// /Teacher/Lesson/AssignLesson.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ChevronLeft, Search, CheckCircle2, X } from "lucide-react";

/**
 * AssignLesson Page
 * Route: /Teacher/Lesson/AssignLesson?lesson_id=<template_lesson_id>
 *
 * - Select class (from section_schedules where teacher_id = current user)
 * - Create a SNAPSHOT instance (lesson_instances + instance parts + instance activities)
 *
 * IMPORTANT: Adjust TABLE/COLUMN constants below to match your schema.
 */

// ====== UI THEME ======
const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

// ====== Schema knobs (EDIT if your DB differs) ======
// Template tables
const T_LESSONS = "lessons";
const T_PARTS = "lesson_parts";
const T_ACTS = "lesson_activities";

// Instance snapshot tables (create these if you haven’t yet)
const T_INST = "lesson_instances";
const T_INST_PARTS = "lesson_instance_parts";
const T_INST_ACTS = "lesson_instance_activities";

// Class sources (you already have these)
const T_SCHEDULES = "section_schedules";
const T_SECTIONS = "sections";
const T_SUBJECTS = "subjects";
const T_SCHOOL_YEARS = "school_years";
const T_TERMS = "terms";
const T_TRACKS = "tracks";
const T_STRANDS = "strands";
const T_GRADES = "grade_levels";

// ====== Helpers ======
function getSearchParam(key) {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function fmtTime(t) {
  if (!t) return "—";
  try {
    return String(t).slice(0, 5); // "HH:MM:SS" -> "HH:MM"
  } catch {
    return "—";
  }
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

function uuid() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());
}

