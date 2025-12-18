// src/admin/Calendar/CalendarView.jsx
// Grabsum School Admin — Calendar (UI-first)
//
// ✅ Features included (per spec):
// - Header + Add Event button
// - View toggles: Month (default), Week, List
// - Prev / Today / Next navigation + current month/year label
// - Month grid (Sun–Sat) with today highlight + event indicators
// - Day sidebar panel (click a date) listing events with actions
// - Add/Edit modal with Zod + react-hook-form validation
// - View Details modal
// - Delete confirmation modal (handles recurring with options in UI)
// - Filters (top) by type + month + audience
// - List view grouped by month
//
// ⚠️ UI-only for now: data is stored in component state with mock seed.
// Next step later: connect to Supabase events table.

import { useEffect, useMemo, useState } from "react";
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
      // if not all-day, times can be blank (allowed) but if both provided must be valid range
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekSunday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun
  return addDays(x, -day);
}

function formatMonthYear(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatNiceDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

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
  // Simple range check (supports multi-day)
  const s = ev.start_date;
  const e = ev.end_date || ev.start_date;
  return isoDay >= s && isoDay <= e;
}

/* =====================
   MAIN COMPONENT
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

  // Keep selected day within visible month when navigating month view
  useEffect(() => {
    if (view !== VIEW.MONTH) return;
    const iso = selectedDay;
    const m = cursorDate.getMonth();
    const y = cursorDate.getFullYear();
    const d = new Date(iso);
    if (d.getMonth() !== m || d.getFullYear() !== y) {
      setSelectedDay(toISODate(new Date(y, m, 1)));
    }
  }, [cursorDate, view]);

  const filteredEvents = useMemo(() => {
    let list = [...events];

    // type filter
    if (typeFilter.size > 0) {
      list = list.filter((e) => typeFilter.has(e.type));
    }

    // month filter (YYYY-MM)
    if (monthFilter) {
      list = list.filter((e) => {
        const s = e.start_date.slice(0, 7);
        const en = (e.end_date || e.start_date).slice(0, 7);
        return monthFilter >= s && monthFilter <= en;
      });
    }

    // audience filter
    if (audienceFilter) {
      list = list.filter((e) => (e.audiences || []).includes(audienceFilter));
    }

    // sort by start date then time
    list.sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    });

    return list;
  }, [events, typeFilter, monthFilter, audienceFilter]);

  const dayEvents = useMemo(() => {
    const iso = selectedDay;
    return filteredEvents.filter((e) => occursOnDay(e, iso));
  }, [filteredEvents, selectedDay]);

  // Stats (optional quick glance)
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
    const gridEnd = addDays(startOfWeekSunday(addDays(last, 7)), -1); // last day of last row

    const days = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
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
        prev.map((e) =>
          e.id === editing.id
            ? { ...e, ...payload, updated_at: new Date().toISOString() }
            : e
        )
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
    if (view === VIEW.MONTH) {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (view === VIEW.WEEK) {
      setCursorDate((d) => addDays(d, -7));
    } else {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  };

  const navNext = () => {
    if (view === VIEW.MONTH) {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (view === VIEW.WEEK) {
      setCursorDate((d) => addDays(d, 7));
    } else {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  };

  const navToday = () => {
    setCursorDate(today);
    setSelectedDay(toISODate(today));
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>School Calendar</h1>
          <div style={styles.sub}>Manage school events, activities, and important dates</div>
        </div>

        <button style={styles.primaryBtn} onClick={() => openAdd(selectedDay)}>
          <Plus size={18} /> Add Event
        </button>
      </div>

      {/* Top stats + controls */}
      <div style={styles.topBar}>
        <div style={styles.statsRow}>
          <MiniStat label="Total Events" value={stats.total} tone="brown" />
          <MiniStat label="This Period" value={stats.inMonth} tone="gold" />
          <MiniStat label="Upcoming" value={stats.upcoming} tone="blue" />
        </div>

        <div style={styles.controlsRow}>
          <div style={styles.viewToggle}>
            <ToggleBtn active={view === VIEW.MONTH} onClick={() => setView(VIEW.MONTH)} icon={<LayoutGrid size={16} />}>
              Month
            </ToggleBtn>
            <ToggleBtn active={view === VIEW.WEEK} onClick={() => setView(VIEW.WEEK)} icon={<Columns size={16} />}>
              Week
            </ToggleBtn>
            <ToggleBtn active={view === VIEW.LIST} onClick={() => setView(VIEW.LIST)} icon={<ListIcon size={16} />}>
              List
            </ToggleBtn>
          </div>

          <div style={styles.navRow}>
            <button style={styles.iconBtn} onClick={navPrev} title="Previous">
              <ChevronLeft size={18} />
            </button>
            <button style={styles.ghostBtn} onClick={navToday}>
              Today
            </button>
            <button style={styles.iconBtn} onClick={navNext} title="Next">
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={styles.monthLabel}>
            <CalendarIcon size={18} /> {formatMonthYear(cursorDate)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 950 }}>
            <Filter size={16} /> Filters
          </div>
          <button style={styles.ghostBtn} onClick={clearFilters}>Clear</button>
        </div>

        <div style={styles.filterGrid}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Event Type</div>
            <div style={styles.typeChips}>
              {EVENT_TYPES.map((t) => {
                const active = typeFilter.has(t.key);
                return (
                  <button
                    key={t.key}
                    style={{
                      ...styles.typeChip,
                      borderColor: active ? t.color : "#E5E7EB",
                      background: active ? "#FFFBEB" : "#fff",
                    }}
                    onClick={() => {
                      setTypeFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.key)) next.delete(t.key);
                        else next.add(t.key);
                        return next;
                      });
                    }}
                    type="button"
                    title={t.key}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: t.color }} />
                    {t.emoji} {t.key}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={styles.label}>Month</div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={styles.label}>Target Audience</div>
            <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)} style={styles.input}>
              <option value="">All</option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.mainGrid}>
        <div style={styles.mainPanel}>
          {view === VIEW.MONTH && (
            <MonthView
              cursorDate={cursorDate}
              todayISO={toISODate(today)}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              gridDays={monthGrid}
              events={filteredEvents}
              onQuickAdd={openAdd}
              onOpenEvent={(ev) => openDetails(ev)}
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
              onOpenEvent={(ev) => openDetails(ev)}
            />
          )}

          {view === VIEW.LIST && (
            <ListView
              cursorDate={cursorDate}
              events={filteredEvents}
              onOpenEvent={(ev) => openDetails(ev)}
              onEdit={openEdit}
              onDelete={openDeleteConfirm}
            />
          )}
        </div>

        {/* Sidebar: selected day details */}
        <div style={styles.sidePanel}>
          <div style={styles.sideHeader}>
            <div style={{ fontWeight: 950 }}>Events on {formatNiceDate(selectedDay)}</div>
            <button style={styles.ghostBtn} onClick={() => openAdd(selectedDay)}>
              <Plus size={16} /> Add
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>
              No events for this day. Click <b>Add</b> to create one.
            </div>
          ) : (
            <div style={styles.sideList}>
              {dayEvents.map((ev) => {
                const meta = typeMeta(ev.type);
                const color = ev.custom_color || meta.color;
                return (
                  <div key={ev.id} style={styles.sideItem}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                          <div style={{ fontWeight: 950 }}>{ev.title}</div>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Badge color={color}>{meta.emoji} {ev.type}</Badge>
                          <Badge color="#6B7280">{formatTimeRange(ev)}</Badge>
                          {ev.location ? <Badge color="#A0826D">📍 {ev.location}</Badge> : null}
                        </div>
                        {ev.description ? (
                          <div style={{ marginTop: 8, color: "#6B7280", fontSize: 13 }}>
                            {ev.description.slice(0, 100)}{ev.description.length > 100 ? "…" : ""}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(ev.audiences || []).slice(0, 4).map((a) => (
                            <Pill key={a}>{a}</Pill>
                          ))}
                          {(ev.audiences || []).length > 4 ? <Pill>+{(ev.audiences || []).length - 4}</Pill> : null}
                        </div>
                      </div>

                      <div style={{ display: "inline-flex", gap: 8, height: 36 }}>
                        <button style={styles.iconBtn} onClick={() => openDetails(ev)} title="View">
                          <Eye size={16} />
                        </button>
                        <button style={styles.iconBtn} onClick={() => openEdit(ev)} title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button style={{ ...styles.iconBtn, color: "#EF4444" }} onClick={() => openDeleteConfirm(ev)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* View Details Modal */}
      <Modal
        open={openView}
        title={viewing ? viewing.title : "Event"}
        onClose={() => setOpenView(false)}
        wide
      >
        {viewing && (
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
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={openDelete}
        title={deleting ? `Delete Event — ${deleting.title}` : "Delete Event"}
        onClose={() => setOpenDelete(false)}
      >
        {deleting && (
          <DeleteEventDialog
            event={deleting}
            onCancel={() => setOpenDelete(false)}
            onDelete={(mode) => {
              // UI-only: just delete one record.
              // Later with recurrence-series table, use mode.
              setEvents((prev) => prev.filter((e) => e.id !== deleting.id));
              setOpenDelete(false);
            }}
          />
        )}
      </Modal>
    </div>
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
    <div>
      <div style={styles.calendarHeaderRow}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={styles.dow}>{d}</div>
        ))}
      </div>

      <div style={styles.monthGrid}>
        {gridDays.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === month && d.getFullYear() === year;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDay;
          const list = eventsByDay.get(iso) || [];

          return (
            <div
              key={iso}
              style={{
                ...styles.dayCell,
                background: isSelected ? "#FFFBEB" : "#fff",
                borderColor: isToday ? "#DAA520" : "#E5E7EB",
                opacity: inMonth ? 1 : 0.55,
              }}
              onClick={() => onSelectDay(iso)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectDay(iso);
              }}
              title="Click to view day"
            >
              <div style={styles.dayTop}>
                <div style={styles.dayNum}>{d.getDate()}</div>
                <button
                  type="button"
                  style={styles.quickAdd}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(iso);
                  }}
                  title="Quick add"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Event indicators */}
              <div style={styles.indicators}>
                {list.slice(0, 3).map((ev) => {
                  const meta = typeMeta(ev.type);
                  const color = ev.custom_color || meta.color;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      style={{ ...styles.indicatorBadge, borderColor: color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(ev);
                      }}
                      title={ev.title}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
                      <span style={styles.indicatorText}>{ev.title}</span>
                    </button>
                  );
                })}

                {list.length > 3 ? (
                  <div style={styles.moreEvents}>+{list.length - 3} more</div>
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.weekGrid}>
        {weekDays.map((d) => {
          const iso = toISODate(d);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDay;
          const list = events.filter((ev) => occursOnDay(ev, iso));

          return (
            <div
              key={iso}
              style={{
                ...styles.weekCol,
                borderColor: isToday ? "#DAA520" : "#E5E7EB",
                background: isSelected ? "#FFFBEB" : "#fff",
              }}
              onClick={() => onSelectDay(iso)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectDay(iso)}
            >
              <div style={styles.weekColHeader}>
                <div style={{ fontWeight: 950 }}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div style={{ color: "#6B7280", fontWeight: 900 }}>
                  {d.getDate()}
                </div>
                <button
                  type="button"
                  style={styles.quickAdd}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(iso);
                  }}
                  title="Quick add"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div style={styles.weekEvents}>
                {list.length === 0 ? (
                  <div style={{ color: "#9CA3AF", fontSize: 12 }}>No events</div>
                ) : (
                  list.slice(0, 6).map((ev) => {
                    const meta = typeMeta(ev.type);
                    const color = ev.custom_color || meta.color;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        style={{ ...styles.weekEventPill, borderColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEvent(ev);
                        }}
                        title={ev.title}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                        <span style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.title}
                        </span>
                      </button>
                    );
                  })
                )}
                {list.length > 6 ? <div style={styles.moreEvents}>+{list.length - 6} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
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
    // sort keys
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ key: k, items: map.get(k) }));
  }, [events]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {grouped.length === 0 ? (
        <div style={{ color: "#6B7280" }}>No events match your filters.</div>
      ) : (
        grouped.map((g) => {
          const [yy, mm] = g.key.split("-");
          const d = new Date(Number(yy), Number(mm) - 1, 1);
          return (
            <div key={g.key} style={styles.listGroup}>
              <div style={styles.listGroupHeader}>{formatMonthYear(d)}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {g.items.map((ev) => {
                  const meta = typeMeta(ev.type);
                  const color = ev.custom_color || meta.color;
                  const dateLabel = ev.end_date && ev.end_date !== ev.start_date
                    ? `${formatNiceDate(ev.start_date)} – ${formatNiceDate(ev.end_date)}`
                    : formatNiceDate(ev.start_date);
                  return (
                    <div key={ev.id} style={styles.listItem}>
                      <div style={styles.listDateBox}>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>{ev.start_date.slice(8, 10)}</div>
                        <div style={{ color: "#6B7280", fontSize: 12 }}>{d.toLocaleDateString(undefined, { month: "short" })}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 950 }}>{ev.title}</div>
                            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Badge color={color}>{meta.emoji} {ev.type}</Badge>
                              <Badge color="#6B7280">{dateLabel}</Badge>
                              <Badge color="#6B7280">{formatTimeRange(ev)}</Badge>
                              {ev.location ? <Badge color="#A0826D">📍 {ev.location}</Badge> : null}
                            </div>
                          </div>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <button style={styles.iconBtn} onClick={() => onOpenEvent(ev)} title="View">
                              <Eye size={16} />
                            </button>
                            <button style={styles.iconBtn} onClick={() => onEdit(ev)} title="Edit">
                              <Pencil size={16} />
                            </button>
                            <button style={{ ...styles.iconBtn, color: "#EF4444" }} onClick={() => onDelete(ev)} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        {ev.description ? (
                          <div style={{ marginTop: 8, color: "#6B7280", fontSize: 13 }}>
                            {ev.description.slice(0, 120)}{ev.description.length > 120 ? "…" : ""}
                          </div>
                        ) : null}
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
   FORMS & MODALS
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
        // If all-day, wipe times
        const payload = {
          ...values,
          start_time: values.all_day ? "" : values.start_time,
          end_time: values.all_day ? "" : values.end_time,
        };
        onSave(payload);
      })}
      style={{ display: "grid", gap: 12 }}
    >
      <div style={styles.formGrid}>
        <RHFText form={form} name="title" label="Event Title *" placeholder="e.g., Foundation Day Celebration" />
        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Event Type *</div>
          <select {...form.register("type")} style={styles.input}>
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji} {t.key}
              </option>
            ))}
          </select>
          {form.formState.errors.type?.message ? <div style={styles.err}>{String(form.formState.errors.type.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Start Date *</div>
          <input type="date" {...form.register("start_date")} style={styles.input} />
          {form.formState.errors.start_date?.message ? <div style={styles.err}>{String(form.formState.errors.start_date.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>End Date (Optional)</div>
          <input type="date" {...form.register("end_date")} style={styles.input} />
          {form.formState.errors.end_date?.message ? <div style={styles.err}>{String(form.formState.errors.end_date.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>All-Day Event</div>
          <label style={styles.checkboxRow}>
            <input type="checkbox" {...form.register("all_day")} />
            All day
          </label>
        </div>

        {!allDay && (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={styles.label}>Start Time</div>
              <input type="time" {...form.register("start_time")} style={styles.input} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={styles.label}>End Time</div>
              <input type="time" {...form.register("end_time")} style={styles.input} />
              {form.formState.errors.end_time?.message ? <div style={styles.err}>{String(form.formState.errors.end_time.message)}</div> : null}
            </div>
          </>
        )}

        <RHFText form={form} name="location" label="Location / Venue" placeholder="e.g., School Gymnasium" />

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Target Audience *</div>
          <div style={styles.audienceBox}>
            {AUDIENCES.map((a) => {
              const checked = audiences.includes(a);
              return (
                <label key={a} style={styles.audienceItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(audiences);
                      if (next.has(a)) next.delete(a);
                      else next.add(a);
                      form.setValue("audiences", Array.from(next), { shouldValidate: true });
                    }}
                  />
                  {a}
                </label>
              );
            })}
          </div>
          {form.formState.errors.audiences?.message ? <div style={styles.err}>{String(form.formState.errors.audiences.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Recurring Event</div>
          <label style={styles.checkboxRow}>
            <input type="checkbox" {...form.register("recurring")} />
            This event repeats
          </label>
        </div>

        {recurring && (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={styles.label}>Repeat Pattern *</div>
              <select {...form.register("repeat_pattern")} style={styles.input}>
                <option value="">Select…</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={styles.label}>Repeat Until *</div>
              <input type="date" {...form.register("repeat_until")} style={styles.input} />
              {form.formState.errors.repeat_until?.message ? <div style={styles.err}>{String(form.formState.errors.repeat_until.message)}</div> : null}
            </div>
          </>
        )}

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Color (Optional)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" {...form.register("custom_color")} defaultValue={defaults.custom_color || meta.color} />
            <div style={{ color: "#6B7280", fontSize: 13 }}>
              Leave empty to use default color for <b>{meta.emoji} {selectedType}</b>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={styles.label}>Event Description</div>
        <textarea
          {...form.register("description")}
          rows={3}
          maxLength={500}
          placeholder="Optional description (max 500 chars)"
          style={styles.textarea}
        />
        {form.formState.errors.description?.message ? <div style={styles.err}>{String(form.formState.errors.description.message)}</div> : null}
      </div>

      <div style={styles.modalActions}>
        <button type="button" style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" style={styles.primaryBtn}>{initial ? "Save Changes" : "Save Event"}</button>
      </div>
    </form>
  );
}

function EventDetails({ event, onEdit, onDelete, onClose }) {
  const meta = typeMeta(event.type);
  const color = event.custom_color || meta.color;

  const dateLabel = event.end_date && event.end_date !== event.start_date
    ? `${formatNiceDate(event.start_date)} – ${formatNiceDate(event.end_date)}`
    : formatNiceDate(event.start_date);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.detailsHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Badge color={color} big>{meta.emoji} {event.type}</Badge>
          <Badge color="#6B7280" big>{dateLabel}</Badge>
          <Badge color="#6B7280" big>{formatTimeRange(event)}</Badge>
          {event.location ? <Badge color="#A0826D" big>📍 {event.location}</Badge> : null}
        </div>
      </div>

      {event.description ? (
        <div style={styles.detailsSection}>
          <div style={styles.sectionTitle}>Description</div>
          <div style={{ color: "#2C2C2C", whiteSpace: "pre-wrap" }}>{event.description}</div>
        </div>
      ) : null}

      <div style={styles.detailsSection}>
        <div style={styles.sectionTitle}>Target Audience</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(event.audiences || []).map((a) => (
            <Pill key={a}>{a}</Pill>
          ))}
        </div>
      </div>

      {event.recurring ? (
        <div style={styles.detailsSection}>
          <div style={styles.sectionTitle}>Recurrence</div>
          <div style={{ color: "#2C2C2C" }}>
            Repeats <b>{event.repeat_pattern}</b> until <b>{event.repeat_until}</b>
          </div>
        </div>
      ) : null}

      <div style={styles.detailsSection}>
        <div style={styles.sectionTitle}>Metadata</div>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          Created by <b>{event.created_by || "Admin"}</b> • Created: {new Date(event.created_at).toLocaleString()} • Updated: {new Date(event.updated_at).toLocaleString()}
        </div>
      </div>

      <div style={styles.modalActions}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={16} /> Close</button>
        <button style={styles.primaryBtn} onClick={onEdit}><Pencil size={16} /> Edit Event</button>
        <button style={styles.dangerBtn} onClick={onDelete}><Trash2 size={16} /> Delete</button>
      </div>
    </div>
  );
}

function DeleteEventDialog({ event, onCancel, onDelete }) {
  const [mode, setMode] = useState("this");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.deleteBox}>
        <div style={{ fontWeight: 950 }}>⚠️ Delete Event?</div>
        <div style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }}>
          Are you sure you want to delete:
          <div style={{ marginTop: 6, fontWeight: 950, color: "#2C2C2C" }}>
            {event.title}
          </div>
          <div style={{ marginTop: 4 }}>
            Date: <b>{formatNiceDate(event.start_date)}</b>
            {event.end_date ? ` – ${formatNiceDate(event.end_date)}` : ""}
          </div>
        </div>
      </div>

      {event.recurring ? (
        <div style={styles.detailsSection}>
          <div style={styles.sectionTitle}>Recurring Event</div>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={styles.radioRow}>
              <input type="radio" checked={mode === "this"} onChange={() => setMode("this")} />
              This event only
            </label>
            <label style={styles.radioRow}>
              <input type="radio" checked={mode === "future"} onChange={() => setMode("future")} />
              This and future events
            </label>
            <label style={styles.radioRow}>
              <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
              All events in the series
            </label>
            <div style={{ color: "#6B7280", fontSize: 12 }}>
              (UI note) Series deletion will be implemented when recurrence is stored as a series.
            </div>
          </div>
        </div>
      ) : null}

      <div style={styles.modalActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.dangerBtn} onClick={() => onDelete(mode)}>Delete Event</button>
      </div>
    </div>
  );
}

/* =====================
   UI PRIMITIVES
===================== */

function ToggleBtn({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.toggleBtn,
        borderColor: active ? "#DAA520" : "#E5E7EB",
        background: active ? "#FFFBEB" : "#fff",
      }}
    >
      {icon} {children}
    </button>
  );
}

function MiniStat({ label, value, tone }) {
  const map = {
    brown: { top: "#A0826D" },
    gold: { top: "#DAA520" },
    blue: { top: "#3B82F6" },
  };
  const c = map[tone] || map.brown;
  return (
    <div style={{ ...styles.miniStat, borderTopColor: c.top }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>{value}</div>
      <div style={{ color: "#6B7280", fontSize: 12 }}>{label}</div>
    </div>
  );
}

function Badge({ color, children, big }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 12px" : "6px 10px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: "#fff",
        color: "#2C2C2C",
        fontWeight: 950,
        fontSize: big ? 13 : 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        color: "#2C2C2C",
        background: "#FAF9F6",
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        padding: "4px 10px",
      }}
    >
      {children}
    </span>
  );
}

