// src/pages/teacher/TeacherSchedule.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react";
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
const DEFAULT_TERM = "1st Sem";

function pad2(n) { return String(n).padStart(2, "0"); }
function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${pad2(m)} ${ampm}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function formatDateLong(d) {
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function startOfWeekMon(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // Sun=0
  const diffToMon = (day + 6) % 7;
  return addDays(x, -diffToMon);
}
function endOfWeekSun(d) { return endOfDay(addDays(startOfWeekMon(d), 6)); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function dayIndexToCode(idx) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx]; }
function hhmmToParts(t) {
  const s = String(t); // "13:00:00" or "13:00"
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
 * Materialize recurring schedules (day_of_week, start_time, end_time) into concrete events in [rangeStart..rangeEnd].
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
    const dow = dayIndexToCode(d.getDay());
    const rowsForDay = scheduleRows.filter((r) => r.day_of_week === dow);

    for (const r of rowsForDay) {
      const { hh: sh, mm: sm } = hhmmToParts(r.start_time);
      const { hh: eh, mm: em } = hhmmToParts(r.end_time);

      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm);
      const endDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);

      events.push({
        id: `${r.schedule_id}-${start.toISOString()}`,
        date: startOfDay(d),
        start,
        end: endDt,
        subject: r.subjects?.subject_title ?? "—",
        className: r.sections?.section_name ?? "—",
        room: r.room ?? "—",
        students: r._studentCount ?? 0,
        day_of_week: r.day_of_week,
        period_no: r.period_no,
        _raw: r,
      });
    }
  }

  events.sort((a, b) => a.start - b.start);
  return events;
}

