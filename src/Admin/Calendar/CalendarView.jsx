// src/admin/Calendar/CalendarView.jsx
// Grabsum School Admin — Calendar (UI-first, fixed design)
// - Uses Tailwind + TOKENS for consistent portal UI
// - Removes global matchMedia hacks
// - Keeps your features: Month/Week/List, filters, day sidebar, modals, validation

import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  LayoutGrid,
  List as ListIcon,
  Columns,
  X,
  Eye,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";

import { TOKENS } from "../../styles/tokens"; // adjust if needed

/* =====================
   CONSTANTS
===================== */

const VIEW = {
  MONTH: "month",
  WEEK: "week",
  LIST: "list",
};

const EVENT_TYPES = [
  { key: "School Activity", emoji: "🎉", color: "#DAA520" },
  { key: "Holiday", emoji: "🏖️", color: "#10B981" },
  { key: "Examination", emoji: "📝", color: "#EF4444" },
  { key: "Meeting", emoji: "👥", color: "#3B82F6" },
  { key: "Deadline", emoji: "⏰", color: "#F59E0B" },
  { key: "Seminar/Training", emoji: "📚", color: "#9333EA" },
  { key: "Others", emoji: "📌", color: "#6B7280" },
];

const AUDIENCES = [
  "All Students",
  "Grade 11 Students",
  "Grade 12 Students",
  "STEM Students",
  "ABM Students",
  "HUMSS Students",
  "GAS Students",
  "TVL Students",
  "All Teachers",
  "Specific Teachers",
  "Parents/Guardians",
  "Admin Staff",
];

