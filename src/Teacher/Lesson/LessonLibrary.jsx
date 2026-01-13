import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Only using components you said you have
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Optional icons (remove if you don't have lucide-react)
import {
  Plus,
  Search,
  Copy,
  ArchiveRestore,
  Archive,
  Trash2,
  Pencil,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

/**
 * Lesson Library List Page (Enhanced)
 * - Template library list for teachers
 * - Draft | Published (ready to assign) | Archived
 * - Enhancements:
 *   ✓ Bulk select + bulk actions
 *   ✓ Pagination
 *   ✓ Sort (Updated / Created / Title)
 *   ✓ Subject filter
 *   ✓ Quick stats + status counters
 *   ✓ Debounced search
 *
 * Builder route: /Teacher/Lesson/TeacherLessons
 * Assign route: /Teacher/Lesson/AssignLesson (change ASSIGN_ROUTE if different)
 */

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

const TABS = ["All", "Draft", "Published", "Archived"];

// Change this to your actual assignment flow route
const ASSIGN_ROUTE = "/Teacher/Lesson/AssignLesson";

const SORTS = [
  { id: "updated_desc", label: "Last updated (newest)", col: "updated_at", asc: false },
  { id: "updated_asc", label: "Last updated (oldest)", col: "updated_at", asc: true },
  { id: "created_desc", label: "Created (newest)", col: "created_at", asc: false },
  { id: "created_asc", label: "Created (oldest)", col: "created_at", asc: true },
  { id: "title_asc", label: "Title (A–Z)", col: "title", asc: true },
  { id: "title_desc", label: "Title (Z–A)", col: "title", asc: false },
];

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }) {
  const s = norm(status);
  const cls =
    s === "published"
      ? "bg-[#C9A227]/15 text-[#6B4E2E] border-[#C9A227]/30"
      : s === "draft"
      ? "bg-black/[0.03] text-black/70 border-black/10"
      : s === "archived"
      ? "bg-rose-500/10 text-rose-700 border-rose-200"
      : "bg-black/[0.03] text-black/70 border-black/10";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {status || "Draft"}
    </span>
  );
}

