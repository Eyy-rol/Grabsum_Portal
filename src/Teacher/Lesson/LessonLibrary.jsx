// Teacher/Lesson/LessonLibrary.jsx
//
// Lesson Library (Teacher)
// - Shows ALL / Draft / Published / Archived lessons owned by the logged-in teacher
// - Search by title
// - Filters: Subject, Track, Grade
// - Sort: Updated (newest), Updated (oldest), Created (newest), Title (A-Z)
// - Actions:
//   - Edit (goes to /teacher/lesson/edit/:lessonId)
//   - Duplicate (copies lesson + lesson_parts => new Draft)
//   - Publish (Draft -> Published) ✅
//   - Archive / Unarchive
//   - Assign (Published only) -> navigates to /teacher/assign-lesson?lessonId=...
//   - Assignments -> navigates to /teacher/lesson-assignments ✅
//
// Notes:
// - Uses your existing LessonSampler.jsx for editing lesson parts
// - Keeps assignment logic inside AssignLesson.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import {
  Search,
  Plus,
  Pencil,
  Copy,
  UploadCloud,
  Archive,
  RotateCcw,
  BookOpen,
  Filter,
  ArrowUpDown,
} from "lucide-react";

const UI = {
  pageBg: "bg-white",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  border: "border-black/10",
  goldBg: "bg-[#C9A227]",
};

const TABS = ["All", "Draft", "Published", "Archived"];