function RHFText({ form, name, label, placeholder }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <input {...form.register(name)} placeholder={placeholder} style={styles.input} />
      {err ? <div style={styles.err}>{String(err)}</div> : null}
    </div>
  );
}

function Modal({ open, title, onClose, wide, children }) {
  if (!open) return null;
  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        style={{
          ...styles.modal,
          width: wide ? "min(1080px, 100%)" : "min(820px, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <button style={styles.iconBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* =====================
   STYLES
===================== */

const styles = {
  title: { margin: 0, fontWeight: 950, color: "#2C2C2C" },
  sub: { marginTop: 6, color: "#6B7280" },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  primaryBtn: {
    background: "#A0826D",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 20px rgba(160,130,109,0.35)",
  },

  ghostBtn: {
    background: "transparent",
    color: "#2C2C2C",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  dangerBtn: {
    background: "#EF4444",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    background: "#FAF9F6",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "8px 10px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2C2C2C",
  },

  topBar: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },

  miniStat: {
    background: "#FDFBF7",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 12,
    borderTop: "4px solid",
  },

  controlsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewToggle: { display: "flex", gap: 10, flexWrap: "wrap" },
  toggleBtn: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#2C2C2C",
  },

  navRow: { display: "flex", gap: 10, alignItems: "center" },

  monthLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 950,
    color: "#2C2C2C",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#FDFBF7",
  },

  filterCard: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    marginBottom: 14,
  },

  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 0.7fr 0.9fr",
    gap: 12,
    alignItems: "start",
  },

  label: { fontSize: 12, color: "#6B7280", fontWeight: 900 },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
  },

  typeChips: { display: "flex", flexWrap: "wrap", gap: 8 },
  typeChip: {
    border: "1px solid #E5E7EB",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#2C2C2C",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.8fr 1fr",
    gap: 14,
    alignItems: "start",
  },

  mainPanel: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },

  sidePanel: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    position: "sticky",
    top: 12,
  },

  sideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  sideList: { display: "grid", gap: 10, maxHeight: 620, overflow: "auto", paddingRight: 4 },
  sideItem: { border: "1px solid #E5E7EB", borderRadius: 14, padding: 12, background: "#FDFBF7" },

  calendarHeaderRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 10,
    marginBottom: 10,
  },

  dow: {
    fontSize: 12,
    fontWeight: 950,
    color: "#6B7280",
    textAlign: "center",
    padding: "8px 0",
    borderRadius: 12,
    background: "#FDFBF7",
    border: "1px solid #E5E7EB",
  },

  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 },

  dayCell: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 10,
    minHeight: 120,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  dayTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  dayNum: { fontWeight: 950, color: "#2C2C2C" },

  quickAdd: {
    background: "#FAF9F6",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "6px 8px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#2C2C2C",
  },

  indicators: { display: "grid", gap: 6 },

  indicatorBadge: {
    width: "100%",
    textAlign: "left",
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: "6px 8px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },

  indicatorText: {
    fontSize: 12,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#2C2C2C",
  },

  moreEvents: { color: "#6B7280", fontSize: 12, fontWeight: 900 },

  weekGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 },
  weekCol: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 10,
    minHeight: 260,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(0,0,0,0.05)",
  },
  weekColHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 },
  weekEvents: { display: "grid", gap: 8 },
  weekEventPill: {
    border: "1px solid #E5E7EB",
    background: "#FDFBF7",
    borderRadius: 12,
    padding: "8px 10px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    textAlign: "left",
  },

  listGroup: { border: "1px solid #E5E7EB", borderRadius: 16, background: "#fff", overflow: "hidden" },
  listGroupHeader: {
    padding: 12,
    fontWeight: 950,
    color: "#2C2C2C",
    background: "#FDFBF7",
    borderBottom: "1px solid #E5E7EB",
  },
  listItem: { display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #F3F4F6" },
  listDateBox: {
    width: 64,
    minWidth: 64,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    display: "grid",
    placeItems: "center",
    padding: 10,
  },

  // Forms
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
    resize: "vertical",
  },
  err: { color: "#EF4444", fontSize: 12, fontWeight: 900 },
  checkboxRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    fontWeight: 900,
  },

  audienceBox: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 10,
    background: "#FDFBF7",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 8,
    maxHeight: 220,
    overflow: "auto",
  },

  audienceItem: {
    display: "inline-flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#fff",
    fontWeight: 900,
    color: "#2C2C2C",
  },

  detailsHeader: { borderRadius: 16, border: "1px solid #E5E7EB", background: "#FDFBF7", padding: 12 },
  detailsSection: { borderRadius: 16, border: "1px solid #E5E7EB", background: "#fff", padding: 12 },
  sectionTitle: { fontWeight: 950, color: "#A0826D", marginBottom: 8 },

  deleteBox: { borderRadius: 16, border: "1px solid #EF4444", background: "#FEF2F2", padding: 12 },
  radioRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    fontWeight: 900,
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    padding: 14,
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  modalBody: { padding: 14 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 6 },
};

// Responsive: stack sidebar under main on small screens
// (inline style approach; in production, move to CSS)
if (typeof window !== "undefined") {
  const mq = window.matchMedia("(max-width: 980px)");
  const apply = () => {
    const root = document.documentElement;
    if (mq.matches) {
      root.style.setProperty("--cal-cols", "1fr");
    } else {
      root.style.setProperty("--cal-cols", "1.8fr 1fr");
    }
  };
  apply();
  mq.addEventListener?.("change", apply);
}

// Patch mainGrid columns using CSS var (safe if var not set)
styles.mainGrid.gridTemplateColumns = "var(--cal-cols, 1.8fr 1fr)";

// Tiny smoke test: schema should reject empty title
console.assert(eventSchema.safeParse({
  title: "",
  type: "Holiday",
  start_date: "2025-12-01",
  audiences: ["All Students"],
  all_day: true,
  recurring: false,
}).success === false, "Event schema should reject empty title");
