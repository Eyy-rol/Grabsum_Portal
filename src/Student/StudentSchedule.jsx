// src/pages/student/StudentSchedule.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock,
  MapPin,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

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
  return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function StudentSchedule() {
  const [tab, setTab] = useState("Today"); // Today | Week | Month
  const [selectedDate, setSelectedDate] = useState(new Date());
  const now = new Date();

  // Demo schedule data (replace with Supabase)
  const items = useMemo(() => {
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

    // A few recurring-ish demo events across this week:
    const mk = (dayOffset, startHour, startMin, endHour, endMin, subject, code, teacher, room) => {
      const d = addDays(today, dayOffset);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMin);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, endMin);
      return {
        id: `${code}-${dayOffset}-${startHour}${startMin}`,
        date: d,
        start,
        end,
        subject,
        code,
        teacher,
        room,
      };
    };

    return [
      mk(0, 8, 0, 9, 30, "Oral Communication", "ORALCOMM", "Ms. Reyes", "Room 201"),
      mk(0, 10, 0, 11, 30, "General Mathematics", "MATH101", "Mr. Santos", "Room 305"),
      mk(0, 13, 0, 14, 30, "UCSP", "UCSP", "Ms. Dizon", "Room 109"),

      mk(1, 9, 30, 11, 0, "Reading & Writing Skills", "ENG101", "Mr. Garcia", "Room 114"),
      mk(1, 13, 0, 14, 30, "UCSP", "UCSP", "Ms. Dizon", "Room 109"),

      mk(2, 8, 0, 9, 30, "Oral Communication", "ORALCOMM", "Ms. Reyes", "Room 201"),
      mk(2, 10, 0, 11, 30, "General Mathematics", "MATH101", "Mr. Santos", "Room 305"),

      mk(3, 9, 30, 11, 0, "Reading & Writing Skills", "ENG101", "Mr. Garcia", "Room 114"),
      mk(4, 8, 0, 9, 30, "Oral Communication", "ORALCOMM", "Ms. Reyes", "Room 201"),
      mk(4, 10, 0, 11, 30, "General Mathematics", "MATH101", "Mr. Santos", "Room 305"),
    ];
  }, []);

  const todayItems = useMemo(() => {
    return items
      .filter((x) => sameDay(x.date, selectedDate))
      .sort((a, b) => a.start - b.start);
  }, [items, selectedDate]);

  const weekRange = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); // 0 Sun
    const diffToMon = (day + 6) % 7;
    const start = addDays(d, -diffToMon);
    const end = addDays(start, 6);
    return { start, end };
  }, [selectedDate]);

  const weekItems = useMemo(() => {
    const { start, end } = weekRange;
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
    return items.filter((x) => x.start >= s && x.start <= e).sort((a, b) => a.start - b.start);
  }, [items, weekRange]);

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

      {/* Content */}
      {tab === "Today" ? (
        <TodayView items={todayItems} selectedDate={selectedDate} now={now} />
      ) : tab === "Week" ? (
        <WeekView items={weekItems} range={weekRange} selectedDate={selectedDate} onJump={setSelectedDate} />
      ) : (
        <MonthView items={items} selectedDate={selectedDate} onPick={setSelectedDate} />
      )}
    </div>
  );
}

function TodayView({ items, selectedDate, now }) {
  // Determine status
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
          {nextClass ? (
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
        {enriched.length === 0 ? (
          <div className="rounded-2xl border bg-white p-5 text-center"
               style={{ borderColor: BRAND.stroke }}>
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
              key={c.id}
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

function WeekView({ items, range, selectedDate, onJump }) {
  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(addDays(range.start, i));
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
            >
              <div className="text-xs font-extrabold" style={{ color: BRAND.brown }}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>

              <div className="mt-2 space-y-2">
                {dayItems.length === 0 ? (
                  <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                    No classes
                  </div>
                ) : (
                  dayItems.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
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
                {dayItems.length > 3 ? (
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
          {items.filter((x) => sameDay(x.date, selectedDate)).length === 0 ? (
            <div className="text-sm" style={{ color: BRAND.muted }}>
              No classes on this day.
            </div>
          ) : (
            items
              .filter((x) => sameDay(x.date, selectedDate))
              .map((c) => (
                <div key={c.id} className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
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

function MonthView({ items, selectedDate, onPick }) {
  const [cursor, setCursor] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const grid = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startDay = start.getDay(); // Sun=0
    const daysInMonth = end.getDate();

    // Build 6 weeks grid
    const cells = [];
    let dayNum = 1 - startDay;
    for (let i = 0; i < 42; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
      cells.push(d);
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
          <div className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold"
               style={{ borderColor: BRAND.stroke, color: BRAND.brown }}>
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
          <div key={d} className="text-center">{d}</div>
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
            >
              <div className="flex items-center justify-between">
                <div
                  className="text-sm font-extrabold"
                  style={{ color: BRAND.brown }}
                >
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
          {items.filter((x) => sameDay(x.date, selectedDate)).length === 0 ? (
            <div className="text-sm" style={{ color: BRAND.muted }}>
              No classes scheduled.
            </div>
          ) : (
            items
              .filter((x) => sameDay(x.date, selectedDate))
              .sort((a, b) => a.start - b.start)
              .map((c) => (
                <div key={c.id} className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
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
