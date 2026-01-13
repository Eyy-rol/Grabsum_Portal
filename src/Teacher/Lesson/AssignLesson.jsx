// Teacher/Lesson/AssignLesson.jsx
//
// Assign Lesson (Teacher)
// - Expects query param: /teacher/assign-lesson?lessonId=...
// - Teacher can only assign a Published lesson
// - Teacher can only assign to SECTIONS they teach (via section_schedules.teacher_id = auth.uid())
// - The selectable section/schedule must be aligned to the lesson's:
//    - grade_id
//    - track_id
//    - strand_id
//   (Alignment rule: if lesson field is NULL => it's not a constraint; if NOT NULL => must match section field)
//
// Inserts into lesson_assignments.
//
// Tables used:
// - lessons (validate Published + get grade_id/track_id/strand_id)
// - school_years (get Active sy)
// - section_schedules (teacher's schedules in Active sy)
// - sections (to check grade/track/strand alignment)
// - lesson_assignments (insert)
//
// Notes:
// - This page does NOT create lesson_instances; it only creates the assignment row.
// - RLS should enforce: assigned_by = auth.uid() and teacher_can_access_section(section_id)

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { ArrowLeft, CheckCircle2, BookOpen, CalendarDays } from "lucide-react";

const UI = {
  pageBg: "bg-white",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  border: "border-black/10",
  goldBg: "bg-[#C9A227]",
};

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function fmtTime(v) {
  if (!v) return "—";
  return String(v).slice(0, 5) || "—";
}

function matchesConstraint(sectionValue, lessonValue) {
  // If lessonValue is null => no constraint, allow any
  if (lessonValue == null) return true;
  return sectionValue === lessonValue;
}

