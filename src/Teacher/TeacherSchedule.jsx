// src/pages/teacher/TeacherSchedule.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

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

export default function TeacherSchedule() {
  const [tab, setTab] = useState("Today");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const now = new Date();

  const items = useMemo(() => {
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const mk = (offset, sh, sm, eh, em, subject, className, room, students) => {
      const d = addDays(today, offset);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);
      return { id: `${subject}-${offset}-${sh}${sm}`, date: d, start, end, subject, className, room, students };
    };
    return [
      mk(0, 8, 0, 9, 0, "Oral Communication", "HUMSS 11-C", "Room 201", 36),
      mk(0, 10, 0, 11, 30, "General Mathematics", "ABM 11-B", "Room 305", 42),
      mk(0, 13, 0, 14, 30, "UCSP", "STEM 11-A", "Room 109", 38),
      mk(1, 9, 30, 11, 0, "Reading & Writing", "STEM 11-A", "Room 114", 38),
      mk(2, 8, 0, 9, 0, "Oral Communication", "HUMSS 11-C", "Room 201", 36),
      mk(3, 13, 0, 14, 30, "UCSP", "STEM 11-A", "Room 109", 38),
    ];
  }, []);

  const dayItems = useMemo(
    () => items.filter((x) => sameDay(x.date, selectedDate)).sort((a, b) => a.start - b.start),
    [items, selectedDate]
  );

  const weekRange = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    const start = addDays(d, -diffToMon);
    const end = addDays(start, 6);
    return { start, end };
  }, [selectedDate]);

  const weekItems = useMemo(() => {
    const s = new Date(weekRange.start.getFullYear(), weekRange.start.getMonth(), weekRange.start.getDate());
    const e = new Date(weekRange.end.getFullYear(), weekRange.end.getMonth(), weekRange.end.getDate(), 23, 59, 59);
    return items.filter((x) => x.start >= s && x.start <= e).sort((a, b) => a.start - b.start);
  }, [items, weekRange]);

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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <div className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold"
                 style={{ borderColor: BRAND.stroke, color: BRAND.brown }}>
              {formatDateLong(selectedDate)}
            </div>
          </div>

          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            Current time: <span style={{ color: BRAND.brown }}>{formatTime(now)}</span>
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
            <TodayTimeline items={dayItems} now={now} onPick={setSelected} />
          ) : tab === "Week" ? (
            <WeekGrid items={weekItems} range={weekRange} onPick={setSelected} />
          ) : (
            <MonthMini items={items} selectedDate={selectedDate} onPickDate={setSelectedDate} />
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

function TodayTimeline({ items, now, onPick }) {
  return (
    <div>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        Today Timeline
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
        Current time indicator is simulated (UI)
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
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

function WeekGrid({ items, range, onPick }) {
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
                {dayItems.length === 0 ? (
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

function MonthMini({ items, selectedDate, onPickDate }) {
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
          >
            <ChevronLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>
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
            >
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{d.getDate()}</div>
              {has ? <div className="mt-2 h-2 w-2 rounded-full" style={{ background: BRAND.gold }} /> : <div className="mt-2 text-[11px]" style={{ color: BRAND.muted }}>—</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
