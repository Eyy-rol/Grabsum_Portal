// Lesson/LessonSampler.jsx
// DB-wired version (Draft Save + Publish) for React Router route: /lesson/edit/:lessonId
//
// Features:
// - Loads existing lesson + parts from Supabase when :lessonId is a UUID
// - If :lessonId === "new" (or missing), starts a new draft
// - Saves Draft: upserts into lessons + replaces lesson_parts with proper sort_order
// - Publish: same save pipeline but sets lessons.status = "Published"
// - Owner-teacher can edit Published lessons (no readOnly lock based on status)
// - Student Preview modal renders the whole lesson as Activity Cards (1 card per lesson part)
// - Reorder parts (Up/Down) persisted to DB via sort_order
//
// Tables used:
// - lessons (includes objectives text[] column you added)
// - lesson_parts
// - grade_levels, tracks, strands, subjects (for dropdowns)
//
// Edge Function: "lesson-part" (unchanged)

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Sparkles,
  X,
  Save,
  Wand2,
  RefreshCcw,
  Trash2,
  Eye,
  UploadCloud,
} from "lucide-react";

const EDGE_FN_NAME = "lesson-part";

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

const LESSON_PART_TYPES = [
  "Lesson Overview",
  "Discussion",
  "Warm-up",
  "Direct Instruction",
  "Guided Practice",
  "Independent Practice",
  "Assessment",
  "Homework",
  "Materials",
  "Notes",
];

const AI_LIMIT = 15;
const AI_STORAGE_KEY = "lesson_ai_uses_remaining_v1";

