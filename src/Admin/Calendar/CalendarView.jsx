// src/admin/Calendar/CalendarView.jsx
// ✅ super_admin: Full CRUD
// ✅ admin: Read-only (view + filters + Month/Week/List + day sidebar + view details)
// ✅ Role auto-detected from Supabase (profiles.role)
//
// ✅ DESIGN FIXES APPLIED (no overflow at 100%):
// 1) Remove -mx-1 from header (common overflow culprit)
// 2) Match Subject page container width: max-w-6xl + px-4/md:px-6
// 3) Add overflow-x-hidden at root
// 4) Remove min-w-[980px] that forces horizontal overflow
// 5) Week grid responsive (prevents squish/overflow)

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
  Search,
  SlidersHorizontal,
  Dot,
  Clock,
  MapPin,
  Repeat,
  Info,
} from "lucide-react";

import { TOKENS } from "../../styles/tokens";
import { supabase } from "../../lib/supabaseClient";

/* =====================
   CONSTANTS
===================== */

const VIEW = {
  MONTH: "month",
  WEEK: "week",
  LIST: "list",
};

const EVENT_TYPES = [
  { key: "School Activity", color: "#DAA520" },
  { key: "Holiday", color: "#10B981" },
  { key: "Examination", color: "#EF4444" },
  { key: "Meeting", color: "#3B82F6" },
  { key: "Deadline", color: "#F59E0B" },
  { key: "Seminar / Training", color: "#9333EA" },
  { key: "Others", color: "#6B7280" },
];