const SORTS = [
  { value: "updated_desc", label: "Updated (newest)" },
  { value: "updated_asc", label: "Updated (oldest)" },
  { value: "created_desc", label: "Created (newest)" },
  { value: "title_asc", label: "Title (A–Z)" },
];

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function LessonLibrary() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  // Lookup filters
  const [gradeOptions, setGradeOptions] = useState([]);
  const [trackOptions, setTrackOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);

  // Filters / controls
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [filterGradeId, setFilterGradeId] = useState("");
  const [filterTrackId, setFilterTrackId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");

  // Data
  const [lessons, setLessons] = useState([]);

  /* =========================
     Initial Loads
  ========================= */

  useEffect(() => {
    fetchLookups();
    fetchLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLookups() {
    try {
      const [{ data: grades }, { data: tracks }, { data: subjects }] =
        await Promise.all([
          supabase
            .from("grade_levels")
            .select("grade_id, grade_level, description")
            .order("grade_level", { ascending: true }),
          supabase
            .from("tracks")
            .select("track_id, track_code, description")
            .order("track_code", { ascending: true }),
          supabase
            .from("subjects")
            .select(
              "subject_id, subject_title, subject_code, subject_type, grade_id, strand_id, is_archived"
            )
            .eq("is_archived", false)
            .order("subject_title", { ascending: true }),
        ]);

      setGradeOptions(grades || []);
      setTrackOptions(tracks || []);
      setSubjectOptions(subjects || []);
    } catch (e) {
      console.error("fetchLookups error:", e);
    }
  }

  async function fetchLessons() {
    setLoading(true);
    try {
      // RLS already limits to owner via your policies
      const { data, error } = await supabase
        .from("lessons")
        .select(
          `
          lesson_id,
          title,
          grade_id,
          track_id,
          strand_id,
          subject_id,
          duration_minutes,
          audience,
          status,
          created_at,
          updated_at,
          objectives,
          grade_levels:grade_id (grade_level, description),
          tracks:track_id (track_code, description),
          strands:strand_id (strand_code, description),
          subjects:subject_id (subject_title, subject_code, subject_type)
        `
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setLessons(data || []);
    } catch (e) {
      console.error("fetchLessons error:", e);
      alert(`Failed to load lessons: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Actions
  ========================= */

  function goCreateNew() {
    navigate("/teacher/lesson/edit/new");
  }

  function goEdit(lessonId) {
    if (!isUuid(lessonId)) return;
    navigate(`/teacher/lesson/edit/${lessonId}`);
  }

  function goAssign(lessonId) {
    if (!isUuid(lessonId)) return;
    // assignment workflow lives in AssignLesson.jsx
    navigate(`/teacher/assign-lesson?lessonId=${lessonId}`);
  }

  function goAssignments() {
    navigate("/teacher/lesson-assignments");
  }

  async function publishLesson(lesson) {
    if (!lesson?.lesson_id) return;

    const ok = window.confirm(
      `Publish "${lesson.title}"?\n\nOnce published, you can assign it to a section.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("lessons")
        .update({ status: "Published" })
        .eq("lesson_id", lesson.lesson_id);

      if (error) throw error;

      await fetchLessons();
    } catch (e) {
      console.error("publishLesson error:", e);
      alert(`Publish failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function archiveLesson(lesson) {
    if (!lesson?.lesson_id) return;

    const ok = window.confirm(
      `Archive "${lesson.title}"?\n\nYou can unarchive it later.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("lessons")
        .update({ status: "Archived" })
        .eq("lesson_id", lesson.lesson_id);

      if (error) throw error;

      await fetchLessons();
    } catch (e) {
      console.error("archiveLesson error:", e);
      alert(`Archive failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function unarchiveLesson(lesson) {
    if (!lesson?.lesson_id) return;

    const ok = window.confirm(
      `Unarchive "${lesson.title}"?\n\nIt will become Draft again.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("lessons")
        .update({ status: "Draft" })
        .eq("lesson_id", lesson.lesson_id);

      if (error) throw error;

      await fetchLessons();
    } catch (e) {
      console.error("unarchiveLesson error:", e);
      alert(`Unarchive failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function duplicateLesson(lesson) {
    if (!lesson?.lesson_id) return;

    const ok = window.confirm(
      `Duplicate "${lesson.title}"?\n\nA new Draft copy will be created (including parts).`
    );
    if (!ok) return;

    try {
      setLoading(true);

      // 1) fetch the full lesson row (source of truth)
      const { data: sourceLesson, error: lErr } = await supabase
        .from("lessons")
        .select(
          "lesson_id, title, grade_id, track_id, strand_id, subject_id, duration_minutes, audience, objectives"
        )
        .eq("lesson_id", lesson.lesson_id)
        .single();

      if (lErr) throw lErr;

      // 2) fetch parts
      const { data: sourceParts, error: pErr } = await supabase
        .from("lesson_parts")
        .select("sort_order, part_type, title, body, is_collapsed")
        .eq("lesson_id", lesson.lesson_id)
        .order("sort_order", { ascending: true });

      if (pErr) throw pErr;

      // 3) insert new lesson as Draft
      const { data: inserted, error: insErr } = await supabase
        .from("lessons")
        .insert({
          title: `${String(sourceLesson.title || "").slice(0, 180)} (Copy)`,
          grade_id: sourceLesson.grade_id,
          track_id: sourceLesson.track_id,
          strand_id: sourceLesson.strand_id,
          subject_id: sourceLesson.subject_id,
          duration_minutes: sourceLesson.duration_minutes ?? 45,
          audience: sourceLesson.audience ?? "Whole Class",
          status: "Draft",
          objectives: Array.isArray(sourceLesson.objectives)
            ? sourceLesson.objectives
            : [],
          // IMPORTANT: owner_teacher_id will be enforced by RLS as auth.uid()
        })
        .select("lesson_id")
        .single();

      if (insErr) throw insErr;

      const newLessonId = inserted.lesson_id;

      // 4) insert copied parts
      const partsToInsert =
        (sourceParts || []).map((p) => ({
          lesson_id: newLessonId,
          sort_order: p.sort_order,
          part_type: p.part_type,
          title: (
            String(p.title || p.part_type || "").trim() || p.part_type
          ).slice(0, 200),
          body: String(p.body || ""),
          is_collapsed: Boolean(p.is_collapsed),
        })) || [];

      if (partsToInsert.length) {
        const { error: cpErr } = await supabase
          .from("lesson_parts")
          .insert(partsToInsert);
        if (cpErr) throw cpErr;
      }

      await fetchLessons();

      const goEditNow = window.confirm(
        "Duplicated successfully.\n\nOpen the copied draft in the editor now?"
      );
      if (goEditNow) goEdit(newLessonId);
    } catch (e) {
      console.error("duplicateLesson error:", e);
      alert(`Duplicate failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Derived: Filtering + Sorting
  ========================= */

  const filteredLessons = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = [...(lessons || [])];

    // tab status
    if (tab !== "All") {
      list = list.filter((l) => String(l.status || "") === tab);
    }

    // filters
    if (filterGradeId) list = list.filter((l) => l.grade_id === filterGradeId);
    if (filterTrackId) list = list.filter((l) => l.track_id === filterTrackId);
    if (filterSubjectId)
      list = list.filter((l) => l.subject_id === filterSubjectId);

    // search (title only, simple + fast)
    if (needle) {
      list = list.filter((l) =>
        String(l.title || "").toLowerCase().includes(needle)
      );
    }

    // sort
    const byUpdated = (a, b) =>
      new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    const byCreated = (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const byTitle = (a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), undefined, {
        sensitivity: "base",
      });

    if (sortBy === "updated_desc") list.sort((a, b) => byUpdated(b, a));
    if (sortBy === "updated_asc") list.sort((a, b) => byUpdated(a, b));
    if (sortBy === "created_desc") list.sort((a, b) => byCreated(b, a));
    if (sortBy === "title_asc") list.sort((a, b) => byTitle(a, b));

    return list;
  }, [lessons, tab, q, filterGradeId, filterTrackId, filterSubjectId, sortBy]);

  /* =========================
     Render
  ========================= */

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-lg font-extrabold">Lesson Library</div>
            <span className="rounded-full border border-black/10 bg-black/[0.02] px-2.5 py-1 text-[11px] font-extrabold text-black/70">
              {loading ? "Loading…" : `${filteredLessons.length} shown`}
            </span>
          </div>
          <div className={`text-sm ${UI.muted}`}>
            Manage your drafted, published, and archived lessons. Publish drafts
            here, then assign published lessons to sections.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchLessons()}
            type="button"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
            title="Refresh"
          >
            <ArrowUpDown className="h-4 w-4" />
            Refresh
          </button>

          {/* ✅ NEW: Go to Lesson Assignments table */}
          <button
            onClick={goAssignments}
            type="button"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
            title="View assigned lessons"
          >
            <BookOpen className="h-4 w-4" />
            Assignments
          </button>

          <button
            onClick={goCreateNew}
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
            title="Create new lesson"
          >
            <Plus className="h-4 w-4" />
            New Lesson
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className={`rounded-2xl border ${UI.border} bg-white p-4 space-y-3`}>
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${
                tab === t
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/[0.02]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="block">
              <span className="text-xs font-semibold text-black/55">
                Search
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-black/45" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search lesson title..."
                  className="w-full text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <div className="md:col-span-2">
            <Select
              label="Grade"
              value={filterGradeId}
              onChange={setFilterGradeId}
              placeholder="All"
              options={gradeOptions.map((g) => ({
                value: g.grade_id,
                label: `Grade ${g.grade_level}${
                  g.description ? ` • ${g.description}` : ""
                }`,
              }))}
            />
          </div>

          <div className="md:col-span-2">
            <Select
              label="Track"
              value={filterTrackId}
              onChange={setFilterTrackId}
              placeholder="All"
              options={trackOptions.map((t) => ({
                value: t.track_id,
                label: `${t.track_code}${
                  t.description ? ` • ${t.description}` : ""
                }`,
              }))}
            />
          </div>

          <div className="md:col-span-3">
            <Select
              label="Subject"
              value={filterSubjectId}
              onChange={setFilterSubjectId}
              placeholder="All"
              options={subjectOptions.map((s) => ({
                value: s.subject_id,
                label: `${s.subject_title} (${
                  String(s.subject_type || "").trim() || "—"
                })`,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Select
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={SORTS}
            />
          </div>

          <div className="md:col-span-8 flex items-end justify-end">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFilterGradeId("");
                setFilterTrackId("");
                setFilterSubjectId("");
                setSortBy("updated_desc");
                setTab("All");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              title="Clear filters"
            >
              <Filter className="h-4 w-4" />
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {filteredLessons.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/60">
          No lessons found.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredLessons.map((l) => (
            <LessonCard
              key={l.lesson_id}
              lesson={l}
              loading={loading}
              onEdit={() => goEdit(l.lesson_id)}
              onDuplicate={() => duplicateLesson(l)}
              onPublish={() => publishLesson(l)}
              onArchive={() => archiveLesson(l)}
              onUnarchive={() => unarchiveLesson(l)}
              onAssign={() => goAssign(l.lesson_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Small components ===================== */

function Select({ label, value, onChange, options, placeholder = "Select..." }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      >
        <option value="">{placeholder}</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LessonCard({
  lesson,
  loading,
  onEdit,
  onDuplicate,
  onPublish,
  onArchive,
  onUnarchive,
  onAssign,
}) {
  const status = String(lesson.status || "Draft");
  const meta = [];

  const gradeLevel = lesson?.grade_levels?.grade_level;
  const subjectTitle = lesson?.subjects?.subject_title;
  const trackCode = lesson?.tracks?.track_code;
  const strandCode = lesson?.strands?.strand_code;

  if (gradeLevel) meta.push(`Grade ${gradeLevel}`);
  if (subjectTitle) meta.push(subjectTitle);
  if (trackCode) meta.push(`Track: ${trackCode}`);
  if (strandCode) meta.push(`Strand: ${strandCode}`);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-extrabold text-[#1F1A14] line-clamp-2">
              {lesson.title}
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                status === "Published"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : status === "Archived"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-black/10 bg-black/[0.02] text-black/70"
              }`}
            >
              {status}
            </span>
          </div>

          {meta.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs font-semibold text-black/70"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-1 text-xs text-black/55">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Last updated:</span>
              <span className="font-bold text-black/70">
                {fmtDateTime(lesson.updated_at)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Created:</span>
              <span className="font-bold text-black/70">
                {fmtDateTime(lesson.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            onClick={onEdit}
            disabled={loading}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-60"
            title="Edit lesson"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>

          <button
            onClick={onDuplicate}
            disabled={loading}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-60"
            title="Duplicate lesson"
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>

          {/* ✅ Publish (Draft only) */}
          {status === "Draft" ? (
            <button
              onClick={onPublish}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-60"
              title="Publish lesson"
            >
              <UploadCloud className="h-4 w-4" />
              Publish
            </button>
          ) : null}

          {/* Assign (Published only) */}
          {status === "Published" ? (
            <button
              onClick={onAssign}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-60"
              title="Assign published lesson to a section"
            >
              <BookOpen className="h-4 w-4" />
              Assign
            </button>
          ) : null}

          {/* Archive / Unarchive */}
          {status !== "Archived" ? (
            <button
              onClick={onArchive}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-60"
              title="Archive lesson"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          ) : (
            <button
              onClick={onUnarchive}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-60"
              title="Unarchive lesson"
            >
              <RotateCcw className="h-4 w-4" />
              Unarchive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