function StatusChip({ tone, children }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-[#C9A227]/15 text-[#6B4E2E] border-[#C9A227]/30"
      : "bg-black/[0.03] text-black/70 border-black/10";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
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
    const id = uuid();
    const item = { id, tone: "info", ...toast };
    setToasts((p) => [item, ...p]);

    if (!item.actions?.length) {
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
    }
    return id;
  };

  const dismiss = (id) => setToasts((p) => p.filter((x) => x.id !== id));

  const confirm = ({ title, message, confirmText = "Confirm", cancelText = "Cancel", tone = "danger" }) =>
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

/* ===================== Page ===================== */

export default function AssignLesson() {
  const toast = useToasts();

  const templateLessonId = getSearchParam("lesson_id");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Template data
  const [lesson, setLesson] = useState(null);
  const [parts, setParts] = useState([]);
  const [acts, setActs] = useState([]);

  // Lookups
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [strands, setStrands] = useState([]);
  const [grades, setGrades] = useState([]);
  const [terms, setTerms] = useState([]);
  const [activeSy, setActiveSy] = useState(null);

  // Teacher schedules (classes)
  const [sched, setSched] = useState([]);

  // UI
  const [tab, setTab] = useState("Pick Class");
  const [q, setQ] = useState("");
  const [pickedScheduleId, setPickedScheduleId] = useState(null);

  // Visibility (instance controls student visibility)
  const [visibility, setVisibility] = useState({
    mode: "Hidden", // Hidden | Visible
    visible_from: "",
    visible_until: "",
  });

  const subjectMap = useMemo(() => {
    const m = new Map();
    (subjects ?? []).forEach((s) => m.set(String(s.subject_id), s.subject_title));
    return m;
  }, [subjects]);

  const sectionMap = useMemo(() => {
    const m = new Map();
    (sections ?? []).forEach((s) => m.set(String(s.section_id), s));
    return m;
  }, [sections]);

  const trackMap = useMemo(() => {
    const m = new Map();
    (tracks ?? []).forEach((t) => m.set(String(t.track_id), t.track_code));
    return m;
  }, [tracks]);

  const strandMap = useMemo(() => {
    const m = new Map();
    (strands ?? []).forEach((s) => m.set(String(s.strand_id), s.strand_code));
    return m;
  }, [strands]);

  const gradeMap = useMemo(() => {
    const m = new Map();
    (grades ?? []).forEach((g) => m.set(String(g.grade_id), g.grade_level));
    return m;
  }, [grades]);

  const termMap = useMemo(() => {
    const m = new Map();
    (terms ?? []).forEach((t) => m.set(String(t.term_id), t.term_code));
    return m;
  }, [terms]);

  const pickedSchedule = useMemo(() => {
    if (!pickedScheduleId) return null;
    return (sched ?? []).find((x) => String(x.schedule_id) === String(pickedScheduleId)) || null;
  }, [sched, pickedScheduleId]);

  const pickedSection = useMemo(() => {
    if (!pickedSchedule?.section_id) return null;
    return sectionMap.get(String(pickedSchedule.section_id)) || null;
  }, [pickedSchedule, sectionMap]);

  const visibilityDateError = useMemo(() => {
    if (!visibility.visible_from || !visibility.visible_until) return null;
    const a = new Date(visibility.visible_from).getTime();
    const b = new Date(visibility.visible_until).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b < a) return "Visible-until must not be earlier than visible-from.";
    return null;
  }, [visibility.visible_from, visibility.visible_until]);

  const canAssign = useMemo(() => {
    if (!templateLessonId) return false;
    if (!lesson) return false;
    if (String(lesson.status || "Draft") !== "Published") return false;
    if (!pickedSchedule) return false;
    if (visibilityDateError) return false;
    return true;
  }, [templateLessonId, lesson, pickedSchedule, visibilityDateError]);

  const filteredSched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sched ?? [];

    return (sched ?? []).filter((r) => {
      const sec = sectionMap.get(String(r.section_id || ""));
      const subj = subjectMap.get(String(r.subject_id || "")) || "";
      const hay = `${sec?.section_name || ""} ${subj} ${r.day_of_week || ""} ${r.room || ""} ${
        termMap.get(String(r.term_id || "")) || ""
      }`
        .toLowerCase()
        .trim();
      return hay.includes(needle);
    });
  }, [sched, q, sectionMap, subjectMap, termMap]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      if (!templateLessonId) throw new Error("Missing lesson_id in URL.");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authData?.user?.id;
      if (!uid) throw new Error("Not authenticated.");

      // Active SY (optional)
      const syRes = await supabase
        .from(T_SCHOOL_YEARS)
        .select("sy_id, sy_code, start_date, end_date, status")
        .eq("status", "Active")
        .maybeSingle();

      if (syRes.error && syRes.status !== 406) throw syRes.error;
      setActiveSy(syRes.data || null);

      // Lookups
      const [subRes, secRes, trRes, stRes, grRes, tmRes] = await Promise.all([
        supabase.from(T_SUBJECTS).select("subject_id, subject_title, is_archived").eq("is_archived", false).order("subject_title"),
        supabase.from(T_SECTIONS).select("section_id, section_name, grade_id, track_id, strand_id, sy_id, is_archived").eq("is_archived", false),
        supabase.from(T_TRACKS).select("track_id, track_code").order("track_code"),
        supabase.from(T_STRANDS).select("strand_id, strand_code, track_id").order("strand_code"),
        supabase.from(T_GRADES).select("grade_id, grade_level").order("grade_level"),
        supabase.from(T_TERMS).select("term_id, term_code").order("term_code"),
      ]);

      if (subRes.error) throw subRes.error;
      if (secRes.error) throw secRes.error;
      if (trRes.error) throw trRes.error;
      if (stRes.error) throw stRes.error;
      if (grRes.error) throw grRes.error;
      if (tmRes.error) throw tmRes.error;

      setSubjects(subRes.data ?? []);
      setSections(secRes.data ?? []);
      setTracks(trRes.data ?? []);
      setStrands(stRes.data ?? []);
      setGrades(grRes.data ?? []);
      setTerms(tmRes.data ?? []);

      // Template header (ownership guard included)
      const lRes = await supabase
        .from(T_LESSONS)
        .select("lesson_id, owner_teacher_id, title, subject_id, grade_id, track_id, strand_id, duration_minutes, audience, status, created_at, updated_at")
        .eq("lesson_id", templateLessonId)
        .maybeSingle();

      if (lRes.error) throw lRes.error;
      if (!lRes.data) throw new Error("Lesson not found.");

      if (String(lRes.data.owner_teacher_id) !== String(uid)) {
        throw new Error("You do not own this lesson template.");
      }

      setLesson(lRes.data);

      // Parts
      const pRes = await supabase
        .from(T_PARTS)
        .select("part_id, lesson_id, sort_order, part_type, title, body, is_collapsed")
        .eq("lesson_id", templateLessonId)
        .order("sort_order", { ascending: true });

      if (pRes.error) throw pRes.error;
      const partRows = pRes.data ?? [];
      setParts(partRows);

      // Activities
      const partIds = partRows.map((x) => x.part_id);
      const aRes = partIds.length
        ? await supabase
            .from(T_ACTS)
            .select("activity_id, part_id, sort_order, activity_type, title, instructions, estimated_minutes, attachable")
            .in("part_id", partIds)
            .order("sort_order", { ascending: true })
        : { data: [], error: null };

      if (aRes.error) throw aRes.error;
      setActs(aRes.data ?? []);

      // Teacher schedules (classes)
      let schQ = supabase
        .from(T_SCHEDULES)
        .select("schedule_id, sy_id, term_id, section_id, day_of_week, period_no, start_time, end_time, subject_id, teacher_id, room")
        .eq("teacher_id", uid)
        .order("sy_id", { ascending: false })
        .order("term_id", { ascending: true })
        .order("day_of_week", { ascending: true })
        .order("period_no", { ascending: true });

      if (syRes.data?.sy_id) schQ = schQ.eq("sy_id", syRes.data.sy_id);

      const schRes = await schQ;
      if (schRes.error) throw schRes.error;

      setSched(schRes.data ?? []);

      // Default pick: match schedule subject to lesson subject if possible
      const match = (schRes.data ?? []).find((x) => String(x.subject_id) === String(lRes.data.subject_id));
      if (match) setPickedScheduleId(match.schedule_id);

      // Warn if not Published
      if (String(lRes.data.status || "Draft") !== "Published") {
        toast.push({
          tone: "danger",
          title: "Not ready to assign",
          message: "This lesson is not Published. Go back and publish it first.",
        });
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goBack() {
    window.history.back();
  }

  async function createSnapshotInstance() {
    if (!canAssign) return;

    const ok = await toast.confirm({
      title: "Assign this lesson?",
      message: "This will create a snapshot instance for the selected class.",
      confirmText: "Assign",
      cancelText: "Cancel",
      tone: "info",
    });

    if (!ok) return;

    setBusy(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authData?.user?.id;
      if (!uid) throw new Error("Not authenticated.");

      const instanceId = uuid();

      // 1) Insert instance header
      const instPayload = {
        instance_id: instanceId,
        template_lesson_id: templateLessonId,
        owner_teacher_id: uid,

        // class context
        sy_id: pickedSchedule.sy_id,
        term_id: pickedSchedule.term_id,
        section_id: pickedSchedule.section_id,
        schedule_id: pickedSchedule.schedule_id,
        subject_id: pickedSchedule.subject_id,

        // visibility controls
        status: visibility.mode === "Visible" ? "Visible" : "Hidden",
        visible_from: visibility.visible_from || null,
        visible_until: visibility.visible_until || null,

        // denormalized convenience
        title: lesson?.title || "Untitled Lesson",
        duration_minutes: lesson?.duration_minutes ?? null,
      };

      const insInst = await supabase.from(T_INST).insert(instPayload);
      if (insInst.error) throw insInst.error;

      // 2) Copy parts
      const partIdMap = new Map(); // template part_id -> instance_part_id
      const instPartRows = (parts ?? []).map((p) => {
        const instancePartId = uuid();
        partIdMap.set(p.part_id, instancePartId);
        return {
          instance_part_id: instancePartId,
          instance_id: instanceId,
          sort_order: p.sort_order,
          part_type: p.part_type,
          title: p.title,
          body: p.body,
          is_collapsed: p.is_collapsed,
        };
      });

      if (instPartRows.length) {
        const insParts = await supabase.from(T_INST_PARTS).insert(instPartRows);
        if (insParts.error) throw insParts.error;
      }

      // 3) Copy activities
      const instActRows = (acts ?? []).map((a) => ({
        instance_activity_id: uuid(),
        instance_id: instanceId,
        instance_part_id: partIdMap.get(a.part_id),
        sort_order: a.sort_order,
        activity_type: a.activity_type,
        title: a.title,
        instructions: a.instructions,
        estimated_minutes: a.estimated_minutes,
        attachable: a.attachable,
      }));

      if (instActRows.length) {
        const insActs = await supabase.from(T_INST_ACTS).insert(instActRows);
        if (insActs.error) throw insActs.error;
      }

      toast.push({
        tone: "success",
        title: "Assigned",
        message: "Snapshot instance created successfully.",
      });

      // Optional redirect after success:
      // window.location.href = `/Teacher/Lesson/AssignedLesson?instance_id=${instanceId}`;
    } catch (e) {
      toast.push({ tone: "danger", title: "Assign failed", message: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }

  const pickedMeta = useMemo(() => {
    if (!pickedSchedule) return null;

    const sec = sectionMap.get(String(pickedSchedule.section_id || ""));
    const subj = subjectMap.get(String(pickedSchedule.subject_id || ""));
    const grade = sec?.grade_id ? gradeMap.get(String(sec.grade_id)) : null;
    const track = sec?.track_id ? trackMap.get(String(sec.track_id)) : null;
    const strand = sec?.strand_id ? strandMap.get(String(sec.strand_id)) : null;

    return {
      sectionName: sec?.section_name || "—",
      subject: subj || "—",
      grade: grade != null ? `Grade ${grade}` : "—",
      track: track || "—",
      strand: strand || "—",
      day: pickedSchedule.day_of_week || "—",
      period: pickedSchedule.period_no,
      start: fmtTime(pickedSchedule.start_time),
      end: fmtTime(pickedSchedule.end_time),
      room: pickedSchedule.room || "—",
      term: termMap.get(String(pickedSchedule.term_id || "")) || "—",
    };
  }, [pickedSchedule, sectionMap, subjectMap, gradeMap, trackMap, strandMap, termMap]);

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div>
            <div className="text-lg font-extrabold">Assign Lesson</div>
            <div className={`text-sm ${UI.muted}`}>
              Creates a <b>snapshot instance</b> for a class. Students only see the instance.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lesson ? <Badge className="rounded-full">Template: {lesson.title || "Untitled Lesson"}</Badge> : null}
          {lesson?.status ? (
            <StatusChip tone={String(lesson.status) === "Published" ? "ok" : "warn"}>{lesson.status}</StatusChip>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Setup */}
        <Card className={`rounded-2xl border ${UI.border}`}>
          <CardHeader>
            <CardTitle>Assignment Setup</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : err ? (
              <div className="text-sm text-rose-700">
                Error: {err}
                <div className="mt-3">
                  <Button variant="outline" className="rounded-2xl" onClick={load}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Step Tabs */}
                <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
                  <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="rounded-2xl">
                      {["Pick Class", "Visibility", "Review"].map((t) => (
                        <TabsTrigger key={t} value={t} className="rounded-2xl">
                          {t}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* PICK CLASS */}
                {tab === "Pick Class" ? (
                  <div className="space-y-3">
                    <Field label="Search class / subject / day">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                        <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Search section, subject, day…"
                          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                        />
                      </div>
                    </Field>

                    <div className={`rounded-2xl border ${UI.border} bg-white`}>
                      <div className="border-b border-black/10 px-4 py-3 text-sm font-extrabold">
                        Your Classes <span className={`ml-2 text-xs ${UI.muted}`}>({filteredSched.length})</span>
                      </div>

                      <ScrollArea className="h-[320px]">
                        <div className="p-2 space-y-2">
                          {filteredSched.map((r) => {
                            const sec = sectionMap.get(String(r.section_id || ""));
                            const subj = subjectMap.get(String(r.subject_id || ""));
                            const picked = String(pickedScheduleId || "") === String(r.schedule_id);

                            return (
                              <button
                                key={r.schedule_id}
                                type="button"
                                onClick={() => setPickedScheduleId(r.schedule_id)}
                                className={`w-full rounded-2xl border p-3 text-left transition ${
                                  picked ? "border-[#C9A227]/60 bg-[#C9A227]/10" : "border-black/10 bg-white hover:bg-black/[0.02]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-extrabold truncate">{sec?.section_name || "(No section)"}</div>
                                    <div className="mt-1 text-xs text-black/60">
                                      {subj || "(No subject)"} {r.room ? ` • ${r.room}` : ""}
                                    </div>
                                    <div className="mt-1 text-xs text-black/60">
                                      {r.day_of_week || "—"} • Period {r.period_no} • {fmtTime(r.start_time)}–{fmtTime(r.end_time)}
                                      {termMap.get(String(r.term_id || "")) ? ` • ${termMap.get(String(r.term_id))}` : ""}
                                    </div>
                                  </div>

                                  {picked ? (
                                    <span className="inline-flex items-center gap-2 text-xs font-extrabold text-[#6B4E2E]">
                                      <CheckCircle2 className="h-4 w-4" /> Selected
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}

                          {filteredSched.length === 0 ? (
                            <div className={`px-3 py-8 text-center text-sm ${UI.muted}`}>No classes found.</div>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("Visibility")}
                        disabled={!pickedSchedule}
                        className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
                          pickedSchedule ? "bg-[#C9A227] text-black" : "bg-black/5 text-black/40"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* VISIBILITY */}
                {tab === "Visibility" ? (
                  <div className="space-y-3">
                    <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
                      <div className="text-sm font-extrabold">Student visibility</div>
                      <div className={`mt-1 text-xs ${UI.muted}`}>
                        Visibility applies to the <b>instance</b>, not the template.
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Mode">
                          <select
                            value={visibility.mode}
                            onChange={(e) => setVisibility((p) => ({ ...p, mode: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          >
                            <option value="Hidden">Hidden (teacher only)</option>
                            <option value="Visible">Visible to students</option>
                          </select>
                        </Field>

                        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                          <div className="text-xs font-semibold text-black/60">Suggestion</div>
                          <div className="mt-1 text-sm font-extrabold">
                            {visibility.mode === "Visible" ? "Students can see it." : "Prepare first, make visible later."}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Visible from (optional)">
                          <input
                            type="date"
                            value={visibility.visible_from}
                            onChange={(e) => setVisibility((p) => ({ ...p, visible_from: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          />
                        </Field>
                        <Field label="Visible until (optional)">
                          <input
                            type="date"
                            value={visibility.visible_until}
                            onChange={(e) => setVisibility((p) => ({ ...p, visible_until: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          />
                        </Field>
                      </div>

                      {visibilityDateError ? <div className="mt-2 text-xs font-semibold text-rose-700">{visibilityDateError}</div> : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("Pick Class")}
                        className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab("Review")}
                        className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-extrabold text-black"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* REVIEW */}
                {tab === "Review" ? (
                  <div className="space-y-3">
                    <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
                      <div className="text-sm font-extrabold">Review</div>

                      <div className="mt-3 grid gap-3">
                        <Row label="Template">
                          <b>{lesson?.title || "—"}</b>
                        </Row>

                        <Row label="Subject">{subjectMap.get(String(lesson?.subject_id || "")) || "—"}</Row>

                        <Row label="Class">
                          <b>{pickedMeta?.sectionName || "—"}</b>
                          <span className="text-black/60">
                            {pickedMeta ? ` • ${pickedMeta.day} P${pickedMeta.period} ${pickedMeta.start}–${pickedMeta.end}` : ""}
                          </span>
                        </Row>

                        <Row label="Room">{pickedMeta?.room || "—"}</Row>

                        <Row label="Term">{pickedMeta?.term || "—"}</Row>

                        <Row label="School year">{activeSy?.sy_code || "—"}</Row>

                        <Row label="Visibility">
                          <StatusChip tone={visibility.mode === "Visible" ? "ok" : "warn"}>{visibility.mode}</StatusChip>
                          <span className="ml-2 text-xs text-black/60">
                            {visibility.visible_from ? `from ${fmtDate(visibility.visible_from)}` : ""}
                            {visibility.visible_until ? ` until ${fmtDate(visibility.visible_until)}` : ""}
                          </span>
                        </Row>

                        <Row label="Snapshot size">
                          {parts.length} part(s) • {acts.length} activity(ies)
                        </Row>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("Visibility")}
                        className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        disabled={!canAssign || busy}
                        onClick={createSnapshotInstance}
                        className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
                          !canAssign || busy ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black"
                        }`}
                        title={!canAssign ? "Select a class and ensure template is Published" : ""}
                      >
                        {busy ? "Assigning…" : "Assign & Create Snapshot"}
                      </button>
                    </div>

                    {!canAssign ? (
                      <div className="text-xs text-rose-700">
                        {String(lesson?.status || "Draft") !== "Published"
                          ? "This template is not Published. Publish it first."
                          : !pickedSchedule
                          ? "Pick a class first."
                          : visibilityDateError || "Fix the form errors."}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Template Preview */}
        <Card className={`rounded-2xl border ${UI.border}`}>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : err ? (
              <div className={`text-sm ${UI.muted}`}>Preview unavailable.</div>
            ) : (
              <div className="space-y-3">
                <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
                  <div className="text-sm font-extrabold">{lesson?.title || "Untitled Lesson"}</div>
                  <div className={`mt-1 text-xs ${UI.muted}`}>
                    {subjectMap.get(String(lesson?.subject_id || "")) || "—"}
                    {lesson?.duration_minutes ? ` • ${lesson.duration_minutes} min` : ""}
                    {lesson?.audience ? ` • ${lesson.audience}` : ""}
                  </div>
                </div>

                <div className={`rounded-2xl border ${UI.border} bg-white`}>
                  <div className="border-b border-black/10 px-4 py-3 text-sm font-extrabold">
                    Parts ({parts.length})
                  </div>

                  <ScrollArea className="h-[420px]">
                    <div className="p-3 space-y-3">
                      {parts.map((p) => {
                        const partActs = (acts ?? [])
                          .filter((a) => String(a.part_id) === String(p.part_id))
                          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

                        return (
                          <div key={p.part_id} className={`rounded-2xl border ${UI.border} bg-white p-4`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold truncate">
                                  {p.title || p.part_type || "Lesson Part"}
                                </div>
                                <div className={`mt-1 text-xs ${UI.muted}`}>
                                  Type: <b>{p.part_type || "—"}</b> • Order: {p.sort_order ?? "—"}
                                </div>
                              </div>
                              <StatusChip tone="neutral">{partActs.length} act</StatusChip>
                            </div>

                            {p.body ? (
                              <div className="mt-3 text-sm text-black/70 whitespace-pre-wrap">
                                {String(p.body).slice(0, 420)}
                                {String(p.body).length > 420 ? "…" : ""}
                              </div>
                            ) : null}

                            {partActs.length ? (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-extrabold text-black/60">Activities</div>
                                {partActs.map((a) => (
                                  <div key={a.activity_id} className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                                    <div className="text-xs font-extrabold">{a.title || a.activity_type || "Activity"}</div>
                                    <div className={`mt-1 text-xs ${UI.muted}`}>
                                      {a.activity_type || "—"}
                                      {a.estimated_minutes ? ` • ${a.estimated_minutes} min` : ""}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {parts.length === 0 ? (
                        <div className={`px-3 py-10 text-center text-sm ${UI.muted}`}>No parts yet.</div>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4 text-sm ${UI.muted}`}>
        <b>Note:</b> Templates are teacher-only. Students see only <b>instances</b> created here.
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

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <div className="text-sm text-black/80">{children}</div>
    </div>
  );
}