function typeMeta(type) {
  return EVENT_TYPES.find((t) => t.key === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

/* =====================
   VALIDATION
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
   RANGE FETCH HELPER (overlap)
===================== */

function buildRange(cursorDate) {
  const first = startOfMonth(cursorDate);
  const last = endOfMonth(cursorDate);
  const from = toISODate(addDays(startOfWeekSunday(first), -7)); // buffer
  const to = toISODate(addDays(last, 14)); // buffer
  return { from, to };
}

/* =====================
   MAIN
===================== */

export default function CalendarView() {
  // role state
  const [role, setRole] = useState("admin"); // default safe
  const canManage = role === "super_admin";

  // calendar states
  const [events, setEvents] = useState([]);
  const [view, setView] = useState(VIEW.MONTH);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursorDate, setCursorDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState(toISODate(today));

  // filters
  const [typeFilter, setTypeFilter] = useState(() => new Set());
  const [monthFilter, setMonthFilter] = useState("");
  const [query, setQuery] = useState("");

  // loading + error
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // role loading
  const [roleLoading, setRoleLoading] = useState(true);

  // modals
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [openView, setOpenView] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // UI: mobile filters drawer
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ✅ Load role from profiles (profiles.user_id = auth.users.id)
  useEffect(() => {
    let alive = true;

    async function loadRole() {
      setRoleLoading(true);
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (authErr || !authData?.user) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      const user = authData.user;

      const { data, error } = await supabase
        .from("profiles")
        .select("role, is_active, is_archived")
        .eq("user_id", user.id)
        .single();

      if (!alive) return;

      if (error || !data) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      if (data.is_active === false || data.is_archived === true) {
        setRole("disabled");
        setRoleLoading(false);
        return;
      }

      setRole(data.role);
      setRoleLoading(false);
    }

    loadRole();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadRole());

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Ensure selected day stays within visible month for month view
  useEffect(() => {
    if (view !== VIEW.MONTH) return;
    const d = new Date(selectedDay);
    if (d.getMonth() !== cursorDate.getMonth() || d.getFullYear() !== cursorDate.getFullYear()) {
      setSelectedDay(toISODate(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)));
    }
  }, [cursorDate, view, selectedDay]);

  // ✅ Fetch events from Supabase on cursorDate change
  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      setLoading(true);
      setErrorMsg("");

      const { from, to } = buildRange(cursorDate);

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .lte("start_date", to)
        .or(`end_date.gte.${from},end_date.is.null`)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (!alive) return;

      if (error) {
        setErrorMsg(error.message);
        setEvents([]);
      } else {
        setEvents(data ?? []);
      }

      setLoading(false);
    }

    loadEvents();
    return () => {
      alive = false;
    };
  }, [cursorDate]);

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

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((e) => {
        const hay = `${e.title || ""} ${e.description || ""} ${e.location || ""} ${e.type || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    });

    return list;
  }, [events, typeFilter, monthFilter, query]);

  const dayEvents = useMemo(
    () => filteredEvents.filter((e) => occursOnDay(e, selectedDay)),
    [filteredEvents, selectedDay]
  );

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

  /* =====================
     ACTIONS (locked by canManage)
  ===================== */

  const openAdd = (isoDay) => {
    if (!canManage) return;
    setEditing(null);
    if (isoDay) setSelectedDay(isoDay);
    setOpenForm(true);
  };

  const openEdit = (ev) => {
    if (!canManage) return;
    setEditing(ev);
    setOpenForm(true);
  };

  const openDetails = (ev) => {
    setViewing(ev);
    setOpenView(true);
  };

  const openDeleteConfirm = (ev) => {
    if (!canManage) return;
    setDeleting(ev);
    setOpenDelete(true);
  };

  function clearFilters() {
    setTypeFilter(new Set());
    setMonthFilter("");
    setQuery("");
  }

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

  // ✅ CREATE/UPDATE/DELETE with Supabase
  async function createEvent(payload) {
    if (!canManage) throw new Error("Not allowed");
    const { data, error } = await supabase.from("calendar_events").insert([payload]).select("*").single();
    if (error) throw error;
    setEvents((prev) => [data, ...prev]);
    return data;
  }

  async function updateEvent(id, payload) {
    if (!canManage) throw new Error("Not allowed");
    const { data, error } = await supabase.from("calendar_events").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    setEvents((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  }

  async function deleteEvent(id) {
    if (!canManage) throw new Error("Not allowed");
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) throw error;
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const onSaveEvent = async (payload) => {
    if (!canManage) return;
    try {
      if (editing) await updateEvent(editing.id, payload);
      else await createEvent(payload);
      setOpenForm(false);
    } catch (e) {
      alert(e?.message || "Failed to save event");
    }
  };

  const roleLabel = roleLoading ? "Loading role…" : canManage ? "Super Admin • Full access" : "Admin • View only";

  /* =====================
     UI
  ===================== */

  return (
    <div className={`min-h-[calc(100vh-90px)] ${TOKENS.text} font-[Nunito] overflow-x-hidden`}>
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 mb-4 border-b border-black/10 bg-white/70 backdrop-blur">
        {/* ✅ Match Subject page width/margins */}
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-white">
                <CalendarIcon className="h-5 w-5 text-black/60" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-extrabold">School Calendar</div>
                  <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-extrabold text-black/60">
                    {canManage ? "Manage" : "Read-only"}
                  </span>
                </div>
                <div className="text-sm text-black/55">{roleLabel}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, type, location…"
                  className="w-full rounded-2xl border border-black/10 bg-white/70 pl-10 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
                />
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4 text-black/60" />
                Filters
              </button>

              {canManage ? (
                <button
                  onClick={() => openAdd(selectedDay)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black shadow-sm hover:opacity-95`}
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </button>
              ) : (
                <div className="hidden sm:flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-extrabold text-black/55">
                  Read-only
                </div>
              )}
            </div>
          </div>

          {/* Nav + View switches */}
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <ViewBtn active={view === VIEW.MONTH} onClick={() => setView(VIEW.MONTH)} icon={<LayoutGrid className="h-4 w-4" />}>
                Month
              </ViewBtn>
              <ViewBtn active={view === VIEW.WEEK} onClick={() => setView(VIEW.WEEK)} icon={<Columns className="h-4 w-4" />}>
                Week
              </ViewBtn>
              <ViewBtn active={view === VIEW.LIST} onClick={() => setView(VIEW.LIST)} icon={<ListIcon className="h-4 w-4" />}>
                List
              </ViewBtn>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={navPrev} className={navIconBtn}>
                <ChevronLeft className="h-5 w-5 text-black/60" />
              </button>
              <button onClick={navToday} className={navBtn}>
                Today
              </button>
              <button onClick={navNext} className={navIconBtn}>
                <ChevronRight className="h-5 w-5 text-black/60" />
              </button>

              <div className="ml-1 inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold">
                <CalendarIcon className="h-4 w-4 text-black/60" />
                {formatMonthYear(cursorDate)}
              </div>

              <div className="hidden md:flex items-center gap-2">
                <StatPill label="Total" value={stats.total} />
                <StatPill label="This month" value={stats.inMonth} highlight />
                <StatPill label="Upcoming" value={stats.upcoming} />
              </div>
            </div>
          </div>

          {errorMsg ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {errorMsg}
            </div>
          ) : null}
        </div>
      </div>

      {/* Page Body */}
      {/* ✅ Match Subject page width/margins */}
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 md:px-6 lg:grid-cols-[320px_1fr]">
        {/* Left Filters + Tips + Day Agenda (desktop) */}
        <div className="hidden lg:block space-y-4">
          <FiltersCard
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            monthFilter={monthFilter}
            setMonthFilter={setMonthFilter}
            clearFilters={clearFilters}
          />

          {/* Tips */}
          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <Info className="h-4 w-4 text-black/60" />
              Tips
            </div>
            <ul className="mt-2 space-y-2 text-sm text-black/60">
              <li className="flex gap-2">
                <Dot className="mt-1 h-4 w-4 text-black/40" />
                Click a day to see its agenda below.
              </li>
              <li className="flex gap-2">
                <Dot className="mt-1 h-4 w-4 text-black/40" />
                Use List view for printing / reviewing all events.
              </li>
              <li className="flex gap-2">
                <Dot className="mt-1 h-4 w-4 text-black/40" />
                Super Admin can add, edit, and delete events.
              </li>
            </ul>
          </div>

          {/* Day Agenda BELOW Tips (desktop) */}
          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Day agenda</div>
                <div className="text-sm text-black/55">{formatNiceDate(selectedDay)}</div>
              </div>

              {canManage ? (
                <button
                  onClick={() => openAdd(selectedDay)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-extrabold hover:bg-white"
                >
                  <Plus className="h-4 w-4 text-black/60" /> Add
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3 max-h-[46vh] overflow-auto pr-1">
              {loading ? (
                <SkeletonCard text="Loading…" />
              ) : dayEvents.length === 0 ? (
                <EmptyState
                  title="No events for this day"
                  subtitle="Try another date or clear filters."
                  actionLabel={canManage ? "Add event" : null}
                  onAction={canManage ? () => openAdd(selectedDay) : null}
                />
              ) : (
                dayEvents.map((ev) => (
                  <DayCard
                    key={ev.id}
                    ev={ev}
                    onView={openDetails}
                    onEdit={openEdit}
                    onDelete={openDeleteConfirm}
                    canManage={canManage}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Calendar */}
        <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
          {loading ? (
            <SkeletonCard text="Loading calendar events…" />
          ) : (
            <>
              {/* ✅ No forced min-width to avoid page overflow */}
              {view === VIEW.MONTH && (
                <div className="overflow-x-auto">
                  <MonthView
                    cursorDate={cursorDate}
                    todayISO={toISODate(today)}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    gridDays={monthGrid}
                    events={filteredEvents}
                    onQuickAdd={openAdd}
                    onOpenEvent={openDetails}
                    canManage={canManage}
                  />
                </div>
              )}

              {view === VIEW.WEEK && (
                <div className="overflow-x-auto">
                  <WeekView
                    weekDays={weekDays}
                    todayISO={toISODate(today)}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    events={filteredEvents}
                    onQuickAdd={openAdd}
                    onOpenEvent={openDetails}
                    canManage={canManage}
                  />
                </div>
              )}

              {view === VIEW.LIST && (
                <ListView
                  events={filteredEvents}
                  onOpenEvent={openDetails}
                  onEdit={openEdit}
                  onDelete={openDeleteConfirm}
                  canManage={canManage}
                />
              )}
            </>
          )}

          {/* Day Agenda for mobile/tablet (left sidebar hidden) */}
          <div className="mt-4 lg:hidden rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Day agenda</div>
                <div className="text-sm text-black/55">{formatNiceDate(selectedDay)}</div>
              </div>

              {canManage ? (
                <button
                  onClick={() => openAdd(selectedDay)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-extrabold hover:bg-white"
                >
                  <Plus className="h-4 w-4 text-black/60" /> Add
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3 max-h-[60vh] overflow-auto pr-1">
              {loading ? (
                <SkeletonCard text="Loading…" />
              ) : dayEvents.length === 0 ? (
                <EmptyState
                  title="No events for this day"
                  subtitle="Try another date or clear filters."
                  actionLabel={canManage ? "Add event" : null}
                  onAction={canManage ? () => openAdd(selectedDay) : null}
                />
              ) : (
                dayEvents.map((ev) => (
                  <DayCard
                    key={ev.id}
                    ev={ev}
                    onView={openDetails}
                    onEdit={openEdit}
                    onDelete={openDeleteConfirm}
                    canManage={canManage}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <FiltersCard
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          clearFilters={clearFilters}
          compact
        />
      </Drawer>

      {/* Add/Edit Modal (super_admin only) */}
      <Modal open={openForm && canManage} title={editing ? `Edit Event` : "Add Event"} onClose={() => setOpenForm(false)} wide>
        <EventForm initial={editing} defaultDay={selectedDay} onCancel={() => setOpenForm(false)} onSave={onSaveEvent} />
      </Modal>

      {/* View Details (everyone) */}
      <Modal open={openView} title={viewing ? viewing.title : "Event"} onClose={() => setOpenView(false)} wide>
        {viewing ? (
          <EventDetails
            event={viewing}
            canManage={canManage}
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

      {/* Delete (super_admin only) */}
      <Modal open={openDelete && canManage} title={deleting ? `Delete Event` : "Delete Event"} onClose={() => setOpenDelete(false)}>
        {deleting ? (
          <DeleteEventDialog
            event={deleting}
            onCancel={() => setOpenDelete(false)}
            onDelete={async () => {
              try {
                await deleteEvent(deleting.id);
                setOpenDelete(false);
              } catch (e) {
                alert(e?.message || "Failed to delete event");
              }
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* =====================
   UI HELPERS
===================== */

const navBtn = "rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white";
const navIconBtn = "grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/70 hover:bg-white";

function ViewBtn({ active, onClick, icon, children }) {
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

function StatPill({ label, value, highlight }) {
  return (
    <div
      className={
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold " +
        (highlight ? "border-[#C9A227]/30 bg-[#C9A227]/10 text-[#6B4E2E]" : "border-black/10 bg-white/70 text-black/60")
      }
    >
      <span className="text-black/55">{label}</span>
      <span className="text-black font-extrabold">{value}</span>
    </div>
  );
}

function SkeletonCard({ text }) {
  return <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">{text}</div>;
}

function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 text-center">
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-1 text-sm text-black/55">{subtitle}</div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className={`mt-3 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function FiltersCard({ typeFilter, setTypeFilter, monthFilter, setMonthFilter, clearFilters, compact }) {
  return (
    <div className={`rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur ${compact ? "" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold">
          <Filter className="h-4 w-4 text-black/60" /> Filters
        </div>
        <button onClick={clearFilters} className="text-sm font-extrabold text-black/60 hover:underline" type="button">
          Clear
        </button>
      </div>

      <div className="mt-3 space-y-3">
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
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition " +
                    (active ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/70 border-black/10 hover:bg-white")
                  }
                  title={t.key}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  {t.key}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-black/55">Month</div>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={inputCls} />
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">{title}</div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5" type="button">
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
      </div>
    </>
  );
}

/* =====================
   SUB COMPONENTS
===================== */

function Badge({ color, children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-black/70 bg-white"
      style={{ borderColor: color }}
    >
      {children}
    </span>
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

function DayCard({ ev, onView, onEdit, onDelete, canManage }) {
  const meta = typeMeta(ev.type);
  const color = ev.custom_color || meta.color;

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <div className="truncate text-sm font-extrabold">{ev.title}</div>
          </div>

          <div className="mt-2 grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge color={color}>{ev.type}</Badge>
              <Badge color="#6B7280">{formatTimeRange(ev)}</Badge>
            </div>

            {ev.location ? (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-black/55">
                <MapPin className="h-4 w-4 text-black/40" />
                <span className="truncate">{ev.location}</span>
              </div>
            ) : null}

            {ev.recurring ? (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-black/55">
                <Repeat className="h-4 w-4 text-black/40" />
                <span className="truncate">
                  Repeats {ev.repeat_pattern} (until {ev.repeat_until})
                </span>
              </div>
            ) : null}

            {ev.description ? (
              <div className="text-sm text-black/60">
                {ev.description.slice(0, 110)}
                {ev.description.length > 110 ? "…" : ""}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <IconBtn title="View" onClick={() => onView(ev)}>
            <Eye className="h-4 w-4" />
          </IconBtn>

          {canManage ? (
            <>
              <IconBtn title="Edit" onClick={() => onEdit(ev)}>
                <Pencil className="h-4 w-4" />
              </IconBtn>
              <IconBtn danger title="Delete" onClick={() => onDelete(ev)}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =====================
   VIEWS
===================== */

function MonthView({ cursorDate, todayISO, selectedDay, onSelectDay, gridDays, events, onQuickAdd, onOpenEvent, canManage }) {
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
      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="rounded-2xl border border-black/10 bg-white/60 py-2 text-center text-xs font-semibold text-black/55">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
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
                "min-h-[132px] rounded-3xl border p-3 transition cursor-pointer " +
                (isSelected ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/60 border-black/10 hover:bg-white") +
                (!inMonth ? " opacity-50" : "") +
                (isToday ? " ring-2 ring-[#C9A227]/30" : "")
              }
              onClick={() => onSelectDay(iso)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectDay(iso)}
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <div className="text-sm font-extrabold">{d.getDate()}</div>
                  {isToday ? <span className="rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#6B4E2E]">Today</span> : null}
                </div>

                {canManage ? (
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
                ) : null}
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
                      className="w-full rounded-2xl border border-black/10 bg-white px-2 py-1.5 text-left text-xs font-semibold hover:bg-black/[0.02]"
                      title={ev.title}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    </button>
                  );
                })}
                {list.length > 3 ? <div className="text-xs font-semibold text-black/50">+{list.length - 3} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ weekDays, todayISO, selectedDay, onSelectDay, events, onQuickAdd, onOpenEvent, canManage }) {
  // ✅ Responsive columns to avoid overflow / squish
  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {weekDays.map((d) => {
        const iso = toISODate(d);
        const isToday = iso === todayISO;
        const isSelected = iso === selectedDay;
        const list = events.filter((ev) => occursOnDay(ev, iso));

        return (
          <div
            key={iso}
            className={
              "min-h-[260px] rounded-3xl border p-3 cursor-pointer transition " +
              (isSelected ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white/60 border-black/10 hover:bg-white") +
              (isToday ? " ring-2 ring-[#C9A227]/30" : "")
            }
            onClick={() => onSelectDay(iso)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelectDay(iso)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div className="text-xs font-semibold text-black/55">{formatNiceDate(iso)}</div>
              </div>

              {canManage ? (
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
              ) : null}
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
                      className="w-full rounded-2xl border border-black/10 bg-white px-2 py-2 text-left text-xs font-semibold hover:bg-black/[0.02]"
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
              {list.length > 6 ? <div className="text-xs font-semibold text-black/50">+{list.length - 6} more</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =====================
   LIST VIEW + FORMS + DETAILS + MODALS
   (UNCHANGED from your file)
===================== */
// ✅ Keep your existing ListView, EventForm, EventDetails, DeleteEventDialog, RHFText, ErrMsg, inputCls, Modal here.
// (Paste them exactly as-is from your current file.)


function ListView({ events, onOpenEvent, onEdit, onDelete, canManage }) {
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
        <EmptyState title="No matching events" subtitle="Try clearing filters or searching another keyword." />
      ) : (
        grouped.map((g) => {
          const [yy, mm] = g.key.split("-");
          const d = new Date(Number(yy), Number(mm) - 1, 1);

          return (
            <div key={g.key} className="overflow-hidden rounded-3xl border border-black/10 bg-white/60">
              <div className="border-b border-black/10 bg-white/70 px-4 py-3 text-sm font-extrabold">{formatMonthYear(d)}</div>

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
                            <Badge color={color}>{ev.type}</Badge>
                            <Badge color="#6B7280">{dateLabel}</Badge>
                            <Badge color="#6B7280">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-black/40" />
                                {formatTimeRange(ev)}
                              </span>
                            </Badge>
                            {ev.location ? (
                              <Badge color="#6B4E2E">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-black/40" />
                                  {ev.location}
                                </span>
                              </Badge>
                            ) : null}
                          </div>

                          {ev.description ? (
                            <div className="mt-2 text-sm text-black/60">
                              {ev.description.slice(0, 140)}
                              {ev.description.length > 140 ? "…" : ""}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex gap-2">
                          <IconBtn title="View" onClick={() => onOpenEvent(ev)}>
                            <Eye className="h-4 w-4" />
                          </IconBtn>

                          {canManage ? (
                            <>
                              <IconBtn title="Edit" onClick={() => onEdit(ev)}>
                                <Pencil className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn danger title="Delete" onClick={() => onDelete(ev)}>
                                <Trash2 className="h-4 w-4" />
                              </IconBtn>
                            </>
                          ) : null}
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
  const selectedType = form.watch("type");
  const meta = typeMeta(selectedType);

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        const payload = {
          title: values.title,
          description: values.description || null,
          type: values.type,
          start_date: values.start_date,
          end_date: values.end_date || null,
          all_day: values.all_day,
          start_time: values.all_day ? null : values.start_time || null,
          end_time: values.all_day ? null : values.end_time || null,
          location: values.location || null,
          recurring: values.recurring,
          repeat_pattern: values.recurring ? values.repeat_pattern || null : null,
          repeat_until: values.recurring ? values.repeat_until || null : null,
          custom_color: values.custom_color || null,
          audiences: ["All"],
        };

        onSave(payload);
      })}
      className="space-y-4"
    >
      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Basic info</div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <RHFText form={form} name="title" label="Event Title *" placeholder="e.g., Foundation Day Celebration" />

          <div>
            <div className="text-xs font-semibold text-black/55">Event Type *</div>
            <select {...form.register("type")} className={inputCls}>
              {EVENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key}
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

          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-black/70">
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
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Recurrence & color</div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-black/70">
              <input type="checkbox" {...form.register("recurring")} className="h-4 w-4 rounded border-black/20" />
              Recurring event
            </label>
          </div>

          {recurring ? (
            <>
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
            </>
          ) : null}

          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-black/55">Color (Optional)</div>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 p-3">
              <input type="color" {...form.register("custom_color")} defaultValue={defaults.custom_color || meta.color} />
              <div className="text-sm font-semibold text-black/55">
                Leave empty to use default color for <b>{selectedType}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Description</div>
        <textarea
          {...form.register("description")}
          rows={4}
          maxLength={500}
          placeholder="Optional description (max 500 chars)"
          className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A227]/30"
        />
        {form.formState.errors.description?.message ? <ErrMsg msg={String(form.formState.errors.description.message)} /> : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className={`rounded-2xl ${TOKENS.goldBg} px-4 py-2 text-sm font-extrabold text-black hover:opacity-95`}>
          {initial ? "Save Changes" : "Save Event"}
        </button>
      </div>
    </form>
  );
}

function EventDetails({ event, onEdit, onDelete, onClose, canManage }) {
  const meta = typeMeta(event.type);
  const color = event.custom_color || meta.color;

  const dateLabel =
    event.end_date && event.end_date !== event.start_date
      ? `${formatNiceDate(event.start_date)} – ${formatNiceDate(event.end_date)}`
      : formatNiceDate(event.start_date);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={color}>{event.type}</Badge>
          <Badge color="#6B7280">{dateLabel}</Badge>
          <Badge color="#6B7280">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-black/40" />
              {formatTimeRange(event)}
            </span>
          </Badge>
          {event.location ? (
            <Badge color="#6B4E2E">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-black/40" />
                {event.location}
              </span>
            </Badge>
          ) : null}
          {event.recurring ? (
            <Badge color="#6B7280">
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5 text-black/40" />
                {event.repeat_pattern} until {event.repeat_until}
              </span>
            </Badge>
          ) : null}
        </div>
      </div>

      {event.description ? (
        <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-extrabold text-[#6B4E2E]">Description</div>
          <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{event.description}</div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold text-[#6B4E2E]">Metadata</div>
        <div className="mt-2 text-sm text-black/55">
          Created: {event.created_at ? new Date(event.created_at).toLocaleString() : "—"} • Updated:{" "}
          {event.updated_at ? new Date(event.updated_at).toLocaleString() : "—"}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-extrabold hover:bg-white" onClick={onClose}>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4" /> Close
          </span>
        </button>

        {canManage ? (
          <>
            <button className={`rounded-2xl ${TOKENS.goldBg} px-4 py-2 text-sm font-extrabold text-black hover:opacity-95`} onClick={onEdit}>
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Edit
              </span>
            </button>
            <button className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95" onClick={onDelete}>
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DeleteEventDialog({ event, onCancel, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
        <div className="text-sm font-extrabold text-rose-700">Delete event?</div>
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
        <div className={`w-full ${wide ? "max-w-5xl" : "max-w-3xl"} rounded-3xl border border-black/10 bg-white shadow-xl`}>
          <div className="flex items-center justify-between border-b border-black/10 p-4">
            <div className="min-w-0">
              <div className="text-sm font-extrabold truncate">{title}</div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </>
  );
}
