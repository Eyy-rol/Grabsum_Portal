import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  Plus,
  Search,
  X,
  Save,
  Pencil,
  Archive,
  RotateCcw,
  Calendar,
} from "lucide-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

/* ================== UI THEME (same as Enrollment) ================== */
const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  gold: "text-[#C9A227]",
  goldBg: "bg-[#C9A227]",
  goldSoft: "bg-[#C9A227]/10",
  brown: "text-[#6B4E2E]",
};

/* ================== Status options ================== */
const CLASS_STATUS = ["Open", "Closed", "Cancelled"];

/* ================== Validation (Create/Edit) ================== */
const classSchema = z.object({
  class_code: z.string().min(1, "Class Code is required").max(50),
  subject_id: z.string().min(1, "Subject is required"),
  section_id: z.string().min(1, "Section is required"),
  sy_id: z.string().min(1, "School Year is required"),
  term_id: z.string().min(1, "Term is required"),

  // OPTIONAL but recommended for scheduling
  teacher_user_id: z.string().optional().or(z.literal("")),

  room: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().min(0, "Capacity must be 0 or higher"),
  status: z.enum(["Open", "Closed", "Cancelled"]),
  notes: z.string().optional().or(z.literal("")),
});

/* ================== Scheduling helpers ================== */
// Weekly template
const TEMPLATE_WEEK = {
  1: "2025-01-06", // Mon
  2: "2025-01-07",
  3: "2025-01-08",
  4: "2025-01-09",
  5: "2025-01-10",
  6: "2025-01-11",
  7: "2025-01-12", // Sun
};

const DAYS = [
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
  { v: 7, label: "Sun" },
];

function dayLabel(dow) {
  return DAYS.find((d) => d.v === dow)?.label || `Day ${dow}`;
}

function toTemplateTimestamp(dayOfWeek, hhmm) {
  const date = TEMPLATE_WEEK[dayOfWeek];
  if (!date) throw new Error("Invalid day_of_week");
  return `${date} ${hhmm}:00`;
}

