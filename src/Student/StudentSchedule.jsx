// src/pages/student/StudentSchedule.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  MapPin,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

const TERM_CODES = ["1st Sem", "2nd Sem"];
const DEFAULT_TERM_CODE = "1st Sem";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${pad2(m)} ${ampm}`;
}
function formatDateLong(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfWeekMon(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // Sun=0
  const diffToMon = (day + 6) % 7;
  return addDays(x, -diffToMon);
}
function endOfWeekSun(d) {
  return endOfDay(addDays(startOfWeekMon(d), 6));
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function dayIndexToCode(idx) {
  // JS: Sun=0 ... Sat=6
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx];
}
function hhmmToParts(t) {
  // t could be "13:00:00" or "13:00"
  const s = String(t);
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(3, 5), 10);
  return { hh, mm };
}

function Select({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {label}: {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Convert recurring schedule rows (day_of_week + start_time/end_time)
 * into concrete events for a given date range.
 */
function materializeSchedule(scheduleRows, rangeStart, rangeEnd) {
  const days = [];
  let cur = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);

  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }

  const events = [];
  for (const d of days) {
    const dow = dayIndexToCode(d.getDay()); // "Mon", "Tue", etc.
    const rowsForDay = scheduleRows.filter((r) => r.day_of_week === dow);

    for (const r of rowsForDay) {
      const { hh: sh, mm: sm } = hhmmToParts(r.start_time);
      const { hh: eh, mm: em } = hhmmToParts(r.end_time);

      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm);
      const endDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);

      events.push({
        id: r.schedule_id,
        date: startOfDay(d),
        start,
        end: endDt,
        subject: r.subjects?.subject_title ?? "—",
        code: r.subjects?.subject_code ?? "—",
        teacher: r.teachers ? `${r.teachers.first_name ?? ""} ${r.teachers.last_name ?? ""}`.trim() : "—",
        room: r.room ?? "—",
        period_no: r.period_no,
        day_of_week: r.day_of_week,
        _raw: r,
      });
    }
  }

  // sort by start time
  events.sort((a, b) => a.start - b.start);
  return events;
}

export default function StudentSchedule() {
  const [tab, setTab] = useState("Today"); // Today | Week | Month
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [termCode, setTermCode] = useState(DEFAULT_TERM_CODE);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [activeSY, setActiveSY] = useState(null); // { sy_id, sy_code }
  const [student, setStudent] = useState(null); // { section_id, ... }
  const [scheduleRows, setScheduleRows] = useState([]); // raw recurring rows

  const now = new Date();

  // Load active SY + student record once, and reload schedule when term changes
  useEffect(() => {
    let alive = true;

    async function loadBase() {
      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (alive) setErr(authErr.message);
        if (alive) setLoading(false);
        return;
      }
      const user = authData?.user;
      if (!user) {
        if (alive) setErr("Not authenticated.");
        if (alive) setLoading(false);
        return;
      }

      // Active school year
      const { data: syRow, error: syErr } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (syErr) {
        if (alive) setErr(syErr.message);
        if (alive) setLoading(false);
        return;
      }
      if (!syRow?.sy_id) {
        if (alive) setErr("No Active school year found.");
        if (alive) setLoading(false);
        return;
      }
      if (alive) setActiveSY({ sy_id: syRow.sy_id, sy_code: syRow.sy_code });

      // Student record (must exist)
      const { data: studentRow, error: studErr } = await supabase
        .from("students")
        .select("id, user_id, student_number, section_id, status, grade_id, strand_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (studErr) {
        if (alive) setErr(studErr.message);
        if (alive) setLoading(false);
        return;
      }
      if (!studentRow?.section_id) {
        if (alive) setErr("Student record not found or missing section_id.");
        if (alive) setLoading(false);
        return;
      }
      if (alive) setStudent(studentRow);

      if (alive) setLoading(false);
    }

    loadBase();
    return () => {
      alive = false;
    };
  }, []);

  // Load recurring schedule rows for the student's section (active SY + selected term)
  useEffect(() => {
    let alive = true;

    async function loadSchedules() {
      if (!activeSY?.sy_id || !student?.section_id || !termCode) return;

      setLoading(true);
      setErr(null);

      const { data: termRow, error: termErr } = await supabase
        .from("terms")
        .select("term_id, term_code")
        .eq("term_code", termCode)
        .limit(1)
        .maybeSingle();

      if (termErr) {
        if (alive) setErr(termErr.message);
        if (alive) setLoading(false);
        return;
      }
      if (!termRow?.term_id) {
        if (alive) setErr(`Term not found: ${termCode}`);
        if (alive) setLoading(false);
        return;
      }

      // section_schedules for student's section
      const { data, error } = await supabase
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
          room,
          subject_id,
          teacher_id,
          subjects:subject_id (
            subject_id,
            subject_code,
            subject_title
          ),
          teachers:teacher_id (
            user_id,
            first_name,
            last_name,
            employee_number
          )
        `
        )
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", termRow.term_id)
        .eq("section_id", student.section_id);

      if (error) {
        if (alive) setErr(error.message);
        if (alive) setLoading(false);
        return;
      }

      if (alive) setScheduleRows(data ?? []);
      if (alive) setLoading(false);
    }

    loadSchedules();

    return () => {
      alive = false;
    };
  }, [activeSY?.sy_id, student?.section_id, termCode]);

  // Range calculations
  const weekRange = useMemo(() => {
    const start = startOfWeekMon(selectedDate);
    const end = endOfWeekSun(selectedDate);
    return { start, end };
  }, [selectedDate]);

  const monthRange = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return { start, end };
  }, [selectedDate]);

  // Materialize events for week + month so UI works naturally
  const weekEvents = useMemo(() => {
    return materializeSchedule(scheduleRows, weekRange.start, weekRange.end);
  }, [scheduleRows, weekRange]);

  const monthEvents = useMemo(() => {
    return materializeSchedule(scheduleRows, monthRange.start, monthRange.end);
  }, [scheduleRows, monthRange]);

  const todayItems = useMemo(() => {
    const list = materializeSchedule(scheduleRows, selectedDate, selectedDate);
    return list.sort((a, b) => a.start - b.start);
  }, [scheduleRows, selectedDate]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Schedule
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              View your classes by day, week, or month
              {activeSY?.sy_code ? ` • SY ${activeSY.sy_code}` : ""}
              {termCode ? ` • ${termCode}` : ""}
            </div>
            {err ? (
              <div className="mt-2 text-xs font-semibold text-red-600">
                Error: {err}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Term combo */}
            <Select value={termCode} onChange={setTermCode} options={TERM_CODES} label="Term" />
            {["Today", "Week", "Month"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: BRAND.stroke,
                  background: tab === t ? BRAND.softGoldBg : "white",
                  color: BRAND.brown,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date controls */}
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
              style={{ borderColor: BRAND.stroke }}
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
              style={{ borderColor: BRAND.stroke }}
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5" style={{ color: BRAND.muted }} />
            </button>

            <div
              className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {formatDateLong(selectedDate)}
            </div>
          </div>

          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {loading ? (
              <>Loading…</>
            ) : (
              <>
                Current time:{" "}
                <span style={{ color: BRAND.brown }}>{formatTime(now)}</span>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {tab === "Today" ? (
        <TodayView items={todayItems} selectedDate={selectedDate} now={now} loading={loading} />
      ) : tab === "Week" ? (
        <WeekView
          items={weekEvents}
          range={weekRange}
          selectedDate={selectedDate}
          onJump={setSelectedDate}
          loading={loading}
        />
      ) : (
        <MonthView
          items={monthEvents}
          selectedDate={selectedDate}
          onPick={setSelectedDate}
          loading={loading}
        />
      )}
    </div>
  );
}

function TodayView({ items, selectedDate, now, loading }) {
  const enriched = items.map((x) => {
    let status = "Upcoming";
    if (now >= x.start && now <= x.end) status = "In Progress";
    if (now > x.end) status = "Completed";
    return { ...x, status };
  });

  const nextClass = enriched.find((x) => x.start > now);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Today View
        </div>
        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
          {loading ? (
            <>Loading…</>
          ) : nextClass ? (
            <>
              Next class:{" "}
              <span style={{ color: BRAND.brown }}>
                {nextClass.code} • {formatTime(nextClass.start)}
              </span>
            </>
          ) : (
            <>No upcoming classes today</>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!loading && enriched.length === 0 ? (
          <div className="rounded-2xl border bg-white p-5 text-center" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              No classes scheduled
            </div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              Enjoy your day off 😊
            </div>
          </div>
        ) : (
          enriched.map((c) => (
            <div
              key={`${c.id}-${c.start.toISOString()}`}
              className="rounded-2xl border bg-white p-4 transition"
              style={{ borderColor: BRAND.stroke }}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {formatTime(c.start)} — {formatTime(c.end)}
                  </div>
                  <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                    {c.subject} <span className="font-black" style={{ color: BRAND.muted }}>•</span> {c.code}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      <span>{c.teacher}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{c.room}</span>
                    </div>
                  </div>
                </div>

                <span
                  className="w-fit rounded-full px-3 py-1 text-[11px] font-extrabold"
                  style={{
                    background:
                      c.status === "Upcoming"
                        ? BRAND.softGoldBg
                        : c.status === "In Progress"
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(107,114,128,0.12)",
                    color: BRAND.brown,
                  }}
                >
                  {c.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <button
                  className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                  onClick={() => alert("View details (wire later)")}
                >
                  View Details
                </button>
                <button
                  className="rounded-2xl py-2 text-sm font-semibold transition"
                  style={{
                    background: BRAND.gold,
                    color: BRAND.brown,
                    boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                  onClick={() => alert("Mark attendance (optional later)")}
                >
                  Mark Attendance (Optional)
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function WeekView({ items, range, selectedDate, onJump, loading }) {
  const days = useMemo(() => {
    const arr = [];
    const start = startOfDay(range.start);
    for (let i = 0; i < 7; i++) arr.push(addDays(start, i));
    return arr;
  }, [range]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Week View
        </div>
        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
          {range.start.toLocaleDateString()} — {range.end.toLocaleDateString()}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const dayItems = items.filter((x) => sameDay(x.date, d));
          const active = sameDay(d, selectedDate);
          return (
            <button
              key={d.toISOString()}
              className="rounded-2xl border p-3 text-left transition hover:bg-black/5"
              style={{
                borderColor: BRAND.stroke,
                background: active ? BRAND.softGoldBg : "white",
              }}
              onClick={() => onJump(d)}
              disabled={loading}
            >
              <div className="text-xs font-extrabold" style={{ color: BRAND.brown }}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>

              <div className="mt-2 space-y-2">
                {!loading && dayItems.length === 0 ? (
                  <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                    No classes
                  </div>
                ) : (
                  dayItems.slice(0, 3).map((c) => (
                    <div
                      key={`${c.id}-${c.start.toISOString()}`}
                      className="rounded-xl border px-2 py-2"
                      style={{ borderColor: BRAND.stroke, background: "rgba(255,255,255,0.75)" }}
                    >
                      <div className="text-[11px] font-extrabold" style={{ color: BRAND.brown }}>
                        {c.code}
                      </div>
                      <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                        {formatTime(c.start)}
                      </div>
                    </div>
                  ))
                )}
                {!loading && dayItems.length > 3 ? (
                  <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                    +{dayItems.length - 3} more
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: BRAND.brown }}>
          <CalendarDays className="h-5 w-5" style={{ color: BRAND.muted }} />
          Selected day details
        </div>

        <div className="mt-3 space-y-2">
          {!loading && items.filter((x) => sameDay(x.date, selectedDate)).length === 0 ? (
            <div className="text-sm" style={{ color: BRAND.muted }}>
              No classes on this day.
            </div>
          ) : (
            items
              .filter((x) => sameDay(x.date, selectedDate))
              .map((c) => (
                <div
                  key={`${c.id}-${c.start.toISOString()}`}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: BRAND.stroke }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                        <span className="inline-flex items-center gap-2">
                          <Clock className="h-4 w-4" /> {formatTime(c.start)} — {formatTime(c.end)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        {c.subject} • {c.code}
                      </div>
                      <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {c.teacher} • {c.room}
                      </div>
                    </div>
                    <button
                      className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => alert("View details (wire later)")}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MonthView({ items, selectedDate, onPick, loading }) {
  const [cursor, setCursor] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const grid = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDay = start.getDay(); // Sun=0
    const cells = [];
    let dayNum = 1 - startDay;
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
      dayNum++;
    }
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Month View
        </div>

        <div className="flex items-center gap-2">
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>
          <div
            className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {monthLabel}
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const hasClasses = items.some((x) => sameDay(x.date, d));
          const isSel = sameDay(d, selectedDate);
          const isToday = sameDay(d, new Date());

          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className="rounded-2xl border p-2 text-left transition hover:bg-black/5"
              style={{
                borderColor: BRAND.stroke,
                background: isSel ? BRAND.softGoldBg : "white",
                opacity: inMonth ? 1 : 0.45,
              }}
              disabled={loading}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                  {d.getDate()}
                </div>
                {isToday ? (
                  <span
                    className="rounded-full px-2 py-[2px] text-[10px] font-extrabold"
                    style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                  >
                    Today
                  </span>
                ) : null}
              </div>

              {hasClasses ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: BRAND.gold }} />
                  <span className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                    Classes
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                  —
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Selected Date
        </div>
        <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
          {formatDateLong(selectedDate)}
        </div>

        <div className="mt-3 space-y-2">
          {!loading && items.filter((x) => sameDay(x.date, selectedDate)).length === 0 ? (
            <div className="text-sm" style={{ color: BRAND.muted }}>
              No classes scheduled.
            </div>
          ) : (
            items
              .filter((x) => sameDay(x.date, selectedDate))
              .sort((a, b) => a.start - b.start)
              .map((c) => (
                <div
                  key={`${c.id}-${c.start.toISOString()}`}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: BRAND.stroke }}
                >
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {formatTime(c.start)} — {formatTime(c.end)}
                  </div>
                  <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                    {c.subject} • {c.code}
                  </div>
                  <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {c.teacher} • {c.room}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