function typeMeta(type) {
  return EVENT_TYPES.find((t) => t.key === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

/* =====================
   ZOD VALIDATION
===================== */

const eventSchema = z
  .object({
    title: z.string().min(1, "Event title is required").max(120, "Max 120 characters"),
    description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
    type: z.string().min(1, "Event type is required"),

    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().optional().or(z.literal("")),

    all_day: z.boolean().default(false),
    start_time: z.string().optional().or(z.literal("")),
    end_time: z.string().optional().or(z.literal("")),

    location: z.string().optional().or(z.literal("")),
    audiences: z.array(z.string()).min(1, "Select at least one target audience"),

    recurring: z.boolean().default(false),
    repeat_pattern: z.enum(["Daily", "Weekly", "Monthly", "Yearly"]).optional().or(z.literal("")),
    repeat_until: z.string().optional().or(z.literal("")),

    custom_color: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) => {
      if (!v.end_date) return true;
      return new Date(v.end_date) >= new Date(v.start_date);
    },
    { path: ["end_date"], message: "End date must be on or after start date" }
  )
  .refine(
    (v) => {
      if (v.all_day) return true;
      if (!v.start_time && !v.end_time) return true;
      if (!v.start_time || !v.end_time) return false;
      return v.end_time > v.start_time;
    },
    { path: ["end_time"], message: "End time must be after start time (or leave both blank)" }
  )
  .refine(
    (v) => {
      if (!v.recurring) return true;
      return Boolean(v.repeat_pattern) && Boolean(v.repeat_until);
    },
    { path: ["repeat_until"], message: "Repeat pattern and repeat-until date are required for recurring events" }
  );

/* =====================
   MOCK SEED
===================== */

const seedEvents = [
  {
    id: "ev1",
    title: "Foundation Day Celebration",
    description: "Annual celebration of the school's founding.",
    type: "School Activity",
    start_date: "2025-12-18",
    end_date: "",
    all_day: true,
    start_time: "",
    end_time: "",
    location: "School Gymnasium",
    audiences: ["All Students", "All Teachers", "Parents/Guardians"],
    recurring: false,
    repeat_pattern: "",
    repeat_until: "",
    custom_color: "",
    created_by: "Admin",
    created_at: "2025-12-01T08:00:00Z",
    updated_at: "2025-12-01T08:00:00Z",
  },
  {
    id: "ev2",
    title: "Final Exams (Grade 11)",
    description: "Final examination week for Grade 11.",
    type: "Examination",
    start_date: "2025-12-15",
    end_date: "2025-12-19",
    all_day: true,
    start_time: "",
    end_time: "",
    location: "Assigned classrooms",
    audiences: ["Grade 11 Students", "All Teachers"],
    recurring: false,
    repeat_pattern: "",
    repeat_until: "",
    custom_color: "",
    created_by: "Admin",
    created_at: "2025-11-20T08:00:00Z",
    updated_at: "2025-11-20T08:00:00Z",
  },
  {
    id: "ev3",
    title: "Faculty Meeting",
    description: "Monthly faculty meeting.",
    type: "Meeting",
    start_date: "2025-12-20",
    end_date: "",
    all_day: false,
    start_time: "14:00",
    end_time: "16:00",
    location: "Conference Room",
    audiences: ["All Teachers", "Admin Staff"],
    recurring: true,
    repeat_pattern: "Monthly",
    repeat_until: "2026-06-30",
    custom_color: "",
    created_by: "Admin",
    created_at: "2025-11-01T08:00:00Z",
    updated_at: "2025-11-01T08:00:00Z",
  },
];

/* =====================
   DATE HELPERS
===================== */

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
const startOfWeekSunday = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  return addDays(x, -day);
};
const formatMonthYear = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const formatNiceDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function formatTimeRange(ev) {
  if (ev.all_day) return "All Day";
  if (!ev.start_time || !ev.end_time) return "—";
  const fmt = (t) => {
    const [h, m] = t.split(":");
    const dd = new Date();
    dd.setHours(Number(h), Number(m), 0, 0);
    return dd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  return `${fmt(ev.start_time)} – ${fmt(ev.end_time)}`;
}

function occursOnDay(ev, isoDay) {
  const s = ev.start_date;
  const e = ev.end_date || ev.start_date;
  return isoDay >= s && isoDay <= e;
}

/* =====================
   MAIN
===================== */

export default function CalendarView() {
  const [events, setEvents] = useState(seedEvents);
  const [view, setView] = useState(VIEW.MONTH);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursorDate, setCursorDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState(toISODate(today));

  // Filters
  const [typeFilter, setTypeFilter] = useState(() => new Set());
  const [audienceFilter, setAudienceFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  // Modals
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [openView, setOpenView] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Ensure selected day stays within visible month for month view
  useEffect(() => {
    if (view !== VIEW.MONTH) return;
    const d = new Date(selectedDay);
    if (d.getMonth() !== cursorDate.getMonth() || d.getFullYear() !== cursorDate.getFullYear()) {
      setSelectedDay(toISODate(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)));
    }
  }, [cursorDate, view, selectedDay]);

  const filteredEvents = useMemo(() => {
    let list = [...events];

    if (typeFilter.size > 0) list = list.filter((e) => typeFilter.has(e.type));

    if (monthFilter) {
      list = list.filter((e) => {
        const s = e.start_date.slice(0, 7);
        const en = (e.end_date || e.start_date).slice(0, 7);
        return monthFilter >= s && monthFilter <= en;
      });
    }

    if (audienceFilter) list = list.filter((e) => (e.audiences || []).includes(audienceFilter));

    list.sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    });

    return list;
  }, [events, typeFilter, monthFilter, audienceFilter]);

  const dayEvents = useMemo(() => filteredEvents.filter((e) => occursOnDay(e, selectedDay)), [filteredEvents, selectedDay]);

  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const thisMonthKey = `${cursorDate.getFullYear()}-${pad2(cursorDate.getMonth() + 1)}`;
    const inMonth = filteredEvents.filter((e) => {
      const s = e.start_date.slice(0, 7);
      const en = (e.end_date || e.start_date).slice(0, 7);
      return thisMonthKey >= s && thisMonthKey <= en;
    }).length;
    const upcoming = filteredEvents.filter((e) => e.start_date >= toISODate(today)).length;
    return { total, inMonth, upcoming };
  }, [filteredEvents, cursorDate, today]);

  const monthGrid = useMemo(() => {
    const first = startOfMonth(cursorDate);
    const last = endOfMonth(cursorDate);
    const gridStart = startOfWeekSunday(first);
    const gridEnd = addDays(startOfWeekSunday(addDays(last, 7)), -1);
    const days = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));
    return days;
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeekSunday(cursorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursorDate]);

  const openAdd = (isoDay) => {
    setEditing(null);
    if (isoDay) setSelectedDay(isoDay);
    setOpenForm(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setOpenForm(true);
  };

  const openDetails = (ev) => {
    setViewing(ev);
    setOpenView(true);
  };

  const openDeleteConfirm = (ev) => {
    setDeleting(ev);
    setOpenDelete(true);
  };

  const onSaveEvent = (payload) => {
    if (editing) {
      setEvents((prev) =>
        prev.map((e) => (e.id === editing.id ? { ...e, ...payload, updated_at: new Date().toISOString() } : e))
      );
    } else {
      setEvents((prev) => [
        {
          id: `ev_${crypto.randomUUID()}`,
          ...payload,
          created_by: "Admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const clearFilters = () => {
    setTypeFilter(new Set());
    setAudienceFilter("");
    setMonthFilter("");
  };

  const navPrev = () => {
    if (view === VIEW.WEEK) setCursorDate((d) => addDays(d, -7));
    else setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const navNext = () => {
    if (view === VIEW.WEEK) setCursorDate((d) => addDays(d, 7));
    else setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const navToday = () => {
    setCursorDate(today);
    setSelectedDay(toISODate(today));
  };

  return (
    <div className={`space-y-4 ${TOKENS.text} font-[Nunito]`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">School Calendar</div>
          <div className="text-sm text-black/55">Manage school events, activities, and important dates</div>
        </div>

        <button
          onClick={() => openAdd(selectedDay)}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black shadow-sm hover:opacity-95`}
        >
          <Plus className="h-4 w-4" /> Add Event
        </button>
      </div>

      {/* Top bar: stats + view + nav */}
      <div className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm space-y-3`}>
        <div className="grid gap-3 md:grid-cols-3">
          <MiniStat label="Total Events" value={stats.total} tone="brown" />
          <MiniStat label="This Month" value={stats.inMonth} tone="gold" />
          <MiniStat label="Upcoming" value={stats.upcoming} tone="blue" />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <ToggleBtn active={view === VIEW.MONTH} onClick={() => setView(VIEW.MONTH)} icon={<LayoutGrid className="h-4 w-4" />}>
              Month
            </ToggleBtn>
            <ToggleBtn active={view === VIEW.WEEK} onClick={() => setView(VIEW.WEEK)} icon={<Columns className="h-4 w-4" />}>
              Week
            </ToggleBtn>
            <ToggleBtn active={view === VIEW.LIST} onClick={() => setView(VIEW.LIST)} icon={<ListIcon className="h-4 w-4" />}>
              List
            </ToggleBtn>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={navPrev} className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white">
              <ChevronLeft className="h-5 w-5 text-black/60" />
            </button>
            <button onClick={navToday} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white">
              Today
            </button>
            <button onClick={navNext} className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white">
              <ChevronRight className="h-5 w-5 text-black/60" />
            </button>

            <div className="ml-1 inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold">
              <CalendarIcon className="h-4 w-4 text-black/60" />
              {formatMonthYear(cursorDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-extrabold">
            <Filter className="h-4 w-4 text-black/60" /> Filters
          </div>
          <button onClick={clearFilters} className="text-sm font-extrabold text-black/60 hover:underline">
            Clear
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_.7fr_.9fr]">
          <div>
            <div className="text-xs font-semibold text-black/55">Event Type</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => {
                const active = typeFilter.has(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTypeFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.key)) next.delete(t.key);
                        else next.add(t.key);
                        return next;
                      });
                    }}
                    className={
                      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition " +
                      (active ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/70 border-black/10 hover:bg-white")
                    }
                    title={t.key}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    {t.emoji} {t.key}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-black/55">Month</div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-black/55">Target Audience</div>
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
            >
              <option value="">All</option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <div className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm`}>
          {view === VIEW.MONTH && (
            <MonthView
              cursorDate={cursorDate}
              todayISO={toISODate(today)}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              gridDays={monthGrid}
              events={filteredEvents}
              onQuickAdd={openAdd}
              onOpenEvent={openDetails}
            />
          )}

          {view === VIEW.WEEK && (
            <WeekView
              weekDays={weekDays}
              todayISO={toISODate(today)}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              events={filteredEvents}
              onQuickAdd={openAdd}
              onOpenEvent={openDetails}
            />
          )}

          {view === VIEW.LIST && (
            <ListView
              events={filteredEvents}
              onOpenEvent={openDetails}
              onEdit={openEdit}
              onDelete={openDeleteConfirm}
            />
          )}
        </div>

        {/* Day panel */}
        <div className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm lg:sticky lg:top-4 h-fit`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Events on {formatNiceDate(selectedDay)}</div>
            <button
              onClick={() => openAdd(selectedDay)}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-extrabold hover:bg-white"
            >
              <Plus className="h-4 w-4 text-black/60" /> Add
            </button>
          </div>

          <div className="mt-3 space-y-3 max-h-[70vh] overflow-auto pr-1">
            {dayEvents.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                No events for this day. Click <b>Add</b> to create one.
              </div>
            ) : (
              dayEvents.map((ev) => <DayCard key={ev.id} ev={ev} onView={openDetails} onEdit={openEdit} onDelete={openDeleteConfirm} />)
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={openForm}
        title={editing ? `Edit Event — ${editing.title}` : "Add New Event"}
        onClose={() => setOpenForm(false)}
        wide
      >
        <EventForm
          initial={editing}
          defaultDay={selectedDay}
          onCancel={() => setOpenForm(false)}
          onSave={(payload) => {
            onSaveEvent(payload);
            setOpenForm(false);
          }}
        />
      </Modal>

      {/* View Details */}
      <Modal open={openView} title={viewing ? viewing.title : "Event"} onClose={() => setOpenView(false)} wide>
        {viewing ? (
          <EventDetails
            event={viewing}
            onEdit={() => {
              setOpenView(false);
              openEdit(viewing);
            }}
            onDelete={() => {
              setOpenView(false);
              openDeleteConfirm(viewing);
            }}
            onClose={() => setOpenView(false)}
          />
        ) : null}
      </Modal>

      {/* Delete */}
      <Modal open={openDelete} title={deleting ? `Delete Event — ${deleting.title}` : "Delete Event"} onClose={() => setOpenDelete(false)}>
        {deleting ? (
          <DeleteEventDialog
            event={deleting}
            onCancel={() => setOpenDelete(false)}
            onDelete={() => {
              setEvents((prev) => prev.filter((e) => e.id !== deleting.id));
              setOpenDelete(false);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* =====================
   SUB COMPONENTS
===================== */

function ToggleBtn({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-extrabold transition " +
        (active ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/70 border-black/10 hover:bg-white")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function MiniStat({ label, value, tone }) {
  const top =
    tone === "gold" ? "#C9A227" : tone === "blue" ? "#3B82F6" : "#6B4E2E";

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" style={{ borderTop: `4px solid ${top}` }}>
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs font-semibold text-black/55">{label}</div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-extrabold" style={{ borderColor: color }}>
      {children}
    </span>
  );
}

function Pill({ children }) {
  return <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-extrabold">{children}</span>;
}

function DayCard({ ev, onView, onEdit, onDelete }) {
  const meta = typeMeta(ev.type);
  const color = ev.custom_color || meta.color;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <div className="truncate text-sm font-extrabold">{ev.title}</div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge color={color}>{meta.emoji} {ev.type}</Badge>
            <Badge color="#6B7280">{formatTimeRange(ev)}</Badge>
            {ev.location ? <Badge color="#6B4E2E">📍 {ev.location}</Badge> : null}
          </div>

          {ev.description ? (
            <div className="mt-2 text-sm text-black/60">
              {ev.description.slice(0, 120)}{ev.description.length > 120 ? "…" : ""}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {(ev.audiences || []).slice(0, 4).map((a) => <Pill key={a}>{a}</Pill>)}
            {(ev.audiences || []).length > 4 ? <Pill>+{(ev.audiences || []).length - 4}</Pill> : null}
          </div>
        </div>

        <div className="flex gap-2">
          <IconBtn title="View" onClick={() => onView(ev)}><Eye className="h-4 w-4" /></IconBtn>
          <IconBtn title="Edit" onClick={() => onEdit(ev)}><Pencil className="h-4 w-4" /></IconBtn>
          <IconBtn danger title="Delete" onClick={() => onDelete(ev)}><Trash2 className="h-4 w-4" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, danger, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        "grid h-9 w-9 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white " +
        (danger ? "text-rose-700" : "text-black/70")
      }
      type="button"
    >
      {children}
    </button>
  );
}

/* =====================
   VIEWS
===================== */

function MonthView({ cursorDate, todayISO, selectedDay, onSelectDay, gridDays, events, onQuickAdd, onOpenEvent }) {
  const month = cursorDate.getMonth();
  const year = cursorDate.getFullYear();

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const day of gridDays) {
      const iso = toISODate(day);
      const list = events.filter((ev) => occursOnDay(ev, iso));
      if (list.length) map.set(iso, list);
    }
    return map;
  }, [gridDays, events]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="rounded-2xl border border-black/10 bg-white/70 py-2 text-center text-xs font-extrabold text-black/55">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {gridDays.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === month && d.getFullYear() === year;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDay;
          const list = eventsByDay.get(iso) || [];

          return (
            <div
              key={iso}
              className={
                "min-h-[120px] rounded-2xl border p-3 transition cursor-pointer " +
                (isSelected ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/70 border-black/10 hover:bg-white") +
                (!inMonth ? " opacity-50" : "") +
                (isToday ? " ring-2 ring-[#C9A227]/40" : "")
              }
              onClick={() => onSelectDay(iso)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectDay(iso)}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">{d.getDate()}</div>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(iso);
                  }}
                  title="Quick add"
                >
                  <Plus className="h-4 w-4 text-black/60" />
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {list.slice(0, 3).map((ev) => {
                  const meta = typeMeta(ev.type);
                  const color = ev.custom_color || meta.color;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(ev);
                      }}
                      className="w-full rounded-xl border border-black/10 bg-white px-2 py-1 text-left text-xs font-extrabold hover:bg-black/[0.02]"
                      title={ev.title}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    </button>
                  );
                })}
                {list.length > 3 ? (
                  <div className="text-xs font-extrabold text-black/50">+{list.length - 3} more</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ weekDays, todayISO, selectedDay, onSelectDay, events, onQuickAdd, onOpenEvent }) {
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {weekDays.map((d) => {
        const iso = toISODate(d);
        const isToday = iso === todayISO;
        const isSelected = iso === selectedDay;
        const list = events.filter((ev) => occursOnDay(ev, iso));

        return (
          <div
            key={iso}
            className={
              "min-h-[260px] rounded-2xl border p-3 cursor-pointer transition " +
              (isSelected ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/70 border-black/10 hover:bg-white") +
              (isToday ? " ring-2 ring-[#C9A227]/40" : "")
            }
            onClick={() => onSelectDay(iso)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelectDay(iso)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div className="text-xs font-extrabold text-black/55">{d.getDate()}</div>
              </div>

              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd(iso);
                }}
              >
                <Plus className="h-4 w-4 text-black/60" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {list.length === 0 ? (
                <div className="text-xs font-semibold text-black/40">No events</div>
              ) : (
                list.slice(0, 6).map((ev) => {
                  const meta = typeMeta(ev.type);
                  const color = ev.custom_color || meta.color;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className="w-full rounded-xl border border-black/10 bg-white px-2 py-2 text-left text-xs font-extrabold hover:bg-black/[0.02]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(ev);
                      }}
                      title={ev.title}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    </button>
                  );
                })
              )}
              {list.length > 6 ? <div className="text-xs font-extrabold text-black/50">+{list.length - 6} more</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ events, onOpenEvent, onEdit, onDelete }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = e.start_date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return Array.from(map.keys())
      .sort()
      .map((k) => ({ key: k, items: map.get(k) }));
  }, [events]);

  return (
    <div className="space-y-3">
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
          No events match your filters.
        </div>
      ) : (
        grouped.map((g) => {
          const [yy, mm] = g.key.split("-");
          const d = new Date(Number(yy), Number(mm) - 1, 1);

          return (
            <div key={g.key} className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
              <div className="border-b border-black/10 bg-white/70 px-4 py-3 text-sm font-extrabold">
                {formatMonthYear(d)}
              </div>

              <div className="divide-y divide-black/10">
                {g.items.map((ev) => {
                  const meta = typeMeta(ev.type);
                  const color = ev.custom_color || meta.color;
                  const dateLabel =
                    ev.end_date && ev.end_date !== ev.start_date
                      ? `${formatNiceDate(ev.start_date)} – ${formatNiceDate(ev.end_date)}`
                      : formatNiceDate(ev.start_date);

                  return (
                    <div key={ev.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold">{ev.title}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge color={color}>{meta.emoji} {ev.type}</Badge>
                            <Badge color="#6B7280">{dateLabel}</Badge>
                            <Badge color="#6B7280">{formatTimeRange(ev)}</Badge>
                            {ev.location ? <Badge color="#6B4E2E">📍 {ev.location}</Badge> : null}
                          </div>
                          {ev.description ? <div className="mt-2 text-sm text-black/60">{ev.description.slice(0, 140)}{ev.description.length > 140 ? "…" : ""}</div> : null}
                        </div>

                        <div className="flex gap-2">
                          <IconBtn title="View" onClick={() => onOpenEvent(ev)}><Eye className="h-4 w-4" /></IconBtn>
                          <IconBtn title="Edit" onClick={() => onEdit(ev)}><Pencil className="h-4 w-4" /></IconBtn>
                          <IconBtn danger title="Delete" onClick={() => onDelete(ev)}><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* =====================
   FORMS & DETAILS
===================== */

function EventForm({ initial, defaultDay, onCancel, onSave }) {
  const defaults = {
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "School Activity",

    start_date: initial?.start_date ?? defaultDay,
    end_date: initial?.end_date ?? "",

    all_day: initial?.all_day ?? false,
    start_time: initial?.start_time ?? "",
    end_time: initial?.end_time ?? "",

    location: initial?.location ?? "",
    audiences: initial?.audiences ?? ["All Students"],

    recurring: initial?.recurring ?? false,
    repeat_pattern: initial?.repeat_pattern ?? "",
    repeat_until: initial?.repeat_until ?? "",

    custom_color: initial?.custom_color ?? "",
  };

  const form = useForm({
    defaultValues: defaults,
    resolver: zodResolver(eventSchema),
    mode: "onBlur",
  });

  const allDay = form.watch("all_day");
  const recurring = form.watch("recurring");
  const audiences = form.watch("audiences");
  const selectedType = form.watch("type");
  const meta = typeMeta(selectedType);

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        onSave({
          ...values,
          start_time: values.all_day ? "" : values.start_time,
          end_time: values.all_day ? "" : values.end_time,
        });
      })}
      className="space-y-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <RHFText form={form} name="title" label="Event Title *" placeholder="e.g., Foundation Day Celebration" />

        <div>
          <div className="text-xs font-semibold text-black/55">Event Type *</div>
          <select
            {...form.register("type")}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji} {t.key}
              </option>
            ))}
          </select>
          {form.formState.errors.type?.message ? <ErrMsg msg={String(form.formState.errors.type.message)} /> : null}
        </div>

        <div>
          <div className="text-xs font-semibold text-black/55">Start Date *</div>
          <input type="date" {...form.register("start_date")} className={inputCls} />
          {form.formState.errors.start_date?.message ? <ErrMsg msg={String(form.formState.errors.start_date.message)} /> : null}
        </div>

        <div>
          <div className="text-xs font-semibold text-black/55">End Date (Optional)</div>
          <input type="date" {...form.register("end_date")} className={inputCls} />
          {form.formState.errors.end_date?.message ? <ErrMsg msg={String(form.formState.errors.end_date.message)} /> : null}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-extrabold text-black/70">
            <input type="checkbox" {...form.register("all_day")} className="h-4 w-4 rounded border-black/20" />
            All-day event
          </label>
        </div>

        {!allDay ? (
          <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
            <div>
              <div className="text-xs font-semibold text-black/55">Start Time</div>
              <input type="time" {...form.register("start_time")} className={inputCls} />
            </div>
            <div>
              <div className="text-xs font-semibold text-black/55">End Time</div>
              <input type="time" {...form.register("end_time")} className={inputCls} />
              {form.formState.errors.end_time?.message ? <ErrMsg msg={String(form.formState.errors.end_time.message)} /> : null}
            </div>
          </div>
        ) : null}

        <RHFText form={form} name="location" label="Location / Venue" placeholder="e.g., School Gymnasium" />

        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-extrabold text-black/70">
            <input type="checkbox" {...form.register("recurring")} className="h-4 w-4 rounded border-black/20" />
            Recurring event
          </label>
        </div>

        {recurring ? (
          <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
            <div>
              <div className="text-xs font-semibold text-black/55">Repeat Pattern *</div>
              <select {...form.register("repeat_pattern")} className={inputCls}>
                <option value="">Select…</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-black/55">Repeat Until *</div>
              <input type="date" {...form.register("repeat_until")} className={inputCls} />
              {form.formState.errors.repeat_until?.message ? <ErrMsg msg={String(form.formState.errors.repeat_until.message)} /> : null}
            </div>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <div className="text-xs font-semibold text-black/55">Target Audience *</div>
          <div className="mt-2 max-h-[220px] overflow-auto rounded-2xl border border-black/10 bg-white/70 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              {AUDIENCES.map((a) => {
                const checked = audiences.includes(a);
                return (
                  <label key={a} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-extrabold text-black/70">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(audiences);
                        if (next.has(a)) next.delete(a);
                        else next.add(a);
                        form.setValue("audiences", Array.from(next), { shouldValidate: true });
                      }}
                      className="h-4 w-4 rounded border-black/20"
                    />
                    {a}
                  </label>
                );
              })}
            </div>
          </div>
          {form.formState.errors.audiences?.message ? <ErrMsg msg={String(form.formState.errors.audiences.message)} /> : null}
        </div>

        <div className="md:col-span-2">
          <div className="text-xs font-semibold text-black/55">Color (Optional)</div>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 p-3">
            <input type="color" {...form.register("custom_color")} defaultValue={defaults.custom_color || meta.color} />
            <div className="text-sm font-semibold text-black/55">
              Leave empty to use default color for <b>{meta.emoji} {selectedType}</b>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-black/55">Event Description</div>
        <textarea
          {...form.register("description")}
          rows={3}
          maxLength={500}
          placeholder="Optional description (max 500 chars)"
          className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
        />
        {form.formState.errors.description?.message ? <ErrMsg msg={String(form.formState.errors.description.message)} /> : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={`rounded-2xl ${TOKENS.goldBg} px-4 py-2 text-sm font-extrabold text-black hover:opacity-95`}>
          {initial ? "Save Changes" : "Save Event"}
        </button>
      </div>
    </form>
  );
}

function EventDetails({ event, onEdit, onDelete, onClose }) {
  const meta = typeMeta(event.type);
  const color = event.custom_color || meta.color;

  const dateLabel =
    event.end_date && event.end_date !== event.start_date
      ? `${formatNiceDate(event.start_date)} – ${formatNiceDate(event.end_date)}`
      : formatNiceDate(event.start_date);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap gap-2">
          <Badge color={color}>{meta.emoji} {event.type}</Badge>
          <Badge color="#6B7280">{dateLabel}</Badge>
          <Badge color="#6B7280">{formatTimeRange(event)}</Badge>
          {event.location ? <Badge color="#6B4E2E">📍 {event.location}</Badge> : null}
        </div>
      </div>

      {event.description ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-extrabold text-[#6B4E2E]">Description</div>
          <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{event.description}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Target Audience</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(event.audiences || []).map((a) => <Pill key={a}>{a}</Pill>)}
        </div>
      </div>

      {event.recurring ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-extrabold text-[#6B4E2E]">Recurrence</div>
          <div className="mt-2 text-sm text-black/70">
            Repeats <b>{event.repeat_pattern}</b> until <b>{event.repeat_until}</b>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Metadata</div>
        <div className="mt-2 text-sm text-black/55">
          Created by <b>{event.created_by || "Admin"}</b> • Created: {new Date(event.created_at).toLocaleString()} • Updated: {new Date(event.updated_at).toLocaleString()}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white" onClick={onClose}>
          <span className="inline-flex items-center gap-2"><X className="h-4 w-4" /> Close</span>
        </button>
        <button className={`rounded-2xl ${TOKENS.goldBg} px-4 py-2 text-sm font-extrabold text-black hover:opacity-95`} onClick={onEdit}>
          <span className="inline-flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit</span>
        </button>
        <button className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95" onClick={onDelete}>
          <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete</span>
        </button>
      </div>
    </div>
  );
}

function DeleteEventDialog({ event, onCancel, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <div className="text-sm font-extrabold text-rose-700">⚠️ Delete Event?</div>
        <div className="mt-2 text-sm text-rose-700/80">
          Are you sure you want to delete <b>{event.title}</b>?
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white" onClick={onCancel}>
          Cancel
        </button>
        <button className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function RHFText({ form, name, label, placeholder }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div>
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <input {...form.register(name)} placeholder={placeholder} className={inputCls} />
      {err ? <ErrMsg msg={String(err)} /> : null}
    </div>
  );
}

function ErrMsg({ msg }) {
  return <div className="mt-1 text-xs font-extrabold text-rose-600">{msg}</div>;
}

const inputCls =
  "mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30";

/* =====================
   MODAL
===================== */

function Modal({ open, title, onClose, wide, children }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full ${wide ? "max-w-5xl" : "max-w-3xl"} rounded-2xl border border-black/10 bg-white shadow-xl`}>
          <div className="flex items-center justify-between border-b border-black/10 p-4">
            <div className="text-sm font-extrabold">{title}</div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </>
  );
}