function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// overlap rule using [start, end) — end exclusive
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Friendly DB constraint messages (based on your constraint names)
function friendlyScheduleError(err) {
  const msg = String(err?.message || "");
  if (msg.includes("no_room_time_conflict"))
    return "Conflict: Another class is already scheduled in that room at the same time.";
  if (msg.includes("no_section_time_conflict"))
    return "Conflict: This section already has a class at the same time.";
  if (msg.includes("no_teacher_time_conflict"))
    return "Conflict: This teacher already has a class at the same time.";
  if (msg.includes("no_class_time_conflict"))
    return "Conflict: This class already has an overlapping schedule.";
  return msg || "Failed to save schedule.";
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function Classes() {
  const qc = useQueryClient();
  const toast = useToast();

  // Filters
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [view, setView] = useState("Active"); // Active | Archived | All

  // Modal state
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });
  const closeModal = () => setModal({ open: false, mode: "create", row: null });

  // Archive confirm modal state
  const [archiveConfirm, setArchiveConfirm] = useState({ open: false, row: null });

  // Schedule modal state
  const [scheduleModal, setScheduleModal] = useState({
    open: false,
    klass: null,
    existing: [], // existing schedules from DB (active only)
  });

  const [schedSlots, setSchedSlots] = useState([]); // new slots to add
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);

  const [slotArchiveConfirm, setSlotArchiveConfirm] = useState({ open: false, slot: null });
  const [slotArchiving, setSlotArchiving] = useState(false);

  // Current user (for admin-only Restore + edit archived)
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user ?? null;
    },
  });

  // ⚠️ Adjust later to your real role system (profiles table + RLS)
  const isAdmin = meQ.data?.user_metadata?.role === "admin";

  /* ================== Dropdowns (loaded only when modal opens) ================== */
  const dropdownQ = useQuery({
    queryKey: ["classDropdowns"],
    enabled: modal.open,
    queryFn: async () => {
      const [subjRes, secRes, syRes, termRes] = await Promise.all([
        supabase
          .from("subjects")
          .select("subject_id, subject_code, subject_title")
          .order("subject_code", { ascending: true }),

        supabase
          .from("sections")
          .select("section_id, section_name, adviser_name")
          .order("section_name", { ascending: true }),

        supabase
          .from("school_years")
          .select("sy_id, sy_code, start_date, end_date, status")
          .order("start_date", { ascending: false }),

        supabase
          .from("terms")
          .select("term_id, term_code, description")
          .order("term_code", { ascending: true }),
      ]);

      if (subjRes.error) throw subjRes.error;
      if (secRes.error) throw secRes.error;
      if (syRes.error) throw syRes.error;
      if (termRes.error) throw termRes.error;

      return {
        subjects: subjRes.data ?? [],
        sections: secRes.data ?? [],
        schoolYears: syRes.data ?? [],
        terms: termRes.data ?? [],
      };
    },
  });

  /* ================== READ classes (IMPORTANT: fixed select string) ================== */
  const classesQ = useQuery({
    queryKey: ["classes", view],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(
          `
          class_id,
          class_code,
          subject_id,
          section_id,
          sy_id,
          term_id,
          teacher_user_id,
          room,
          capacity,
          status,
          notes,
          created_at,
          updated_at,
          is_archived,
          archived_at,

          subjects (
            subject_code,
            subject_title,
            subject_type,
            units
          ),

          sections (
            section_name,
            adviser_name
          ),

          school_years (
            sy_code,
            start_date,
            end_date,
            status
          ),

          terms (
            term_code,
            description
          )
        `
        )
        .order("created_at", { ascending: false });

      if (view === "Active") query = query.eq("is_archived", false);
      if (view === "Archived") query = query.eq("is_archived", true);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = classesQ.data ?? [];

  /* ================== Filtered rows ================== */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) =>
        needle
          ? String(r.class_code || "").toLowerCase().includes(needle) ||
            String(r.subjects?.subject_title || "").toLowerCase().includes(needle) ||
            String(r.subjects?.subject_code || "").toLowerCase().includes(needle) ||
            String(r.sections?.section_name || "").toLowerCase().includes(needle) ||
            String(r.school_years?.sy_code || "").toLowerCase().includes(needle) ||
            String(r.terms?.term_code || "").toLowerCase().includes(needle)
          : true
      )
      .filter((r) => (fStatus === "All" ? true : r.status === fStatus));
  }, [rows, q, fStatus]);

  /* ================== Duplicate class_code check ================== */
  async function classCodeExists(code, excludeClassId = null) {
    const base = supabase.from("classes").select("class_id").eq("class_code", code).limit(1);
    const { data, error } = excludeClassId ? await base.neq("class_id", excludeClassId) : await base;
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /* ================== CREATE ================== */
  const createM = useMutation({
    mutationFn: async (values) => {
      const code = values.class_code.trim();
      const dup = await classCodeExists(code);
      if (dup) throw new Error(`Class Code "${code}" already exists.`);

      const payload = {
        class_code: code,
        subject_id: values.subject_id,
        section_id: values.section_id,
        sy_id: values.sy_id,
        term_id: values.term_id,
        teacher_user_id: values.teacher_user_id || null,
        room: values.room?.trim() || null,
        capacity: Number(values.capacity),
        status: values.status,
        notes: values.notes?.trim() || null,
        is_archived: false,
        archived_at: null,
      };

      const { error } = await supabase.from("classes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.push({ type: "success", title: "Class created" });
      qc.invalidateQueries({ queryKey: ["classes"] });
      closeModal();
    },
    onError: (e) =>
      toast.push({
        type: "error",
        title: "Create failed",
        message: String(e.message || e),
      }),
  });

  /* ================== UPDATE ================== */
  const updateM = useMutation({
    mutationFn: async ({ class_id, values }) => {
      const code = values.class_code.trim();
      const dup = await classCodeExists(code, class_id);
      if (dup) throw new Error(`Class Code "${code}" already exists.`);

      const patch = {
        class_code: code,
        subject_id: values.subject_id,
        section_id: values.section_id,
        sy_id: values.sy_id,
        term_id: values.term_id,
        teacher_user_id: values.teacher_user_id || null,
        room: values.room?.trim() || null,
        capacity: Number(values.capacity),
        status: values.status,
        notes: values.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("classes").update(patch).eq("class_id", class_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.push({ type: "success", title: "Class updated" });
      qc.invalidateQueries({ queryKey: ["classes"] });
      closeModal();
    },
    onError: (e) =>
      toast.push({
        type: "error",
        title: "Update failed",
        message: String(e.message || e),
      }),
  });

  /* ================== ARCHIVE (replaces delete) ================== */
  const archiveM = useMutation({
    mutationFn: async (row) => {
      const patch = {
        is_archived: true,
        archived_at: new Date().toISOString(),
        status: "Closed",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("classes").update(patch).eq("class_id", row.class_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.push({ type: "success", title: "Class archived" });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e) =>
      toast.push({
        type: "error",
        title: "Archive failed",
        message: String(e.message || e),
      }),
  });

  /* ================== RESTORE (admin-only) ================== */
  const restoreM = useMutation({
    mutationFn: async (row) => {
      const patch = {
        is_archived: false,
        archived_at: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("classes").update(patch).eq("class_id", row.class_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.push({ type: "success", title: "Class restored" });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e) =>
      toast.push({
        type: "error",
        title: "Restore failed",
        message: String(e.message || e),
      }),
  });

  function openCreate() {
    setModal({ open: true, mode: "create", row: null });
  }

  function openEdit(row) {
    if (row?.is_archived && !isAdmin) {
      toast.push({
        type: "error",
        title: "Editing blocked",
        message: "Archived classes can only be edited by admins.",
      });
      return;
    }
    setModal({ open: true, mode: "edit", row });
  }

  function onArchive(row) {
    setArchiveConfirm({ open: true, row });
  }

  function onRestore(row) {
    if (!isAdmin) {
      toast.push({
        type: "error",
        title: "Not allowed",
        message: "Only admins can restore archived classes.",
      });
      return;
    }
    restoreM.mutate(row);
  }

  const busy = createM.isPending || updateM.isPending;

  const viewTabs = ["Active", "Archived", "All"];

  /* ================== Schedule modal: open/close/load ================== */
  async function openScheduleModal(klass) {
    // block scheduling if archived (unless admin)
    if (klass?.is_archived && !isAdmin) {
      toast.push({
        type: "error",
        title: "Scheduling blocked",
        message: "Archived classes can only be scheduled by admins.",
      });
      return;
    }

    // Must have section_id (for conflict check) — you already have it in query.
    if (!klass.section_id) {
      toast.push({
        type: "error",
        title: "Missing section",
        message: "This class has no section_id. Please edit the class first.",
      });
      return;
    }

    setScheduleModal({ open: true, klass, existing: [] });
    setSchedSlots([]);
    setSchedLoading(true);

    try {
      const { data, error } = await supabase
        .from("class_schedules")
        .select("schedule_id, day_of_week, room, start_at, end_at, is_archived")
        .eq("class_id", klass.class_id)
        .eq("is_archived", false)
        .order("day_of_week", { ascending: true })
        .order("start_at", { ascending: true });

      if (error) throw error;

      setScheduleModal((m) => ({ ...m, existing: data ?? [] }));

      // Start with one row
      setSchedSlots([
        { day_of_week: 1, startTime: "08:00", endTime: "09:00", room: klass.room ?? "" },
      ]);
    } catch (e) {
      toast.push({ type: "error", title: "Failed to load schedules", message: String(e.message || e) });
    } finally {
      setSchedLoading(false);
    }
  }

  function closeScheduleModal() {
    if (schedSaving || slotArchiving) return; // prevent closing while saving/archiving
    setScheduleModal({ open: false, klass: null, existing: [] });
    setSchedSlots([]);
  }

  function addSlotRow() {
    setSchedSlots((prev) => [
      ...prev,
      { day_of_week: 1, startTime: "08:00", endTime: "09:00", room: scheduleModal.klass?.room ?? "" },
    ]);
  }

  function removeSlotRow(idx) {
    setSchedSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSlot(idx, patch) {
    setSchedSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function validateSlots(slots) {
    if (!slots.length) return "Add at least one schedule slot.";
    for (const s of slots) {
      if (!s.day_of_week) return "Day is required.";
      if (!s.startTime || !s.endTime) return "Start/End time is required.";
      if (s.startTime >= s.endTime) return "End time must be later than start time.";
      if (!String(s.room || "").trim()) return "Room is required.";
    }
    return "";
  }

  /* ================== Visual conflict preview (client-side) ================== */
  const conflictPreview = useMemo(() => {
    const klass = scheduleModal.klass;
    if (!scheduleModal.open || !klass) return [];

    const existing = (scheduleModal.existing ?? []).map((x) => ({
      day: x.day_of_week,
      room: String(x.room || "").trim().toLowerCase(),
      start: String(x.start_at).slice(11, 16),
      end: String(x.end_at).slice(11, 16),
    }));

    const incoming = (schedSlots ?? []).map((s, idx) => ({
      idx,
      day: Number(s.day_of_week),
      room: String(s.room || "").trim().toLowerCase(),
      start: s.startTime,
      end: s.endTime,
    }));

    const issues = [];

    // incoming vs incoming
    for (let i = 0; i < incoming.length; i++) {
      for (let j = i + 1; j < incoming.length; j++) {
        const A = incoming[i];
        const B = incoming[j];
        if (A.day !== B.day) continue;

        const aS = hhmmToMinutes(A.start);
        const aE = hhmmToMinutes(A.end);
        const bS = hhmmToMinutes(B.start);
        const bE = hhmmToMinutes(B.end);

        if (overlaps(aS, aE, bS, bE)) {
          issues.push({
            type: "New slots overlap",
            detail: `Slot #${A.idx + 1} overlaps slot #${B.idx + 1} (${dayLabel(A.day)} ${A.start}-${A.end})`,
          });
        }
      }
    }

    // incoming vs existing (same class)
    for (const N of incoming) {
      const nS = hhmmToMinutes(N.start);
      const nE = hhmmToMinutes(N.end);

      for (const E of existing) {
        if (N.day !== E.day) continue;

        const eS = hhmmToMinutes(E.start);
        const eE = hhmmToMinutes(E.end);
        if (!overlaps(nS, nE, eS, eE)) continue;

        issues.push({
          type: "Overlaps existing schedule",
          detail: `${dayLabel(N.day)} ${N.start}-${N.end} overlaps an existing slot for this class.`,
        });

        // room-specific warning within same class
        if (N.room && E.room && N.room === E.room) {
          issues.push({
            type: "Room overlap (same class)",
            detail: `${dayLabel(N.day)} ${N.start}-${N.end} overlaps in room "${N.room}".`,
          });
        }
      }
    }

    // unique
    const seen = new Set();
    return issues.filter((x) => {
      const k = `${x.type}|${x.detail}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [scheduleModal.open, scheduleModal.klass, scheduleModal.existing, schedSlots]);

  /* ================== Save schedule slots ================== */
  async function saveScheduleSlots() {
    const klass = scheduleModal.klass;
    if (!klass) return;

    // Must have teacher assigned for teacher-conflict check
    if (!klass.teacher_user_id) {
      toast.push({
        type: "error",
        title: "Missing teacher",
        message: "This class has no assigned teacher. Please set teacher first.",
      });
      return;
    }

    const msg = validateSlots(schedSlots);
    if (msg) {
      toast.push({ type: "error", title: "Validation", message: msg });
      return;
    }

    if (conflictPreview.length > 0) {
      toast.push({
        type: "error",
        title: "Resolve conflicts first",
        message: "Fix the conflict preview before saving.",
      });
      return;
    }

    setSchedSaving(true);
    try {
      const payload = schedSlots.map((s) => ({
        class_id: klass.class_id,
        section_id: klass.section_id,
        teacher_user_id: klass.teacher_user_id,
        room: String(s.room).trim(),
        day_of_week: Number(s.day_of_week),
        start_at: toTemplateTimestamp(Number(s.day_of_week), s.startTime),
        end_at: toTemplateTimestamp(Number(s.day_of_week), s.endTime),
      }));

      const { error } = await supabase.from("class_schedules").insert(payload);
      if (error) throw error;

      // reload schedules
      const { data, error: reloadErr } = await supabase
        .from("class_schedules")
        .select("schedule_id, day_of_week, room, start_at, end_at, is_archived")
        .eq("class_id", klass.class_id)
        .eq("is_archived", false)
        .order("day_of_week", { ascending: true })
        .order("start_at", { ascending: true });

      if (reloadErr) throw reloadErr;

      setScheduleModal((m) => ({ ...m, existing: data ?? [] }));
      setSchedSlots([]);

      toast.push({ type: "success", title: "Schedules saved" });
    } catch (e) {
      toast.push({
        type: "error",
        title: "Schedule save failed",
        message: friendlyScheduleError(e),
      });
    } finally {
      setSchedSaving(false);
    }
  }

  /* ================== Archive a single existing schedule slot ================== */
  async function archiveScheduleSlot(slot) {
    if (!slot?.schedule_id) return;

    setSlotArchiving(true);
    try {
      const { error } = await supabase
        .from("class_schedules")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("schedule_id", slot.schedule_id);

      if (error) throw error;

      // reload
      const klass = scheduleModal.klass;
      if (klass?.class_id) {
        const { data, error: reloadErr } = await supabase
          .from("class_schedules")
          .select("schedule_id, day_of_week, room, start_at, end_at, is_archived")
          .eq("class_id", klass.class_id)
          .eq("is_archived", false)
          .order("day_of_week", { ascending: true })
          .order("start_at", { ascending: true });

        if (reloadErr) throw reloadErr;

        setScheduleModal((m) => ({ ...m, existing: data ?? [] }));
      }

      toast.push({ type: "success", title: "Slot archived" });
    } catch (e) {
      toast.push({ type: "error", title: "Archive failed", message: String(e.message || e) });
    } finally {
      setSlotArchiving(false);
    }
  }

  /* ================== UI ================== */
  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastViewport toasts={toast.toasts} onClose={toast.remove} />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Classes</div>
          <div className={`text-sm ${UI.muted}`}>
            Archive instead of delete to keep history safe.
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Class
        </button>
      </div>

      {/* View Tabs (Active / Archived / All) */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {viewTabs.map((t) => {
            const active = view === t;
            return (
              <button
                key={t}
                onClick={() => setView(t)}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active
                    ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                    : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
              >
                <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Search (class / subject / section / SY / term)">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <Field label="Status">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...CLASS_STATUS].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end justify-end">
            <div className={`text-xs ${UI.muted}`}>
              Showing {filtered.length} of {rows.length}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold">Class List</div>
            {view === "Archived" ? (
              <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] px-2 py-1 text-[11px] font-extrabold text-black/70">
                Archived
              </span>
            ) : null}
          </div>

          <div className={`text-xs ${UI.muted}`}>Total: {rows.length}</div>
        </div>

        {classesQ.isLoading ? (
          <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
        ) : classesQ.isError ? (
          <div className="p-6 text-sm text-rose-700">
            Error: {String(classesQ.error?.message || classesQ.error)}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">SY / Term</th>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.class_id}
                  className="border-t border-black/10 hover:bg-black/[0.01]"
                >
                  <td className="px-4 py-3">
                    <div className="font-extrabold">{c.class_code}</div>
                    <div className="text-xs text-black/60">Cap: {c.capacity ?? "—"}</div>
                    {c.is_archived ? (
                      <div className="mt-1 text-[11px] text-black/50">
                        Archived: {c.archived_at ? new Date(c.archived_at).toLocaleString() : "—"}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.subjects?.subject_title ?? "—"}</div>
                    <div className="text-xs text-black/60">
                      {c.subjects?.subject_code ?? "—"} • {c.subjects?.subject_type ?? "—"} •{" "}
                      {c.subjects?.units ?? "—"} unit(s)
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.sections?.section_name ?? "—"}</div>
                    <div className="text-xs text-black/60">Adviser: {c.sections?.adviser_name ?? "—"}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold">{c.school_years?.sy_code ?? "—"}</div>
                    <div className="text-xs text-black/60">
                      {fmtDate(c.school_years?.start_date)} – {fmtDate(c.school_years?.end_date)}
                    </div>
                    <div className="mt-1 text-xs font-semibold">{c.terms?.term_code ?? "—"}</div>
                    <div className="text-xs text-black/60">{c.terms?.description ?? ""}</div>
                  </td>

                  <td className="px-4 py-3 text-black/70">{c.room ?? "—"}</td>

                  <td className="px-4 py-3">
                    <StatusPill value={c.status || "Open"} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {/* Schedule */}
                      <IconBtn
                        title="Schedule"
                        onClick={() => openScheduleModal(c)}
                        tone="plain"
                        disabled={c.is_archived && !isAdmin}
                      >
                        <Calendar className="h-5 w-5" />
                      </IconBtn>

                      {/* Edit */}
                      <IconBtn
                        title={c.is_archived && !isAdmin ? "Archived (admin only)" : "Edit"}
                        onClick={() => openEdit(c)}
                        tone={c.is_archived && !isAdmin ? "muted" : "gold"}
                        disabled={c.is_archived && !isAdmin}
                      >
                        <Pencil className="h-5 w-5" />
                      </IconBtn>

                      {/* Archive / Restore */}
                      {!c.is_archived ? (
                        <IconBtn title="Archive" onClick={() => onArchive(c)} tone="warn">
                          <Archive className="h-5 w-5" />
                        </IconBtn>
                      ) : (
                        <IconBtn
                          title={isAdmin ? "Restore" : "Restore (admin only)"}
                          onClick={() => onRestore(c)}
                          tone={isAdmin ? "good" : "muted"}
                          disabled={!isAdmin}
                        >
                          <RotateCcw className="h-5 w-5" />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                    No classes found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal.open ? (
        <ClassModal
          mode={modal.mode}
          row={modal.row}
          onClose={closeModal}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(class_id, values) => updateM.mutate({ class_id, values })}
          busy={busy}
          dropdowns={dropdownQ.data}
          dropdownLoading={dropdownQ.isLoading}
          dropdownError={
            dropdownQ.isError ? String(dropdownQ.error?.message || dropdownQ.error) : ""
          }
        />
      ) : null}

      {/* Confirm Archive Modal */}
      {archiveConfirm.open ? (
        <ConfirmArchiveModal
          row={archiveConfirm.row}
          busy={archiveM.isPending}
          onClose={() => {
            if (archiveM.isPending) return;
            setArchiveConfirm({ open: false, row: null });
          }}
          onConfirm={() => {
            const row = archiveConfirm.row;
            archiveM.mutate(row, {
              onSuccess: () => setArchiveConfirm({ open: false, row: null }),
            });
          }}
        />
      ) : null}

      {/* ================== Schedule Modal UI ================== */}
      {scheduleModal.open ? (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={schedSaving || slotArchiving ? undefined : closeScheduleModal}
          />

          <div className="absolute inset-0 flex items-start justify-center p-4">
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-lg flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
                <div>
                  <h2 className="text-lg font-extrabold leading-none">
                    Schedule — {scheduleModal.klass?.class_code}
                  </h2>
                  <p className="text-xs text-black/55 mt-1">
                    Add weekly slots. Conflicts are prevented by DB constraints.
                  </p>
                </div>

                <button
                  onClick={schedSaving || slotArchiving ? undefined : closeScheduleModal}
                  disabled={schedSaving || slotArchiving}
                  className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ${
                    schedSaving || slotArchiving ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-black/60" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 overflow-auto">
                {schedLoading ? (
                  <div className={`text-sm ${UI.muted}`}>Loading schedules…</div>
                ) : (
                  <div className="space-y-5">
                    {/* Existing */}
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                      <div className="text-sm font-extrabold mb-2">Existing schedules</div>
                      {scheduleModal.existing.length === 0 ? (
                        <div className={`text-sm ${UI.muted}`}>No schedules yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {scheduleModal.existing.map((x) => (
                            <div key={x.schedule_id} className="flex items-center justify-between gap-3">
                              <div className="text-sm">
                                <span className="font-extrabold">{dayLabel(x.day_of_week)}</span>{" "}
                                {String(x.start_at).slice(11, 16)}–{String(x.end_at).slice(11, 16)}
                                <span className="ml-3 text-black/60">{x.room}</span>
                              </div>
                              <button
                                onClick={() => setSlotArchiveConfirm({ open: true, slot: x })}
                                disabled={schedSaving || slotArchiving}
                                className={`rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.02] ${
                                  schedSaving || slotArchiving ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                              >
                                Archive
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Conflict preview */}
                    {conflictPreview.length > 0 ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="text-sm font-extrabold text-rose-700">
                          Conflict preview
                        </div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-rose-700 space-y-1">
                          {conflictPreview.slice(0, 8).map((c, i) => (
                            <li key={i}>
                              <span className="font-semibold">{c.type}:</span> {c.detail}
                            </li>
                          ))}
                        </ul>
                        {conflictPreview.length > 8 ? (
                          <div className="mt-2 text-xs text-rose-700">
                            + {conflictPreview.length - 8} more…
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* New slots */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold">Add new slots</div>
                      <button
                        type="button"
                        onClick={addSlotRow}
                        disabled={schedSaving}
                        className={`rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/[0.02] ${
                          schedSaving ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        + Add slot
                      </button>
                    </div>

                    {schedSlots.length === 0 ? (
                      <div className={`text-sm ${UI.muted}`}>No new slots added.</div>
                    ) : (
                      <div className="space-y-3">
                        {schedSlots.map((s, idx) => (
                          <div key={idx} className="rounded-2xl border border-black/10 p-4">
                            <div className="grid grid-cols-12 gap-3 items-end">
                              <div className="col-span-12 md:col-span-2">
                                <label className="block text-xs font-semibold text-black/55 mb-1">Day</label>
                                <select
                                  value={s.day_of_week}
                                  onChange={(e) => updateSlot(idx, { day_of_week: Number(e.target.value) })}
                                  disabled={schedSaving}
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                                >
                                  {DAYS.map((d) => (
                                    <option key={d.v} value={d.v}>
                                      {d.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="col-span-6 md:col-span-2">
                                <label className="block text-xs font-semibold text-black/55 mb-1">Start</label>
                                <input
                                  type="time"
                                  value={s.startTime}
                                  onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                                  disabled={schedSaving}
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                                />
                              </div>

                              <div className="col-span-6 md:col-span-2">
                                <label className="block text-xs font-semibold text-black/55 mb-1">End</label>
                                <input
                                  type="time"
                                  value={s.endTime}
                                  onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                                  disabled={schedSaving}
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                                />
                              </div>

                              <div className="col-span-12 md:col-span-5">
                                <label className="block text-xs font-semibold text-black/55 mb-1">Room</label>
                                <input
                                  value={s.room}
                                  onChange={(e) => updateSlot(idx, { room: e.target.value })}
                                  disabled={schedSaving}
                                  placeholder="e.g. Room 203"
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                                />
                              </div>

                              <div className="col-span-12 md:col-span-1 flex md:justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeSlotRow(idx)}
                                  disabled={schedSaving}
                                  className={`rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02] ${
                                    schedSaving ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 px-6 py-4 border-t bg-white">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={schedSaving || slotArchiving ? undefined : closeScheduleModal}
                    disabled={schedSaving || slotArchiving}
                    className={`rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
                      schedSaving || slotArchiving ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Close
                  </button>

                  <button
                    onClick={saveScheduleSlots}
                    disabled={schedSaving || schedLoading || conflictPreview.length > 0}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold text-black ${
                      schedSaving || schedLoading || conflictPreview.length > 0
                        ? "bg-[#C9A227]/60 cursor-not-allowed"
                        : "bg-[#C9A227] hover:opacity-95"
                    }`}
                  >
                    <Save className="h-4 w-4" />
                    {schedSaving ? "Saving..." : conflictPreview.length > 0 ? "Resolve conflicts" : "Save slots"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm slot archive modal (small) */}
      {slotArchiveConfirm.open ? (
        <ConfirmSmall
          title="Archive schedule slot?"
          description="This will remove the slot from active schedules."
          busy={slotArchiving}
          onClose={() => {
            if (slotArchiving) return;
            setSlotArchiveConfirm({ open: false, slot: null });
          }}
          onConfirm={async () => {
            const slot = slotArchiveConfirm.slot;
            setSlotArchiveConfirm({ open: false, slot: null });
            await archiveScheduleSlot(slot);
          }}
        />
      ) : null}
    </div>
  );
}

/* ================== Add/Edit Modal ================== */

function ClassModal({
  mode,
  row,
  onClose,
  onCreate,
  onUpdate,
  busy,
  dropdowns,
  dropdownLoading,
  dropdownError,
}) {
  const isEdit = mode === "edit";

  const subjects = dropdowns?.subjects ?? [];
  const sections = dropdowns?.sections ?? [];
  const schoolYears = dropdowns?.schoolYears ?? [];
  const terms = dropdowns?.terms ?? [];

  const defaults = useMemo(() => {
    return {
      class_code: row?.class_code || "",
      subject_id: row?.subject_id || subjects[0]?.subject_id || "",
      section_id: row?.section_id || sections[0]?.section_id || "",
      sy_id: row?.sy_id || schoolYears[0]?.sy_id || "",
      term_id: row?.term_id || terms[0]?.term_id || "",
      teacher_user_id: row?.teacher_user_id || "",
      room: row?.room || "",
      capacity: row?.capacity ?? 40,
      status: row?.status || "Open",
      notes: row?.notes || "",
    };
  }, [row, subjects, sections, schoolYears, terms]);

  const form = useForm({
    resolver: zodResolver(classSchema),
    defaultValues: defaults,
    values: defaults,
  });

  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  function submit(values) {
    if (isEdit) onUpdate(row.class_id, values);
    else onCreate(values);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-3xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{isEdit ? "Edit Class" : "Add Class"}</div>
              <div className={`text-xs ${UI.muted}`}>White + gold minimal design.</div>
            </div>

            <button
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ml-auto ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit(submit)} className="p-4 space-y-4 max-h-[75vh] overflow-auto">
            {dropdownLoading ? (
              <div className={`p-3 text-sm ${UI.muted}`}>Loading dropdowns…</div>
            ) : dropdownError ? (
              <div className="p-3 text-sm text-rose-700">{dropdownError}</div>
            ) : (
              <>
                <Section title="Class Info">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input label="Class Code *" error={errors.class_code?.message} {...register("class_code")} />
                    <Select label="Status" error={errors.status?.message} {...register("status")}>
                      {CLASS_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <Input label="Capacity" type="number" error={errors.capacity?.message} {...register("capacity")} />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Input label="Room" {...register("room")} />
                    <Input label="Notes" {...register("notes")} />
                  </div>

                  <div className="mt-3">
                    <Input label="Teacher User ID (optional for now)" {...register("teacher_user_id")} />
                    <div className="mt-1 text-xs text-black/55">
                      You can later replace this with a teacher dropdown when your teachers UI is ready.
                    </div>
                  </div>
                </Section>

                <Section title="Linked Records">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select label="Subject *" error={errors.subject_id?.message} {...register("subject_id")}>
                      {subjects.map((s) => (
                        <option key={s.subject_id} value={s.subject_id}>
                          {s.subject_code} — {s.subject_title}
                        </option>
                      ))}
                    </Select>

                    <Select label="Section *" error={errors.section_id?.message} {...register("section_id")}>
                      {sections.map((s) => (
                        <option key={s.section_id} value={s.section_id}>
                          {s.section_name}
                          {s.adviser_name ? ` • Adviser: ${s.adviser_name}` : ""}
                        </option>
                      ))}
                    </Select>

                    <Select label="School Year *" error={errors.sy_id?.message} {...register("sy_id")}>
                      {schoolYears.map((sy) => (
                        <option key={sy.sy_id} value={sy.sy_id}>
                          {sy.sy_code} {sy.status ? `(${sy.status})` : ""}
                        </option>
                      ))}
                    </Select>

                    <Select label="Term *" error={errors.term_id?.message} {...register("term_id")}>
                      {terms.map((t) => (
                        <option key={t.term_id} value={t.term_id}>
                          {t.term_code} {t.description ? `— ${t.description}` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Section>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={busy ? undefined : onClose}
                    disabled={busy}
                    className={`rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
                      busy ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    disabled={busy}
                    type="submit"
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                  >
                    <Save className="h-4 w-4" />
                    {busy ? "Saving..." : isEdit ? "Save Changes" : "Create"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}

/* ================== Confirm Archive Modal ================== */

function ConfirmArchiveModal({ row, busy, onClose, onConfirm }) {
  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold text-[#1F1A14]">Archive Class</div>
              <div className="mt-1 text-xs text-black/55">
                This will hide the class from Active view but keep history for reports/enrollments.
              </div>
            </div>

            <button
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4">
            <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
              <div className="text-xs text-black/55">You are archiving:</div>
              <div className="mt-1 text-sm font-extrabold text-[#1F1A14]">{row?.class_code || "—"}</div>
              <div className="mt-1 text-xs text-black/55">
                {row?.subjects?.subject_code ? `${row.subjects.subject_code} — ` : ""}
                {row?.subjects?.subject_title || ""}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={busy ? undefined : onClose}
                disabled={busy}
                className={`rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
                  busy ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={busy ? undefined : onConfirm}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-extrabold text-black hover:opacity-95 disabled:opacity-60"
              >
                <Archive className="h-4 w-4" />
                {busy ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================== Small confirm modal ================== */
function ConfirmSmall({ title, description, busy, onClose, onConfirm }) {
  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold text-[#1F1A14]">{title}</div>
              <div className="mt-1 text-xs text-black/55">{description}</div>
            </div>

            <button
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={busy ? undefined : onClose}
              disabled={busy}
              className={`rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
                busy ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={busy ? undefined : onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-extrabold text-black hover:opacity-95 disabled:opacity-60"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================== Toast ================== */

function useToast() {
  const [toasts, setToasts] = useState([]);

  function push({ type = "info", title, message }) {
    const id = (crypto?.randomUUID?.() ?? String(Date.now() + Math.random())).toString();
    setToasts((t) => [...t, { id, type, title, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  return { toasts, push, remove: (id) => setToasts((t) => t.filter((x) => x.id !== id)) };
}

function ToastViewport({ toasts, onClose }) {
  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="rounded-2xl border border-black/10 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-[#1F1A14]">{t.title}</div>
              {t.message ? <div className="mt-1 text-xs text-black/60">{t.message}</div> : null}
            </div>
            <button
              onClick={() => onClose(t.id)}
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5"
              aria-label="Close toast"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className={`h-full ${
                t.type === "success"
                  ? "bg-emerald-500/40"
                  : t.type === "error"
                  ? "bg-rose-500/40"
                  : "bg-[#C9A227]/40"
              }`}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================== Small Components ================== */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
      <div className={`text-sm font-extrabold ${UI.brown}`}>{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Input({ label, error, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <input
        type={type}
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function Select({ label, error, children, ...rest }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <select
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function IconBtn({ title, onClick, tone, disabled = false, children }) {
  const cls =
    tone === "warn"
      ? "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90"
      : tone === "good"
      ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
      : tone === "muted"
      ? "bg-black/5 text-black/45 hover:bg-black/10"
      : tone === "plain"
      ? "bg-white text-black/70 hover:bg-black/[0.02]"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ value }) {
  const v = String(value || "").trim().toLowerCase();
  const cls =
    v === "open"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "closed"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : v === "cancelled"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {value}
    </span>
  );
}
