// src/pages/teacher/TeacherDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Users,
  Upload,
  Sparkles,
  Megaphone,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import CalendarWidget from "../components/CalendarWidget";

const BRAND = {
  gold: "#d4a62f",
  ink: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.08)",
};

function CardShell({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border bg-white ${className}`}
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      {children}
    </div>
  );
}

// ---------- helpers ----------
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cleanTime(t) {
  if (!t) return "";
  return String(t).split(".")[0]; // "13:00:00" or "13:00:00.000"
}

function to12h(t) {
  const tt = cleanTime(t);
  if (!tt || tt.length < 5) return "—";
  const hh = Number(tt.slice(0, 2));
  const mm = tt.slice(3, 5);
  const ampm = hh >= 12 ? "PM" : "AM";
  let h = hh % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}

function formatTimeRange(startTime, endTime) {
  return `${to12h(startTime)}–${to12h(endTime)}`;
}

function timeToMinutes(t) {
  const tt = cleanTime(t);
  if (!tt || tt.length < 5) return 0;
  const hh = Number(tt.slice(0, 2));
  const mm = Number(tt.slice(3, 5));
  return hh * 60 + mm;
}

/**
 * Picks current sy_id + term_id by frequency in the teacher’s schedule rows.
 * (More reliable than using a separate "classes" table that might not match your real source.)
 */
function chooseCurrentSyTermFromSchedules(scheduleRows) {
  const freq = new Map();
  for (const r of scheduleRows || []) {
    if (!r.sy_id || !r.term_id) continue;
    const key = `${r.sy_id}::${r.term_id}`;
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [k, v] of freq.entries()) {
    if (v > bestCount) {
      bestCount = v;
      best = k;
    }
  }
  if (!best) return { sy_id: null, term_id: null };
  const [sy_id, term_id] = best.split("::");
  return { sy_id, term_id };
}

function buildHighlightedDaysForMonth(year, monthIndex, teacherWeekdaysSet) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const highlighted = new Set();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = DOW[new Date(year, monthIndex, d).getDay()];
    if (teacherWeekdaysSet.has(dow)) highlighted.add(d);
  }
  return highlighted;
}

function sectionLabelFromRow(sectionRow) {
  return sectionRow?.section_name || "Section";
}
// ---------- end helpers ----------

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [teacher, setTeacher] = useState(null);

  // NOTE: We derive “classes” from section_schedules (your real source).
  // We keep this array only to show stats and “Total Classes” count.
  const [classes, setClasses] = useState([]); // unique by section_id + subject_id (per SY+Term)
  const [studentsAcrossClasses, setStudentsAcrossClasses] = useState(0);

  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [nextClassSub, setNextClassSub] = useState("—");
  const [todaysClassesCount, setTodaysClassesCount] = useState("—");
  const [upcomingLabel, setUpcomingLabel] = useState({ value: "—", sub: "—" });

  const [announcements, setAnnouncements] = useState([]);
  const [calendarHighlighted, setCalendarHighlighted] = useState(new Set());

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // 1) current user
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = authData?.user;
        if (!user?.id) throw new Error("Not logged in.");

        // 2) profile / role check (resilient)
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, role, is_active, is_archived")
          .eq("user_id", user.id)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!profile) throw new Error("Profile not found.");
        if (String(profile.role).toLowerCase() !== "teacher") throw new Error("This account is not a teacher.");
        if (profile.is_active === false || profile.is_archived === true)
          throw new Error("Teacher account is inactive/archived.");

        // 3) teacher record (optional)
        const { data: teacherRow } = await supabase
          .from("teachers")
          .select("user_id, first_name, last_name, employee_number, department, status, is_archived")
          .eq("user_id", user.id)
          .maybeSingle();

        // 4) Active school year (optional, but helps when picking data)
        const { data: activeSY, error: syErr } = await supabase
          .from("school_years")
          .select("sy_id, sy_code, status, start_date")
          .eq("status", "Active")
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (syErr) throw syErr;

        // 5) load ALL schedules for teacher (for class count + current term inference)
        // If you always want to scope to activeSY, keep the filter.
        let allSchedQ = supabase
          .from("section_schedules")
          .select(
            `
            schedule_id,
            sy_id,
            term_id,
            section_id,
            subject_id,
            teacher_id,
            day_of_week,
            start_time,
            end_time,
            room,
            subjects:subject_id ( subject_id, subject_code, subject_title ),
            sections:section_id ( section_id, section_name )
          `
          )
          .eq("teacher_id", user.id);

        if (activeSY?.sy_id) allSchedQ = allSchedQ.eq("sy_id", activeSY.sy_id);

        const { data: allSchedRows, error: allSchedErr } = await allSchedQ;
        if (allSchedErr) throw allSchedErr;

        // infer current term based on schedule frequency (within active SY)
        const { sy_id: currentSyId, term_id: currentTermId } =
          chooseCurrentSyTermFromSchedules(allSchedRows || []);

        // 6) build unique “classes” from schedules (section_id + subject_id)
        const scheduleRows = allSchedRows || [];
        const classKeyMap = new Map();
        for (const r of scheduleRows) {
          const k = `${r.section_id}:${r.subject_id}`;
          if (!classKeyMap.has(k)) classKeyMap.set(k, r);
        }
        const derivedClasses = Array.from(classKeyMap.entries()).map(([k, r]) => ({
          id: k,
          section_id: r.section_id,
          subject_id: r.subject_id,
          sy_id: r.sy_id,
          term_id: r.term_id,
          subject_code: r.subjects?.subject_code ?? "—",
          subject_title: r.subjects?.subject_title ?? "—",
          section_name: r.sections?.section_name ?? "—",
        }));

        // 7) students across teacher’s sections (Enrolled only; scoped to active SY if present)
        const sectionIds = Array.from(new Set(derivedClasses.map((c) => c.section_id).filter(Boolean)));
        let studentCount = 0;

        if (sectionIds.length) {
          let studQ = supabase
            .from("students")
            .select("id, section_id, status, sy_id")
            .in("section_id", sectionIds)
            .eq("status", "Enrolled");

          if (currentSyId) studQ = studQ.eq("sy_id", currentSyId);

          const { data: studentRows, error: sErr } = await studQ;
          if (sErr) throw sErr;

          studentCount = new Set((studentRows || []).map((s) => s.id)).size;
        }

        // 8) today's schedule (scoped to inferred current SY+term if present)
        const now = new Date();
        const todayDow = DOW[now.getDay()];
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        let todaySchedQ = supabase
          .from("section_schedules")
          .select(
            `
            schedule_id,
            sy_id,
            term_id,
            section_id,
            day_of_week,
            period_no,
            start_time,
            end_time,
            teacher_id,
            room,
            subjects:subject_id ( subject_id, subject_title, subject_code ),
            sections:section_id ( section_id, section_name )
          `
          )
          .eq("teacher_id", user.id)
          .eq("day_of_week", todayDow)
          .order("start_time", { ascending: true });

        if (currentSyId) todaySchedQ = todaySchedQ.eq("sy_id", currentSyId);
        if (currentTermId) todaySchedQ = todaySchedQ.eq("term_id", currentTermId);

        const { data: schedRows, error: scErr } = await todaySchedQ;
        if (scErr) throw scErr;

        // student count per today sections
        const todaySectionIds = Array.from(new Set((schedRows || []).map((r) => r.section_id).filter(Boolean)));
        const sectionStudentCount = new Map();

        if (todaySectionIds.length) {
          let stQ = supabase
            .from("students")
            .select("id, section_id, status, sy_id")
            .in("section_id", todaySectionIds)
            .eq("status", "Enrolled");

          if (currentSyId) stQ = stQ.eq("sy_id", currentSyId);

          const { data: todayStudents, error: tsErr } = await stQ;
          if (tsErr) throw tsErr;

          for (const s of todayStudents || []) {
            sectionStudentCount.set(s.section_id, (sectionStudentCount.get(s.section_id) || 0) + 1);
          }
        }

        const uiSchedule = (schedRows || []).map((r) => ({
          schedule_id: r.schedule_id,
          section_id: r.section_id,
          _start: r.start_time,
          _end: r.end_time,
          time: formatTimeRange(r.start_time, r.end_time),
          subject: r.subjects?.subject_title ?? "Subject",
          class: sectionLabelFromRow(r.sections),
          room: r.room || "—",
          count: sectionStudentCount.get(r.section_id) ?? 0,
          period_no: r.period_no,
        }));

        const todayCount = uiSchedule.length;
        const next = uiSchedule.find((x) => timeToMinutes(x._start) > nowMinutes);

        const nextSub = next ? `Next: ${to12h(next._start)}` : "No more today";
        const upcoming = next ? { value: to12h(next._start), sub: next.class } : { value: "—", sub: "No more today" };

        // 9) calendar dots: teacher class weekdays + calendar_events (audience All/Teachers)
        let weekdayQ = supabase.from("section_schedules").select("day_of_week").eq("teacher_id", user.id);
        if (currentSyId) weekdayQ = weekdayQ.eq("sy_id", currentSyId);
        if (currentTermId) weekdayQ = weekdayQ.eq("term_id", currentTermId);

        const { data: weekdaysRows, error: wdErr } = await weekdayQ;
        if (wdErr) throw wdErr;

        const teacherWeekdaysSet = new Set((weekdaysRows || []).map((r) => r.day_of_week));
        const year = now.getFullYear();
        const month = now.getMonth();
        const classDayDots = buildHighlightedDaysForMonth(year, month, teacherWeekdaysSet);

        const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
        const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        const { data: calEvents, error: ceErr } = await supabase
          .from("calendar_events")
          .select("id, start_date, end_date, is_deleted, audiences")
          .eq("is_deleted", false)
          .lte("start_date", monthEnd)
          .or(`end_date.gte.${monthStart},end_date.is.null`)
          .order("start_date", { ascending: true });

        if (ceErr) throw ceErr;

        const eventDots = new Set();
        for (const ev of calEvents || []) {
          const audiences = ev.audiences || ["All"];
          const visible =
            audiences.includes("All") || audiences.includes("Teachers") || audiences.includes("All Teachers");
          if (!visible) continue;

          const start = new Date(`${ev.start_date}T00:00:00`);
          const end = new Date(`${(ev.end_date || ev.start_date)}T00:00:00`);
          const monthStartDate = new Date(year, month, 1);
          const monthEndDate = new Date(year, month + 1, 0);

          const clampStart = new Date(Math.max(start.getTime(), monthStartDate.getTime()));
          const clampEnd = new Date(Math.min(end.getTime(), monthEndDate.getTime()));

          for (let d = new Date(clampStart); d <= clampEnd; d.setDate(d.getDate() + 1)) {
            if (d.getMonth() === month) eventDots.add(d.getDate());
          }
        }

        const mergedDots = new Set([...classDayDots, ...eventDots]);

        // 10) announcements (Published teacher-facing)
        // If you later want section/subject-targeted announcements, we can expand this.
        const { data: annRows, error: aErr } = await supabase
          .from("announcements")
          .select("id, title, content, posted_at, status, is_archived, target_audience")
          .eq("status", "Published")
          .eq("is_archived", false)
          .in("target_audience", ["All Teachers", "Teachers", "All"])
          .order("posted_at", { ascending: false })
          .limit(3);

        if (aErr) throw aErr;

        if (!mounted) return;

        setTeacher({ ...profile, ...(teacherRow || {}) });
        setClasses(derivedClasses);
        setStudentsAcrossClasses(studentCount);

        setTodaysSchedule(uiSchedule);
        setTodaysClassesCount(todayCount);
        setNextClassSub(nextSub);
        setUpcomingLabel(upcoming);

        setCalendarHighlighted(mergedDots);

        setAnnouncements(
          (annRows || []).map((a) => ({
            id: a.id,
            title: a.title,
            date: a.posted_at
              ? new Date(a.posted_at).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
              : "—",
            body: a.content,
          }))
        );
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load dashboard.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Lessons/activity not provided yet → keep routes, show placeholders
  const pendingLessons = "—";
  const activity = [];

  const stats = useMemo(
    () => [
      { label: "Total Classes", value: loading ? "…" : classes.length, icon: GraduationCap },
      {
        label: "Today's Classes",
        value: loading ? "…" : todaysClassesCount,
        icon: CalendarDays,
        sub: loading ? "…" : nextClassSub,
      },
      { label: "Pending Lessons", value: pendingLessons, icon: BookOpen, sub: "See Lessons" },
      { label: "Students", value: loading ? "…" : studentsAcrossClasses, icon: Users, sub: "Across classes" },
      {
        label: "Upcoming Schedule",
        value: loading ? "…" : upcomingLabel.value,
        icon: Clock,
        sub: loading ? "…" : upcomingLabel.sub,
      },
    ],
    [loading, classes.length, todaysClassesCount, nextClassSub, pendingLessons, studentsAcrossClasses, upcomingLabel]
  );

  return (
    <div className="space-y-6">
      {err ? (
        <CardShell>
          <div className="p-4 md:p-5">
            <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
              Couldn’t load dashboard
            </div>
            <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
              {err}
            </div>
          </div>
        </CardShell>
      ) : null}

      {/* Overview cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: idx * 0.03 }}
            >
              <CardShell>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {s.label}
                      </div>
                      <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.ink }}>
                        {s.value}
                      </div>
                      {s.sub ? (
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {s.sub}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                      style={{ borderColor: "rgba(212,166,47,0.35)" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: BRAND.gold }} />
                    </div>
                  </div>
                </div>
              </CardShell>
            </motion.div>
          );
        })}
      </div>

      {/* Quick actions */}
      <CardShell>
        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                Quick Access
              </div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Common actions you can do right now
              </div>
            </div>

            {teacher?.full_name ? (
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Signed in as {teacher.full_name}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActionButton icon={Upload} label="Upload New Lesson" primary onClick={() => navigate("/teacher/lessons")} />
            <ActionButton icon={Sparkles} label="AI Lesson Planner ✨" primary onClick={() => navigate("/teacher/lessons")} />
            <ActionButton
              icon={CalendarDays}
              label="View Today's Schedule"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                navigate(`/teacher/schedule?date=${encodeURIComponent(today)}`);
              }}
            />
            <ActionButton icon={Megaphone} label="Create Announcement" onClick={() => navigate("/teacher/announcements")} />
          </div>
        </div>
      </CardShell>

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Today's schedule */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                    Today's Schedule
                  </div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Your classes for today
                  </div>
                </div>

                <button
                  className="rounded-2xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  style={{ color: BRAND.gold }}
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    navigate(`/teacher/schedule?date=${encodeURIComponent(today)}`);
                  }}
                  type="button"
                >
                  View Full
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {todaysSchedule.length ? (
                  todaysSchedule.map((c) => (
                    <div key={c.schedule_id} className="rounded-2xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                            {c.time}
                          </div>
                          <div className="mt-0.5 text-sm font-extrabold truncate" style={{ color: BRAND.ink }}>
                            {c.subject} • {c.class}
                          </div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                            {c.room} • {c.count} students
                          </div>
                        </div>

                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-black/5"
                          style={{ borderColor: "rgba(212,166,47,0.55)", color: BRAND.ink }}
                          onClick={() => navigate(`/teacher/schedule?scheduleId=${encodeURIComponent(c.schedule_id)}`)}
                          type="button"
                        >
                          View Details <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border bg-white p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                    {loading ? "Loading schedule…" : "No classes scheduled today."}
                  </div>
                )}
              </div>
            </div>
          </CardShell>

          {/* Recent activity */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                    Recent Activity
                  </div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Latest updates from your work
                  </div>
                </div>

                <button
                  className="rounded-2xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  style={{ color: BRAND.gold }}
                  onClick={() => navigate("/teacher/lessons")}
                  type="button"
                >
                  Open Lessons
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {activity.length ? (
                  activity.map((a, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-4 rounded-2xl border bg-white px-4 py-3"
                      style={{ borderColor: BRAND.stroke }}
                    >
                      <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                        {a.what}
                      </div>
                      <div className="shrink-0 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {a.when}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border bg-white p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                    Activity will appear here once lessons/submissions tables are wired.
                  </div>
                )}
              </div>
            </div>
          </CardShell>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Announcements preview */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                    Announcements
                  </div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Latest from admin
                  </div>
                </div>

                <button
                  className="rounded-2xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  style={{ color: BRAND.gold }}
                  onClick={() => navigate("/teacher/announcements")}
                  type="button"
                >
                  View All
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {announcements.length ? (
                  announcements.map((an) => (
                    <button
                      key={an.id}
                      className="w-full text-left rounded-2xl border bg-white p-4 hover:bg-black/5"
                      style={{ borderColor: BRAND.stroke }}
                      onClick={() => navigate(`/teacher/announcements?announcementId=${encodeURIComponent(an.id)}`)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate" style={{ color: BRAND.ink }}>
                            {an.title}
                          </div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                            {an.body}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {an.date}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border bg-white p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                    {loading ? "Loading announcements…" : "No published announcements."}
                  </div>
                )}
              </div>
            </div>
          </CardShell>

          {/* Calendar widget */}
          <CalendarWidget
            highlighted={calendarHighlighted}
            onDayClick={(dateObj) => {
              const date = dateObj.toISOString().slice(0, 10);
              navigate(`/teacher/schedule?date=${encodeURIComponent(date)}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary = false }) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition " +
        (primary ? "hover:-translate-y-[1px]" : "hover:bg-black/5")
      }
      style={{
        borderColor: primary ? "rgba(212,166,47,0.55)" : BRAND.stroke,
        background: primary ? "rgba(212,166,47,0.18)" : "white",
      }}
      type="button"
    >
      <div>
        <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
          {label}
        </div>
        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
          {primary ? "Recommended" : "Open"}
        </div>
      </div>
      <div
        className="grid h-10 w-10 place-items-center rounded-2xl border bg-white"
        style={{ borderColor: primary ? "rgba(212,166,47,0.55)" : BRAND.stroke }}
      >
        <Icon className="h-5 w-5" style={{ color: primary ? BRAND.gold : "rgba(43,26,18,0.65)" }} />
      </div>
    </button>
  );
}
