// src/components/calendar/CalendarWidget.jsx
import React, { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient"; // adjust if needed

const BRAND = {
  brown: "rgba(43,26,18,0.95)",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getMonthMatrix(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const firstDay = first.getDay(); // 0 Sun
  const start = new Date(year, month, 1 - firstDay);

  const weeks = [];
  let cur = new Date(start);

  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

function occursOnDay(ev, isoDay) {
  const s = ev.start_date; // YYYY-MM-DD
  const e = ev.end_date || ev.start_date;
  return isoDay >= s && isoDay <= e;
}

function niceDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function timeRange(ev) {
  if (ev.all_day) return "All Day";
  if (!ev.start_time || !ev.end_time) return "—";
  const fmt = (t) => {
    const [h, m] = String(t).split(":");
    const dd = new Date();
    dd.setHours(Number(h), Number(m), 0, 0);
    return dd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  return `${fmt(ev.start_time)} – ${fmt(ev.end_time)}`;
}

export default function CalendarWidget({
  title = "Academic Calendar",
  subtitle = "Official schedule (read-only)",
  limitDotsPerDay = 3,
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedDay, setSelectedDay] = useState(toISODate(new Date()));
  const [openDayModal, setOpenDayModal] = useState(false);

  const monthWeeks = useMemo(() => getMonthMatrix(monthCursor), [monthCursor]);
  const todayISO = useMemo(() => toISODate(new Date()), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // Fetch events for visible month (with safe buffer to include spanning events)
        const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
        const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);

        const startISO = toISODate(start);
        const endISO = toISODate(end);

        // include events that:
        // - start within the month OR
        // - end within the month OR
        // - spans across the month (start before, end after)
        const { data, error } = await supabase
          .from("calendar_events")
          .select("id,title,type,start_date,end_date,all_day,start_time,end_time,location,custom_color")
          .or(
            [
              `start_date.gte.${startISO},start_date.lte.${endISO}`,
              `end_date.gte.${startISO},end_date.lte.${endISO}`,
              `and(start_date.lte.${startISO},end_date.gte.${endISO})`,
              `and(start_date.lte.${endISO},end_date.is.null)`, // single-day events
            ].join(",")
          )
          .order("start_date", { ascending: true });

        if (error) throw error;

        if (!alive) return;
        setEvents(data || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
        setEvents([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    // optional realtime updates
    const ch = supabase
      .channel("calendar_widget_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    // build for all days in matrix
    const flatDays = monthWeeks.flat();
    for (const d of flatDays) {
      const iso = toISODate(d);
      const list = events.filter((ev) => occursOnDay(ev, iso));
      if (list.length) map.set(iso, list);
    }
    return map;
  }, [events, monthWeeks]);

  const dayEvents = useMemo(() => events.filter((ev) => occursOnDay(ev, selectedDay)), [events, selectedDay]);

  return (
    <section
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            {title}
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {subtitle}
          </div>
          {err ? (
            <div className="mt-2 rounded-2xl border px-3 py-2 text-xs font-extrabold text-rose-700"
              style={{ borderColor: "rgba(244,63,94,0.25)", background: "rgba(244,63,94,0.08)" }}
            >
              {err}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-black/5"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-black/5"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-extrabold"
        style={{ borderColor: BRAND.stroke, background: "rgba(255,255,255,0.7)", color: BRAND.brown }}
      >
        <CalendarIcon className="h-4 w-4" style={{ color: BRAND.muted }} />
        {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold" style={{ color: BRAND.muted }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthWeeks.flat().map((d, idx) => {
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const iso = toISODate(d);
          const isToday = iso === todayISO;
          const list = eventsByDay.get(iso) || [];

          return (
            <button
              key={idx}
              className="relative rounded-xl border py-2 text-xs font-semibold transition hover:bg-black/5"
              style={{
                borderColor: BRAND.stroke,
                color: inMonth ? BRAND.brown : "rgba(43,26,18,0.35)",
                background: isToday ? BRAND.softGoldBg : "white",
              }}
              onClick={() => {
                setSelectedDay(iso);
                setOpenDayModal(true);
              }}
              type="button"
              disabled={loading}
              title={list.length ? `${list.length} event(s)` : "No events"}
            >
              {d.getDate()}

              {/* Dots */}
              {list.length ? (
                <div className="mt-1 flex items-center justify-center gap-1">
                  {list.slice(0, limitDotsPerDay).map((ev) => (
                    <span
                      key={ev.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ev.custom_color || BRAND.gold }}
                    />
                  ))}
                  {list.length > limitDotsPerDay ? (
                    <span className="text-[10px]" style={{ color: BRAND.muted }}>
                      +{list.length - limitDotsPerDay}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Day modal */}
      {openDayModal ? (
        <DayModal
          dayISO={selectedDay}
          events={dayEvents}
          onClose={() => setOpenDayModal(false)}
        />
      ) : null}
    </section>
  );
}

function DayModal({ dayISO, events, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-black/10 p-4">
            <div className="text-sm font-extrabold">
              {niceDate(dayISO)}
              <div className="text-xs font-semibold text-black/55">Official schedule</div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                No events for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div key={ev.id} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ev.custom_color || BRAND.gold }} />
                          <div className="truncate text-sm font-extrabold">{ev.title}</div>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-black/55">
                          {ev.type} • {timeRange(ev)}
                          {ev.location ? ` • ${ev.location}` : ""}
                        </div>
                      </div>
                      <span className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                      >
                        Official
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