export default function AssignLesson() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const lessonId = sp.get("lessonId");

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState(null);

  // lesson
  const [lesson, setLesson] = useState(null);

  // active school year
  const [activeSY, setActiveSY] = useState(null);

  // schedule slots teacher can assign to (active sy only, aligned to lesson grade/track/strand)
  const [slots, setSlots] = useState([]);

  // form state
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(""); // YYYY-MM-DD optional

  useEffect(() => {
    if (!isUuid(lessonId)) return;
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function init() {
    setLoading(true);
    try {
      // 0) auth user
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes?.user;
      if (!user?.id) throw new Error("Not authenticated.");
      setMe(user);

      // 1) load lesson (need grade_id/track_id/strand_id for alignment)
      const { data: l, error: lErr } = await supabase
        .from("lessons")
        .select("lesson_id, title, status, grade_id, track_id, strand_id")
        .eq("lesson_id", lessonId)
        .single();

      if (lErr) throw lErr;

      if (String(l.status || "") !== "Published") {
        alert("Only Published lessons can be assigned.");
        navigate("/teacher/lesson-library", { replace: true });
        return;
      }
      setLesson(l);

      // 2) get Active school year
      const { data: sy, error: syErr } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, start_date, end_date, status")
        .eq("status", "Active")
        .single();

      if (syErr) throw syErr;
      setActiveSY(sy);

      // 3) load teacher schedule slots in active sy (teacher-only)
      const { data: sched, error: schedErr } = await supabase
        .from("section_schedules")
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
          subjects:subject_id ( subject_title, subject_code ),
          sections:section_id ( section_name, grade_id, track_id, strand_id ),
          terms:term_id ( term_code )
        `
        )
        .eq("sy_id", sy.sy_id)
        .eq("teacher_id", user.id)
        .order("section_id", { ascending: true })
        .order("day_of_week", { ascending: true })
        .order("period_no", { ascending: true });

      if (schedErr) throw schedErr;

      // 4) filter schedules by alignment:
      //    lesson.grade_id/track_id/strand_id must match section.* when lesson value is NOT NULL
      const aligned =
        (sched || []).filter((row) => {
          const sec = row?.sections || {};
          return (
            matchesConstraint(sec.grade_id, l.grade_id) &&
            matchesConstraint(sec.track_id, l.track_id) &&
            matchesConstraint(sec.strand_id, l.strand_id)
          );
        }) || [];

      setSlots(aligned);

      // If previously selected schedule is no longer valid, clear it
      setSelectedScheduleId((prev) =>
        aligned.some((x) => x.schedule_id === prev) ? prev : ""
      );
    } catch (e) {
      console.error("AssignLesson init error:", e);
      alert(`Failed to load assign screen: ${e?.message || e}`);
      navigate("/teacher/lesson-library", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  const slotOptions = useMemo(() => {
    return (slots || []).map((r) => {
      const sec = r?.sections?.section_name || "Unknown section";
      const term = r?.terms?.term_code ? ` • ${r.terms.term_code}` : "";
      const subj =
        r?.subjects?.subject_title || r?.subjects?.subject_code || "";
      const subjText = subj ? ` • ${subj}` : "";
      const label = `${sec}${term}${subjText} • ${r.day_of_week} P${
        r.period_no
      } (${fmtTime(r.start_time)}-${fmtTime(r.end_time)})`;

      return { value: r.schedule_id, label, row: r };
    });
  }, [slots]);

  const selectedSlot = useMemo(() => {
    return slotOptions.find((o) => o.value === selectedScheduleId)?.row || null;
  }, [slotOptions, selectedScheduleId]);

  const canSubmit = Boolean(
    !loading &&
      me?.id &&
      lesson?.lesson_id &&
      activeSY?.sy_id &&
      selectedSlot?.schedule_id
  );

  async function submit() {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const payload = {
        lesson_id: lesson.lesson_id,
        sy_id: activeSY.sy_id,
        section_id: selectedSlot.section_id,
        term_id: selectedSlot.term_id,
        schedule_id: selectedSlot.schedule_id,
        assigned_by: me.id,
        scheduled_date: scheduledDate || null,
      };

      const { error } = await supabase.from("lesson_assignments").insert(payload);
      if (error) throw error;

      alert("Lesson assigned successfully!");
      navigate("/teacher/lesson-library"); // ✅ go back to Lesson Library
    } catch (e) {
      console.error("AssignLesson submit error:", e);

      const msg = String(e?.message || e);
      if (
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique")
      ) {
        alert("This lesson is already assigned to that schedule/section.");
      } else {
        alert(`Assign failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isUuid(lessonId)) {
    return (
      <div className={`${UI.pageBg} ${UI.text} p-4`}>Invalid lessonId.</div>
    );
  }

  const alignmentHint =
    lesson && (lesson.grade_id || lesson.track_id || lesson.strand_id)
      ? "Schedule list is filtered to sections aligned with this lesson’s Grade/Track/Strand."
      : "This lesson has no Grade/Track/Strand constraints, so all your schedule slots (Active SY) are selectable.";

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={() => navigate("/teacher/lesson-library")}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
          title="Go to Lesson Library"
        >
          <BookOpen className="h-4 w-4" />
          Lesson Library
        </button>
      </div>

      {/* Header card */}
      <div className={`rounded-2xl border ${UI.border} bg-white p-4 space-y-2`}>
        <div className="text-lg font-extrabold">Assign Lesson</div>

        <div className={`text-sm ${UI.muted}`}>
          {lesson ? (
            <>
              Assigning:{" "}
              <span className="font-extrabold text-black/80">
                {lesson.title}
              </span>
              {activeSY?.sy_code ? (
                <>
                  {" "}
                  <span className="text-black/35">•</span>{" "}
                  <span className="font-bold text-black/70">
                    SY {activeSY.sy_code}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            "Loading lesson…"
          )}
        </div>

        <div className="text-xs text-black/50">
          Only <span className="font-bold">Published</span> lessons can be
          assigned.
        </div>
      </div>

      {/* Form */}
      <div className={`rounded-2xl border ${UI.border} bg-white p-4 space-y-4`}>
        {/* Schedule Slot */}
        <label className="block">
          <span className="text-xs font-semibold text-black/55">
            Schedule Slot (Aligned Section)
          </span>
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            disabled={loading}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          >
            <option value="">Select a schedule slot you teach…</option>
            {slotOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="mt-1 text-xs text-black/45">{alignmentHint}</div>

          {!loading && lesson && slotOptions.length === 0 ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No available schedule slots match this lesson’s Grade/Track/Strand
              within the Active School Year.
            </div>
          ) : null}
        </label>

        {/* Scheduled Date */}
        <label className="block">
          <span className="text-xs font-semibold text-black/55">
            Scheduled Date{" "}
            <span className="font-normal text-black/40">(optional)</span>
          </span>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <CalendarDays className="h-4 w-4 text-black/45" />
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              disabled={loading}
              className="w-full text-sm outline-none"
            />
          </div>
        </label>

        {/* Preview selection */}
        {selectedSlot ? (
          <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm">
            <div className="font-extrabold text-black/75">
              Assignment Preview
            </div>
            <div className="mt-2 grid gap-1 text-xs text-black/60">
              <div>
                <span className="font-semibold">Section:</span>{" "}
                <span className="font-bold text-black/70">
                  {selectedSlot?.sections?.section_name || "—"}
                </span>
              </div>
              <div>
                <span className="font-semibold">Term:</span>{" "}
                <span className="font-bold text-black/70">
                  {selectedSlot?.terms?.term_code || "—"}
                </span>
              </div>
              <div>
                <span className="font-semibold">Schedule:</span>{" "}
                <span className="font-bold text-black/70">
                  {selectedSlot.day_of_week} • P{selectedSlot.period_no} (
                  {fmtTime(selectedSlot.start_time)}-
                  {fmtTime(selectedSlot.end_time)})
                </span>
              </div>
              <div>
                <span className="font-semibold">Subject:</span>{" "}
                <span className="font-bold text-black/70">
                  {selectedSlot?.subjects?.subject_title ||
                    selectedSlot?.subjects?.subject_code ||
                    "—"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Submit */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Assign Lesson
        </button>

        <div className="text-xs text-black/45">
          If you don’t see a section here, make sure:
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              You have a schedule slot assigned to you for the Active School
              Year.
            </li>
            <li>
              The section’s Grade/Track/Strand matches the lesson’s Grade/Track/Strand
              (when set).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
