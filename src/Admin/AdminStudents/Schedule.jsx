// src/pages/admin/Schedule.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Save,
  Wand2,
  Download,
  Copy,
  Menu,
  Minimize2,
  Maximize2,
  Rows3,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Info,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

/**
 * Senior High – Section Schedule Admin (Supabase wired)
 *
 * ✅ Table used: public.section_schedules
 * ✅ Role behavior:
 * - super_admin: full CRUD + bulk + clear + export
 * - admin: VIEW ONLY
 */

// ====== UI THEME (White + Gold, minimal brown) ======
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
  danger: "text-rose-700",
};

const SCHEDULE_TABLE = "section_schedules";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Teaching periods only (breaks are excluded)
const PERIODS = [
  { period_no: 1, label: "First Period", start: "07:00", end: "08:00" },
  { period_no: 2, label: "Second Period", start: "08:00", end: "09:00" },
  { period_no: 3, label: "Third Period", start: "09:20", end: "10:20" },
  { period_no: 4, label: "Fourth Period", start: "10:20", end: "11:20" },
  { period_no: 5, label: "Fifth Period", start: "12:10", end: "13:10" },
  { period_no: 6, label: "Sixth Period", start: "13:10", end: "14:10" },
  { period_no: 7, label: "Seventh Period", start: "14:30", end: "15:30" },
  { period_no: 8, label: "Eighth Period", start: "15:30", end: "16:30" },
  { period_no: 9, label: "Ninth Period", start: "16:30", end: "17:30" },
];

