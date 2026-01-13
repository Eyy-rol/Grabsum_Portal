import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import {
  ChevronLeft,
  Info,
  RefreshCcw,
  Send,
  X,
  Search,
  BookOpen,
  Clock,
} from "lucide-react";

/**
 * ============================================================
 * AssignLesson.jsx (Option A)
 *
 * Route:
 *   /teacher/assign-lesson/:lessonId
 *
 * Rules:
 * ✅ If lessonId is missing/invalid -> redirect to /teacher/lesson-library
 * ✅ Teacher can assign only if lesson exists
 * ============================================================
 */

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
  goldSoft: "bg-[#C9A227]/10",
};

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso || "");
  }
}

function ErrorBlock({ title, message }) {
  return (
    <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${UI.goldSoft}`}>
          <Info className="h-5 w-5 text-[#6B4E2E]" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold">{title}</div>
          <div className={`mt-1 text-sm ${UI.muted} whitespace-pre-wrap`}>{message}</div>
        </div>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`h-[84px] rounded-2xl border ${UI.border} bg-black/[0.02] animate-pulse`}
        />
      ))}
    </div>
  );
}

function Pill({ children, tone = "gold" }) {
  const cls =
    tone === "gold"
      ? `${UI.goldSoft} text-[#6B4E2E]`
      : tone === "outline"
      ? "bg-white border border-black/10 text-black/70"
      : "bg-black/5 text-black/70";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Card({ children }) {
  return <div className={`rounded-2xl border ${UI.border} ${UI.panel}`}>{children}</div>;
}

function CardHeader({ title, right }) {
  return (
    <div className={`border-b ${UI.border} px-4 py-3 flex items-center justify-between gap-2`}>
      <div className="text-sm font-extrabold">{title}</div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function CardBody({ children }) {
  return <div className="px-4 py-4">{children}</div>;
}

/* ============================================================
   Main Page
============================================================ */

export default function AssignLesson() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lessonId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [lesson, setLesson] = useState(null);

  // ✅ assignments UI (basic version)
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [students, setStudents] = useState([]);

  const invalidLessonId = !lessonId || lessonId === "undefined" || lessonId === "null";

  /* ============================================================
     Redirect rule (Option A)
  ============================================================ */
  useEffect(() => {
    if (invalidLessonId) {
      navigate("/teacher/lesson-library", {
        replace: true,
        state: {
          from: location.pathname,
          reason: "missing_lesson_id",
        },
      });
    }
  }, [invalidLessonId, navigate, location.pathname]);

  // ✅ Prevent render while redirecting
  if (invalidLessonId) return null;

  /* ============================================================
     Load: Lesson + Teacher class students
  ============================================================ */
  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        setLesson(null);

        // ✅ Lesson info
        const { data: l, error: lErr } = await supabase
          .from("lessons")
          .select("lesson_id, title, duration_minutes, audience, status, created_at, updated_at, subject_id")
          .eq("lesson_id", lessonId)
          .limit(1)
          .maybeSingle();

        if (lErr) throw lErr;
        if (!l) throw new Error("Lesson not found.");

        // ✅ Optional: if lesson is draft, still allow assignment only if you want
        // Here we allow assignment regardless, but show a badge.
        // If you want to block Draft/Archived, uncomment below:
        // if (l.status !== "Published") throw new Error("Only Published lessons can be assigned.");

        // ✅ Teacher user
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const teacherId = auth?.user?.id;
        if (!teacherId) throw new Error("Not signed in.");

        // ✅ Pull teacher students via section_schedules -> section -> students
        // Your DB structure doesn’t have a direct teacher->section table, so we use schedules.

        const { data: schedules, error: schedErr } = await supabase
          .from("section_schedules")
          .select("section_id")
          .eq("teacher_id", teacherId);

        if (schedErr) throw schedErr;

        const sectionIds = Array.from(
          new Set((schedules || []).map((x) => x.section_id).filter(Boolean))
        );

        if (sectionIds.length === 0) {
          // teacher has no schedules -> no students
          if (!alive) return;
          setLesson(l);
          setStudents([]);
          return;
        }

        const { data: studs, error: studsErr } = await supabase
          .from("students")
          .select("id, user_id, student_number, first_name, last_name, email, section_id")
          .in("section_id", sectionIds)
          .order("last_name", { ascending: true });

        if (studsErr) throw studsErr;

        if (!alive) return;
        setLesson(l);
        setStudents(studs || []);
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [lessonId]);

  /* ============================================================
     Filtering
  ============================================================ */
  const filteredStudents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;

    return (students || []).filter((s) => {
      const hay = `${s.student_number || ""} ${s.first_name || ""} ${s.last_name || ""} ${
        s.email || ""
      }`.toLowerCase();
      return hay.includes(needle);
    });
  }, [students, q]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function assignNow() {
    try {
      if (!lesson?.lesson_id) throw new Error("Lesson not loaded.");
      if (selected.size === 0) throw new Error("Select at least 1 student.");

      // ✅ IMPORTANT:
      // You did not provide the table where assignments are saved.
      // So for now, we only show the payload that you should insert.
      //
      // Suggested table name example: lesson_assignments
      // Fields example:
      // - assignment_id uuid
      // - lesson_id uuid
      // - student_id bigint (students.id)
      // - assigned_at timestamp
      // - assigned_by uuid (teacher user_id)
      //
      // You can paste your assignment table schema and I will wire it fully.

      const payload = Array.from(selected).map((studentDbId) => ({
        lesson_id: lesson.lesson_id,
        student_id: studentDbId,
      }));

      console.log("Assign payload:", payload);

      alert(
        `✅ Assignment prepared!\n\nLesson: ${lesson.title}\nStudents selected: ${
          selected.size
        }\n\n(Insert logic not yet wired because assignment table was not provided.)`
      );
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-extrabold">Assign Lesson</div>
          <div className={`mt-1 text-sm ${UI.muted}`}>
            Select students to assign this lesson.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/teacher/lesson-library")}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Lesson Library
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className={`h-px w-full ${UI.border} border-t`} />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock title="Unable to load assignment page" message={error} />
      ) : !lesson ? (
        <ErrorBlock title="Lesson not found" message="This lesson does not exist." />
      ) : (
        <div className="grid gap-4">
          {/* Lesson info */}
          <Card>
            <CardHeader
              title="Lesson Info"
              right={
                <div className="flex gap-2">
                  <Pill tone="outline">{lesson.status}</Pill>
                </div>
              }
            />
            <CardBody>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#6B4E2E]" />
                    <div className="text-lg font-extrabold">{lesson.title}</div>
                  </div>

                  <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${UI.muted}`}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {lesson.duration_minutes} min
                    </span>
                    <span>•</span>
                    <span>{lesson.audience}</span>
                    <span>•</span>
                    <span>Updated: {fmtDateTime(lesson.updated_at)}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Students picker */}
          <Card>
            <CardHeader
              title="Select Students"
              right={
                <Pill tone="outline">
                  Selected: {selected.size}
                </Pill>
              }
            />
            <CardBody>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className={`text-sm ${UI.muted}`}>
                  {students.length} student{students.length === 1 ? "" : "s"} found in your sections.
                </div>

                <div className="w-full md:w-[360px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search student # / name / email..."
                      className="w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/[0.02] text-xs text-black/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Select</th>
                      <th className="px-4 py-3 font-semibold">Student #</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map((s) => {
                      const id = String(s.id);
                      const isChecked = selected.has(id);

                      return (
                        <tr key={id} className="border-t border-black/10 hover:bg-black/[0.01]">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelect(id)}
                              className="h-4 w-4 accent-[#C9A227]"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold">{s.student_number || "-"}</td>
                          <td className="px-4 py-3">
                            {`${s.last_name || ""}, ${s.first_name || ""}`.trim()}
                          </td>
                          <td className="px-4 py-3 text-black/70">{s.email || "-"}</td>
                        </tr>
                      );
                    })}

                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                          No students found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selected.size === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={assignNow}
                  disabled={selected.size === 0}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold text-black hover:opacity-95 disabled:opacity-60 ${UI.goldBg}`}
                >
                  <Send className="h-4 w-4" />
                  Assign Now
                </button>
              </div>

              <div className="mt-3 text-[11px] text-black/55">
                ⚠️ Note: Assignment insert logic is not yet connected because the assignment table schema was not provided.
                If you paste your assignment table schema, I will wire the `insert()` immediately.
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