export default function TeacherSchedule() {
  const [tab, setTab] = useState("Today");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const [termCode, setTermCode] = useState(DEFAULT_TERM);
  const [activeSY, setActiveSY] = useState(null); // { sy_id, sy_code }
  const [term, setTerm] = useState(null); // { term_id, term_code }
  const [scheduleRows, setScheduleRows] = useState([]); // recurring rows
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const now = new Date();

  // Week + month ranges based on selectedDate (for materialization)
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

  // Load Active SY once
  useEffect(() => {
    let alive = true;
    async function loadSY() {
      setLoading(true);
      setErr(null);

      const { data: syRow, error: syErr } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (syErr) {
        setErr(syErr.message);
        setLoading(false);
        return;
      }
      if (!syRow?.sy_id) {
        setErr("No Active school year found.");
        setLoading(false);
        return;
      }

      setActiveSY({ sy_id: syRow.sy_id, sy_code: syRow.sy_code });
      setLoading(false);
    }
    loadSY();
    return () => { alive = false; };
  }, []);

  // Load Term row whenever termCode changes
  useEffect(() => {
    let alive = true;
    async function loadTerm() {
      setLoading(true);
      setErr(null);

      const { data: tRow, error: tErr } = await supabase
        .from("terms")
        .select("term_id, term_code")
        .eq("term_code", termCode)
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (tErr) {
        setErr(tErr.message);
        setLoading(false);
        return;
      }
      if (!tRow?.term_id) {
        setErr(`Term not found: ${termCode}`);
        setLoading(false);
        return;
      }

      setTerm(tRow);
      setLoading(false);
    }
    loadTerm();
    return () => { alive = false; };
  }, [termCode]);

  // Load teacher schedule rows (recurring) whenever SY/term changes
  useEffect(() => {
    let alive = true;

    async function loadSchedule() {
      if (!activeSY?.sy_id || !term?.term_id) return;

      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (authErr) {
        setErr(authErr.message);
        setLoading(false);
        return;
      }
      const user = authData?.user;
      if (!user) {
        setErr("Not authenticated.");
        setLoading(false);
        return;
      }

      // Fetch schedules for this teacher for active SY + selected term
      const { data, error } = await supabase
        .from("section_schedules")
        .select(`
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
          sections:section_id (
            section_id,
            section_name
          )
        `)
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", term.term_id)
        .eq("teacher_id", user.id);

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];

      // student counts per section (Enrolled only)
      const sectionIds = Array.from(new Set(rows.map((r) => r.section_id).filter(Boolean)));
      let countsMap = new Map();

      if (sectionIds.length > 0) {
        const { data: studentsRows, error: studErr } = await supabase
          .from("students")
          .select("section_id, status")
          .in("section_id", sectionIds)
          .eq("status", "Enrolled");

        if (studErr) {
          // don’t fail the whole page; just show 0 counts
          console.warn("Student count query failed:", studErr.message);
        } else {
          for (const r of studentsRows ?? []) {
            const k = r.section_id;
            countsMap.set(k, (countsMap.get(k) ?? 0) + 1);
          }
        }
      }

      const withCounts = rows.map((r) => ({
        ...r,
        _studentCount: countsMap.get(r.section_id) ?? 0,
      }));

      setScheduleRows(withCounts);
      setSelected(null);
      setLoading(false);
    }

    loadSchedule();
    return () => { alive = false; };
  }, [activeSY?.sy_id, term?.term_id]);

  // Materialize items based on view
  const allMonthItems = useMemo(() => materializeSchedule(scheduleRows, monthRange.start, monthRange.end), [scheduleRows, monthRange]);
  const dayItems = useMemo(() => materializeSchedule(scheduleRows, selectedDate, selectedDate), [scheduleRows, selectedDate]);
  const weekItems = useMemo(() => materializeSchedule(scheduleRows, weekRange.start, weekRange.end), [scheduleRows, weekRange]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
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
              Today / Week / Month view with timeline and details panel
              {activeSY?.sy_code ? ` • SY ${activeSY.sy_code}` : ""}
              {termCode ? ` • ${termCode}` : ""}
            </div>
            {err ? <div className="mt-2 text-xs font-semibold text-red-600">Error: {err}</div> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
              style={{ borderColor: BRAND.stroke }}
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              aria-label="Previous day"
              disabled={loading}
            >
              <ChevronLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
              style={{ borderColor: BRAND.stroke }}
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
              disabled={loading}
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
                Current time: <span style={{ color: BRAND.brown }}>{formatTime(now)}</span>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Main schedule */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          {tab === "Today" ? (
            <TodayTimeline items={dayItems} now={now} onPick={setSelected} loading={loading} />
          ) : tab === "Week" ? (
            <WeekGrid items={weekItems} range={weekRange} onPick={setSelected} loading={loading} />
          ) : (
            <MonthMini items={allMonthItems} selectedDate={selectedDate} onPickDate={setSelectedDate} loading={loading} />
          )}
        </motion.div>

        {/* Details panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Details Panel
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            Click a class block to view full details
          </div>

          <div className="mt-4">
            {selected ? (
              <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                  {selected.subject}
                </div>
                <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  {selected.className}
                </div>

                <div className="mt-4 space-y-2 text-sm" style={{ color: BRAND.muted }}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatTime(selected.start)} — {formatTime(selected.end)}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {selected.room}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {selected.students} students
                  </div>
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-2">
                  <button
                    className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                    style={{ background: BRAND.gold, color: BRAND.brown }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                    onClick={() => alert("Start class (optional later)")}
                  >
                    Start Class
                  </button>
                  <button
                    className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
                    style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                    onClick={() => alert("Open class page (wire later)")}
                  >
                    View Class
                  </button>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <button
                    className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
                    style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                    onClick={() => alert("Mark attendance (optional later)")}
                  >
                    Mark Attendance
                  </button>
                  <button
                    className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
                    style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                    onClick={() => alert("Add notes (optional later)")}
                  >
                    Notes
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
                <CalendarDays className="mx-auto h-7 w-7" style={{ color: BRAND.muted }} />
                <div className="mt-2 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                  No class selected
                </div>
                <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                  Select a class to see details here.
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function TodayTimeline({ items, now, onPick, loading }) {
  return (
    <div>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        Today Timeline
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
        {loading ? "Loading…" : "Click a block to open details."}
      </div>

      <div className="mt-4 space-y-3">
        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              No classes today
            </div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              You’re free today 😊
            </div>
          </div>
        ) : (
          items.map((c) => {
            let status = "Upcoming";
            if (now >= c.start && now <= c.end) status = "In Progress";
            if (now > c.end) status = "Completed";

            return (
              <button
                key={c.id}
                onClick={() => onPick(c)}
                className="w-full rounded-3xl border bg-white p-4 text-left transition hover:-translate-y-[1px]"
                style={{ borderColor: BRAND.stroke }}
                disabled={loading}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                      {formatTime(c.start)} — {formatTime(c.end)}
                    </div>
                    <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                      {c.subject}
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                      {c.className} • {c.room} • {c.students} students
                    </div>
                  </div>

                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                    style={{
                      background:
                        status === "Upcoming"
                          ? BRAND.softGoldBg
                          : status === "In Progress"
                          ? "rgba(34,197,94,0.14)"
                          : "rgba(107,114,128,0.12)",
                      color: BRAND.brown,
                    }}
                  >
                    {status}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function WeekGrid({ items, range, onPick, loading }) {
  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(addDays(range.start, i));
    return arr;
  }, [range]);

  return (
    <div>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        Week View
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
        {range.start.toLocaleDateString()} — {range.end.toLocaleDateString()}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const dayItems = items.filter((x) => sameDay(x.date, d));
          return (
            <div key={d.toISOString()} className="rounded-3xl border p-3" style={{ borderColor: BRAND.stroke }}>
              <div className="text-xs font-extrabold" style={{ color: BRAND.brown }}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>

              <div className="mt-3 space-y-2">
                {!loading && dayItems.length === 0 ? (
                  <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                    No classes
                  </div>
                ) : (
                  dayItems.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onPick(c)}
                      className="w-full rounded-2xl border bg-white/70 px-2 py-2 text-left hover:bg-white"
                      style={{ borderColor: BRAND.stroke }}
                      disabled={loading}
                    >
                      <div className="text-[11px] font-extrabold" style={{ color: BRAND.brown }}>
                        {c.subject}
                      </div>
                      <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                        {formatTime(c.start)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthMini({ items, selectedDate, onPickDate, loading }) {
  const [cursor, setCursor] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const grid = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDay = start.getDay();
    const cells = [];
    let dayNum = 1 - startDay;
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
      dayNum++;
    }
    return cells;
  }, [cursor]);

  const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Month View
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            aria-label="Previous month"
            disabled={loading}
          >
            <ChevronLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            aria-label="Next month"
            disabled={loading}
          >
            <ChevronRight className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const has = items.some((x) => sameDay(x.date, d));
          const sel = sameDay(d, selectedDate);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDate(d)}
              className="rounded-2xl border p-2 text-left hover:bg-black/5"
              style={{
                borderColor: BRAND.stroke,
                background: sel ? BRAND.softGoldBg : "white",
                opacity: inMonth ? 1 : 0.45,
              }}
              disabled={loading}
            >
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{d.getDate()}</div>
              {has ? (
                <div className="mt-2 h-2 w-2 rounded-full" style={{ background: BRAND.gold }} />
              ) : (
                <div className="mt-2 text-[11px]" style={{ color: BRAND.muted }}>—</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