function slotKey(day, periodNo) {
  return `${day}|${periodNo}`;
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function timeRange(p) {
  return `${p.start}–${p.end}`;
}

function teacherName(t) {
  const first = (t?.first_name || "").trim();
  const last = (t?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || t?.email || t?.employee_number || "(Unnamed teacher)";
}

function sectionLabel(row) {
  const grade = row?.grade_levels?.grade_level ?? "—";
  const track = row?.tracks?.track_code ?? "—";
  const strand = row?.strands?.strand_code ?? "—";
  const name = row?.section_name ?? "—";
  return `Grade ${grade} • ${track} • ${strand} • Section ${name}`;
}

function adviserLabel(section) {
  const a = section?.adviser;
  if (!a) return "—";
  return teacherName(a);
}

function subjectLabel(s) {
  if (!s) return "";
  const code = s.subject_code ? `${s.subject_code} — ` : "";
  return `${code}${s.subject_title}`;
}

function csvEscape(value) {
  const v = String(value ?? "");
  // Escape quotes and wrap in quotes if needed
  const needs = /[",\n]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function toCsv(rows, headers) {
  // headers: [{ key, label }]
  const head = headers.map((h) => csvEscape(h.label)).join(",");
  const body = rows
    .map((r) => headers.map((h) => csvEscape(r[h.key])).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
}

function safeFileName(name) {
  return String(name || "")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");
}

/* ====================================================================== */

export default function SeniorHighScheduleAdminPage() {
  const qc = useQueryClient();

  // ===== Toasts (no external lib) =====
  const { toasts, pushToast, removeToast } = useToasts();

  // ====== Role / Permissions ======
  const meQ = useQuery({
    queryKey: ["me_role"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user?.id) return { role: "admin", email: user?.email ?? "" };

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return { role: "admin", email: user.email ?? "" };

      return {
        role: prof?.role ?? "admin",
        email: prof?.email ?? user.email ?? "",
      };
    },
  });

  const role = meQ.data?.role ?? "admin";
  const canEditSchedule = role === "super_admin";

  // ====== UI state ======
  const [activeTab, setActiveTab] = useState("Timetable"); // Timetable | List
  const [focusTable, setFocusTable] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  // Filters
  const [qSection, setQSection] = useState("");
  const [fGrade, setFGrade] = useState("All");
  const [fStrand, setFStrand] = useState("All");

  // Term + Section selection
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Slot modal
  const [slotModal, setSlotModal] = useState({ open: false, mode: "create", entry: null });
  const [slotForm, setSlotForm] = useState({
    day_of_week: "Mon",
    period_no: 1,
    subject_id: "",
    teacher_id: "",
    room: "",
    notes: "",
  });

  // Bulk modal
  const [bulkModal, setBulkModal] = useState({ open: false });
  const [bulkMode, setBulkMode] = useState("copy"); // copy | clear
  const [bulkSourceSectionId, setBulkSourceSectionId] = useState("");
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkTargetSectionIds, setBulkTargetSectionIds] = useState(new Set());

  function toggleTarget(sectionId) {
    setBulkTargetSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // ====== Queries ======

  const activeSyQ = useQuery({
    queryKey: ["active_school_year"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const termsQ = useQuery({
    queryKey: ["terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select("term_id, term_code, description")
        .order("term_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sectionsQ = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select(
          `
          section_id,
          section_name,
          grade_id,
          track_id,
          strand_id,
          adviser_id,
          adviser:adviser_id(user_id, first_name, last_name, email),
          grade_levels:grade_id(grade_id, grade_level),
          tracks:track_id(track_id, track_code),
          strands:strand_id(strand_id, strand_code)
        `
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("subject_id, subject_code, subject_title, subject_type, units, grade_id, strand_id")
        .order("subject_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const teachersQ = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("user_id, first_name, last_name, email, employee_number, status, is_archived")
        .eq("status", "Active")
        .eq("is_archived", false)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeSy = activeSyQ.data;
  const terms = termsQ.data ?? [];
const sections = useMemo(
  () => (sectionsQ.data ?? []).filter((s) => norm(s.section_name) !== "unclassified"),
  [sectionsQ.data]
);

  const subjects = subjectsQ.data ?? [];
  const teachers = teachersQ.data ?? [];

  // auto-select first term when loaded
  useEffect(() => {
    if (!selectedTermId && terms.length) setSelectedTermId(terms[0].term_id);
  }, [terms, selectedTermId]);

  // auto-select first section when loaded
  useEffect(() => {
    if (!selectedSectionId && sections.length) setSelectedSectionId(sections[0].section_id);
  }, [sections, selectedSectionId]);

  const selectedTerm = useMemo(
    () => terms.find((t) => t.term_id === selectedTermId) || null,
    [terms, selectedTermId]
  );

  const selectedSection = useMemo(
    () => sections.find((s) => s.section_id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const schedulesQ = useQuery({
    enabled: !!activeSy?.sy_id && !!selectedTermId && !!selectedSectionId,
    queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(SCHEDULE_TABLE)
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
          subject_id,
          teacher_id,
          room,
          notes,
          subjects:subject_id(subject_id, subject_code, subject_title),
          teachers:teacher_id(user_id, first_name, last_name, email, employee_number)
        `
        )
        .eq("sy_id", activeSy.sy_id)
        .eq("term_id", selectedTermId)
        .eq("section_id", selectedSectionId);

      if (error) throw error;
      return data ?? [];
    },
  });

  const allSySchedulesQ = useQuery({
    enabled: !!activeSy?.sy_id && !!selectedTermId,
    queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(SCHEDULE_TABLE)
        .select(
          `
          schedule_id,
          sy_id,
          term_id,
          section_id,
          day_of_week,
          period_no,
          teacher_id,
          room,
          subjects:subject_id(subject_id, subject_code, subject_title),
          sections:section_id(
            section_id,
            section_name,
            grade_levels:grade_id(grade_level),
            tracks:track_id(track_code),
            strands:strand_id(strand_code)
          )
        `
        )
        .eq("sy_id", activeSy.sy_id)
        .eq("term_id", selectedTermId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sectionSchedules = schedulesQ.data ?? [];
  const allSySchedules = allSySchedulesQ.data ?? [];

  // ====== Filters: grade & strand options ======
  const grades = useMemo(() => {
    const uniq = new Set();
    for (const s of sections) {
      const g = s?.grade_levels?.grade_level;
      if (g != null) uniq.add(String(g));
    }
    const arr = Array.from(uniq).sort((a, b) => Number(a) - Number(b));
    return ["All", ...arr];
  }, [sections]);

  const strands = useMemo(() => {
    const uniq = new Set();
    for (const s of sections) {
      const code = s?.strands?.strand_code;
      if (code) uniq.add(String(code));
    }
    return ["All", ...Array.from(uniq).sort()];
  }, [sections]);

  const filteredSections = useMemo(() => {
    const q = norm(qSection);
    return sections
      .filter((s) => {
        const label = sectionLabel(s);
        return q ? norm(label).includes(q) : true;
      })
      .filter((s) => (fGrade === "All" ? true : String(s?.grade_levels?.grade_level ?? "") === String(fGrade)))
      .filter((s) => (fStrand === "All" ? true : String(s?.strands?.strand_code ?? "") === String(fStrand)));
  }, [sections, qSection, fGrade, fStrand]);

  // Subjects appropriate for selected section (grade + strand). Null means "global".
  const subjectsForSection = useMemo(() => {
    if (!selectedSection) return subjects;
    const gid = selectedSection.grade_id;
    const sid = selectedSection.strand_id;

    return subjects.filter((subj) => {
      const gradeOk = !subj.grade_id || subj.grade_id === gid;
      const strandOk = !subj.strand_id || subj.strand_id === sid;
      return gradeOk && strandOk;
    });
  }, [subjects, selectedSection]);

  // ====== Timetable map ======
  const scheduleMap = useMemo(() => {
    const m = new Map();
    for (const e of sectionSchedules) {
      m.set(slotKey(e.day_of_week, Number(e.period_no)), e);
    }
    return m;
  }, [sectionSchedules]);

  // ====== Conflicts for selected section across SY+Term ======
  const conflictsForSelected = useMemo(() => {
    const map = new Map();
    if (!selectedSectionId) return map;

    const selectedEntries = allSySchedules.filter((x) => x.section_id === selectedSectionId);

    for (const entry of selectedEntries) {
      const key = slotKey(entry.day_of_week, Number(entry.period_no));
      const teacherClash = [];
      const roomClash = [];

      for (const other of allSySchedules) {
        if (other.section_id === selectedSectionId) continue;
        if (other.day_of_week !== entry.day_of_week) continue;
        if (Number(other.period_no) !== Number(entry.period_no)) continue;

        if (entry.teacher_id && other.teacher_id && other.teacher_id === entry.teacher_id) {
          teacherClash.push(other);
        }

        const rA = String(entry.room || "").trim().toLowerCase();
        const rB = String(other.room || "").trim().toLowerCase();
        if (rA && rB && rA === rB) roomClash.push(other);
      }

      if (teacherClash.length || roomClash.length) {
        map.set(key, { teacherClash, roomClash });
      }
    }

    return map;
  }, [allSySchedules, selectedSectionId]);

  const stats = useMemo(() => {
    const rooms = new Set();
    const subjectsSet = new Set();
    const teachersSet = new Set();

    for (const e of sectionSchedules) {
      if (e.room) rooms.add(String(e.room).trim().toLowerCase());
      if (e.subject_id) subjectsSet.add(e.subject_id);
      if (e.teacher_id) teachersSet.add(e.teacher_id);
    }

    return {
      count: sectionSchedules.length,
      rooms: rooms.size,
      subjects: subjectsSet.size,
      teachers: teachersSet.size,
      hasConflicts: conflictsForSelected.size > 0,
    };
  }, [sectionSchedules, conflictsForSelected]);

  // ====== Mutations ======

  async function checkConflicts({ schedule_id, day_of_week, period_no, teacher_id, room }) {
    // prevent multiple entries in same day/period for same section
    const localSlotTaken = sectionSchedules.some(
      (e) =>
        e.day_of_week === day_of_week &&
        Number(e.period_no) === Number(period_no) &&
        e.schedule_id !== schedule_id
    );
    if (localSlotTaken) {
      return { type: "section", message: "This section already has an entry for that day/period." };
    }

    // teacher + room conflicts across other sections (SY + Term)
    for (const other of allSySchedules) {
      if (other.section_id === selectedSectionId) continue;
      if (other.day_of_week !== day_of_week) continue;
      if (Number(other.period_no) !== Number(period_no)) continue;

      if (teacher_id && other.teacher_id && other.teacher_id === teacher_id) {
        return {
          type: "teacher",
          message: `Teacher conflict: already assigned in ${sectionLabel(other.sections)} at the same time.`,
        };
      }

      const rA = String(room || "").trim().toLowerCase();
      const rB = String(other.room || "").trim().toLowerCase();
      if (rA && rB && rA === rB) {
        return {
          type: "room",
          message: `Room conflict: ${room} is already used in ${sectionLabel(other.sections)} at the same time.`,
        };
      }
    }

    return null;
  }

  const upsertM = useMutation({
    mutationFn: async () => {
      if (!canEditSchedule) throw new Error("View-only: admin cannot modify schedules.");
      if (!activeSy?.sy_id) throw new Error("No active School Year.");
      if (!selectedTermId) throw new Error("Select a term.");
      if (!selectedSectionId) throw new Error("Select a section.");
      if (!slotForm.subject_id) throw new Error("Subject is required.");

      const p = PERIODS.find((x) => Number(x.period_no) === Number(slotForm.period_no));
      if (!p) throw new Error("Invalid period.");

      const payload = {
        sy_id: activeSy.sy_id,
        term_id: selectedTermId,
        section_id: selectedSectionId,
        day_of_week: slotForm.day_of_week,
        period_no: Number(slotForm.period_no),
        start_time: p.start,
        end_time: p.end,
        subject_id: slotForm.subject_id,
        teacher_id: slotForm.teacher_id ? slotForm.teacher_id : null,
        room: String(slotForm.room || "").trim() || null,
        notes: String(slotForm.notes || "").trim() || null,
      };

      const scheduleId = slotModal.mode === "edit" ? slotModal.entry?.schedule_id : null;

      const conflict = await checkConflicts({
        schedule_id: scheduleId,
        day_of_week: payload.day_of_week,
        period_no: payload.period_no,
        teacher_id: payload.teacher_id,
        room: payload.room,
      });

      if (conflict) throw new Error(conflict.message);

      if (slotModal.mode === "edit") {
        const { error } = await supabase.from(SCHEDULE_TABLE).update(payload).eq("schedule_id", scheduleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(SCHEDULE_TABLE).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
      });
      await qc.invalidateQueries({ queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId] });
      pushToast({ type: "success", title: "Saved", message: "Schedule entry updated." });
      closeSlotModal();
    },
    onError: (e) => {
      pushToast({ type: "error", title: "Save failed", message: String(e?.message || e) });
    },
  });

  const deleteM = useMutation({
    mutationFn: async (scheduleId) => {
      if (!canEditSchedule) throw new Error("View-only: admin cannot delete schedules.");
      const { error } = await supabase.from(SCHEDULE_TABLE).delete().eq("schedule_id", scheduleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
      });
      await qc.invalidateQueries({ queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId] });
      pushToast({ type: "success", title: "Deleted", message: "Schedule entry removed." });
    },
    onError: (e) => {
      pushToast({ type: "error", title: "Delete failed", message: String(e?.message || e) });
    },
  });

  const clearSectionM = useMutation({
    mutationFn: async () => {
      if (!canEditSchedule) throw new Error("View-only: admin cannot clear schedules.");
      if (!activeSy?.sy_id || !selectedTermId || !selectedSectionId) return;

      const { error } = await supabase
        .from(SCHEDULE_TABLE)
        .delete()
        .eq("sy_id", activeSy.sy_id)
        .eq("term_id", selectedTermId)
        .eq("section_id", selectedSectionId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
      });
      await qc.invalidateQueries({ queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId] });
      pushToast({ type: "success", title: "Cleared", message: "Section schedule cleared." });
    },
    onError: (e) => {
      pushToast({ type: "error", title: "Clear failed", message: String(e?.message || e) });
    },
  });

  const bulkM = useMutation({
    mutationFn: async () => {
      if (!canEditSchedule) throw new Error("View-only: admin cannot run bulk actions.");
      if (!activeSy?.sy_id) throw new Error("No active School Year.");
      if (!selectedTermId) throw new Error("Select a term.");

      const targets = Array.from(bulkTargetSectionIds);
      if (!targets.length) throw new Error("Select at least one target section.");

      if (bulkMode === "copy") {
        if (!bulkSourceSectionId) throw new Error("Select a source section.");

        const { data: source, error: srcErr } = await supabase
          .from(SCHEDULE_TABLE)
          .select("day_of_week, period_no, start_time, end_time, subject_id, teacher_id, room, notes")
          .eq("sy_id", activeSy.sy_id)
          .eq("term_id", selectedTermId)
          .eq("section_id", bulkSourceSectionId);

        if (srcErr) throw srcErr;

        for (const tid of targets) {
          if (tid === bulkSourceSectionId) continue;

          if (bulkOverwrite) {
            const { error: delErr } = await supabase
              .from(SCHEDULE_TABLE)
              .delete()
              .eq("sy_id", activeSy.sy_id)
              .eq("term_id", selectedTermId)
              .eq("section_id", tid);
            if (delErr) throw delErr;
          }

          const rows = (source ?? []).map((r) => ({
            ...r,
            sy_id: activeSy.sy_id,
            term_id: selectedTermId,
            section_id: tid,
            room: String(r.room || "").trim() || null,
            notes: String(r.notes || "").trim() || null,
          }));

          if (!bulkOverwrite) {
            const { data: existing, error: exErr } = await supabase
              .from(SCHEDULE_TABLE)
              .select("day_of_week, period_no")
              .eq("sy_id", activeSy.sy_id)
              .eq("term_id", selectedTermId)
              .eq("section_id", tid);

            if (exErr) throw exErr;

            const existingKeys = new Set((existing ?? []).map((e) => slotKey(e.day_of_week, e.period_no)));
            const filtered = rows.filter((r) => !existingKeys.has(slotKey(r.day_of_week, r.period_no)));

            if (filtered.length) {
              const { error: insErr } = await supabase.from(SCHEDULE_TABLE).insert(filtered);
              if (insErr) throw insErr;
            }
          } else {
            if (rows.length) {
              const { error: insErr } = await supabase.from(SCHEDULE_TABLE).insert(rows);
              if (insErr) throw insErr;
            }
          }
        }
      }

      if (bulkMode === "clear") {
        for (const tid of targets) {
          const { error } = await supabase
            .from(SCHEDULE_TABLE)
            .delete()
            .eq("sy_id", activeSy.sy_id)
            .eq("term_id", selectedTermId)
            .eq("section_id", tid);
          if (error) throw error;
        }
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
      });
      await qc.invalidateQueries({ queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId] });
      setBulkModal({ open: false });
      pushToast({ type: "success", title: "Bulk applied", message: "Bulk changes completed." });
    },
    onError: (e) => {
      pushToast({ type: "error", title: "Bulk failed", message: String(e?.message || e) });
    },
  });

  // ====== Modal helpers ======
  function openCreate(preset = {}) {
    if (!canEditSchedule) return;
    setSlotModal({ open: true, mode: "create", entry: null });
    setSlotForm({
      day_of_week: preset.day_of_week || "Mon",
      period_no: preset.period_no || 1,
      subject_id: "",
      teacher_id: "",
      room: "",
      notes: "",
    });
  }

  function openEdit(entry) {
    if (!canEditSchedule) return;
    setSlotModal({ open: true, mode: "edit", entry });
    setSlotForm({
      day_of_week: entry.day_of_week,
      period_no: Number(entry.period_no),
      subject_id: entry.subject_id || "",
      teacher_id: entry.teacher_id || "",
      room: entry.room || "",
      notes: entry.notes || "",
    });
  }

  function closeSlotModal() {
    setSlotModal({ open: false, mode: "create", entry: null });
  }

  function onDelete(entry) {
    if (!canEditSchedule) return;
    const p = PERIODS.find((x) => Number(x.period_no) === Number(entry.period_no));
    const ok = window.confirm(
      `Delete schedule entry?\n\n${entry.day_of_week} • Period ${entry.period_no} (${p ? timeRange(p) : ""})\n${subjectLabel(
        entry.subjects
      )}`
    );
    if (!ok) return;
    deleteM.mutate(entry.schedule_id);
  }

  // ===== CSV Export (current selected section) =====
  function exportCurrentSectionCsv() {
    if (!activeSy?.sy_id) {
      pushToast({ type: "error", title: "Export failed", message: "No active School Year." });
      return;
    }
    if (!selectedTermId || !selectedTerm) {
      pushToast({ type: "error", title: "Export failed", message: "Select a term first." });
      return;
    }
    if (!selectedSectionId || !selectedSection) {
      pushToast({ type: "error", title: "Export failed", message: "Select a section first." });
      return;
    }
    if (!sectionSchedules.length) {
      pushToast({ type: "info", title: "Nothing to export", message: "This section has no schedule entries yet." });
      return;
    }

    const sorted = sectionSchedules
      .slice()
      .sort((a, b) => {
        const da = DAYS.indexOf(a.day_of_week);
        const db = DAYS.indexOf(b.day_of_week);
        if (da !== db) return da - db;
        return Number(a.period_no) - Number(b.period_no);
      })
      .map((e) => ({
        day: e.day_of_week,
        period_no: e.period_no,
        start_time: e.start_time,
        end_time: e.end_time,
        subject_code: e.subjects?.subject_code || "",
        subject_title: e.subjects?.subject_title || "",
        teacher: e.teachers ? teacherName(e.teachers) : "",
        room: e.room || "",
        notes: e.notes || "",
      }));

    const headers = [
      { key: "day", label: "Day" },
      { key: "period_no", label: "Period No" },
      { key: "start_time", label: "Start Time" },
      { key: "end_time", label: "End Time" },
      { key: "subject_code", label: "Subject Code" },
      { key: "subject_title", label: "Subject Title" },
      { key: "teacher", label: "Teacher" },
      { key: "room", label: "Room" },
      { key: "notes", label: "Notes" },
    ];

    const csv = toCsv(sorted, headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const sy = safeFileName(activeSy?.sy_code || "SY");
    const term = safeFileName(selectedTerm?.term_code || "TERM");
    const section = safeFileName(selectedSection?.section_name || "SECTION");

    const filename = `${sy}_${term}_Section-${section}_Schedule.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    pushToast({ type: "success", title: "Exported", message: `Downloaded CSV: ${filename}` });
  }

  // ====== Slot modal conflict preview ======
  const slotPreviewConflicts = useMemo(() => {
    if (!activeSy?.sy_id || !selectedSectionId) return { teacherOverlaps: [], roomOverlaps: [] };

    const teacherOverlaps = [];
    const roomOverlaps = [];

    const day = slotForm.day_of_week;
    const period_no = Number(slotForm.period_no);

    for (const other of allSySchedules) {
      if (other.section_id === selectedSectionId) continue;
      if (other.day_of_week !== day) continue;
      if (Number(other.period_no) !== period_no) continue;

      if (slotForm.teacher_id && other.teacher_id === slotForm.teacher_id) teacherOverlaps.push(other);

      const roomA = String(slotForm.room || "").trim();
      const roomB = String(other.room || "").trim();
      if (roomA && roomB && roomA.toLowerCase() === roomB.toLowerCase()) roomOverlaps.push(other);
    }

    return { teacherOverlaps, roomOverlaps };
  }, [
    allSySchedules,
    activeSy?.sy_id,
    selectedSectionId,
    slotForm.day_of_week,
    slotForm.period_no,
    slotForm.teacher_id,
    slotForm.room,
  ]);

  // ====== Loading & errors ======
  const loading =
    meQ.isLoading ||
    activeSyQ.isLoading ||
    termsQ.isLoading ||
    sectionsQ.isLoading ||
    subjectsQ.isLoading ||
    teachersQ.isLoading ||
    schedulesQ.isLoading ||
    allSySchedulesQ.isLoading;

  const anyError =
    meQ.isError ||
    activeSyQ.isError ||
    termsQ.isError ||
    sectionsQ.isError ||
    subjectsQ.isError ||
    teachersQ.isError ||
    schedulesQ.isError ||
    allSySchedulesQ.isError;

  const errMsg =
    (meQ.error?.message || "") +
    (activeSyQ.error?.message || "") +
    (termsQ.error?.message || "") +
    (sectionsQ.error?.message || "") +
    (subjectsQ.error?.message || "") +
    (teachersQ.error?.message || "") +
    (schedulesQ.error?.message || "") +
    (allSySchedulesQ.error?.message || "");

  const cellPad = compact ? "px-2 py-2" : "px-4 py-3";
  const periodPad = compact ? "px-3 py-2" : "px-4 py-3";

  // ====== UI helpers ======
  const pageTitle = "Class Schedules";
 
  const metaChips = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Chip tone="muted">
        Role: <b className="text-black">{role || "—"}</b>
      </Chip>
      <Chip tone="muted">
        Active SY: <b className="text-black">{activeSy?.sy_code || "—"}</b>
      </Chip>
      <Chip tone="muted">
        Term: <b className="text-black">{selectedTerm?.term_code || "—"}</b>
      </Chip>
    </div>
  );

  return (
    <div className={`${UI.pageBg} ${UI.text} min-h-screen`}>
      {/* Toast Host */}
      <ToastHost toasts={toasts} onClose={removeToast} />

      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 space-y-4">
        {/* ====== Header ====== */}
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="text-lg font-extrabold">{pageTitle}</div>
       
              <div className="pt-1">{metaChips}</div>
            </div>

            {/* Right header controls */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px]">
                <SelectField
                  label="Term"
                  value={selectedTermId || ""}
                  onChange={setSelectedTermId}
                  options={[{ value: "", label: "Select term" }, ...terms.map((t) => ({ value: t.term_id, label: t.term_code }))]}
                />
              </div>

              <ActionBtn
                icon={Wand2}
                label="Bulk actions"
                onClick={() => setBulkModal({ open: true })}
                disabled={!canEditSchedule}
                title={!canEditSchedule ? "View only" : "Bulk actions"}
              />

              <ActionBtn
                icon={focusTable ? Minimize2 : Maximize2}
                label={focusTable ? "Exit focus" : "Focus"}
                onClick={() =>
                  setFocusTable((v) => {
                    const next = !v;
                    if (!next) setDrawerOpen(false);
                    return next;
                  })
                }
                active={focusTable}
              />

              <ActionBtn
                icon={Download}
                label="Export CSV"
                onClick={exportCurrentSectionCsv}
                disabled={!activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                title="Export current section schedule as CSV"
              />

              <PrimaryBtn
                icon={Plus}
                label="Add Entry"
                onClick={() => openCreate()}
                disabled={!canEditSchedule || !activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                title={!canEditSchedule ? "View only" : "Add Entry"}
              />
            </div>
          </div>

          {/* View-only banner */}
          {!canEditSchedule ? (
            <div className="mt-4 rounded-2xl border border-[#C9A227]/30 bg-[#C9A227]/10 p-3 text-sm">
              <b className="font-extrabold">View only:</b> Admin accounts can view schedules but cannot create, edit, delete, clear, or run bulk actions.
            </div>
          ) : null}

          {loading ? (
            <div className={`mt-4 rounded-2xl border ${UI.border} bg-white p-4 text-sm ${UI.muted}`}>Loading…</div>
          ) : null}

          {anyError ? (
            <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700">
              Error: {errMsg || "Something went wrong."}
            </div>
          ) : null}

          {!activeSy && !activeSyQ.isLoading ? (
            <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
              <div className="text-sm font-extrabold text-rose-700">No active School Year</div>
              <div className="mt-1 text-sm text-black/60">Set one school_years row to status = Active to enable scheduling.</div>
            </div>
          ) : null}
        </div>

        {/* ====== Tabs + quick toggles ====== */}
        <div className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <SegmentedTabs
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                { key: "Timetable", label: "Timetable" },
                { key: "List", label: "List" },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              {focusTable ? <ActionBtn icon={Menu} label="Sections" onClick={() => setDrawerOpen(true)} /> : null}

              <ActionBtn
                icon={Rows3}
                label={compact ? "Compact" : "Comfortable"}
                onClick={() => setCompact((v) => !v)}
                active={compact}
                title={compact ? "Switch to comfortable spacing" : "Switch to compact spacing"}
              />

              <ActionBtn
                icon={Trash2}
                label="Clear"
                onClick={() => {
                  if (!canEditSchedule) return;
                  const ok = window.confirm(`Clear schedule for ${selectedSection ? sectionLabel(selectedSection) : "this section"}?`);
                  if (!ok) return;
                  clearSectionM.mutate();
                }}
                disabled={!canEditSchedule || clearSectionM.isPending || !activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                title={!canEditSchedule ? "View only" : "Clear schedule"}
              />

              <PrimaryBtn
                icon={Plus}
                label="Add Entry"
                onClick={() => openCreate()}
                disabled={!canEditSchedule || !activeSy?.sy_id || !selectedTermId || !selectedSectionId}
              />
            </div>
          </div>
        </div>

        {/* ====== Main layout ====== */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Left panel */}
          {!focusTable ? (
            <div className="lg:col-span-4 xl:col-span-3">
              <SectionsPanel
                qSection={qSection}
                setQSection={setQSection}
                fGrade={fGrade}
                setFGrade={setFGrade}
                fStrand={fStrand}
                setFStrand={setFStrand}
                grades={grades}
                strands={strands}
                filteredSections={filteredSections}
                allSySchedules={allSySchedules}
                selectedSectionId={selectedSectionId}
                setSelectedSectionId={setSelectedSectionId}
                canEdit={canEditSchedule}
              />
            </div>
          ) : null}

          {/* Drawer (focus mode) */}
          {focusTable && drawerOpen ? (
            <Drawer onClose={() => setDrawerOpen(false)}>
              <SectionsPanel
                qSection={qSection}
                setQSection={setQSection}
                fGrade={fGrade}
                setFGrade={setFGrade}
                fStrand={fStrand}
                setFStrand={setFStrand}
                grades={grades}
                strands={strands}
                filteredSections={filteredSections}
                allSySchedules={allSySchedules}
                selectedSectionId={selectedSectionId}
                setSelectedSectionId={(id) => {
                  setSelectedSectionId(id);
                  setDrawerOpen(false);
                }}
                canEdit={canEditSchedule}
                headerRight={
                  <button onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" title="Close">
                    <X className="h-5 w-5 text-black/60" />
                  </button>
                }
              />
            </Drawer>
          ) : null}

          {/* Right workspace */}
          <div className={`${focusTable ? "lg:col-span-12" : "lg:col-span-8 xl:col-span-9"} space-y-4`}>
            {/* Workspace header card */}
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className={`text-xs font-semibold ${UI.muted}`}>Currently viewing</div>
                  <div className="text-base font-extrabold">{selectedSection ? sectionLabel(selectedSection) : "—"}</div>
                  <div className={`text-xs ${UI.muted}`}>
                    Adviser: <b className="text-black">{selectedSection ? adviserLabel(selectedSection) : "—"}</b>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <MetricPill label="Entries" value={stats.count} />
                    <MetricPill label="Subjects" value={stats.subjects} />
                    <MetricPill label="Teachers" value={stats.teachers} />
                    <MetricPill label="Rooms" value={stats.rooms} />
                    {stats.hasConflicts ? (
                      <StatusPill tone="danger" icon={AlertTriangle} text="Conflicts detected" />
                    ) : (
                      <StatusPill tone="ok" icon={ShieldCheck} text="No conflicts" />
                    )}
                  </div>
                </div>

                {stats.hasConflicts ? (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3">
                    <div className="text-sm font-extrabold text-rose-700">Heads up</div>
                    <div className="mt-1 text-sm text-black/60">
                      Some entries overlap with other sections using the same teacher and/or room at the same day/period.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === "Timetable" ? (
              <Section title="Weekly timetable">
                <div className="overflow-auto rounded-2xl border border-black/10">
                  <table className="w-full min-w-[1400px] text-left text-sm">
                    <thead className="bg-black/[0.02] text-xs text-black/60 sticky top-0 z-20">
                      <tr>
                        <th className={`font-semibold w-[210px] sticky left-0 z-30 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}>Period</th>
                        {DAYS.map((d) => (
                          <th key={d} className={`font-semibold min-w-[240px] ${cellPad}`}>{d}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {PERIODS.map((p) => (
                        <tr key={p.period_no} className="border-t border-black/10 align-top">
                          <td className={`sticky left-0 z-10 bg-white ${periodPad}`}>
                            <div className="text-xs font-semibold text-black/60">{p.label}</div>
                            <div className="text-xs text-black/55">{timeRange(p)}</div>
                          </td>

                          {DAYS.map((d) => {
                            const key = slotKey(d, p.period_no);
                            const entry = scheduleMap.get(key);
                            const conflict = conflictsForSelected.get(key);

                            return (
                              <td key={key} className={`${cellPad}`}>
                                {!entry ? (
                                  <SlotEmpty
                                    compact={compact}
                                    disabled={!canEditSchedule || !activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                                    onClick={() => openCreate({ day_of_week: d, period_no: p.period_no })}
                                  />
                                ) : (
                                  <SlotCard
                                    compact={compact}
                                    entry={entry}
                                    conflict={conflict}
                                    canEdit={canEditSchedule}
                                    onEdit={() => openEdit(entry)}
                                    onDelete={() => onDelete(entry)}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : (
              <Section title="Schedule entries">
                <div className="overflow-auto rounded-2xl border border-black/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/[0.02] text-xs text-black/60">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Day</th>
                        <th className="px-4 py-3 font-semibold">Period</th>
                        <th className="px-4 py-3 font-semibold">Time</th>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Teacher</th>
                        <th className="px-4 py-3 font-semibold">Room</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sectionSchedules
                        .slice()
                        .sort((a, b) => {
                          const da = DAYS.indexOf(a.day_of_week);
                          const db = DAYS.indexOf(b.day_of_week);
                          if (da !== db) return da - db;
                          return Number(a.period_no) - Number(b.period_no);
                        })
                        .map((entry) => {
                          const key = slotKey(entry.day_of_week, entry.period_no);
                          const conflict = conflictsForSelected.get(key);
                          const p = PERIODS.find((x) => Number(x.period_no) === Number(entry.period_no));

                          return (
                            <tr
                              key={entry.schedule_id}
                              className="border-t border-black/10 hover:bg-black/[0.01] cursor-pointer"
                              onClick={() => (canEditSchedule ? openEdit(entry) : null)}
                              title={!canEditSchedule ? "View only" : "Click to edit"}
                            >
                              <td className="px-4 py-3 font-semibold">{entry.day_of_week}</td>
                              <td className="px-4 py-3 text-black/70">{entry.period_no}</td>
                              <td className="px-4 py-3 text-black/70">{p ? timeRange(p) : "—"}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{subjectLabel(entry.subjects)}</span>
                                  {conflict ? <Pill tone="danger">Conflict</Pill> : null}
                                </div>
                              </td>
                              <td className="px-4 py-3">{entry.teachers ? teacherName(entry.teachers) : "—"}</td>
                              <td className="px-4 py-3">{entry.room || "—"}</td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  {canEditSchedule ? (
                                    <>
                                      <IconBtn title="Edit" onClick={() => openEdit(entry)} tone="gold">
                                        <Pencil className="h-5 w-5" />
                                      </IconBtn>
                                      <IconBtn title="Delete" onClick={() => onDelete(entry)} tone="danger">
                                        <Trash2 className="h-5 w-5" />
                                      </IconBtn>
                                    </>
                                  ) : (
                                    <span className="text-xs text-black/45">View only</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      {sectionSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={`px-4 py-12 text-center text-sm ${UI.muted}`}>
                            No entries yet. {canEditSchedule ? "Click “Add Entry” to start." : ""}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>
        </div>

        {/* Slot Modal */}
        {slotModal.open ? (
          <ModalShell title={slotModal.mode === "edit" ? "Edit Schedule Entry" : "Add Schedule Entry"} onClose={closeSlotModal}>
            <div className={`text-xs ${UI.muted}`}>
              {selectedSection ? sectionLabel(selectedSection) : "—"} • {activeSy?.sy_code || "—"} • {selectedTerm?.term_code || "—"}
            </div>

            {/* Keep inline error, but we also toast via onError */}
            {upsertM.isError ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3 text-sm text-rose-700">
                {String(upsertM.error?.message || upsertM.error)}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SelectField
                label="Day"
                value={slotForm.day_of_week}
                onChange={(v) => setSlotForm((p) => ({ ...p, day_of_week: v }))}
                options={DAYS}
                disabled={!canEditSchedule}
              />

              <SelectField
                label="Period"
                value={String(slotForm.period_no)}
                onChange={(v) => setSlotForm((p) => ({ ...p, period_no: Number(v) }))}
                options={PERIODS.map((x) => ({
                  value: String(x.period_no),
                  label: `${x.period_no} • ${x.label} (${timeRange(x)})`,
                }))}
                disabled={!canEditSchedule}
              />

              <SelectField
                label="Subject *"
                value={slotForm.subject_id}
                onChange={(v) => setSlotForm((p) => ({ ...p, subject_id: v }))}
                options={[
                  { value: "", label: "Select subject" },
                  ...subjectsForSection.map((s) => ({ value: s.subject_id, label: subjectLabel(s) })),
                ]}
                disabled={!canEditSchedule}
              />

              <SelectField
                label="Teacher"
                value={slotForm.teacher_id}
                onChange={(v) => setSlotForm((p) => ({ ...p, teacher_id: v }))}
                options={[{ value: "", label: "—" }, ...teachers.map((t) => ({ value: t.user_id, label: teacherName(t) }))]}
                disabled={!canEditSchedule}
              />

              <InputField
                label="Room"
                value={slotForm.room}
                onChange={(v) => setSlotForm((p) => ({ ...p, room: v }))}
                placeholder="e.g., R-101, Lab-2"
                disabled={!canEditSchedule}
              />

              <InputField
                label="Notes (optional)"
                value={slotForm.notes}
                onChange={(v) => setSlotForm((p) => ({ ...p, notes: v }))}
                placeholder="e.g., Lab session / Bring calculator"
                disabled={!canEditSchedule}
              />
            </div>

            {/* Conflict preview */}
            <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
              <div className="text-sm font-extrabold">Conflict check (preview)</div>
              <div className={`mt-1 text-sm ${UI.muted}`}>
                Flags overlaps across sections when the <b>teacher</b> or <b>room</b> is used at the same day/period.
              </div>

              <div className="mt-3 overflow-auto rounded-2xl border border-black/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/[0.02] text-xs text-black/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-[120px]">Type</th>
                      <th className="px-4 py-3 font-semibold">Overlaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-black/10">
                      <td className="px-4 py-3 font-semibold">Teacher</td>
                      <td className="px-4 py-3 text-black/70">
                        {slotForm.teacher_id ? (
                          slotPreviewConflicts.teacherOverlaps.length ? (
                            <ul className="list-disc pl-5">
                              {slotPreviewConflicts.teacherOverlaps.slice(0, 4).map((x) => (
                                <li key={x.schedule_id}>
                                  {sectionLabel(x.sections)} — {subjectLabel(x.subjects)}
                                </li>
                              ))}
                              {slotPreviewConflicts.teacherOverlaps.length > 4 ? <li>…</li> : null}
                            </ul>
                          ) : (
                            <span className="text-black/60">No teacher conflicts</span>
                          )
                        ) : (
                          <span className="text-black/60">Select a teacher to check</span>
                        )}
                      </td>
                    </tr>

                    <tr className="border-t border-black/10">
                      <td className="px-4 py-3 font-semibold">Room</td>
                      <td className="px-4 py-3 text-black/70">
                        {String(slotForm.room || "").trim() ? (
                          slotPreviewConflicts.roomOverlaps.length ? (
                            <ul className="list-disc pl-5">
                              {slotPreviewConflicts.roomOverlaps.slice(0, 4).map((x) => (
                                <li key={x.schedule_id}>
                                  {sectionLabel(x.sections)} — {subjectLabel(x.subjects)}
                                </li>
                              ))}
                              {slotPreviewConflicts.roomOverlaps.length > 4 ? <li>…</li> : null}
                            </ul>
                          ) : (
                            <span className="text-black/60">No room conflicts</span>
                          )
                        ) : (
                          <span className="text-black/60">Enter a room to check</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeSlotModal}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => upsertM.mutate()}
                disabled={!canEditSchedule || upsertM.isPending || !slotForm.subject_id}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-4 w-4" />
                {upsertM.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </ModalShell>
        ) : null}

        {/* Bulk Modal */}
        {bulkModal.open ? (
          <ModalShell title="Bulk actions" onClose={() => setBulkModal({ open: false })} maxWidth="max-w-4xl">
            {bulkM.isError ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3 text-sm text-rose-700">
                {String(bulkM.error?.message || bulkM.error)}
              </div>
            ) : null}

            <div className={`text-xs ${UI.muted}`}>Apply schedule changes across multiple sections (Active SY + selected term).</div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className={`rounded-2xl border ${UI.border} bg-white p-4 md:col-span-1 space-y-3`}>
                <div>
                  <div className="text-sm font-extrabold">Action</div>
                  <div className={`text-xs ${UI.muted}`}>Choose what to do.</div>
                </div>

                <SelectField
                  label="Choose action"
                  value={bulkMode}
                  onChange={setBulkMode}
                  options={[
                    { value: "copy", label: "Copy schedule from one section" },
                    { value: "clear", label: "Clear schedules for selected sections" },
                  ]}
                  disabled={!canEditSchedule}
                />

                {bulkMode === "copy" ? (
                  <>
                    <SelectField
                      label="Source section"
                      value={bulkSourceSectionId || ""}
                      onChange={setBulkSourceSectionId}
                      options={[{ value: "", label: "Select…" }, ...sections.map((s) => ({ value: s.section_id, label: sectionLabel(s) }))]}
                      disabled={!canEditSchedule}
                    />

                    <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                      <input
                        type="checkbox"
                        checked={bulkOverwrite}
                        onChange={(e) => setBulkOverwrite(e.target.checked)}
                        className="h-4 w-4 accent-[#C9A227]"
                        disabled={!canEditSchedule}
                      />
                      <span className="text-sm font-semibold">Overwrite existing schedules</span>
                    </label>

                    <div className={`text-xs ${UI.muted}`}>
                      If unchecked, existing entries remain and only missing day/period slots will be copied.
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3">
                    <div className="text-sm font-extrabold text-rose-700">Careful</div>
                    <div className="mt-1 text-sm text-black/60">Clearing is irreversible unless you have a backup/export.</div>
                  </div>
                )}
              </div>

              <div className={`rounded-2xl border ${UI.border} bg-white p-4 md:col-span-2 space-y-3`}>
                <div>
                  <div className="text-sm font-extrabold">Target sections</div>
                  <div className={`text-xs ${UI.muted}`}>Select which sections will receive this bulk change.</div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {sections.map((s) => {
                    const checked = bulkTargetSectionIds.has(s.section_id);
                    const disabled = !canEditSchedule || (bulkMode === "copy" && s.section_id === bulkSourceSectionId);
                    const count = allSySchedules.filter((x) => x.section_id === s.section_id).length;

                    return (
                      <label
                        key={s.section_id}
                        className={`flex items-center justify-between rounded-2xl border border-black/10 bg-white p-3 ${
                          disabled ? "opacity-50" : "hover:bg-black/[0.01]"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-extrabold">{sectionLabel(s)}</div>
                          <div className={`mt-1 text-xs ${UI.muted}`}>{count} existing entry(ies)</div>
                        </div>
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() => toggleTarget(s.section_id)}
                          className="h-4 w-4 accent-[#C9A227]"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setBulkTargetSectionIds(new Set(sections.map((s) => s.section_id)))}
                    disabled={!canEditSchedule}
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02] disabled:opacity-60"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setBulkTargetSectionIds(new Set())}
                    disabled={!canEditSchedule}
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02] disabled:opacity-60"
                  >
                    Clear selection
                  </button>
                  <div className={`text-xs ${UI.muted}`}>{bulkTargetSectionIds.size} selected</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkModal({ open: false })}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => bulkM.mutate()}
                disabled={
                  !canEditSchedule ||
                  bulkM.isPending ||
                  bulkTargetSectionIds.size === 0 ||
                  (bulkMode === "copy" && !bulkSourceSectionId)
                }
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Wand2 className="h-4 w-4" />
                {bulkM.isPending ? "Applying…" : "Apply"}
              </button>
            </div>
          </ModalShell>
        ) : null}

      </div>
    </div>
  );
}

/* ================== Toasts ================== */

function useToasts() {
  const [toasts, setToasts] = useState([]);

  function pushToast({ type = "info", title = "", message = "", duration = 3500 }) {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [{ id, type, title, message }, ...prev].slice(0, 5));

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, pushToast, removeToast };
}

function ToastHost({ toasts, onClose }) {
  if (!toasts?.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  const { type, title, message } = toast;

  const tone =
    type === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800"
      : type === "error"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-800"
      : "border-black/10 bg-white text-[#1F1A14]";

  const Icon =
    type === "success" ? CheckCircle2 : type === "error" ? AlertTriangle : Info;

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5" />
        <div className="flex-1">
          <div className="text-sm font-extrabold">{title || "Notice"}</div>
          {message ? <div className="mt-0.5 text-sm opacity-80">{message}</div> : null}
        </div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5" title="Dismiss">
          <X className="h-4 w-4 opacity-70" />
        </button>
      </div>
    </div>
  );
}

/* ================== UI Pieces (Enrollment-style) ================== */

function SegmentedTabs({ value, onChange, tabs }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              active ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
          >
            <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, active, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60 ${
        active ? "border-[#C9A227]/40 bg-[#C9A227]/10" : "border-black/10 bg-white"
      }`}
    >
      <Icon className="h-4 w-4 text-black/60" />
      {label}
    </button>
  );
}

function PrimaryBtn({ icon: Icon, label, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black hover:opacity-95 disabled:opacity-60`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Chip({ children, tone = "muted" }) {
  const cls = tone === "muted" ? "bg-black/5 text-black/70" : "bg-[#C9A227]/10 text-[#1F1A14]";
  return <span className={`inline-flex items-center rounded-full px-3 py-1 ${cls}`}>{children}</span>;
}

function MetricPill({ label, value }) {
  return <span className="inline-flex rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">{label}: {value}</span>;
}

function StatusPill({ tone, icon: Icon, text }) {
  const cls = tone === "danger" ? "bg-rose-500/10 text-rose-700" : "bg-emerald-500/10 text-emerald-700";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-4 w-4" />
      {text}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-4`}>
      <div className={`text-sm font-extrabold text-[#6B4E2E]`}>{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, className = "", disabled = false }) {
  return (
    <label className={`block ${className}`}>
      <span className={`text-xs font-semibold text-black/55`}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  const normalized = Array.isArray(options)
    ? options.map((o) => (typeof o === "string" ? { value: o, label: o } : o))
    : [];
  return (
    <label className="block">
      <span className={`text-xs font-semibold text-black/55`}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {normalized.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";
  return (
    <button title={title} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls}`}>
      {children}
    </button>
  );
}

function Pill({ children, tone }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700"
      : tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700"
      : "bg-black/5 text-black/70";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function ModalShell({ title, onClose, children, maxWidth = "max-w-3xl" }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full ${maxWidth} rounded-2xl border border-black/10 bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{title}</div>
              <div className={`text-xs text-black/55`}>White + gold minimal design.</div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

function Drawer({ onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-stretch">
        <div className="w-full max-w-md h-full p-4">
          <div className={`h-full overflow-auto rounded-2xl border border-black/10 bg-white shadow-xl`}>{children}</div>
        </div>
        <div className="flex-1" onClick={onClose} />
      </div>
    </>
  );
}

function SlotEmpty({ compact, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl border border-black/10 bg-black/[0.01] ${compact ? "p-2" : "p-3"} text-left hover:bg-black/[0.02] disabled:opacity-60`}
      title={disabled ? "View only" : "Add entry"}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-black/45">—</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-black/60">
          <Plus className="h-4 w-4" /> Add
        </span>
      </div>
    </button>
  );
}

function SlotCard({ compact, entry, conflict, canEdit, onEdit, onDelete }) {
  return (
    <div
      className={`rounded-2xl border ${compact ? "p-2" : "p-3"} ${
        conflict ? "border-rose-500/25 bg-rose-500/5" : "border-black/10 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold leading-tight">{subjectLabel(entry.subjects)}</div>
          <div className="mt-1 text-xs text-black/60">
            {entry.teachers ? `Teacher: ${teacherName(entry.teachers)}` : "No teacher"}
          </div>
          <div className="text-xs text-black/60">{entry.room ? `Room: ${entry.room}` : "No room"}</div>
        </div>

        {canEdit ? (
          <div className="flex gap-2">
            <IconBtn title="Edit" onClick={onEdit} tone="gold">
              <Pencil className="h-5 w-5" />
            </IconBtn>
            <IconBtn title="Delete" onClick={onDelete} tone="danger">
              <Trash2 className="h-5 w-5" />
            </IconBtn>
          </div>
        ) : null}
      </div>

      {conflict ? (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-white p-2 text-xs">
          <div className="font-extrabold text-rose-700">Conflict</div>
          <div className="mt-1 text-black/60 space-y-1">
            {conflict.teacherClash?.length ? (
              <div>
                Same teacher in:{" "}
                {conflict.teacherClash
                  .slice(0, 2)
                  .map((x) => sectionLabel(x.sections))
                  .join(", ")}
                {conflict.teacherClash.length > 2 ? "…" : ""}
              </div>
            ) : null}
            {conflict.roomClash?.length ? (
              <div>
                Same room in:{" "}
                {conflict.roomClash
                  .slice(0, 2)
                  .map((x) => sectionLabel(x.sections))
                  .join(", ")}
                {conflict.roomClash.length > 2 ? "…" : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {entry.notes ? <div className="mt-2 text-xs text-black/60">Notes: {entry.notes}</div> : null}
    </div>
  );
}

function SectionsPanel({
  qSection,
  setQSection,
  fGrade,
  setFGrade,
  fStrand,
  setFStrand,
  grades,
  strands,
  filteredSections,
  allSySchedules,
  selectedSectionId,
  setSelectedSectionId,
  headerRight,
  canEdit,
}) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-4 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">Sections</div>
          <div className={`text-xs text-black/55`}>Find and select a section to {canEdit ? "edit." : "view."}</div>
        </div>
        {headerRight || null}
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-black/55">Search section</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            value={qSection}
            onChange={(e) => setQSection(e.target.value)}
            placeholder="Search grade/track/strand/section…"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Grade" value={fGrade} onChange={setFGrade} options={grades} />
        <SelectField label="Strand" value={fStrand} onChange={setFStrand} options={strands} />
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-xs text-black/55`}>{filteredSections.length} result(s)</div>
        <button
          onClick={() => {
            setQSection("");
            setFGrade("All");
            setFStrand("All");
          }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02]"
        >
          Reset
        </button>
      </div>

      <div className="max-h-[480px] overflow-auto pr-1">
        <div className="space-y-2">
          {filteredSections.map((s) => {
            const active = s.section_id === selectedSectionId;
            const count = allSySchedules.filter((x) => x.section_id === s.section_id).length;

            return (
              <button
                key={s.section_id}
                onClick={() => setSelectedSectionId(s.section_id)}
                className={`w-full rounded-2xl border p-3 text-left transition hover:bg-black/[0.01] ${
                  active ? "bg-[#C9A227]/10 border-[#C9A227]/30" : "bg-white border-black/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">{sectionLabel(s)}</div>
                    <div className={`mt-1 text-xs text-black/55`}>Adviser: {adviserLabel(s)}</div>
                    <div className={`mt-1 text-xs text-black/55`}>Entries (SY+Term): {count}</div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      count ? "bg-black/5 text-black/70" : "bg-black/[0.03] text-black/55"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </button>
            );
          })}

          {filteredSections.length === 0 ? (
            <div className={`rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/55`}>No sections found.</div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => alert("Wire to your duplicate section flow")}
          disabled={!canEdit}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
          title={!canEdit ? "View only" : "Duplicate"}
        >
          <Copy className="h-4 w-4 text-black/60" />
          Duplicate
        </button>
        <button
          onClick={() => alert("Wire to your print/PDF view")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[0.02]"
        >
          <Download className="h-4 w-4 text-black/60" />
          Print
        </button>
      </div>
    </div>
  );
}