/* ===================== Toast (Enrollment.jsx style) ===================== */

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-2">
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
              {t.message ? (
                <div className="mt-1 text-xs font-semibold text-black/60">{t.message}</div>
              ) : null}

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
              <span className="text-black/50">×</span>
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
    const id = globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());
    const item = { id, tone: "info", ...toast };
    setToasts((p) => [item, ...p]);

    if (!item.actions?.length) {
      setTimeout(() => {
        setToasts((p) => p.filter((x) => x.id !== id));
      }, 3200);
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

/* ===================== Small hooks ===================== */

function useDebouncedValue(value, delayMs) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

/* ===================== Page ===================== */

export default function LessonLibrary() {
  const toast = useToasts();

  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 250);

  const [fGrade, setFGrade] = useState("All");
  const [fTrack, setFTrack] = useState("All");
  const [fSubject, setFSubject] = useState("All");

  const [sortId, setSortId] = useState("updated_desc");

  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [tracks, setTracks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Bulk selection
  const [selected, setSelected] = useState({}); // { [lesson_id]: true }

  const trackMap = useMemo(() => {
    const m = new Map();
    tracks.forEach((t) => m.set(String(t.track_id), t.track_code));
    return m;
  }, [tracks]);

  const gradeMap = useMemo(() => {
    const m = new Map();
    grades.forEach((g) => m.set(String(g.grade_id), String(g.grade_level)));
    return m;
  }, [grades]);

  const subjectMap = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(String(s.subject_id), s.subject_title));
    return m;
  }, [subjects]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authData?.user?.id;
      if (!uid) throw new Error("Not authenticated.");

      const [tRes, gRes, sRes] = await Promise.all([
        supabase.from("tracks").select("track_id, track_code").order("track_code"),
        supabase.from("grade_levels").select("grade_id, grade_level").order("grade_level"),
        supabase
          .from("subjects")
          .select("subject_id, subject_title, is_archived")
          .eq("is_archived", false)
          .order("subject_title"),
      ]);

      if (tRes.error) throw tRes.error;
      if (gRes.error) throw gRes.error;
      if (sRes.error) throw sRes.error;

      setTracks(tRes.data ?? []);
      setGrades(gRes.data ?? []);
      setSubjects(sRes.data ?? []);

      // Load teacher's templates
      const lRes = await supabase
        .from("lessons")
        .select(
          "lesson_id, owner_teacher_id, title, grade_id, track_id, strand_id, subject_id, duration_minutes, audience, status, created_at, updated_at"
        )
        .eq("owner_teacher_id", uid)
        .order("updated_at", { ascending: false });

      if (lRes.error) throw lRes.error;
      setLessons(lRes.data ?? []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Clear selection on tab/scope changes
  useEffect(() => {
    setSelected({});
    setPage(1);
  }, [tab, fGrade, fTrack, fSubject, sortId, qDebounced]);

  const statusCounts = useMemo(() => {
    const c = { All: lessons.length, Draft: 0, Published: 0, Archived: 0 };
    lessons.forEach((l) => {
      const s = l.status || "Draft";
      if (c[s] != null) c[s] += 1;
    });
    return c;
  }, [lessons]);

  const filtered = useMemo(() => {
    const needle = qDebounced.trim().toLowerCase();

    const base = (lessons ?? [])
      .filter((r) => (tab === "All" ? true : String(r.status || "Draft") === tab))
      .filter((r) => (fGrade === "All" ? true : String(r.grade_id || "") === String(fGrade)))
      .filter((r) => (fTrack === "All" ? true : String(r.track_id || "") === String(fTrack)))
      .filter((r) => (fSubject === "All" ? true : String(r.subject_id || "") === String(fSubject)))
      .filter((r) => {
        if (!needle) return true;
        const hay = `${r.title || ""} ${subjectMap.get(String(r.subject_id || "")) || ""} ${
          trackMap.get(String(r.track_id || "")) || ""
        } ${gradeMap.get(String(r.grade_id || "")) || ""}`
          .toLowerCase()
          .trim();
        return hay.includes(needle);
      });

    const sort = SORTS.find((x) => x.id === sortId) || SORTS[0];
    const sorted = [...base].sort((a, b) => {
      const av = a[sort.col] ?? "";
      const bv = b[sort.col] ?? "";

      // dates
      if (sort.col === "updated_at" || sort.col === "created_at") {
        const at = av ? new Date(av).getTime() : 0;
        const bt = bv ? new Date(bv).getTime() : 0;
        return sort.asc ? at - bt : bt - at;
      }

      // strings
      const as = String(av || "").toLowerCase();
      const bs = String(bv || "").toLowerCase();
      if (as < bs) return sort.asc ? -1 : 1;
      if (as > bs) return sort.asc ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [lessons, tab, qDebounced, fGrade, fTrack, fSubject, sortId, subjectMap, trackMap, gradeMap]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / pageSize));
  }, [filtered.length, pageSize]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  function openBuilder(lessonId) {
    const base = "/Teacher/Lesson/TeacherLessons";
    window.location.href = lessonId ? `${base}?lessonId=${lessonId}` : base;
  }

  function openAssign(lessonId) {
    // Jumps to your assignment flow, passing the template lesson_id
    // Your Assign page should create a snapshot instance from this template.
    window.location.href = `${ASSIGN_ROUTE}?lesson_id=${lessonId}`;
  }

  function quickCreate() {
    openBuilder(null);
  }

  function toggleSelectOne(id) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  }

  function toggleSelectAllOnPage(items) {
    const allSelected = items.length > 0 && items.every((x) => selected[String(x.lesson_id)]);
    if (allSelected) {
      // unselect all on page
      setSelected((p) => {
        const next = { ...p };
        items.forEach((x) => delete next[String(x.lesson_id)]);
        return next;
      });
      return;
    }

    // select all on page
    setSelected((p) => {
      const next = { ...p };
      items.forEach((x) => {
        next[String(x.lesson_id)] = true;
      });
      return next;
    });
  }

  async function setStatus(row, nextStatus) {
    setBusyId(row.lesson_id);
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("lesson_id", row.lesson_id);
      if (error) throw error;

      toast.push({ tone: "success", title: "Updated", message: `Lesson is now ${nextStatus}.` });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", title: "Update failed", message: String(e?.message || e) });
    } finally {
      setBusyId(null);
    }
  }

  async function bulkSetStatus(nextStatus) {
    if (!selectedIds.length) return;

    const ok = await toast.confirm({
      title: `Update ${selectedIds.length} lesson(s)?`,
      message: `Set status to “${nextStatus}”.`,
      confirmText: "Update",
      cancelText: "Cancel",
      tone: "info",
    });

    if (!ok) return;

    setBusyId("__bulk__");
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .in("lesson_id", selectedIds);
      if (error) throw error;

      toast.push({ tone: "success", title: "Updated", message: `Updated ${selectedIds.length} lesson(s).` });
      setSelected({});
      await load();
    } catch (e) {
      toast.push({ tone: "danger", title: "Bulk update failed", message: String(e?.message || e) });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLesson(row) {
    const ok = await toast.confirm({
      title: "Delete lesson permanently?",
      message: "This will remove the lesson template and all its parts/activities.",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    setBusyId(row.lesson_id);
    try {
      const { error } = await supabase.from("lessons").delete().eq("lesson_id", row.lesson_id);
      if (error) throw error;

      toast.push({ tone: "success", title: "Deleted", message: "Lesson removed." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", title: "Delete failed", message: String(e?.message || e) });
    } finally {
      setBusyId(null);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    const ok = await toast.confirm({
      title: `Delete ${selectedIds.length} lesson(s)?`,
      message: "This is permanent and will remove parts/activities.",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    setBusyId("__bulk__");
    try {
      const { error } = await supabase.from("lessons").delete().in("lesson_id", selectedIds);
      if (error) throw error;
      toast.push({ tone: "success", title: "Deleted", message: `Deleted ${selectedIds.length} lesson(s).` });
      setSelected({});
      await load();
    } catch (e) {
      toast.push({ tone: "danger", title: "Bulk delete failed", message: String(e?.message || e) });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateLesson(row) {
    const ok = await toast.confirm({
      title: "Duplicate lesson?",
      message: "This will create a copy as Draft (including parts + activities).",
      confirmText: "Duplicate",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;

    setBusyId(row.lesson_id);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authData?.user?.id;
      if (!uid) throw new Error("Not authenticated.");

      const newLessonId = globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());

      // 1) Copy header
      const headerPayload = {
        lesson_id: newLessonId,
        owner_teacher_id: uid,
        title: `${row.title || "Untitled Lesson"} (Copy)`,
        grade_id: row.grade_id,
        track_id: row.track_id,
        strand_id: row.strand_id,
        subject_id: row.subject_id,
        duration_minutes: row.duration_minutes ?? 45,
        audience: row.audience ?? "Whole Class",
        status: "Draft",
      };

      const insHeader = await supabase.from("lessons").insert(headerPayload);
      if (insHeader.error) throw insHeader.error;

      // 2) Load parts
      const pRes = await supabase
        .from("lesson_parts")
        .select("part_id, lesson_id, sort_order, part_type, title, body, is_collapsed")
        .eq("lesson_id", row.lesson_id)
        .order("sort_order", { ascending: true });
      if (pRes.error) throw pRes.error;

      const oldParts = pRes.data ?? [];
      const partIdMap = new Map(); // oldPartId -> newPartId

      const newPartsRows = oldParts.map((p) => {
        const newPartId = globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());
        partIdMap.set(p.part_id, newPartId);
        return {
          part_id: newPartId,
          lesson_id: newLessonId,
          sort_order: p.sort_order,
          part_type: p.part_type,
          title: p.title,
          body: p.body,
          is_collapsed: p.is_collapsed,
        };
      });

      if (newPartsRows.length) {
        const insParts = await supabase.from("lesson_parts").insert(newPartsRows);
        if (insParts.error) throw insParts.error;
      }

      // 3) Load activities (by old part ids)
      const oldPartIds = oldParts.map((x) => x.part_id);
      const aRes = oldPartIds.length
        ? await supabase
            .from("lesson_activities")
            .select(
              "activity_id, part_id, sort_order, activity_type, title, instructions, estimated_minutes, attachable"
            )
            .in("part_id", oldPartIds)
            .order("sort_order", { ascending: true })
        : { data: [], error: null };
      if (aRes?.error) throw aRes.error;

      const newActsRows = (aRes.data ?? []).map((a) => ({
        activity_id: globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()),
        part_id: partIdMap.get(a.part_id),
        sort_order: a.sort_order,
        activity_type: a.activity_type,
        title: a.title,
        instructions: a.instructions,
        estimated_minutes: a.estimated_minutes,
        attachable: a.attachable,
      }));

      if (newActsRows.length) {
        const insActs = await supabase.from("lesson_activities").insert(newActsRows);
        if (insActs.error) throw insActs.error;
      }

      toast.push({ tone: "success", title: "Duplicated", message: "Copy created as Draft." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", title: "Duplicate failed", message: String(e?.message || e) });
    } finally {
      setBusyId(null);
    }
  }

  const isBulkBusy = busyId === "__bulk__";

  const allOnPageSelected =
    pageItems.length > 0 && pageItems.every((x) => selected[String(x.lesson_id)]);

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Lesson Library</div>
          <div className={`text-sm ${UI.muted}`}>
            Templates you own. <b>Published</b> means “ready to assign” (teacher-only).
          </div>
        </div>

        <button
          onClick={quickCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
          type="button"
          disabled={loading}
        >
          <Plus className="h-4 w-4" />
          Create Lesson
        </button>
      </div>

      {/* Status counters */}
      <div className={`grid gap-3 md:grid-cols-4`}>
        <StatCard title="All" value={statusCounts.All} />
        <StatCard title="Draft" value={statusCounts.Draft} />
        <StatCard title="Published" value={statusCounts.Published} />
        <StatCard title="Archived" value={statusCounts.Archived} />
      </div>

      {/* Tabs */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-2xl">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="rounded-2xl">
                {t}
                <span className="ml-2 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-extrabold text-black/55">
                  {statusCounts[t] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Filters + Sort */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Search title / subject / track">
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

          <Field label="Subject">
            <select
              value={fSubject}
              onChange={(e) => setFSubject(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="All">All</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Track">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="All">All</option>
              {tracks.map((t) => (
                <option key={t.track_id} value={t.track_id}>
                  {t.track_code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grade">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="All">All</option>
              {grades.map((g) => (
                <option key={g.grade_id} value={g.grade_id}>
                  Grade {g.grade_level}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sort">
            <div className="mt-1 flex gap-2">
              <select
                value={sortId}
                onChange={(e) => setSortId(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Toggle sort quick"
                className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/[0.02]"
                onClick={() => {
                  const s = SORTS.find((x) => x.id === sortId) || SORTS[0];
                  if (s.col === "title") {
                    setSortId(s.asc ? "title_desc" : "title_asc");
                  } else if (s.col === "created_at") {
                    setSortId(s.asc ? "created_desc" : "created_asc");
                  } else {
                    setSortId(s.asc ? "updated_desc" : "updated_asc");
                  }
                }}
              >
                <ArrowUpDown className="h-4 w-4 text-black/55" />
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className={`text-xs ${UI.muted}`}>
            {qDebounced ? (
              <span>
                Searching for <b>{qDebounced}</b>
              </span>
            ) : (
              <span>—</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setQ("");
              setFGrade("All");
              setFTrack("All");
              setFSubject("All");
              setSortId("updated_desc");
              setPage(1);
              setSelected({});
            }}
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.length ? (
        <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-extrabold">
              {selectedIds.length} selected
              <span className={`ml-2 text-xs ${UI.muted}`}>(page {page} of {totalPages})</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBulkBusy}
                onClick={() => bulkSetStatus("Draft")}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold border border-black/10 bg-white hover:bg-black/[0.02] disabled:opacity-60`}
              >
                Set Draft
              </button>
              <button
                type="button"
                disabled={isBulkBusy}
                onClick={() => bulkSetStatus("Published")}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold bg-[#C9A227] text-black disabled:opacity-60`}
              >
                Publish
              </button>

              <button
                type="button"
                disabled={isBulkBusy}
                onClick={() => {
                  const notPublished = selectedIds.filter((id) => {
                    const row = lessons.find((l) => String(l.lesson_id) === String(id));
                    return String(row?.status || "Draft") !== "Published";
                  });

                  if (notPublished.length) {
                    toast.push({
                      tone: "danger",
                      title: "Assign blocked",
                      message: "Only Published lessons can be assigned. Publish selected lessons first.",
                    });
                    return;
                  }

                  // If multiple are selected, send them one-by-one to assignment flow.
                  // Most apps prefer assigning one lesson at a time, so we open the first.
                  openAssign(selectedIds[0]);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold border border-black/10 bg-white hover:bg-black/[0.02] disabled:opacity-60`}
                title="Ready to assign (opens assignment flow)"
              >
                Ready to assign
              </button>
              <button
                type="button"
                disabled={isBulkBusy}
                onClick={() => bulkSetStatus("Archived")}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold border border-black/10 bg-white hover:bg-black/[0.02] disabled:opacity-60`}
              >
                Archive
              </button>
              <button
                type="button"
                disabled={isBulkBusy}
                onClick={bulkDelete}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold bg-rose-600 text-white disabled:opacity-60`}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelected({})}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold border border-black/10 bg-white hover:bg-black/[0.02]`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">Lessons</div>
          <div className={`text-xs ${UI.muted}`}>
            Showing {pageItems.length} of {filtered.length}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : err ? (
          <div className="p-6 text-sm text-rose-700">
            Error: {err}
            <div className="mt-3">
              <Button variant="outline" className="rounded-2xl" onClick={load}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold w-[44px]">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={() => toggleSelectAllOnPage(pageItems)}
                    className="h-4 w-4"
                    title="Select all on this page"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Track</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {pageItems.map((r) => {
                const isBusy = busyId === r.lesson_id || isBulkBusy;
                const status = r.status || "Draft";
                const sid = String(r.lesson_id);

                return (
                  <tr key={r.lesson_id} className="border-t border-black/10 hover:bg-black/[0.01]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={Boolean(selected[sid])}
                        onChange={() => toggleSelectOne(sid)}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-extrabold">{r.title || "Untitled Lesson"}</div>
                      <div className="mt-1 text-xs text-black/55">
                        {r.duration_minutes ? `${r.duration_minutes} min` : "—"}
                        {r.audience ? ` • ${r.audience}` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-black/70">
                      {subjectMap.get(String(r.subject_id || "")) || "—"}
                    </td>

                    <td className="px-4 py-3 text-black/70">{gradeMap.get(String(r.grade_id || "")) || "—"}</td>

                    <td className="px-4 py-3 text-black/70">{trackMap.get(String(r.track_id || "")) || "—"}</td>

                    <td className="px-4 py-3 text-black/70">{fmtDate(r.updated_at)}</td>

                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconBtn title="Open / Edit" onClick={() => openBuilder(r.lesson_id)} tone="gold" disabled={isBusy}>
                          <Pencil className="h-5 w-5" />
                        </IconBtn>

                        <IconBtn title="Duplicate" onClick={() => duplicateLesson(r)} tone="gold" disabled={isBusy}>
                          <Copy className="h-5 w-5" />
                        </IconBtn>

                        {status !== "Published" && status !== "Archived" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setStatus(r, "Published")}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${
                              isBusy ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black"
                            }`}
                            title="Mark as ready to assign"
                          >
                            <Upload className="h-4 w-4" /> Publish
                          </button>
                        ) : null}

                        {status === "Published" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openAssign(r.lesson_id)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold border border-black/10 bg-white hover:bg-black/[0.02] disabled:opacity-60`}
                            title="Ready to assign (opens assignment flow)"
                          >
                            Ready to assign
                          </button>
                        ) : null}

                        {status === "Archived" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setStatus(r, "Draft")}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${
                              isBusy ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black"
                            }`}
                            title="Restore to Draft"
                          >
                            <ArchiveRestore className="h-4 w-4" /> Restore
                          </button>
                        ) : (
                          <IconBtn
                            title="Archive"
                            onClick={async () => {
                              const ok = await toast.confirm({
                                title: "Archive lesson?",
                                message: "This hides it from active lists. You can restore later.",
                                confirmText: "Archive",
                                cancelText: "Cancel",
                                tone: "info",
                              });
                              if (!ok) return;
                              setStatus(r, "Archived");
                            }}
                            tone="danger"
                            disabled={isBusy}
                          >
                            <Archive className="h-5 w-5" />
                          </IconBtn>
                        )}

                        <IconBtn title="Delete" onClick={() => deleteLesson(r)} tone="danger" disabled={isBusy}>
                          <Trash2 className="h-5 w-5" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                    No lessons found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !err ? (
        <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`text-xs ${UI.muted}`}>
              Page <b>{page}</b> of <b>{totalPages}</b>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-black/55">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value || 10));
                    setPage(1);
                  }}
                  className="ml-2 rounded-xl border border-black/10 bg-white px-2 py-1 text-xs outline-none"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4 text-sm ${UI.muted}`}>
        <b>Note:</b> This page manages <b>library templates</b>. Student visibility is controlled by <b>lesson instances</b>
        after assignment.
      </div>
    </div>
  );
}

/* ================= Small Components ================= */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value }) {
  return (
    <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
      <div className="text-xs font-semibold text-black/55">{title}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function IconBtn({ title, onClick, tone, disabled, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
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
