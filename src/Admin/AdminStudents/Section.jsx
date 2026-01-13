// Admin/AdminStudents/Sections.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  Plus,
  Search,
  Pencil,
  Archive,
  Users,
  X,
  Save,
  Shuffle,
  RotateCcw,
  UserCheck,
  Download,
  Undo2,
  ArchiveRestore,
  Filter,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ===================== UI (match Enrollment.jsx) ===================== */

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

const MAX_CAPACITY = 40;

/* ===================== Helpers ===================== */

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function fullNameLike({ first_name, last_name, middle_initial, extension }) {
  const mi = middle_initial?.trim() ? ` ${middle_initial.trim()}.` : "";
  const ext = extension?.trim() ? ` ${extension.trim()}` : "";
  return `${last_name || ""}, ${first_name || ""}${ext}${mi}`.trim();
}

function sbErrorMessage(err) {
  const msg = String(err?.message || err || "");
  if (msg.toLowerCase().includes("sections_sy_id_grade_track_strand_name_key".toLowerCase())) {
    return "A section with the same School Year, Grade, Track, Strand, and Section Name already exists.";
  }
  if (msg.toLowerCase().includes("sections_adviser_id_unique".toLowerCase())) {
    return "This adviser is already assigned to another section.";
  }
  if (msg.toLowerCase().includes("student_school_years_ux".toLowerCase())) {
    return "This student already has an assignment in the active school year.";
  }
  return msg;
}

function sectionKey({ grade_id, track_id, strand_id }) {
  return `${grade_id || ""}__${track_id || ""}__${strand_id || ""}`;
}

function matchesSection(student, sec) {
  if (!student.grade_id || !student.track_id) return false;
  if ((sec.grade_id || null) !== (student.grade_id || null)) return false;
  if ((sec.track_id || null) !== (student.track_id || null)) return false;

  const sStrand = student.strand_id || null;
  const secStrand = sec.strand_id || null;

  // strict match: if student has no strand -> must go to section with null strand
  if (sStrand === null) return secStrand === null;
  return secStrand === sStrand;
}

function pickBestSection({ sections, desiredGender, currentCounts }) {
  let best = null;
  let bestScore = Infinity;

  for (const sec of sections) {
    const c = currentCounts.get(sec.section_id) || { total: 0, male: 0, female: 0 };
    if (c.total >= MAX_CAPACITY) continue;

    const fillScore = c.total / MAX_CAPACITY;

    const beforeDiff = Math.abs(c.male - c.female);
    const after = { ...c };
    if (desiredGender === "male") after.male += 1;
    else if (desiredGender === "female") after.female += 1;
    after.total += 1;
    const afterDiff = Math.abs(after.male - after.female);

    const genderPenalty = desiredGender ? (afterDiff - beforeDiff) * 0.08 : 0;
    const jitter = Math.random() * 0.001;

    const score = fillScore + genderPenalty + jitter;

    if (score < bestScore) {
      bestScore = score;
      best = sec;
    }
  }

  return best;
}

/* ===================== Toast (same pattern as Enrollment.jsx) ===================== */

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-2xl border bg-white p-4 shadow-xl ${
            t.tone === "danger"
              ? "border-rose-200"
              : t.tone === "success"
              ? "border-emerald-200"
              : "border-black/10"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-[#1F1A14]">{t.title}</div>
              {t.message ? <div className="mt-1 text-xs font-semibold text-black/60">{t.message}</div> : null}

              {t.actions?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className={`rounded-xl px-3 py-2 text-xs font-extrabold ${
                        a.variant === "danger"
                          ? "bg-rose-600 text-white"
                          : a.variant === "primary"
                          ? "bg-[#C9A227] text-black"
                          : "border border-black/10 bg-white text-black/70"
                      }`}
                      type="button"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5"
              title="Close"
              type="button"
            >
              <X className="h-4 w-4 text-black/50" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = (toast) => {
    const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
    const item = { id, tone: "info", ...toast };
    setToasts((p) => [item, ...p]);

    if (!item.actions?.length) {
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
    }
    return id;
  };

  const dismiss = (id) => setToasts((p) => p.filter((x) => x.id !== id));

  const confirm = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    tone = "danger",
  }) =>
    new Promise((resolve) => {
      const id = push({
        title,
        message,
        tone,
        actions: [
          {
            label: cancelText,
            variant: "secondary",
            onClick: () => {
              dismiss(id);
              resolve(false);
            },
          },
          {
            label: confirmText,
            variant: tone === "danger" ? "danger" : "primary",
            onClick: () => {
              dismiss(id);
              resolve(true);
            },
          },
        ],
      });
    });

  return { toasts, push, dismiss, confirm };
}

/* ====================== PDF ====================== */

function formatSyLabel(sy) {
  if (!sy) return "SY (Active)";
  return `SY ${sy.sy_code || sy.sy_id}`;
}

function sectionMetaLine(section) {
  const grade = section.grade_levels?.grade_level ?? "—";
  const track = section.tracks?.track_code ?? "—";
  const strand = section.strands?.strand_code ?? "—";
  const adviser = section.teachers
    ? `${section.teachers.last_name || ""}, ${section.teachers.first_name || ""}`.trim()
    : "—";
  return `Grade: ${grade}   Track: ${track}   Strand: ${strand}   Adviser: ${adviser || "—"}`;
}

