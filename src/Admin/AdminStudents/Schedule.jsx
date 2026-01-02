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
  Upload,
  Download,
  Copy,
  Menu,
  Minimize2,
  Maximize2,
  Rows3,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

/**
 * Senior High – Class Schedule Admin (Supabase wired)
 * Aligned to Enrollment.jsx design: clean white + gold, minimal brown.
 *
 * ✅ Uses your existing tables:
 * - sections, subjects, teachers, grade_levels, strands, tracks, terms, school_years
 *
 * ✅ Recommended schedule table (run in Supabase SQL Editor):
 *
 * create table public.section_schedules (
 *   schedule_id uuid primary key default gen_random_uuid(),
 *   sy_id uuid not null references public.school_years(sy_id) on update cascade on delete restrict,
 *   term_id uuid not null references public.terms(term_id) on update cascade on delete restrict,
 *   section_id uuid not null references public.sections(section_id) on update cascade on delete cascade,
 *   day_of_week varchar(3) not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat')),
 *   period_no smallint not null check (period_no between 1 and 9),
 *   start_time time not null,
 *   end_time time not null,
 *   subject_id uuid not null references public.subjects(subject_id) on update cascade on delete restrict,
 *   teacher_id uuid null references public.teachers(user_id) on update cascade on delete set null,
 *   room varchar(50) null,
 *   notes varchar(255) null,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * create unique index section_schedules_unique_section_slot
 *   on public.section_schedules (sy_id, term_id, section_id, day_of_week, period_no);
 *
 * create unique index section_schedules_unique_teacher_slot
 *   on public.section_schedules (sy_id, term_id, day_of_week, period_no, teacher_id)
 *   where teacher_id is not null;
 *
 * create unique index section_schedules_unique_room_slot
 *   on public.section_schedules (sy_id, term_id, day_of_week, period_no, room)
 *   where room is not null and btrim(room) <> '';
 *
 * create trigger trg_section_schedules_set_updated_at
 * before update on public.section_schedules
 * for each row execute function set_updated_at();
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
  // reuse teacherName() formatting
  return teacherName(a);
}

function subjectLabel(s) {
  if (!s) return "";
  const code = s.subject_code ? `${s.subject_code} — ` : "";
  return `${code}${s.subject_title}`;
}

function timeRange(p) {
  return `${p.start}–${p.end}`;
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

export default function SeniorHighScheduleAdminPage() {
  const qc = useQueryClient();

  // Filters
  const [qSection, setQSection] = useState("");
  const [fGrade, setFGrade] = useState("All");
  const [fStrand, setFStrand] = useState("All");

  // Tabs
  const [activeTab, setActiveTab] = useState("Timetable"); // Timetable | List

  // Wider weekly overview
  const [focusTable, setFocusTable] = useState(false); // expands timetable + moves sections into a drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);

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
        .select("sy_id, sy_code, status")
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
  const sections = sectionsQ.data ?? [];
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
      .filter((s) => {
        if (fGrade === "All") return true;
        return String(s?.grade_levels?.grade_level ?? "") === String(fGrade);
      })
      .filter((s) => {
        if (fStrand === "All") return true;
        return String(s?.strands?.strand_code ?? "") === String(fStrand);
      });
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
    // section slot: prevent multiple entries in same day/period for same section
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
        const { error } = await supabase
          .from(SCHEDULE_TABLE)
          .update(payload)
          .eq("schedule_id", scheduleId);
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
      closeSlotModal();
    },
  });

  const deleteM = useMutation({
    mutationFn: async (scheduleId) => {
      const { error } = await supabase.from(SCHEDULE_TABLE).delete().eq("schedule_id", scheduleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["section_schedules", activeSy?.sy_id, selectedTermId, selectedSectionId],
      });
      await qc.invalidateQueries({ queryKey: ["all_sy_schedules", activeSy?.sy_id, selectedTermId] });
    },
  });

  const clearSectionM = useMutation({
    mutationFn: async () => {
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
    },
  });

  const bulkM = useMutation({
    mutationFn: async () => {
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
    },
  });

  // ====== Modal helpers ======

  function openCreate(preset = {}) {
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
    const p = PERIODS.find((x) => Number(x.period_no) === Number(entry.period_no));
    const ok = window.confirm(
      `Delete schedule entry?

${entry.day_of_week} • Period ${entry.period_no} (${p ? timeRange(p) : ""})
${subjectLabel(entry.subjects)}`
    );
    if (!ok) return;
    deleteM.mutate(entry.schedule_id);
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
  }, [allSySchedules, activeSy?.sy_id, selectedSectionId, slotForm.day_of_week, slotForm.period_no, slotForm.teacher_id, slotForm.room]);

  // ====== Loading & errors ======

  const loading =
    activeSyQ.isLoading ||
    termsQ.isLoading ||
    sectionsQ.isLoading ||
    subjectsQ.isLoading ||
    teachersQ.isLoading ||
    schedulesQ.isLoading ||
    allSySchedulesQ.isLoading;

  const anyError =
    activeSyQ.isError ||
    termsQ.isError ||
    sectionsQ.isError ||
    subjectsQ.isError ||
    teachersQ.isError ||
    schedulesQ.isError ||
    allSySchedulesQ.isError;

  const errMsg =
    (activeSyQ.error?.message || "") +
    (termsQ.error?.message || "") +
    (sectionsQ.error?.message || "") +
    (subjectsQ.error?.message || "") +
    (teachersQ.error?.message || "") +
    (schedulesQ.error?.message || "") +
    (allSySchedulesQ.error?.message || "");

  const cellPad = compact ? "px-2 py-2" : "px-4 py-3";
  const periodPad = compact ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Class Schedules</div>
          <div className={`text-sm ${UI.muted}`}>
            Senior High School • Create, modify, and delete schedules per class section.
          </div>
          <div className={`mt-1 text-xs ${UI.muted}`}>
            Active SY: <span className="font-semibold text-black">{activeSy?.sy_code || "—"}</span>
            <span className="mx-2 text-black/30">•</span>
            Term: <span className="font-semibold text-black">{selectedTerm?.term_code || "—"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <SelectField
              label="Term"
              value={selectedTermId || ""}
              onChange={setSelectedTermId}
              options={[
                { value: "", label: "Select term" },
                ...terms.map((t) => ({ value: t.term_id, label: t.term_code })),
              ]}
            />
          </div>

          <button
            onClick={() => setBulkModal({ open: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
          >
            <Wand2 className="h-4 w-4 text-black/60" />
            Bulk actions
          </button>

          <button
            onClick={() => setFocusTable((v) => {
              const next = !v;
              if (!next) setDrawerOpen(false);
              return next;
            })}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
              focusTable ? "border-[#C9A227]/40 bg-[#C9A227]/10" : "border-black/10 bg-white"
            }`}
            title={focusTable ? "Exit focus" : "Focus timetable"}
          >
            {focusTable ? <Minimize2 className="h-4 w-4 text-black/60" /> : <Maximize2 className="h-4 w-4 text-black/60" />}
            {focusTable ? "Exit focus" : "Focus timetable"}
          </button>

          <button
            onClick={() => alert("Wire to your import flow")}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
          >
            <Upload className="h-4 w-4 text-black/60" />
            Import
          </button>

          <button
            onClick={() => alert("Wire to your export flow")}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
          >
            <Download className="h-4 w-4 text-black/60" />
            Export
          </button>

          <button
            onClick={() => openCreate()}
            disabled={!activeSy?.sy_id || !selectedTermId || !selectedSectionId}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Status */}
      {loading ? (
        <div className={`rounded-2xl border ${UI.border} bg-white p-4 text-sm ${UI.muted}`}>Loading…</div>
      ) : null}

      {anyError ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700">
          Error: {errMsg || "Something went wrong."}
        </div>
      ) : null}

      {!activeSy && !activeSyQ.isLoading ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
          <div className="text-sm font-extrabold text-rose-700">No active School Year</div>
          <div className="mt-1 text-sm text-black/60">Set one school_years row to status = Active to enable scheduling.</div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {["Timetable", "List"].map((t) => {
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
              >
                <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: section filters (hidden in focus mode) */}
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
            />
          </div>
        ) : null}

        {/* Drawer for sections (focus mode) */}
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
              headerRight={
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5"
                  title="Close"
                >
                  <X className="h-5 w-5 text-black/60" />
                </button>
              }
            />
          </Drawer>
        ) : null}

        {/* Right: schedule */}
        <div className={`${focusTable ? "lg:col-span-12" : "lg:col-span-8 xl:col-span-9"} space-y-4`}>
          <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className={`text-xs font-semibold ${UI.muted}`}>Currently editing</div>
                <div className="text-base font-extrabold">{selectedSection ? sectionLabel(selectedSection) : "—"}</div>
                <div className={`mt-1 text-xs ${UI.muted}`}>
                  Adviser: <span className="font-semibold text-black">{selectedSection ? adviserLabel(selectedSection) : "—"}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>{stats.count} entries</Pill>
                  <Pill>{stats.subjects} subjects</Pill>
                  <Pill>{stats.teachers} teachers</Pill>
                  <Pill>{stats.rooms} rooms</Pill>
                  {stats.hasConflicts ? <Pill tone="danger">Conflicts detected</Pill> : <Pill tone="ok">No conflicts</Pill>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {focusTable ? (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
                    title="Open sections"
                  >
                    <Menu className="h-4 w-4 text-black/60" />
                    Sections
                  </button>
                ) : null}

                <button
                  onClick={() => setCompact((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] ${
                    compact ? "border-[#C9A227]/40 bg-[#C9A227]/10" : "border-black/10 bg-white"
                  }`}
                  title={compact ? "Comfortable" : "Compact"}
                >
                  <Rows3 className="h-4 w-4 text-black/60" />
                  {compact ? "Compact" : "Comfortable"}
                </button>

                <button
                  onClick={() => openCreate()}
                  disabled={!activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                >
                  <Plus className="h-4 w-4" />
                  Add Entry
                </button>

                <button
                  onClick={() => {
                    const ok = window.confirm(
                      `Clear schedule for ${selectedSection ? sectionLabel(selectedSection) : "this section"}?`
                    );
                    if (!ok) return;
                    clearSectionM.mutate();
                  }}
                  disabled={clearSectionM.isPending || !activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4 text-black/60" />
                  Clear
                </button>
              </div>
            </div>

            {stats.hasConflicts ? (
              <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3">
                <div className="text-sm font-extrabold text-rose-700">Heads up: conflicts</div>
                <div className="mt-1 text-sm text-black/60">
                  Some entries overlap with other sections using the same teacher and/or room at the same time.
                </div>
              </div>
            ) : null}
          </div>

          {activeTab === "Timetable" ? (
            <Section title="Weekly timetable">
              <div className="overflow-auto rounded-2xl border border-black/10">
              <table className="w-full min-w-[1400px] text-left text-sm">
                  <thead className="bg-black/[0.02] text-xs text-black/60 sticky top-0 z-20">
                    <tr>
                      <th className={`font-semibold w-[190px] sticky left-0 z-30 bg-white ${periodPad}`}>Period</th>
                      {DAYS.map((d) => (
                        <th key={d} className={`font-semibold min-w-[220px] ${cellPad}`}>
                          {d}
                        </th>
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
                                <button
                                  onClick={() => openCreate({ day_of_week: d, period_no: p.period_no })}
                                  disabled={!activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                                  className={`w-full rounded-2xl border border-black/10 bg-black/[0.01] ${compact ? "p-2" : "p-3"} text-left hover:bg-black/[0.02] disabled:opacity-60`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-black/45">—</span>
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-black/60">
                                      <Plus className="h-4 w-4" /> Add
                                    </span>
                                  </div>
                                </button>
                              ) : (
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

                                    <div className="flex gap-2">
                                      <IconBtn title="Edit" onClick={() => openEdit(entry)} tone="gold">
                                        <Pencil className="h-5 w-5" />
                                      </IconBtn>
                                      <IconBtn title="Delete" onClick={() => onDelete(entry)} tone="danger">
                                        <Trash2 className="h-5 w-5" />
                                      </IconBtn>
                                    </div>
                                  </div>

                                  {conflict ? (
                                    <div className="mt-3 rounded-xl border border-rose-500/20 bg-white p-2 text-xs">
                                      <div className="font-extrabold text-rose-700">Conflict</div>
                                      <div className="mt-1 text-black/60 space-y-1">
                                        {conflict.teacherClash.length ? (
                                          <div>
                                            Same teacher in: {conflict.teacherClash
                                              .slice(0, 2)
                                              .map((x) => sectionLabel(x.sections))
                                              .join(", ")}
                                            {conflict.teacherClash.length > 2 ? "…" : ""}
                                          </div>
                                        ) : null}
                                        {conflict.roomClash.length ? (
                                          <div>
                                            Same room in: {conflict.roomClash
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
              <div className="flex items-center justify-between gap-2">
                <div className={`text-xs ${UI.muted}`}>Click a row to edit.</div>
                <button
                  onClick={() => openCreate()}
                  disabled={!activeSy?.sy_id || !selectedTermId || !selectedSectionId}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                >
                  <Plus className="h-4 w-4" /> Add Entry
                </button>
              </div>

              <div className="mt-3 overflow-auto rounded-2xl border border-black/10">
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
                            onClick={() => openEdit(entry)}
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
                                <IconBtn title="Edit" onClick={() => openEdit(entry)} tone="gold">
                                  <Pencil className="h-5 w-5" />
                                </IconBtn>
                                <IconBtn title="Delete" onClick={() => onDelete(entry)} tone="danger">
                                  <Trash2 className="h-5 w-5" />
                                </IconBtn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {sectionSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                          No entries yet.
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
            />

            <SelectField
              label="Period"
              value={String(slotForm.period_no)}
              onChange={(v) => setSlotForm((p) => ({ ...p, period_no: Number(v) }))}
              options={PERIODS.map((x) => ({
                value: String(x.period_no),
                label: `${x.period_no} • ${x.label} (${timeRange(x)})`,
              }))}
            />

            <SelectField
              label="Subject *"
              value={slotForm.subject_id}
              onChange={(v) => setSlotForm((p) => ({ ...p, subject_id: v }))}
              options={[
                { value: "", label: "Select subject" },
                ...subjectsForSection.map((s) => ({ value: s.subject_id, label: subjectLabel(s) })),
              ]}
            />

            <SelectField
              label="Teacher"
              value={slotForm.teacher_id}
              onChange={(v) => setSlotForm((p) => ({ ...p, teacher_id: v }))}
              options={[
                { value: "", label: "—" },
                ...teachers.map((t) => ({ value: t.user_id, label: teacherName(t) })),
              ]}
            />

            <InputField
              label="Room"
              value={slotForm.room}
              onChange={(v) => setSlotForm((p) => ({ ...p, room: v }))}
              placeholder="e.g., R-101, Lab-2"
            />

            <InputField
              label="Notes (optional)"
              value={slotForm.notes}
              onChange={(v) => setSlotForm((p) => ({ ...p, notes: v }))}
              placeholder="e.g., Lab session / Bring calculator"
            />
          </div>

          {/* Conflict preview */}
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-sm font-extrabold">Conflict check (preview)</div>
            <div className={`mt-1 text-sm ${UI.muted}`}>
              Flags overlaps across sections when the <span className="font-semibold">teacher</span> or <span className="font-semibold">room</span> is used at the same day/period.
            </div>

            <div className="mt-3 overflow-auto rounded-2xl border border-black/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/[0.02] text-xs text-black/60">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-[120px]">Type</th>
                    <th className="px-4 py-3 font-semibold">Overlaps in other section(s)</th>
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
              disabled={upsertM.isPending || !slotForm.subject_id}
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

          <div className={`text-xs ${UI.muted}`}>
            Apply schedule changes across multiple Senior High sections (Active SY + selected term).
          </div>

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
              />

              {bulkMode === "copy" ? (
                <>
                  <SelectField
                    label="Source section"
                    value={bulkSourceSectionId || ""}
                    onChange={setBulkSourceSectionId}
                    options={[
                      { value: "", label: "Select…" },
                      ...sections.map((s) => ({ value: s.section_id, label: sectionLabel(s) })),
                    ]}
                  />

                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                    <input
                      type="checkbox"
                      checked={bulkOverwrite}
                      onChange={(e) => setBulkOverwrite(e.target.checked)}
                      className="h-4 w-4 accent-[#C9A227]"
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
                  const disabled = bulkMode === "copy" && s.section_id === bulkSourceSectionId;
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
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02]"
                >
                  Select all
                </button>
                <button
                  onClick={() => setBulkTargetSectionIds(new Set())}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/[0.02]"
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

      <div className={`pt-2 text-xs ${UI.muted}`}>
        Tip: Keep the DB uniqueness indexes (section slot / teacher slot / room slot) even after you configure RLS. They’re your last line of defense against conflicts.
      </div>
    </div>
  );
}

/* ================= Small Components (aligned to Enrollment.jsx style) ================= */

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

function InputField({ label, value, onChange, placeholder, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  const normalized = Array.isArray(options)
    ? options.map((o) => (typeof o === "string" ? { value: o, label: o } : o))
    : [];

  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
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
    <button
      title={title}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls}`}
    >
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
        <div className={`w-full ${maxWidth} rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{title}</div>
              <div className={`text-xs ${UI.muted}`}>White + gold minimal design.</div>
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
          <div className={`h-full overflow-auto rounded-2xl border ${UI.border} bg-white shadow-xl`}>{children}</div>
        </div>
        <div className="flex-1" onClick={onClose} />
      </div>
    </>
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
}) {
  return (
    <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">Sections</div>
          <div className={`text-xs ${UI.muted}`}>Find and select a section to edit.</div>
        </div>
        {headerRight || null}
      </div>

      <Field label="Search section">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            value={qSection}
            onChange={(e) => setQSection(e.target.value)}
            placeholder="Search grade/track/strand/section…"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Grade" value={fGrade} onChange={setFGrade} options={grades} />
        <SelectField label="Strand" value={fStrand} onChange={setFStrand} options={strands} />
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-xs ${UI.muted}`}>{filteredSections.length} result(s)</div>
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

      <div className="max-h-[420px] overflow-auto pr-1">
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
                    <div className={`mt-1 text-xs ${UI.muted}`}>Adviser: {adviserLabel(s)}</div>
                    <div className={`mt-1 text-xs ${UI.muted}`}>Entries (SY+Term): {count}</div>
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
            <div className={`rounded-2xl border ${UI.border} bg-white p-4 text-sm ${UI.muted}`}>No sections found.</div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => alert("Wire to your duplicate section flow")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[0.02]"
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
