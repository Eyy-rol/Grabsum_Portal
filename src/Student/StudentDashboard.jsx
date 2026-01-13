// src/pages/student/StudentDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// ✅ Supabase-powered calendar widget
import CalendarWidget from "../components/CalendarWidget"; // adjust if your folders differ

const BRAND = {
  brown: "rgba(43,26,18,0.95)",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  softGoldRing: "rgba(212,166,47,0.18)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

// ✅ Frontend-generated tips (random per login/session)
const TIPS = [
  "Review your lessons for 10 minutes before class.",
  "Write down 3 key points after every lesson.",
  "Prepare your bag the night before to avoid rushing.",
  "Use 25 minutes focus + 5 minutes break (Pomodoro).",
  "Ask one question in class today—even a small one.",
  "Read your notes aloud to remember them faster.",
  "Start assignments early—finish the easiest part first.",
  "Sleep early. Your brain learns better with rest.",
  "Turn off notifications while studying for better focus.",
  "Summarize today’s lesson in 2–3 sentences.",
];

function pickRandomTipPerSession() {
  const key = "student_dashboard_tip";
  const saved = sessionStorage.getItem(key);
  if (saved) return saved;

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  sessionStorage.setItem(key, tip);
  return tip;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTime(d) {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function msToCountdown(ms) {
  if (ms <= 0) return "Now";
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  if (hh > 0) return `${hh}h ${mm}m`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function previewText(s, max = 80) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trimEnd() + "..." : t;
}

// ✅ day-of-week mapper (JS -> your table’s Mon/Tue/... format)
function jsDayToDow3(d) {
  // JS: 0 Sun, 1 Mon ... 6 Sat
  const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[d.getDay()];
}

// ✅ combine today's date with Postgres time (HH:MM:SS)
function combineDateAndTime(dateObj, timeStr) {
  const [hh = "0", mm = "0", ss = "0"] = (timeStr || "00:00:00").split(":");
  const x = new Date(dateObj);
  x.setHours(Number(hh), Number(mm), Number(ss), 0);
  return x;
}

export default function StudentDashboard() {
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());

  // ✅ Welcome name
  const [studentName, setStudentName] = useState("Student");
  const [loadingStudent, setLoadingStudent] = useState(true);

  // ✅ Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // ✅ Tip of the day (random per session / login)
  const [tip, setTip] = useState("");

  // ✅ Schedule (Supabase)
  const [todaysClasses, setTodaysClasses] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // ✅ Lessons (Supabase)
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);

  // ✅ Stats (computed)
  const [stats, setStats] = useState({
    totalCourses: 0,
    todaysClasses: 0,
    pendingAssignments: 0, // placeholder until you wire assignments table
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // pick a tip once per session
  useEffect(() => {
    setTip(pickRandomTipPerSession());
  }, []);

  // OPTIONAL: NEW tip on every SIGNED_IN event
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        sessionStorage.removeItem("student_dashboard_tip");
        setTip(pickRandomTipPerSession());
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoadingStudent(true);
      setLoadingAnnouncements(true);
      setLoadingSchedule(true);
      setLoadingLessons(true);

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (authErr || !user) {
        setStudentName("Student");
        setAnnouncements([]);
        setTodaysClasses([]);
        setLessons([]);
        setStats({ totalCourses: 0, todaysClasses: 0, pendingAssignments: 0 });

        setLoadingStudent(false);
        setLoadingAnnouncements(false);
        setLoadingSchedule(false);
        setLoadingLessons(false);
        return;
      }

      // 1) Student row (for section + grade/track/strand filters)
      const { data: studentRow } = await supabase
        .from("students")
        .select("first_name, section_id, grade_id, track_id, strand_id, sy_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // 2) Profile row fallback name
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      const name =
        (studentRow?.first_name && studentRow.first_name.trim()) ||
        (profileRow?.full_name && profileRow.full_name.trim()) ||
        "Student";

      setStudentName(name);
      setLoadingStudent(false);

      // ===== Announcements (All Students + Section Students) =====
      const baseAnnQuery = supabase
        .from("announcements")
        .select(
          "id, title, content, priority, posted_at, posted_by, target_audience, section_id"
        )
        .eq("status", "Published")
        .eq("is_archived", false)
        .order("posted_at", { ascending: false })
        .limit(3);

      const annQuery = studentRow?.section_id
        ? baseAnnQuery.or(
            `target_audience.eq.All Students,and(target_audience.eq.Section Students,section_id.eq.${studentRow.section_id})`
          )
        : baseAnnQuery.eq("target_audience", "All Students");

      const { data: annRows, error: annErr } = await annQuery;

      if (!isMounted) return;

      if (annErr) {
        setAnnouncements([]);
      } else {
        setAnnouncements(
          (annRows ?? []).map((a) => ({
            id: a.id,
            title: a.title,
            by: "Admin", // can be joined to profiles later
            tag: a.priority,
            preview: previewText(a.content, 80),
            posted_at: a.posted_at,
          }))
        );
      }
      setLoadingAnnouncements(false);

      // ===== Today's Schedule (section_schedules + subjects + teachers) =====
      const dow = jsDayToDow3(new Date());

      if (!studentRow?.section_id || dow === "Sun") {
        setTodaysClasses([]);
        setLoadingSchedule(false);
      } else {
        const { data: schedRows, error: schedErr } = await supabase
          .from("section_schedules") // ✅ correct table name per your schema
          .select(
            `
            schedule_id,
            day_of_week,
            period_no,
            start_time,
            end_time,
            room,
            notes,
            subject_id,
            teacher_id,
            subjects:subjects ( subject_title ),
            teacher:teachers ( first_name, last_name )
          `
          )
          .eq("section_id", studentRow.section_id)
          .eq("day_of_week", dow)
          .order("start_time", { ascending: true });

        if (!isMounted) return;

        if (schedErr) {
          setTodaysClasses([]);
        } else {
          const baseDate = startOfDay(new Date());

          setTodaysClasses(
            (schedRows ?? []).map((r) => {
              const teacherName =
                r?.teacher?.first_name || r?.teacher?.last_name
                  ? `${(r?.teacher?.first_name || "").trim()} ${(
                      r?.teacher?.last_name || ""
                    ).trim()}`.trim()
                  : "—";

              return {
                start: combineDateAndTime(baseDate, r.start_time),
                end: combineDateAndTime(baseDate, r.end_time),
                subject: r?.subjects?.subject_title || "Subject",
                room: r.room || "—",
                teacher: teacherName,
                raw: r,
              };
            })
          );

          setStats((s) => ({ ...s, todaysClasses: (schedRows ?? []).length }));
        }

        setLoadingSchedule(false);
      }

      // ===== Recent Lessons (Published + subjects + teachers) =====
      const { data: lessonRows, error: lessonErr } = await supabase
        .from("lessons")
        .select(
          `
          lesson_id,
          title,
          owner_teacher_id,
          created_at,
          subject_id,
          subjects:subjects ( subject_title ),
          teacher:teachers ( first_name, last_name )
        `
        )
        .eq("status", "Published")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!isMounted) return;

      if (lessonErr) {
        setLessons([]);
      } else {
        setLessons(
          (lessonRows ?? []).map((l) => {
            const teacherName =
              l?.teacher?.first_name || l?.teacher?.last_name
                ? `${(l?.teacher?.first_name || "").trim()} ${(
                    l?.teacher?.last_name || ""
                  ).trim()}`.trim()
                : "Teacher";

            return {
              course: l?.subjects?.subject_title || "Subject",
              title: l.title,
              teacher: teacherName,
              date: l.created_at
                ? new Date(l.created_at).toLocaleDateString()
                : "",
              raw: l,
            };
          })
        );
      }
      setLoadingLessons(false);

      // ===== Stats: totalCourses (distinct subject_id for section) =====
      let totalCourses = 0;

      if (studentRow?.section_id) {
        const { data: courseRows } = await supabase
          .from("section_schedules")
          .select("subject_id")
          .eq("section_id", studentRow.section_id);

        const uniq = new Set(
          (courseRows ?? []).map((r) => r.subject_id).filter(Boolean)
        );
        totalCourses = uniq.size;
      }

      setStats((s) => ({
        ...s,
        totalCourses,
        pendingAssignments: 0, // wire later
      }));
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ next class computed from Supabase-powered todaysClasses
  const nextClass = useMemo(() => {
    const upcoming = (todaysClasses ?? [])
      .filter((c) => c.end > now)
      .sort((a, b) => a.start - b.start);
    return upcoming[0] || null;
  }, [todaysClasses, now]);

  const countdown = useMemo(() => {
    if (!nextClass) return "No more classes today";
    const diff = nextClass.start - now;
    return msToCountdown(diff);
  }, [nextClass, now]);

  // keep stats.todaysClasses accurate when schedule loads
  useEffect(() => {
    setStats((s) => ({ ...s, todaysClasses: todaysClasses.length }));
  }, [todaysClasses.length]);

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: BRAND.muted }}
            >
              {formatDate(now)} • {formatTime(now)}
            </div>

            <div
              className="mt-1 text-2xl font-extrabold"
              style={{ color: BRAND.brown }}
            >
              Welcome back, {loadingStudent ? "..." : studentName}!
            </div>

            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              Tip of the day: {tip || "—"}
            </div>
          </div>

          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: BRAND.stroke,
              background: BRAND.softGoldBg,
            }}
          >
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Next class in
            </div>
            <div
              className="text-lg font-extrabold"
              style={{ color: BRAND.brown }}
            >
              {nextClass ? countdown : "—"}
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              {nextClass
                ? `${nextClass.subject} • ${formatTime(nextClass.start)}`
                : "No upcoming class"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={BookOpen}
          title="Total Courses"
          value={stats.totalCourses}
          hint="Tap Courses to view subjects"
        />
        <StatCard
          icon={Clock}
          title="Today's Classes"
          value={stats.todaysClasses}
          hint={
            nextClass ? `Next: ${formatTime(nextClass.start)}` : "No more classes today"
          }
        />
        <StatCard
          icon={CheckCircle2}
          title="Pending Assignments"
          value={stats.pendingAssignments}
          hint="Due soon"
        />
      </div>

      {/* Two-column main widgets */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        {/* Schedule Widget */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-lg font-extrabold"
                style={{ color: BRAND.brown }}
              >
                Today’s Schedule
              </div>
            </div>

            <button
              className="rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{
                background: BRAND.gold,
                color: BRAND.brown,
                boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = BRAND.goldHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = BRAND.gold)
              }
              onClick={() => navigate("/student/schedule")}
              type="button"
            >
              View Full Schedule
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loadingSchedule ? (
              <div
                className="text-sm font-semibold"
                style={{ color: BRAND.muted }}
              >
                Loading schedule...
              </div>
            ) : todaysClasses.length === 0 ? (
              <div
                className="text-sm font-semibold"
                style={{ color: BRAND.muted }}
              >
                No classes scheduled for today.
              </div>
            ) : (
              todaysClasses.map((c, idx) => {
                const status =
                  now < c.start
                    ? "Upcoming"
                    : now >= c.start && now <= c.end
                    ? "In Progress"
                    : "Completed";

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border p-4"
                    style={{
                      borderColor: BRAND.stroke,
                      background:
                        status === "In Progress"
                          ? "rgba(212,166,47,0.10)"
                          : "rgba(255,255,255,1)",
                    }}
                  >
                    <div className="min-w-[110px]">
                      <div
                        className="text-xs font-semibold"
                        style={{ color: BRAND.muted }}
                      >
                        {formatTime(c.start)} - {formatTime(c.end)}
                      </div>
                      <div
                        className="mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{
                          background:
                            status === "Upcoming"
                              ? "rgba(212,166,47,0.14)"
                              : status === "In Progress"
                              ? "rgba(34,197,94,0.14)"
                              : "rgba(0,0,0,0.06)",
                          color:
                            status === "Upcoming"
                              ? BRAND.brown
                              : status === "In Progress"
                              ? "rgba(22,101,52,0.95)"
                              : "rgba(0,0,0,0.55)",
                        }}
                      >
                        {status}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div
                        className="text-sm font-extrabold"
                        style={{ color: BRAND.brown }}
                      >
                        {c.subject}
                      </div>
                      <div
                        className="mt-1 text-xs font-semibold"
                        style={{ color: BRAND.muted }}
                      >
                        {c.teacher} • {c.room}
                      </div>
                    </div>

                    <button
                      className="rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => navigate("/student/schedule")}
                      type="button"
                    >
                      View Details
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </motion.section>

        {/* Right column: Announcements + Calendar */}
        <div className="space-y-4">
          {/* Announcements */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.03 }}
            className="rounded-3xl border bg-white p-5"
            style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-sm font-extrabold"
                  style={{ color: BRAND.brown }}
                >
                  Announcements
                </div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: BRAND.muted }}
                >
                  Latest updates from Admin
                </div>
              </div>

              <button
                className="text-sm font-extrabold hover:underline"
                style={{ color: BRAND.gold }}
                onClick={() => navigate("/student/announcements")}
                type="button"
              >
                View All
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loadingAnnouncements ? (
                <div
                  className="text-sm font-semibold"
                  style={{ color: BRAND.muted }}
                >
                  Loading announcements...
                </div>
              ) : announcements.length === 0 ? (
                <div
                  className="text-sm font-semibold"
                  style={{ color: BRAND.muted }}
                >
                  No announcements yet.
                </div>
              ) : (
                announcements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: BRAND.stroke }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="text-sm font-extrabold"
                        style={{ color: BRAND.brown }}
                      >
                        {a.title}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{
                          background: BRAND.softGoldBg,
                          color: BRAND.brown,
                        }}
                      >
                        {a.tag}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-xs font-semibold"
                      style={{ color: BRAND.muted }}
                    >
                      Posted by {a.by}
                    </div>
                    <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                      {a.preview}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.section>

          {/* ✅ CalendarWidget */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.06 }}
          >
            <CalendarWidget
              title="Academic Calendar"
              subtitle="Official yearly schedule (read-only)"
            />
          </motion.div>
        </div>
      </div>

      {/* Recent Lessons */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.04 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-sm font-extrabold"
              style={{ color: BRAND.brown }}
            >
              Recent Lessons & Updates
            </div>
            <div
              className="text-xs font-semibold"
              style={{ color: BRAND.muted }}
            >
              Latest uploads from your teachers
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
            style={{ background: BRAND.gold, color: BRAND.brown }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = BRAND.goldHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = BRAND.gold)
            }
            onClick={() => navigate("/student/courses")}
            type="button"
          >
            <Sparkles className="h-4 w-4" />
            View Lessons
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {loadingLessons ? (
            <div
              className="text-sm font-semibold"
              style={{ color: BRAND.muted }}
            >
              Loading lessons...
            </div>
          ) : lessons.length === 0 ? (
            <div
              className="text-sm font-semibold"
              style={{ color: BRAND.muted }}
            >
              No lessons yet.
            </div>
          ) : (
            lessons.map((l, idx) => (
              <div
                key={idx}
                className="rounded-2xl border p-4"
                style={{ borderColor: BRAND.stroke }}
              >
                <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                  {l.course} • {l.date}
                </div>
                <div
                  className="mt-1 text-sm font-extrabold"
                  style={{ color: BRAND.brown }}
                >
                  {l.title}
                </div>
                <div
                  className="mt-1 text-xs font-semibold"
                  style={{ color: BRAND.muted }}
                >
                  {l.teacher}
                </div>

                <button
                  className="mt-3 w-full rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                  onClick={() => navigate("/student/courses")}
                  type="button"
                >
                  View Lesson
                </button>
              </div>
            ))
          )}
        </div>
      </motion.section>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{ background: BRAND.softGoldBg }}
        >
          <Icon className="h-5 w-5" style={{ color: "rgba(43,26,18,0.70)" }} />
        </div>

        <div className="flex-1">
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {title}
          </div>
          <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.brown }}>
            {value}
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            {hint}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