function buildSectionsPdf({ title, sy, sections, rosters }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;

  // Cover
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, left, 72);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${formatSyLabel(sy)}`, left, 96);
  doc.setFontSize(10);
  doc.text("Includes roster pages per section.", left, 116);

  doc.addPage();

  let rosterIndex = 0;

  for (const section of sections) {
    if (rosterIndex > 0) doc.addPage();
    rosterIndex += 1;

    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Section: ${section.section_name || "—"}`, left, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(sectionMetaLine(section), left, y + 16);

    const students = rosters.get(section.section_id) || [];

    const body = students.map((s, idx) => [
      String(idx + 1),
      s.student_number || "—",
      fullNameLike(s) || "—",
      s.gender || "—",
      s.status || "—",
    ]);

    autoTable(doc, {
      startY: y + 30,
      head: [["#", "Student #", "Name", "Gender", "Status"]],
      body,
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
      },
      headStyles: { fontStyle: "bold" },
      margin: { left, right: left },
      didDrawPage: () => {
        const internalPage = doc.getCurrentPageInfo().pageNumber; // cover=1
        const rosterPage = Math.max(1, internalPage - 1);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Page ${rosterPage}`,
          doc.internal.pageSize.getWidth() - 70,
          doc.internal.pageSize.getHeight() - 26
        );
      },
    });
  }

  return doc;
}

/* ====================== MAIN PAGE ====================== */

export default function Sections() {
  const qc = useQueryClient();
  const toast = useToasts();

  // UI state
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("Active"); // Active | Archived
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");

  // Modals
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });
  const [studentsModal, setStudentsModal] = useState({ open: false, row: null });
  const [unclassifiedModal, setUnclassifiedModal] = useState(false);

  // Auto-assign report modal
  const [autoAssignReport, setAutoAssignReport] = useState({ open: false, data: null });

  // ===== Role (admin vs super_admin) =====
  const roleQ = useQuery({
    queryKey: ["my_role"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return "anonymous";

      const { data, error } = await supabase.from("profiles").select("role").eq("user_id", uid).single();
      if (error) throw error;
      return data?.role || "anonymous";
    },
  });

  const myRole = roleQ.data || "anonymous";
  const canWrite = myRole === "super_admin";

  function softBlock() {
    toast.push({
      tone: "danger",
      title: "Not allowed",
      message: "Super Admin only.",
    });
  }

  // Lookups
  const gradesQ = useQuery({
    queryKey: ["grade_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_levels")
        .select("grade_id, grade_level, description")
        .order("grade_level", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tracksQ = useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("track_id, track_code, description")
        .order("track_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const strandsQ = useQuery({
    queryKey: ["strands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strands")
        .select("strand_id, track_id, strand_code, description")
        .order("strand_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const teachersQ = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("user_id, first_name, last_name, status, is_archived")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ✅ Active SY
  const activeSYQ = useQuery({
    queryKey: ["active_school_year"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date, end_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // ✅ Unclassified section (active SY only)
  const unclassifiedQ = useQuery({
    queryKey: ["unclassified_section", activeSYQ.data?.sy_id],
    enabled: !!activeSYQ.data?.sy_id,
    queryFn: async () => {
      const sy = activeSYQ.data;
      const { data, error } = await supabase
        .from("sections")
        .select("section_id, section_name")
        .eq("sy_id", sy.sy_id)
        .eq("section_name", "Unclassified")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Sections list + joins (active SY)
  const sectionsQ = useQuery({
    queryKey: ["sections", activeSYQ.data?.sy_id],
    enabled: !!activeSYQ.data?.sy_id,
    queryFn: async () => {
      const sy = activeSYQ.data;
      const { data, error } = await supabase
        .from("sections")
        .select(
          `
          sy_id,
          section_id,
          section_name,
          grade_id,
          track_id,
          strand_id,
          adviser_id,
          is_archived,
          created_at,
          updated_at,
          grade_levels ( grade_id, grade_level ),
          tracks ( track_id, track_code ),
          strands ( strand_id, strand_code ),
          teachers:adviser_id ( user_id, first_name, last_name )
        `
        )
        .eq("sy_id", sy.sy_id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = sectionsQ.data ?? [];

  // Hide Unclassified always
  const notUnclassified = useMemo(() => rows.filter((r) => norm(r.section_name) !== "unclassified"), [rows]);

  // Tab filtering (active/archived)
  const visibleRows = useMemo(() => {
    const wantArchived = norm(tab) === "archived";
    return notUnclassified.filter((r) => !!r.is_archived === wantArchived);
  }, [notUnclassified, tab]);

  // Student counts per section (active SY, Enrolled only)
  const countsQ = useQuery({
    queryKey: ["students_counts_by_section", activeSYQ.data?.sy_id],
    enabled: !!activeSYQ.data?.sy_id,
    queryFn: async () => {
      const sy = activeSYQ.data;
      const { data, error } = await supabase.from("students").select("id, section_id, gender").eq("sy_id", sy.sy_id).eq("status", "Enrolled");
      if (error) throw error;

      const map = new Map();
      for (const s of data ?? []) {
        const k = s.section_id || null;
        if (!k) continue;
        const cur = map.get(k) || { total: 0, male: 0, female: 0 };
        cur.total += 1;
        const g = norm(s.gender);
        if (g === "male") cur.male += 1;
        if (g === "female") cur.female += 1;
        map.set(k, cur);
      }
      return map;
    },
  });

  // ✅ Unclassified students list (active SY, Enrolled only)
  const unclassifiedStudentsQ = useQuery({
    queryKey: ["unclassified_students", activeSYQ.data?.sy_id, unclassifiedQ.data?.section_id],
    enabled: !!activeSYQ.data?.sy_id,
    queryFn: async () => {
      const sy = activeSYQ.data;
      const ucId = unclassifiedQ.data?.section_id;
      if (!sy?.sy_id || !ucId) return [];

      const { data, error } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name, middle_initial, extension, gender, status, updated_at, grade_id, track_id, strand_id, sy_id, section_id")
        .eq("sy_id", sy.sy_id)
        .eq("status", "Enrolled")
        .or(`section_id.is.null,section_id.eq.${ucId}`)
        .order("last_name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Filtered sections
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return visibleRows
      .filter((r) => {
        if (!needle) return true;
        const grade = r.grade_levels?.grade_level ?? "";
        const track = r.tracks?.track_code ?? "";
        const strand = r.strands?.strand_code ?? "";
        const adviser = r.teachers ? `${r.teachers.last_name || ""}, ${r.teachers.first_name || ""}` : "";
        const hay = `${r.section_name} ${grade} ${track} ${strand} ${adviser}`.toLowerCase();
        return hay.includes(needle);
      })
      .filter((r) => (fTrack === "All" ? true : (r.tracks?.track_code || "") === fTrack))
      .filter((r) => (fGrade === "All" ? true : String(r.grade_levels?.grade_level || "") === String(fGrade)))
      .sort((a, b) => (a.section_name || "").localeCompare(b.section_name || ""));
  }, [visibleRows, q, fTrack, fGrade]);

  const stats = useMemo(() => {
    const activeCount = notUnclassified.filter((s) => !s.is_archived).length;
    const archivedCount = notUnclassified.filter((s) => !!s.is_archived).length;

    const totalStudents = Array.from((countsQ.data ?? new Map()).values()).reduce((a, b) => a + (b?.total ?? 0), 0);
    const unclassifiedCount = (unclassifiedStudentsQ.data ?? []).length;

    return { activeSections: activeCount, archivedSections: archivedCount, totalStudents, unclassifiedCount };
  }, [notUnclassified, countsQ.data, unclassifiedStudentsQ.data]);

  /**
   * ✅ Sync adviser assignment into section_advisers (active SY).
   */
  async function syncSectionAdviser({ section_id, adviser_id }) {
    const sy = activeSYQ.data;
    if (!sy?.sy_id) throw new Error("No active school year found.");
    if (!section_id) throw new Error("Missing section_id for adviser sync.");

    const payload = { sy_id: sy.sy_id, section_id, adviser_id: adviser_id || null };

    const { error } = await supabase.from("section_advisers").upsert(payload, { onConflict: "sy_id,section_id" });
    if (error) throw error;
  }

  /* ====================== CRUD + ARCHIVE ====================== */

  const createM = useMutation({
    mutationFn: async (values) => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");

      const payload = {
        sy_id: sy.sy_id,
        section_name: values.section_name,
        grade_id: values.grade_id || null,
        track_id: values.track_id || null,
        strand_id: values.strand_id || null,
        adviser_id: values.adviser_id || null,
        is_archived: false,
      };

      const { data, error } = await supabase.from("sections").insert(payload).select("section_id, adviser_id").single();
      if (error) throw error;

      await syncSectionAdviser({ section_id: data.section_id, adviser_id: data.adviser_id });
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      toast.push({ tone: "success", title: "Created", message: "Section added." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Create failed", message: sbErrorMessage(e) }),
  });

  const updateM = useMutation({
    mutationFn: async ({ section_id, values }) => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");

      const patch = {
        section_name: values.section_name,
        grade_id: values.grade_id || null,
        track_id: values.track_id || null,
        strand_id: values.strand_id || null,
        adviser_id: values.adviser_id || null,
      };

      const { error } = await supabase.from("sections").update(patch).eq("section_id", section_id);
      if (error) throw error;

      await syncSectionAdviser({ section_id, adviser_id: patch.adviser_id });
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      toast.push({ tone: "success", title: "Saved", message: "Section updated." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Update failed", message: sbErrorMessage(e) }),
  });

  const toggleArchiveM = useMutation({
    mutationFn: async ({ section, nextArchived }) => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const { error } = await supabase.from("sections").update({ is_archived: !!nextArchived }).eq("section_id", section.section_id);
      if (error) throw error;
      return { nextArchived: !!nextArchived };
    },
    onSuccess: async ({ nextArchived }) => {
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      toast.push({
        tone: "success",
        title: nextArchived ? "Archived" : "Restored",
        message: nextArchived ? "Section moved to Archived." : "Section restored to Active.",
      });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Action failed", message: sbErrorMessage(e) }),
  });

  /* ====================== ASSIGNMENT ====================== */

  const autoAssignM = useMutation({
    mutationFn: async () => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");

      const uc = unclassifiedQ.data;
      if (!uc?.section_id) throw new Error('"Unclassified" section not found for the active school year.');
      const unclassifiedId = uc.section_id;

      const { data: stData, error: stErr } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name, middle_initial, extension, gender, status, sy_id, grade_id, track_id, strand_id, section_id")
        .eq("sy_id", sy.sy_id)
        .eq("status", "Enrolled");
      if (stErr) throw stErr;

      const candidates = (stData ?? []).filter((s) => (!s.section_id ? true : s.section_id === unclassifiedId));
      if (candidates.length === 0) return { assigned: 0, skipped: 0, reason: "No unclassified enrolled students found." };

      const usableSections = rows
        .filter((sec) => sec.sy_id === sy.sy_id)
        .filter((sec) => norm(sec.section_name) !== "unclassified")
        .filter((sec) => !sec.is_archived);

      const sectionsByKey = new Map();
      for (const sec of usableSections) {
        const key = sectionKey(sec);
        const arr = sectionsByKey.get(key) || [];
        arr.push(sec);
        sectionsByKey.set(key, arr);
      }

      const counts = new Map(countsQ.data ?? new Map());

      const shuffled = [...candidates];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const updates = [];
      let skipped = 0;

      const sectionNameById = new Map();
      for (const sec of usableSections) sectionNameById.set(sec.section_id, sec.section_name);

      for (const s of shuffled) {
        if (!s.grade_id || !s.track_id) {
          skipped += 1;
          continue;
        }

        const key = sectionKey(s);
        const pool = sectionsByKey.get(key) || [];
        if (pool.length === 0) {
          skipped += 1;
          continue;
        }

        const g = norm(s.gender);
        const desiredGender = g === "male" ? "male" : g === "female" ? "female" : null;

        const best = pickBestSection({ sections: pool, desiredGender, currentCounts: counts });
        if (!best) {
          skipped += 1;
          continue;
        }

        updates.push({ id: s.id, section_id: best.section_id });

        const c = counts.get(best.section_id) || { total: 0, male: 0, female: 0 };
        c.total += 1;
        if (desiredGender === "male") c.male += 1;
        else if (desiredGender === "female") c.female += 1;
        counts.set(best.section_id, c);
      }

      if (updates.length === 0) return { assigned: 0, skipped, reason: "No valid assignments found (capacity/match constraints)." };

      for (const u of updates) {
        const { error } = await supabase.from("students").update({ section_id: u.section_id }).eq("id", u.id).eq("sy_id", sy.sy_id);
        if (error) throw error;

        const { error: upErr } = await supabase
          .from("student_school_years")
          .upsert({ sy_id: sy.sy_id, student_id: u.id, section_id: u.section_id }, { onConflict: "sy_id,student_id" });
        if (upErr) throw upErr;
      }

      const assignments = updates.map((u) => {
        const st = candidates.find((x) => x.id === u.id);
        return {
          student_id: u.id,
          student_number: st?.student_number || "—",
          first_name: st?.first_name || "",
          last_name: st?.last_name || "",
          middle_initial: st?.middle_initial || "",
          extension: st?.extension || "",
          gender: st?.gender || null,
          section_id: u.section_id,
          section_name: sectionNameById.get(u.section_id) || "—",
        };
      });

      return { assigned: updates.length, skipped, assignments };
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["students_counts_by_section", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["unclassified_students", activeSYQ.data?.sy_id] });

      toast.push({
        tone: "success",
        title: "Auto-Assign completed",
        message: `Assigned ${data?.assigned ?? 0} · Skipped ${data?.skipped ?? 0}${data?.reason ? ` (${data.reason})` : ""}`,
      });

      if (data?.assignments?.length) setAutoAssignReport({ open: true, data });
      else setAutoAssignReport({ open: false, data: null });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Auto-Assign failed", message: sbErrorMessage(e) }),
  });

  const resetAssignM = useMutation({
    mutationFn: async () => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");

      const uc = unclassifiedQ.data;
      if (!uc?.section_id) throw new Error('"Unclassified" section not found for the active school year.');
      const unclassifiedId = uc.section_id;

      const ok = await toast.confirm({
        title: "Reset assignments?",
        message: `Reset section assignments for ALL Enrolled students in SY ${sy.sy_code || "(active)"}?\n\nThis will set section back to "Unclassified".`,
        confirmText: "Reset",
        cancelText: "Cancel",
        tone: "danger",
      });
      if (!ok) return { cancelled: true };

      const { error: upErr } = await supabase
        .from("students")
        .update({ section_id: unclassifiedId })
        .eq("sy_id", sy.sy_id)
        .eq("status", "Enrolled");
      if (upErr) throw upErr;

      const { error: delErr } = await supabase.from("student_school_years").delete().eq("sy_id", sy.sy_id);
      if (delErr) throw delErr;

      return { ok: true };
    },
    onSuccess: async (res) => {
      if (res?.cancelled) return;

      await qc.invalidateQueries({ queryKey: ["students_counts_by_section", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["unclassified_students", activeSYQ.data?.sy_id] });

      toast.push({ tone: "success", title: "Reset complete", message: "All enrolled students moved to Unclassified." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Reset failed", message: sbErrorMessage(e) }),
  });

  const assignOneM = useMutation({
    mutationFn: async ({ student, section_id }) => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");
      const ucId = unclassifiedQ.data?.section_id;
      if (!ucId) throw new Error('"Unclassified" section not found for the active school year.');

      const sec = rows.find((x) => x.section_id === section_id);
      if (!sec) throw new Error("Section not found.");
      if (sec.is_archived) throw new Error("Cannot assign to an archived section.");
      if (norm(sec.section_name) === "unclassified") throw new Error('Cannot assign to "Unclassified".');

      if (!matchesSection(student, sec)) throw new Error("Student does not match the section's grade/track/strand.");

      const c = (countsQ.data ?? new Map()).get(section_id) || { total: 0 };
      if ((c.total ?? 0) >= MAX_CAPACITY) throw new Error(`This section is at maximum capacity (${MAX_CAPACITY}).`);

      const { error } = await supabase.from("students").update({ section_id }).eq("id", student.id).eq("sy_id", sy.sy_id);
      if (error) throw error;

      const { error: upErr } = await supabase
        .from("student_school_years")
        .upsert({ sy_id: sy.sy_id, student_id: student.id, section_id }, { onConflict: "sy_id,student_id" });
      if (upErr) throw upErr;

      return { student_id: student.id, section_id };
    },
    onSuccess: async ({ student_id, section_id }) => {
      qc.setQueryData(["unclassified_students", activeSYQ.data?.sy_id, unclassifiedQ.data?.section_id], (old) =>
        Array.isArray(old) ? old.filter((s) => s.id !== student_id) : old
      );

      await qc.invalidateQueries({ queryKey: ["students_counts_by_section", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["sections", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["unclassified_students", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["students_in_section", activeSYQ.data?.sy_id, section_id] });
      await qc.invalidateQueries({ queryKey: ["students_in_section"] });

      toast.push({ tone: "success", title: "Assigned", message: "Student assigned to section." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Assign failed", message: sbErrorMessage(e) }),
  });

  const removeFromSectionM = useMutation({
    mutationFn: async ({ student_id }) => {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");
      const ucId = unclassifiedQ.data?.section_id;
      if (!ucId) throw new Error('"Unclassified" section not found for the active school year.');

      const ok = await toast.confirm({
        title: "Unclassify student?",
        message: 'Remove this student from the section and move back to "Unclassified"?',
        confirmText: "Unclassify",
        cancelText: "Cancel",
        tone: "danger",
      });
      if (!ok) return { cancelled: true };

      const { error } = await supabase.from("students").update({ section_id: ucId }).eq("id", student_id).eq("sy_id", sy.sy_id);
      if (error) throw error;

      const { error: delErr } = await supabase.from("student_school_years").delete().eq("sy_id", sy.sy_id).eq("student_id", student_id);
      if (delErr) throw delErr;

      return { ok: true };
    },
    onSuccess: async (res) => {
      if (res?.cancelled) return;

      await qc.invalidateQueries({ queryKey: ["students_counts_by_section", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["unclassified_students", activeSYQ.data?.sy_id] });
      await qc.invalidateQueries({ queryKey: ["students_in_section"] });

      toast.push({ tone: "success", title: "Unclassified", message: "Student moved back to Unclassified." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Action failed", message: sbErrorMessage(e) }),
  });

  /* ====================== PDF DOWNLOADS ====================== */

  const downloadPdfM = useMutation({
    mutationFn: async ({ mode, section }) => {
      const sy = activeSYQ.data;
      if (!sy?.sy_id) throw new Error("No active school year found.");

      const all = notUnclassified;
      const isArchived = (s) => !!s.is_archived;

      let targetSections = [];
      let title = "";

      if (mode === "ONE_ACTIVE") {
        targetSections = [section];
        title = `Active Section • ${formatSyLabel(sy)}`;
      } else if (mode === "ONE_ARCHIVED") {
        targetSections = [section];
        title = `Archived Section • ${formatSyLabel(sy)}`;
      } else if (mode === "ALL_ACTIVE") {
        targetSections = all.filter((s) => !isArchived(s));
        title = `All Active Sections • ${formatSyLabel(sy)}`;
      } else if (mode === "ALL_ARCHIVED") {
        targetSections = all.filter((s) => isArchived(s));
        title = `All Archived Sections • ${formatSyLabel(sy)}`;
      } else {
        throw new Error("Unknown download mode.");
      }

      const rosters = new Map();
      await Promise.all(
        targetSections.map(async (sec) => {
          const { data, error } = await supabase
            .from("students")
            .select("id, student_number, first_name, last_name, middle_initial, extension, gender, status, section_id, sy_id")
            .eq("sy_id", sy.sy_id)
            .eq("section_id", sec.section_id)
            .order("last_name", { ascending: true });

          if (error) throw error;
          rosters.set(sec.section_id, data ?? []);
        })
      );

      const doc = buildSectionsPdf({ title, sy, sections: targetSections, rosters });

      const safeSy = sy.sy_code ? String(sy.sy_code).replace(/\s+/g, "_") : String(sy.sy_id);
      const safeTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
      doc.save(`${safeSy}_${safeTitle}.pdf`);

      return true;
    },
    onSuccess: () => toast.push({ tone: "success", title: "Downloaded", message: "PDF generated successfully." }),
    onError: (e) => toast.push({ tone: "danger", title: "PDF failed", message: sbErrorMessage(e) }),
  });

  /* ====================== UI HANDLERS ====================== */

  function openCreate() {
    if (!canWrite) return softBlock();
    setModal({
      open: true,
      mode: "create",
      row: { section_id: null, section_name: "", grade_id: "", track_id: "", strand_id: "", adviser_id: "" },
    });
  }

  function openEdit(row) {
    if (!canWrite) return softBlock();
    setModal({
      open: true,
      mode: "edit",
      row: {
        section_id: row.section_id,
        section_name: row.section_name || "",
        grade_id: row.grade_id || "",
        track_id: row.track_id || "",
        strand_id: row.strand_id || "",
        adviser_id: row.adviser_id || "",
        updated_at: row.updated_at || null,
      },
    });
  }

  function openStudents(row) {
    setStudentsModal({ open: true, row });
  }

  const gradeOptions = gradesQ.data ?? [];
  const trackOptions = tracksQ.data ?? [];
  const strandOptions = strandsQ.data ?? [];
  const teacherOptions = (teachersQ.data ?? []).filter((t) => !t.is_archived && norm(t.status) === "active");

  const syLabel = activeSYQ.data ? `${activeSYQ.data.sy_code} (Active)` : "No active SY";
  const unclassifiedLabel = unclassifiedQ.data?.section_id ? "Ready" : "Missing";

  const busy =
    createM.isPending ||
    updateM.isPending ||
    toggleArchiveM.isPending ||
    autoAssignM.isPending ||
    resetAssignM.isPending ||
    assignOneM.isPending ||
    removeFromSectionM.isPending ||
    downloadPdfM.isPending;

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Sections</div>
      

          <div className="mt-1 text-xs text-black/60">
            Active School Year: <span className="font-extrabold text-black">{syLabel}</span>
            <span className="mx-2 text-black/30">•</span>
            Role: <span className="font-extrabold text-black">{myRole || "—"}</span>
          
          </div>

          {!canWrite ? (
            <div className="mt-2 rounded-xl border border-black/10 bg-[#C9A227]/5 px-3 py-2 text-xs text-black/70">
              You are in <span className="font-extrabold">Admin/Teacher view</span>. Editing, assigning, archiving, and reset actions are disabled.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setUnclassifiedModal(true)}
            disabled={!activeSYQ.data || !unclassifiedQ.data?.section_id || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
            title="View unclassified students"
            type="button"
          >
            <Users className="h-4 w-4 text-black/60" />
            Unclassified ({stats.unclassifiedCount})
          </button>

          {canWrite ? (
            <>
              <button
                onClick={() => autoAssignM.mutate()}
                disabled={busy || !activeSYQ.data || !unclassifiedQ.data?.section_id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                title="Assign enrolled unclassified students to matching non-archived sections (max 40; balanced gender)."
                type="button"
              >
                <Shuffle className="h-4 w-4 text-black/60" />
                Auto-Assign
              </button>

              <button
                onClick={() => resetAssignM.mutate()}
                disabled={busy || !activeSYQ.data || !unclassifiedQ.data?.section_id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                title='Reset all assignments (set back to "Unclassified").'
                type="button"
              >
                <RotateCcw className="h-4 w-4 text-black/60" />
                Reset
              </button>

              <button
                onClick={openCreate}
                disabled={busy}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Quick stats + downloads */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Active sections" value={stats.activeSections} />
          <Stat label="Archived sections" value={stats.archivedSections} />
          <Stat label="Enrolled students (active SY)" value={stats.totalStudents} />
          <Stat label="Unclassified (active SY)" value={stats.unclassifiedCount} />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => downloadPdfM.mutate({ mode: "ALL_ACTIVE" })}
            disabled={busy || !activeSYQ.data}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
            title="Download PDF for all ACTIVE sections (with roster)"
            type="button"
          >
            <Download className="h-4 w-4 text-black/60" />
            Download Active (All)
          </button>

          <button
            onClick={() => downloadPdfM.mutate({ mode: "ALL_ARCHIVED" })}
            disabled={busy || !activeSYQ.data}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
            title="Download PDF for all ARCHIVED sections (with roster)"
            type="button"
          >
            <Download className="h-4 w-4 text-black/60" />
            Download Archived (All)
          </button>
        </div>
      </div>

      {/* Tabs (Enrollment-style pills) */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {["Active", "Archived"].map((t) => {
            const active = norm(tab) === norm(t);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
                type="button"
              >
                {t === "Active" ? <Users className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters (Enrollment-style) */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Search section">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, grade, track, adviser…"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <Field label="Track (optional)">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...(trackOptions.map((t) => t.track_code) || [])].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grade (optional)">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...(gradeOptions.map((g) => String(g.grade_level)) || [])].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quick actions">
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setFTrack("All");
                  setFGrade("All");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                <Filter className="h-4 w-4 text-black/60" />
                Clear
              </button>
            </div>
          </Field>
        </div>
      </div>

      {/* Table (Enrollment-style wrapper header) */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">{tab === "Archived" ? "Archived Sections" : "Active Sections"}</div>
          <div className={`text-xs ${UI.muted}`}>Showing {filtered.length} sections</div>
        </div>

        {sectionsQ.isLoading ? (
          <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
        ) : sectionsQ.isError ? (
          <div className="p-6 text-sm text-rose-700">Error: {sbErrorMessage(sectionsQ.error)}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Track</th>
                <th className="px-4 py-3 font-semibold">Strand</th>
                <th className="px-4 py-3 font-semibold">Adviser</th>
                <th className="px-4 py-3 font-semibold">Capacity</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const c = (countsQ.data ?? new Map()).get(r.section_id) || { total: 0, male: 0, female: 0 };
                const grade = r.grade_levels?.grade_level ?? "—";
                const track = r.tracks?.track_code ?? "—";
                const strand = r.strands?.strand_code ?? "—";
                const adviser = r.teachers ? `${r.teachers.last_name || ""}, ${r.teachers.first_name || ""}`.trim() : "—";

                const rowMode = r.is_archived ? "ONE_ARCHIVED" : "ONE_ACTIVE";

                return (
                  <tr key={r.section_id} className="border-t border-black/10 hover:bg-black/[0.01]">
                    <td className="px-4 py-3">
                      <div className="font-extrabold">{r.section_name || "—"}</div>
            
                    </td>

                    <td className="px-4 py-3 text-black/70">{grade}</td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#C9A227]/10 px-3 py-1 text-xs font-semibold text-[#C9A227]">
                        {track}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-black/70">{strand}</td>
                    <td className="px-4 py-3 text-black/70">{adviser || "—"}</td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openStudents(r)}
                          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/[0.02]"
                          type="button"
                        >
                          <Users className="h-4 w-4 text-black/60" />
                          {c.total}
                        </button>

                        <div className="text-xs text-black/60">
                          <span className="font-semibold">{c.male}</span> M · <span className="font-semibold">{c.female}</span> F
                        </div>

                        <span className={`ml-auto text-xs font-semibold ${c.total >= MAX_CAPACITY ? "text-rose-700" : "text-black/60"}`}>
                          {c.total}/{MAX_CAPACITY}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          title="Download section PDF"
                          onClick={() => downloadPdfM.mutate({ mode: rowMode, section: r })}
                          disabled={busy}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/[0.02] disabled:opacity-60"
                          type="button"
                        >
                          <Download className="h-5 w-5 text-black/70" />
                        </button>

                        {canWrite ? (
                          <>
                            <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold" disabled={busy}>
                              <Pencil className="h-5 w-5" />
                            </IconBtn>

                            {!r.is_archived ? (
                              <IconBtn
                                title="Archive section"
                                onClick={async () => {
                                  const ok = await toast.confirm({
                                    title: "Archive section?",
                                    message: "This will move the section to Archived. Students are not removed automatically.",
                                    confirmText: "Archive",
                                    cancelText: "Cancel",
                                    tone: "danger",
                                  });
                                  if (!ok) return;
                                  toggleArchiveM.mutate({ section: r, nextArchived: true });
                                }}
                                tone="neutral"
                                disabled={busy}
                              >
                                <Archive className="h-5 w-5" />
                              </IconBtn>
                            ) : (
                              <IconBtn
                                title="Restore section"
                                onClick={async () => {
                                  const ok = await toast.confirm({
                                    title: "Restore section?",
                                    message: "This will restore the section to Active.",
                                    confirmText: "Restore",
                                    cancelText: "Cancel",
                                    tone: "info",
                                  });
                                  if (!ok) return;
                                  toggleArchiveM.mutate({ section: r, nextArchived: false });
                                }}
                                tone="neutral"
                                disabled={busy}
                              >
                                <ArchiveRestore className="h-5 w-5" />
                              </IconBtn>
                            )}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal.open ? (
        <SectionModal
          mode={modal.mode}
          row={modal.row}
          onClose={() => setModal({ open: false, mode: "create", row: null })}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(section_id, values) => updateM.mutate({ section_id, values })}
          busy={createM.isPending || updateM.isPending}
          grades={gradeOptions}
          tracks={trackOptions}
          strands={strandOptions}
          teachers={teacherOptions}
          allSections={rows}
        />
      ) : null}

      {/* Students Modal */}
      {studentsModal.open ? (
        <StudentsModal
          section={studentsModal.row}
          activeSY={activeSYQ.data}
          counts={countsQ.data ?? new Map()}
          unclassifiedSectionId={unclassifiedQ.data?.section_id}
          canWrite={canWrite}
          toast={toast}
          onClose={() => setStudentsModal({ open: false, row: null })}
          onRemove={(student_id) => removeFromSectionM.mutate({ student_id })}
          removing={removeFromSectionM.isPending}
        />
      ) : null}

      {/* Unclassified Modal */}
      {unclassifiedModal ? (
        <UnclassifiedModal
          activeSY={activeSYQ.data}
          unclassifiedSectionId={unclassifiedQ.data?.section_id}
          students={unclassifiedStudentsQ.data ?? []}
          loading={unclassifiedStudentsQ.isLoading}
          error={unclassifiedStudentsQ.isError ? unclassifiedStudentsQ.error : null}
          allSections={rows}
          counts={countsQ.data ?? new Map()}
          canWrite={canWrite}
          assigning={assignOneM.isPending}
          onAssign={(student, section_id) => assignOneM.mutate({ student, section_id })}
          onClose={() => setUnclassifiedModal(false)}
        />
      ) : null}

      {/* Auto-Assign Report Modal */}
      {autoAssignReport.open ? (
        <AutoAssignReportModal
          sy={activeSYQ.data}
          data={autoAssignReport.data}
          onClose={() => setAutoAssignReport({ open: false, data: null })}
        />
      ) : null}

   
    </div>
  );
}

/* ================= Modals ================= */

function SectionModal({ mode, row, onClose, onCreate, onUpdate, busy, grades, tracks, strands, teachers, allSections }) {
  const isEdit = mode === "edit";
  const [draft, setDraft] = useState(() => ({ ...row }));

  useEffect(() => {
    setDraft({ ...row });
  }, [row]);

  const lastUpdatedAt = useMemo(() => {
    const raw = draft?.updated_at || null;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
  }, [draft?.updated_at]);

  const availableStrands = useMemo(() => {
    const tid = draft.track_id;
    if (!tid) return strands;
    return strands.filter((s) => s.track_id === tid);
  }, [strands, draft.track_id]);

  const usedAdvisers = useMemo(() => {
    const set = new Set();
    for (const s of allSections ?? []) {
      if (s.adviser_id) set.add(s.adviser_id);
    }
    if (isEdit && row?.adviser_id) set.delete(row.adviser_id);
    return set;
  }, [allSections, isEdit, row?.adviser_id]);

  const availableTeachers = useMemo(
    () => (teachers ?? []).filter((t) => !usedAdvisers.has(t.user_id)),
    [teachers, usedAdvisers]
  );

  const canSave = !!draft.section_name?.trim();

  function submit(e) {
    e.preventDefault();

    const values = {
      section_name: draft.section_name?.trim(),
      grade_id: draft.grade_id || null,
      track_id: draft.track_id || null,
      strand_id: draft.strand_id || null,
      adviser_id: draft.adviser_id || null,
    };

    if (!canSave) return;

    if (isEdit) onUpdate(draft.section_id, values);
    else onCreate(values);

    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-3xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{isEdit ? "Edit Section" : "Add Section"}</div>
              <div className={`text-xs ${UI.muted}`}>Only Section Name is required. Grade/Track/Strand are optional but used for sectioning rules.</div>
              {isEdit ? (
                <div className="mt-1 text-xs font-bold text-black/60">
                  Last updated: <span className="text-black">{lastUpdatedAt || "—"}</span>
                </div>
              ) : null}
            </div>

            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <form onSubmit={submit} className="p-4 space-y-4 max-h-[75vh] overflow-auto">
            <Section title="Section Details">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Section Name *"
                  value={draft.section_name || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, section_name: e.target.value }))}
                />

                <Select
                  label="Grade Level (optional)"
                  value={draft.grade_id || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, grade_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {grades.map((g) => (
                    <option key={g.grade_id} value={g.grade_id}>
                      {g.grade_level}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Track (optional)"
                  value={draft.track_id || ""}
                  onChange={(e) => {
                    const nextTrack = e.target.value;
                    setDraft((d) => ({ ...d, track_id: nextTrack, strand_id: "" }));
                  }}
                >
                  <option value="">—</option>
                  {tracks.map((t) => (
                    <option key={t.track_id} value={t.track_id}>
                      {t.track_code}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Strand (optional)"
                  value={draft.strand_id || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, strand_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {availableStrands.map((s) => (
                    <option key={s.strand_id} value={s.strand_id}>
                      {s.strand_code}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Adviser (optional, unique per section)"
                  value={draft.adviser_id || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, adviser_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {availableTeachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {`${t.last_name || ""}, ${t.first_name || ""}`.trim()}
                    </option>
                  ))}
                </Select>

                <div className="rounded-xl border border-black/10 bg-black/[0.01] p-3">
                  <div className="text-xs font-semibold text-black/60">Capacity rule</div>
                  <div className="mt-1 text-xs text-black/55">Auto-assign respects max {MAX_CAPACITY} students/section and balances gender.</div>
                </div>
              </div>
            </Section>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                disabled={!canSave || busy}
                type="submit"
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-4 w-4" />
                {isEdit ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function StudentsModal({ section, activeSY, counts, unclassifiedSectionId, canWrite, toast, onClose, onRemove, removing }) {
  const [q, setQ] = useState("");

  const studentsQ = useQuery({
    queryKey: ["students_in_section", activeSY?.sy_id, section?.section_id],
    enabled: !!section?.section_id && !!activeSY?.sy_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name, middle_initial, extension, gender, status, updated_at")
        .eq("sy_id", activeSY.sy_id)
        .eq("section_id", section.section_id)
        .eq("status", "Enrolled")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const students = studentsQ.data ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((s) => {
      const hay = `${s.student_number} ${fullNameLike(s)} ${s.gender} ${s.status}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [students, q]);

  const c = counts.get(section.section_id) || { total: 0, male: 0, female: 0 };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-5xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">Students</div>
              <div className={`text-xs ${UI.muted}`}>
                {section?.section_name || "—"} · {activeSY?.sy_code ? `SY ${activeSY.sy_code}` : ""}
              </div>
              <div className="mt-1 text-[11px] text-black/60">
                {c.total}/{MAX_CAPACITY} · {c.male} M · {c.female} F
              </div>
            </div>

            <button onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
            <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-extrabold">Roster</div>
                  <div className={`text-xs ${UI.muted}`}>
                    {studentsQ.isLoading ? "Loading…" : `Showing ${filtered.length} of ${students.length} students`}
                  </div>
                </div>

                <div className="w-full md:w-[360px]">
                  <Field label="Search student">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name, student #, status…"
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {studentsQ.isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                Error: {sbErrorMessage(studentsQ.error)}
              </div>
            ) : (
              <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/[0.02] text-xs text-black/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student #</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Gender</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                        <td className="px-4 py-3 font-mono text-xs text-black/70">{s.student_number}</td>
                        <td className="px-4 py-3 font-semibold">{fullNameLike(s)}</td>
                        <td className="px-4 py-3 text-black/70">{s.gender || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusPill value={s.status || "Pending"} />
                        </td>
                        <td className="px-4 py-3 text-black/70">{s.updated_at ? new Date(s.updated_at).toLocaleString() : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {canWrite ? (
                              <button
                                title='Move back to "Unclassified"'
                                onClick={async () => {
                                  if (!unclassifiedSectionId) {
                                    toast.push({ tone: "danger", title: "Missing Unclassified", message: "Unclassified section is missing for this SY." });
                                    return;
                                  }
                                  onRemove(s.id);
                                }}
                                disabled={removing || !unclassifiedSectionId}
                                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                                type="button"
                              >
                                <Undo2 className="h-4 w-4 text-black/60" />
                                Unclassify
                              </button>
                            ) : (
                              <span className="text-xs text-black/45">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {studentsQ.isLoading ? null : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                          No students found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function UnclassifiedModal({
  activeSY,
  unclassifiedSectionId,
  students,
  loading,
  error,
  allSections,
  counts,
  canWrite,
  onAssign,
  assigning,
  onClose,
}) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState({ student: null, section_id: "" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((s) => {
      const hay = `${s.student_number} ${fullNameLike(s)} ${s.gender} ${s.status}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [students, q]);

  const eligibleSections = useMemo(() => {
    const st = pick.student;
    if (!st) return [];
    return allSections
      .filter((sec) => norm(sec.section_name) !== "unclassified")
      .filter((sec) => !sec.is_archived)
      .filter((sec) => matchesSection(st, sec))
      .map((sec) => {
        const c = counts.get(sec.section_id) || { total: 0, male: 0, female: 0 };
        return { ...sec, _count: c };
      })
      .sort((a, b) => (a._count.total ?? 0) - (b._count.total ?? 0));
  }, [pick.student, allSections, counts]);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className={`w-full max-w-5xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">Unclassified Students</div>
              <div className={`text-xs ${UI.muted}`}>Active SY: {activeSY?.sy_code || "—"} · Enrolled only</div>
            </div>
            <button onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-auto">
            {!unclassifiedSectionId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                "Unclassified" section is missing for this active school year.
              </div>
            ) : null}

            {!canWrite ? (
              <div className="rounded-2xl border border-black/10 bg-[#C9A227]/5 p-4 text-sm text-black/70">
                You can view the list, but only <span className="font-extrabold">Super Admin</span> can assign students.
              </div>
            ) : null}

            <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Search">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, student #…"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                    />
                  </div>
                </Field>

                <div className="rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                  <div className="text-xs font-semibold text-black/60">Assign rules</div>
                  <div className="mt-1 text-xs text-black/55">
                    Must match <span className="font-mono">grade_id/track_id/strand_id</span> · Max {MAX_CAPACITY} capacity · Non-archived sections only.
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className={`rounded-2xl border ${UI.border} bg-white p-6 text-sm ${UI.muted}`}>Loading…</div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Error: {sbErrorMessage(error)}</div>
            ) : (
              <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/[0.02] text-xs text-black/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student #</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Gender</th>
                      <th className="px-4 py-3 font-semibold">Assign to</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const isPicked = pick.student?.id === s.id;
                      return (
                        <tr key={s.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                          <td className="px-4 py-3 font-mono text-xs text-black/70">{s.student_number}</td>
                          <td className="px-4 py-3 font-semibold">{fullNameLike(s)}</td>
                          <td className="px-4 py-3 text-black/70">{s.gender || "—"}</td>
                          <td className="px-4 py-3">
                            <select
                              disabled={!canWrite}
                              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:opacity-60"
                              value={isPicked ? pick.section_id : ""}
                              onFocus={() => setPick({ student: s, section_id: "" })}
                              onChange={(e) => setPick({ student: s, section_id: e.target.value })}
                            >
                              <option value="">—</option>
                              {(isPicked ? eligibleSections : []).map((sec) => (
                                <option key={sec.section_id} value={sec.section_id} disabled={(sec._count?.total ?? 0) >= MAX_CAPACITY}>
                                  {sec.section_name} — {sec._count?.total ?? 0}/{MAX_CAPACITY}
                                </option>
                              ))}
                            </select>
                            {isPicked && eligibleSections.length === 0 ? (
                              <div className="mt-1 text-[11px] text-rose-700">No eligible sections for this student.</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              {canWrite ? (
                                <button
                                  disabled={!isPicked || !pick.section_id || assigning}
                                  onClick={() => onAssign(s, pick.section_id)}
                                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                                  type="button"
                                >
                                  <UserCheck className="h-4 w-4" />
                                  Assign
                                </button>
                              ) : (
                                <span className="text-xs text-black/45">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                          No unclassified students found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AutoAssignReportModal({ sy, data, onClose }) {
  const [q, setQ] = useState("");
  const rows = data?.assignments ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const name = `${r.last_name || ""}, ${r.first_name || ""} ${r.extension || ""} ${r.middle_initial || ""}`;
      const hay = `${r.section_name} ${r.student_number} ${name} ${r.gender || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = r.section_name || "—";
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [filtered]);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className={`w-full max-w-5xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">Auto-Assign Results</div>
              <div className={`text-xs ${UI.muted}`}>
                {sy?.sy_code ? `SY ${sy.sy_code}` : "Active SY"} · Assigned {data?.assigned ?? 0} · Skipped {data?.skipped ?? 0}
              </div>
            </div>

            <button onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[78vh] overflow-auto">
            <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-extrabold">Assigned students by section</div>
                  <div className={`text-xs ${UI.muted}`}>Showing {filtered.length} assignment records</div>
                </div>

                <div className="w-full md:w-[360px]">
                  <Field label="Search">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search section, student #, name…"
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {grouped.length === 0 ? (
              <div className={`rounded-2xl border ${UI.border} bg-white p-6 text-sm ${UI.muted}`}>No assignments to display.</div>
            ) : (
              <div className="space-y-3">
                {grouped.map(([sectionName, list]) => (
                  <div key={sectionName} className={`overflow-hidden rounded-2xl border ${UI.border} bg-white`}>
                    <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                      <div className="font-extrabold">{sectionName}</div>
                      <div className="text-xs text-black/60">{list.length} students</div>
                    </div>

                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/[0.02] text-xs text-black/60">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Student #</th>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Gender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={`${r.student_id}-${r.section_id}`} className="border-t border-black/10 hover:bg-black/[0.01]">
                            <td className="px-4 py-3 font-mono text-xs text-black/70">{r.student_number}</td>
                            <td className="px-4 py-3 font-semibold">
                              {`${r.last_name || ""}, ${r.first_name || ""}`.trim() || "—"}
                              {r.extension?.trim() ? ` ${r.extension.trim()}` : ""}
                              {r.middle_initial?.trim() ? ` ${r.middle_initial.trim()}.` : ""}
                            </td>
                            <td className="px-4 py-3 text-black/70">{r.gender || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= Small Components (Enrollment-style) ================= */

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-black">{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-extrabold text-[#6B4E2E]">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Input({ label, error, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
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
      <span className="text-xs font-semibold text-black/55">{label}</span>
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

function IconBtn({ title, onClick, tone, disabled, children }) {
  const cls =
    tone === "neutral"
      ? "bg-black/5 text-black/70 hover:bg-black/10"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls} disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function StatusPill({ value }) {
  const v = norm(value);
  const cls =
    v === "pending"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : v === "approved"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : v === "enrolled"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "rejected"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}