/* ===================== Toast ===================== */

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
              <div className="text-sm font-extrabold text-[#1F1A14]">
                {t.title}
              </div>
              {t.message ? (
                <div className="mt-1 text-xs font-semibold text-black/60">
                  {t.message}
                </div>
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

/* ===================== Helpers ===================== */

function uid() {
  return crypto.randomUUID?.() || String(Date.now() + Math.random());
}

function defaultPartTitle(type) {
  return type;
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

/* ===================== Student Preview (1 Card per Part) ===================== */

function PreviewModal({ open, onClose, lesson }) {
  if (!open) return null;

  const meta = [];
  if (lesson?.grade) meta.push(`Grade ${lesson.grade.grade_level}`);
  if (lesson?.subject) meta.push(lesson.subject.subject_title);
  if (lesson?.track) meta.push(`Track: ${lesson.track.track_code}`);
  if (lesson?.strand) meta.push(`Strand: ${lesson.strand.strand_code}`);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
        <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4 md:p-5">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-black/55">
                Student Preview
              </div>
              <div className="mt-1 line-clamp-2 text-lg font-extrabold text-[#1F1A14]">
                {lesson?.title?.trim() || "Untitled Lesson"}
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
            </div>

            <button
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-black/5"
              type="button"
              title="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[78vh] overflow-auto p-4 md:p-6">
            <div className="space-y-4">
              {/* Objectives */}
              <div className="rounded-2xl border border-black/10 bg-white p-4 md:p-5">
                <div className="text-sm font-extrabold text-[#6B4E2E]">
                  Today’s Targets
                </div>
                {lesson?.objectives?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/80">
                    {lesson.objectives.map((o, idx) => (
                      <li key={`${o}-${idx}`}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 text-sm text-black/55">—</div>
                )}
              </div>

              {/* Parts: one card per part */}
              {(lesson?.parts || []).length ? (
                <div className="space-y-3">
                  {lesson.parts.map((p, idx) => {
                    const partType = String(p.type || "").trim() || "Lesson Part";
                    const title =
                      String(p.title || "").trim() ||
                      partType ||
                      `Part ${idx + 1}`;
                    const content = String(p.content || "").trim();

                    return (
                      <ActivityCard
                        key={`${partType}-${idx}`}
                        badge={partType}
                        title={title}
                        content={content}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/60">
                  No lesson parts yet. Add a part, then click Preview again.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-black/10 p-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ActivityCard({ badge, title, content }) {
  const blocks = splitIntoBlocks(content);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 md:p-5 shadow-sm">
      <div className="min-w-0">
        <div className="text-base font-extrabold text-[#1F1A14]">{title}</div>
        {badge ? (
          <div className="mt-2 inline-flex rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-[11px] font-extrabold text-black/60">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 text-sm text-black/80">
        {blocks.length ? (
          blocks.map((b, i) =>
            b.kind === "list" ? (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="whitespace-pre-wrap leading-relaxed">
                {b.text}
              </p>
            )
          )
        ) : (
          <div className="text-sm text-black/55">—</div>
        )}
      </div>
    </div>
  );
}

/**
 * Splits content into readable blocks (paragraphs or lists).
 * - Blank lines separate blocks
 * - List-like blocks render as bullets
 */
function splitIntoBlocks(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const rawBlocks = text
    .split(/\n{2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);

  return rawBlocks.map((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const listLines = lines.filter((l) => /^(-|•|\d+\.|\*)\s+/.test(l));
    const looksLikeList =
      listLines.length >= Math.max(2, Math.ceil(lines.length * 0.6));

    if (looksLikeList) {
      const items = lines
        .map((l) => l.replace(/^(-|•|\d+\.|\*)\s+/, "").trim())
        .filter(Boolean);

      return { kind: "list", items };
    }

    return { kind: "text", text: block };
  });
}

/* ===================== Main Page ===================== */

export default function LessonSampler() {
  const toast = useToasts();
  const navigate = useNavigate();
  const params = useParams();
  const routeLessonId = params.lessonId; // "/lesson/edit/:lessonId"

  // Core fields
  const [lessonTitle, setLessonTitle] = useState("");
  const [objectiveInput, setObjectiveInput] = useState("");
  const [objectives, setObjectives] = useState([]);

  // DB-driven selectors
  const [gradeOptions, setGradeOptions] = useState([]);
  const [trackOptions, setTrackOptions] = useState([]);
  const [strandOptions, setStrandOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);

  const [gradeId, setGradeId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [strandId, setStrandId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  // Lesson identity / status
  const [lessonId, setLessonId] = useState(null); // UUID once created/loaded
  const [lessonStatus, setLessonStatus] = useState("Draft"); // Draft | Published | Archived
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [saving, setSaving] = useState(false);

  // Convenience selected objects
  const selectedGrade = useMemo(
    () => gradeOptions.find((g) => g.grade_id === gradeId) || null,
    [gradeOptions, gradeId]
  );
  const selectedTrack = useMemo(
    () => trackOptions.find((t) => t.track_id === trackId) || null,
    [trackOptions, trackId]
  );
  const selectedStrand = useMemo(
    () => strandOptions.find((s) => s.strand_id === strandId) || null,
    [strandOptions, strandId]
  );
  const selectedSubject = useMemo(
    () => subjectOptions.find((s) => s.subject_id === subjectId) || null,
    [subjectOptions, subjectId]
  );

  // Lesson parts
  const [parts, setParts] = useState([]); // { id, type, title, content, aiBusy }
  const [addPartType, setAddPartType] = useState(LESSON_PART_TYPES[0]);

  // AI usage (localStorage)
  const [aiRemaining, setAiRemaining] = useState(AI_LIMIT);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  /* ===================== Init AI remaining ===================== */

  useEffect(() => {
    try {
      const v = localStorage.getItem(AI_STORAGE_KEY);
      if (v == null) {
        localStorage.setItem(AI_STORAGE_KEY, String(AI_LIMIT));
        setAiRemaining(AI_LIMIT);
      } else {
        const n = Math.max(0, Math.min(AI_LIMIT, Number(v)));
        setAiRemaining(Number.isFinite(n) ? n : AI_LIMIT);
      }
    } catch {
      setAiRemaining(AI_LIMIT);
    }
  }, []);

  function setAiRemainingAndPersist(n) {
    const safe = Math.max(0, Math.min(AI_LIMIT, Number(n)));
    setAiRemaining(safe);
    try {
      localStorage.setItem(AI_STORAGE_KEY, String(safe));
    } catch {
      // ignore
    }
  }

  const canUseAi = aiRemaining > 0;

  // Required prerequisites for AI + Save + Publish (your rule)
  const prerequisitesOk = useMemo(() => {
    return (
      lessonTitle.trim().length >= 3 &&
      Boolean(gradeId) &&
      Boolean(subjectId) &&
      objectives.length > 0
    );
  }, [lessonTitle, gradeId, subjectId, objectives.length]);

  const hasContent = useMemo(() => {
    return Boolean(
      lessonTitle.trim() ||
        objectives.length ||
        gradeId ||
        trackId ||
        strandId ||
        subjectId ||
        parts.some((p) => p.title.trim() || p.content.trim())
    );
  }, [lessonTitle, objectives.length, gradeId, trackId, strandId, subjectId, parts]);

  /* ===================== DB loads (dropdowns) ===================== */

  useEffect(() => {
    (async () => {
      const { data: grades, error: gErr } = await supabase
        .from("grade_levels")
        .select("grade_id, grade_level, description")
        .order("grade_level", { ascending: true });

      if (!gErr) setGradeOptions(grades || []);

      const { data: tracks, error: tErr } = await supabase
        .from("tracks")
        .select("track_id, track_code, description")
        .order("track_code", { ascending: true });

      if (!tErr) setTrackOptions(tracks || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setStrandId("");
      if (!trackId) {
        setStrandOptions([]);
        return;
      }

      const { data, error } = await supabase
        .from("strands")
        .select("strand_id, strand_code, description, track_id")
        .eq("track_id", trackId)
        .order("strand_code", { ascending: true });

      if (!error) setStrandOptions(data || []);
    })();
  }, [trackId]);

  useEffect(() => {
    (async () => {
      setSubjectId("");
      let q = supabase
        .from("subjects")
        .select("subject_id, subject_code, subject_title, subject_type, grade_id, strand_id")
        .eq("is_archived", false)
        .order("subject_title", { ascending: true });

      if (gradeId) q = q.eq("grade_id", gradeId);
      if (strandId) q = q.eq("strand_id", strandId);

      const { data, error } = await q;
      if (!error) setSubjectOptions(data || []);
    })();
  }, [gradeId, strandId]);

  /* ===================== Load existing lesson by route ===================== */

  useEffect(() => {
    // If route is missing, just treat as "new"
    if (!routeLessonId) {
      setLessonId(null);
      setLessonStatus("Draft");
      return;
    }

    // if /lesson/edit/new => new draft
    if (routeLessonId === "new") {
      setLessonId(null);
      setLessonStatus("Draft");
      // keep current local state (or reset, up to you). We'll reset for safety:
      resetAllLocal();
      return;
    }

    // if UUID, load it
    if (isUuid(routeLessonId)) {
      loadLesson(routeLessonId);
      return;
    }

    // otherwise invalid
    toast.push({
      tone: "danger",
      title: "Invalid URL",
      message: "Lesson ID is not valid.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLessonId]);

  async function loadLesson(id) {
    setLoadingLesson(true);
    try {
      const { data: lesson, error: lErr } = await supabase
        .from("lessons")
        .select("lesson_id, owner_teacher_id, title, grade_id, track_id, strand_id, subject_id, duration_minutes, audience, status, objectives")
        .eq("lesson_id", id)
        .single();

      if (lErr) throw lErr;

      setLessonId(lesson.lesson_id);
      setLessonStatus(lesson.status || "Draft");

      setLessonTitle(lesson.title || "");
      setGradeId(lesson.grade_id || "");
      setTrackId(lesson.track_id || "");
      setStrandId(lesson.strand_id || "");
      setSubjectId(lesson.subject_id || "");
      setObjectives(Array.isArray(lesson.objectives) ? lesson.objectives : []);

      const { data: partsRows, error: pErr } = await supabase
        .from("lesson_parts")
        .select("part_id, sort_order, part_type, title, body")
        .eq("lesson_id", id)
        .order("sort_order", { ascending: true });

      if (pErr) throw pErr;

      setParts(
        (partsRows || []).map((r) => ({
          id: r.part_id,
          type: r.part_type,
          title: r.title || r.part_type,
          content: r.body || "",
          aiBusy: false,
        }))
      );
    } catch (e) {
      toast.push({
        tone: "danger",
        title: "Load failed",
        message: String(e?.message || e),
      });
    } finally {
      setLoadingLesson(false);
    }
  }

  /* ===================== Objectives ===================== */

  function addObjective() {
    const v = objectiveInput.trim();
    if (!v) return;

    if (objectives.some((o) => String(o).toLowerCase() === v.toLowerCase())) {
      setObjectiveInput("");
      return;
    }

    setObjectives((p) => [...p, v]);
    setObjectiveInput("");
  }

  function removeObjective(idx) {
    setObjectives((p) => p.filter((_, i) => i !== idx));
  }

  /* ===================== Parts ===================== */

  function addPart() {
    const type = addPartType;

    if (parts.some((p) => p.type === type)) {
      toast.push({
        tone: "danger",
        title: "Already added",
        message: `You already added "${type}".`,
      });
      return;
    }

    setParts((p) => [
      ...p,
      { id: uid(), type, title: defaultPartTitle(type), content: "", aiBusy: false },
    ]);

    toast.push({ tone: "success", title: "Part added", message: `"${type}" added.` });
  }

  async function removePart(partId) {
    const part = parts.find((p) => p.id === partId);
    const ok = await toast.confirm({
      title: "Remove lesson part?",
      message: part ? `This will remove "${part.type}".` : "This will remove the part.",
      confirmText: "Remove",
      cancelText: "Cancel",
      tone: "danger",
    });

    if (!ok) return;
    setParts((p) => p.filter((x) => x.id !== partId));
  }

  function updatePart(partId, patch) {
    setParts((p) => p.map((x) => (x.id === partId ? { ...x, ...patch } : x)));
  }

  function movePart(partId, direction) {
    setParts((prev) => {
      const idx = prev.findIndex((p) => p.id === partId);
      if (idx === -1) return prev;

      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  }

  /* ===================== Validation ===================== */

  function validatePrereqsForSave() {
    if (lessonTitle.trim().length < 3) return "Lesson Title is required.";
    if (!gradeId) return "Grade Level is required.";
    if (!subjectId) return "Subject is required.";
    if (objectives.length === 0) return "Add at least 1 Lesson Objective.";
    return null;
  }

  /* ===================== AI Assist ===================== */

  async function onAiAssistPart(partId) {
    if (!canUseAi) {
      toast.push({
        tone: "danger",
        title: "AI limit reached",
        message: "You used all 15 AI assists.",
      });
      return;
    }

    const missing = validatePrereqsForSave();
    if (missing) {
      toast.push({ tone: "danger", title: "Missing required fields", message: missing });
      return;
    }

    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    updatePart(partId, { aiBusy: true });

    try {
      const content = await generateLessonPart({
        lessonTitle: lessonTitle.trim(),
        objectives,
        gradeLevel: selectedGrade ? `Grade ${selectedGrade.grade_level}` : "",
        subject: selectedSubject ? selectedSubject.subject_title : "",
        partType: part.type,
        partTitle: part.title?.trim() || part.type,
        track: selectedTrack
          ? {
              track_id: selectedTrack.track_id,
              track_code: selectedTrack.track_code,
              description: selectedTrack.description,
            }
          : null,
        strand: selectedStrand
          ? {
              strand_id: selectedStrand.strand_id,
              strand_code: selectedStrand.strand_code,
              description: selectedStrand.description,
            }
          : null,
      });

      updatePart(partId, { content });
      setAiRemainingAndPersist(aiRemaining - 1);

      toast.push({
        tone: "success",
        title: "AI content added",
        message: `Generated "${part.type}". (${aiRemaining - 1}/${AI_LIMIT} remaining)`,
      });
    } catch (e) {
      toast.push({ tone: "danger", title: "AI failed", message: String(e?.message || e) });
    } finally {
      updatePart(partId, { aiBusy: false });
    }
  }

  /* ===================== Save / Publish (DB wired) ===================== */

  async function saveLessonToDb({ nextStatus = "Draft" } = {}) {
    const missing = validatePrereqsForSave();
    if (missing) {
      toast.push({ tone: "danger", title: "Cannot save", message: missing });
      return null;
    }

    setSaving(true);
    try {
      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const user = userRes?.user;
      if (!user?.id) throw new Error("Not logged in.");

      // 1) upsert lessons row
      const lessonPayload = {
        owner_teacher_id: user.id,
        title: lessonTitle.trim(),
        grade_id: gradeId || null,
        track_id: trackId || null,
        strand_id: strandId || null,
        subject_id: subjectId || null,
        objectives: objectives || [],
        // keep existing defaults unless you add UI for these later:
        duration_minutes: 45,
        audience: "Whole Class",
        status: nextStatus,
      };

      let savedLessonId = lessonId;

      if (!savedLessonId) {
        const { data, error } = await supabase
          .from("lessons")
          .insert(lessonPayload)
          .select("lesson_id, status")
          .single();

        if (error) throw error;

        savedLessonId = data.lesson_id;
        setLessonId(savedLessonId);
        setLessonStatus(data.status || nextStatus);

        // move URL from /lesson/edit/new -> /lesson/edit/:uuid
        navigate(`/teacher/lesson/edit/${savedLessonId}`, { replace: true });
      } else {
        const { error } = await supabase
          .from("lessons")
          .update(lessonPayload)
          .eq("lesson_id", savedLessonId);

        if (error) throw error;

        setLessonStatus(nextStatus);
      }

      // 2) Replace parts (delete then insert)
      const { error: delErr } = await supabase
        .from("lesson_parts")
        .delete()
        .eq("lesson_id", savedLessonId);

      if (delErr) throw delErr;

      const partsToInsert = (parts || []).map((p, idx) => ({
        lesson_id: savedLessonId,
        sort_order: idx + 1,
        part_type: p.type,
        title: (String(p.title || p.type || "").trim() || p.type).slice(0, 200),
        body: String(p.content || "").trim(),
        // optional fields exist in your table:
        is_collapsed: false,
      }));

      if (partsToInsert.length) {
        const { error: insErr } = await supabase
          .from("lesson_parts")
          .insert(partsToInsert);

        if (insErr) throw insErr;
      }

      toast.push({
        tone: "success",
        title: nextStatus === "Published" ? "Published" : "Saved",
        message:
          nextStatus === "Published"
            ? "Lesson is now published."
            : "Draft saved.",
      });

      return savedLessonId;
    } catch (e) {
      toast.push({
        tone: "danger",
        title: "Save failed",
        message: String(e?.message || e),
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    await saveLessonToDb({ nextStatus: "Draft" });
  }

  async function onPublish() {
    await saveLessonToDb({ nextStatus: "Published" });
  }

  /* ===================== Actions ===================== */

  function resetAllLocal() {
    setLessonTitle("");
    setObjectiveInput("");
    setObjectives([]);

    setGradeId("");
    setTrackId("");
    setStrandId("");
    setSubjectId("");

    setParts([]);
    setPreviewOpen(false);

    setLessonStatus("Draft");
    setLessonId(null);
  }

  async function resetAll() {
    const ok = await toast.confirm({
      title: "Reset this editor?",
      message: "This clears the fields in the editor. (It does not delete the saved lesson in DB.)",
      confirmText: "Reset",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    // if on a real lesson URL, reset local state but keep route as is
    resetAllLocal();
  }

  /* ===================== Preview ===================== */

  const previewLesson = useMemo(() => {
    return buildLessonPayload({
      lessonId,
      status: lessonStatus,
      lessonTitle,
      objectives,
      grade: selectedGrade,
      subject: selectedSubject,
      track: selectedTrack,
      strand: selectedStrand,
      parts,
    });
  }, [lessonId, lessonStatus, lessonTitle, objectives, selectedGrade, selectedSubject, selectedTrack, selectedStrand, parts]);

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-extrabold">Lesson Sampler</div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                lessonStatus === "Published"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-black/10 bg-black/[0.02] text-black/70"
              }`}
            >
              {lessonStatus}
            </span>
            {loadingLesson ? (
              <span className="text-xs font-semibold text-black/55">Loading…</span>
            ) : null}
          </div>

          <div className={`text-sm ${UI.muted}`}>
            Required: Lesson Title, Grade Level, Subject, and at least 1 Objective. AI Assist limit:{" "}
            <span className="font-bold">{AI_LIMIT}</span>.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Status strip */}
          <div className="hidden md:flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <span className="text-xs font-extrabold text-black/70">
              AI: {prerequisitesOk ? "Enabled" : "Disabled"}
            </span>
            <span className="h-4 w-px bg-black/10" />
            <span className="text-xs font-semibold text-black/55">
              Objectives: <span className="font-extrabold text-black/70">{objectives.length}</span>
            </span>
            <span className="h-4 w-px bg-black/10" />
            <span className="text-xs font-semibold text-black/55">
              Parts: <span className="font-extrabold text-black/70">{parts.length}</span>
            </span>
            <span className="h-4 w-px bg-black/10" />
            <span className="text-xs font-semibold text-black/55">
              Selected:{" "}
              <span className="font-extrabold text-black/70">
                {selectedGrade ? `G${selectedGrade.grade_level}` : "—"}
                {selectedSubject ? ` • ${selectedSubject.subject_title}` : ""}
              </span>
            </span>
          </div>

          <AiCounter
            remaining={aiRemaining}
            limit={AI_LIMIT}
            onReset={() => setAiRemainingAndPersist(AI_LIMIT)}
          />

          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
            disabled={!hasContent}
            type="button"
            title="Open student preview"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>

          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02] disabled:opacity-60"
            disabled={!hasContent || saving}
            type="button"
            title="Clear fields"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>

          <button
            onClick={onSaveDraft}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
            disabled={!prerequisitesOk || saving}
            type="button"
            title="Save draft"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Draft"}
          </button>

          <button
            onClick={onPublish}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            disabled={!prerequisitesOk || saving}
            type="button"
            title="Publish lesson"
          >
            <UploadCloud className="h-4 w-4" />
            {saving ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="space-y-4">
          <Section title="Lesson Details">
            <div className="grid gap-3">
              <Input
                label="Lesson Title *"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="e.g., Media and Information Literacy: Evaluating Sources"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <SelectDB
                  label="Grade Level *"
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  placeholder="Select grade"
                  options={gradeOptions.map((g) => ({
                    value: g.grade_id,
                    label: `Grade ${g.grade_level}${g.description ? ` • ${g.description}` : ""}`,
                  }))}
                />

                <SelectDB
                  label="Track"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="(optional) Select track"
                  options={trackOptions.map((t) => ({
                    value: t.track_id,
                    label: `${t.track_code}${t.description ? ` • ${t.description}` : ""}`,
                  }))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SelectDB
                  label="Strand"
                  value={strandId}
                  onChange={(e) => setStrandId(e.target.value)}
                  placeholder={trackId ? "(optional) Select strand" : "Select track first"}
                  disabled={!trackId}
                  options={strandOptions.map((s) => ({
                    value: s.strand_id,
                    label: `${s.strand_code}${s.description ? ` • ${s.description}` : ""}`,
                  }))}
                />

                <SelectDB
                  label="Subject *"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder={gradeId ? "Select subject" : "Select grade first"}
                  disabled={!gradeId}
                  options={subjectOptions.map((s) => ({
                    value: s.subject_id,
                    label: `${s.subject_title} (${String(s.subject_type || "").trim() || "—"})`,
                  }))}
                />
              </div>

              <Field label="Lesson Objectives * (at least 1)">
                <div className="flex gap-2">
                  <input
                    value={objectiveInput}
                    onChange={(e) => setObjectiveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addObjective();
                      }
                    }}
                    placeholder="Add an objective (press Enter)"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                  />
                  <button
                    type="button"
                    onClick={addObjective}
                    className="mt-1 grid h-[38px] w-[44px] place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/[0.02]"
                    title="Add objective"
                  >
                    <Plus className="h-4 w-4 text-black/70" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {objectives.length === 0 ? (
                    <div className="text-xs font-semibold text-rose-700">
                      Add at least 1 objective to enable AI Assist and Save/Publish.
                    </div>
                  ) : (
                    objectives.map((o, idx) => (
                      <span
                        key={`${o}-${idx}`}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs font-semibold"
                      >
                        {o}
                        <button
                          type="button"
                          onClick={() => removeObjective(idx)}
                          className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/5"
                          title="Remove"
                        >
                          <X className="h-3 w-3 text-black/60" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Lesson Parts">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1">
                  <SelectDB
                    label="Add a lesson part"
                    value={addPartType}
                    onChange={(e) => setAddPartType(e.target.value)}
                    options={LESSON_PART_TYPES.map((x) => ({ value: x, label: x }))}
                  />
                </div>

                <button
                  type="button"
                  onClick={addPart}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  Add Part
                </button>
              </div>

              {parts.length === 0 ? (
                <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm text-black/60">
                  No parts yet. Add one from the dropdown above.
                </div>
              ) : (
                <div className="space-y-3">
                  {parts.map((p, idx) => (
                    <PartCard
                      key={p.id}
                      part={p}
                      onChangeTitle={(v) => updatePart(p.id, { title: v })}
                      onChangeContent={(v) => updatePart(p.id, { content: v })}
                      onAiAssist={() => onAiAssistPart(p.id)}
                      onRemove={() => removePart(p.id)}
                      onMoveUp={() => movePart(p.id, "up")}
                      onMoveDown={() => movePart(p.id, "down")}
                      disableMoveUp={idx === 0}
                      disableMoveDown={idx === parts.length - 1}
                      aiDisabledReason={
                        !canUseAi
                          ? "You used all 15 AI assists."
                          : validatePrereqsForSave()
                          ? validatePrereqsForSave()
                          : null
                      }
                    />
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F1A14]">
                  <Sparkles className="h-4 w-4" />
                  AI Assist rule
                </div>
                <div className="mt-1 text-xs font-semibold text-black/60">
                  AI Assist requires: Lesson Title, Grade Level, Subject, and at least 1 Objective. Track/Strand (if selected)
                  will be sent to AI for alignment.
                </div>
              </div>
            </div>
          </Section>

          <div className="text-xs font-semibold text-black/55">
            Route: <span className="font-bold">/lesson/edit/:lessonId</span> • Edge Function expected:{" "}
            <span className="font-bold">supabase/functions/lesson-part</span>
          </div>
        </div>
      </div>

      {/* Student Preview modal */}
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} lesson={previewLesson} />
    </div>
  );
}

/* ================= UI Bits ================= */

function AiCounter({ remaining, limit, onReset }) {
  const used = limit - remaining;
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-black/70" />
        <div className="text-xs font-extrabold text-black">
          AI: <span className="tabular-nums">{remaining}</span>/<span className="tabular-nums">{limit}</span>
        </div>
      </div>

      <div className="h-5 w-px bg-black/10" />

      <div className="text-xs font-semibold text-black/55 tabular-nums">used {used}</div>

      <button
        type="button"
        onClick={onReset}
        className="ml-1 rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] font-extrabold text-black/70 hover:bg-black/[0.02]"
        title="Reset AI counter (local device only)"
      >
        Reset
      </button>
    </div>
  );
}

function PartCard({
  part,
  onChangeTitle,
  onChangeContent,
  onAiAssist,
  onRemove,
  aiDisabledReason,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}) {
  const aiDisabled = Boolean(aiDisabledReason) || part.aiBusy;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-black/55">Type</div>
          <div className="text-sm font-extrabold text-[#6B4E2E]">{part.type}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disableMoveUp}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-40"
            title="Move up"
          >
            ↑ Up
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={disableMoveDown}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02] disabled:opacity-40"
            title="Move down"
          >
            ↓ Down
          </button>

          <button
            type="button"
            onClick={onAiAssist}
            disabled={aiDisabled}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${
              aiDisabled ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black hover:opacity-95"
            }`}
            title={part.aiBusy ? "Generating..." : aiDisabledReason || "Generate student-facing content"}
          >
            <Wand2 className="h-4 w-4" />
            {part.aiBusy ? "Generating…" : "AI Assist"}
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 hover:bg-black/[0.02]"
            title="Remove this part"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <Input
          label="Title"
          value={part.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder={`e.g., ${part.type}`}
        />

        <Field label="Content">
          <textarea
            value={part.content}
            onChange={(e) => onChangeContent(e.target.value)}
            placeholder="Type content here, or use AI Assist..."
            className="mt-1 min-h-[140px] w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </Field>
      </div>
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

function Input({ label, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        type={type}
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      />
    </label>
  );
}

function SelectDB({ label, value, onChange, options, placeholder = "Select...", disabled = false }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:bg-black/[0.03] disabled:text-black/40"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ================= Builders ================= */

function buildLessonPayload({ lessonId, status, lessonTitle, objectives, grade, subject, track, strand, parts }) {
  return {
    lesson_id: lessonId || null,
    status: status || "Draft",
    title: String(lessonTitle || "").trim(),
    grade: grade
      ? { grade_id: grade.grade_id, grade_level: grade.grade_level, description: grade.description }
      : null,
    subject: subject
      ? {
          subject_id: subject.subject_id,
          subject_title: subject.subject_title,
          subject_code: subject.subject_code,
          subject_type: subject.subject_type,
        }
      : null,
    track: track
      ? { track_id: track.track_id, track_code: track.track_code, description: track.description }
      : null,
    strand: strand
      ? { strand_id: strand.strand_id, strand_code: strand.strand_code, description: strand.description }
      : null,
    objectives: objectives || [],
    parts: (parts || []).map((p) => ({
      type: p.type,
      title: String(p.title || "").trim(),
      content: String(p.content || "").trim(),
    })),
  };
}

/* ================= Edge Function Call ================= */

async function generateLessonPart({
  lessonTitle,
  objectives,
  gradeLevel,
  subject,
  partType,
  partTitle,
  track,
  strand,
}) {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr) throw new Error(`Auth session error: ${sessionErr.message}`);
  if (!session?.access_token) throw new Error("You must be logged in to use AI Assist.");

  const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
    body: {
      lessonTitle,
      objectives,
      gradeLevel,
      subject,
      partType,
      partTitle,
      track,
      strand,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const status = error?.status ? ` (status ${error.status})` : "";
    const details = error?.details ? `\n${error.details}` : "";
    throw new Error(`${error.message || "AI generation failed"}${status}${details}`);
  }

  if (!data?.content) throw new Error("No content returned by Edge Function");
  return String(data.content);
}
