// src/Student/Lessons/lesson.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronLeft, Clock, GraduationCap, Info, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

/* =========================================================
   UI helpers (simple + Tailwind)
========================================================= */

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldSoft: "bg-[#C9A227]/10",
};

function PageShell({ title, subtitle, right, children }) {
  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-extrabold">{title}</div>
          {subtitle ? <div className={`mt-1 text-sm ${UI.muted}`}>{subtitle}</div> : null}
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>

      <div className={`h-px w-full ${UI.border} border-t`} />
      {children}
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

  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Card({ children }) {
  return <div className={`rounded-2xl border ${UI.border} ${UI.panel}`}>{children}</div>;
}

function CardHeader({ children }) {
  return <div className={`border-b ${UI.border} px-4 py-3`}>{children}</div>;
}

function CardBody({ children }) {
  return <div className="px-4 py-4">{children}</div>;
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

function LoadingList({ rows = 6 }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-[84px] rounded-2xl border ${UI.border} bg-black/[0.02] animate-pulse`} />
      ))}
    </div>
  );
}

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso || "");
  }
}

function termLabel(term) {
  if (!term) return "";
  const d = String(term.description || "").trim();
  return d ? `${term.term_code} • ${d}` : term.term_code;
}

/**
 * ✅ Two semesters always mean EXACTLY 2 terms:
 * Prefer explicit "First" + "Second" when present, else take first 2.
 */
function pickTwoTerms(groups) {
  const norm = (s) => String(s || "").toLowerCase();
  const isFirst = (g) =>
    /\b(1st|first)\b/.test(norm(g.term?.term_code)) || /first/.test(norm(g.term?.description));
  const isSecond = (g) =>
    /\b(2nd|second)\b/.test(norm(g.term?.term_code)) || /second/.test(norm(g.term?.description));

  const first = (groups || []).find(isFirst);
  const second = (groups || []).find(isSecond);

  if (first && second) return [first, second];
  return (groups || []).slice(0, 2);
}

/* =========================================================
   Data helpers (JS only — NO TypeScript)
========================================================= */

async function requireAuthedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Not signed in");
  return data.user.id;
}

async function fetchActiveSchoolYear() {
  const { data, error } = await supabase
    .from("school_years")
    .select("sy_id, sy_code, start_date, end_date, status")
    .eq("status", "Active")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No active school year found.");
  return data;
}

async function fetchStudentForUser(userId) {
  const { data, error } = await supabase
    .from("students")
    .select("user_id, section_id, grade_id, track_id, strand_id, sy_id, student_number")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Student record not found for this account.");
  return data;
}

async function fetchSubjectsByTerm({ syId, sectionId }) {
  const { data, error } = await supabase
    .from("section_schedules")
    .select(
      `term_id,
       subject_id,
       terms:term_id (term_id, term_code, description),
       subjects:subject_id (subject_id, subject_code, subject_title, subject_type, units)`
    )
    .eq("sy_id", syId)
    .eq("section_id", sectionId);

  if (error) throw error;

  const byTerm = new Map();

  (data || []).forEach((row) => {
    const term = row.terms;
    const subj = row.subjects;
    if (!term || !subj) return;

    const bucket =
      byTerm.get(term.term_id) || {
        term,
        subjects: new Map(),
      };

    bucket.subjects.set(subj.subject_id, subj);
    byTerm.set(term.term_id, bucket);
  });

  const result = Array.from(byTerm.values())
    .map((x) => ({ term: x.term, subjects: Array.from(x.subjects.values()) }))
    .sort((a, b) => String(a.term.term_code || "").localeCompare(String(b.term.term_code || "")));

  result.forEach((t) => {
    t.subjects.sort((a, b) => String(a.subject_code || "").localeCompare(String(b.subject_code || "")));
  });

  return result;
}

/**
 * ✅ Students can see only published lessons
 * ✅ Additionally, enforce optional grade/track/strand constraints
 */
async function fetchLessonsForSubject({ subjectId, student }) {
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "lesson_id, title, duration_minutes, audience, status, created_at, updated_at, objectives, grade_id, track_id, strand_id, subject_id"
    )
    .eq("subject_id", subjectId)
    .eq("status", "Published")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = data || [];

  return rows.filter((l) => {
    if (l.grade_id && l.grade_id !== student.grade_id) return false;
    if (l.track_id && l.track_id !== student.track_id) return false;
    if (l.strand_id && l.strand_id !== student.strand_id) return false;
    return true;
  });
}

async function fetchLessonWithParts(lessonId) {
  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .select(
      "lesson_id, title, duration_minutes, audience, status, created_at, updated_at, objectives, grade_id, track_id, strand_id, subject_id"
    )
    .eq("lesson_id", lessonId)
    .limit(1)
    .maybeSingle();

  if (lErr) throw lErr;
  if (!lesson) throw new Error("Lesson not found.");

  // ✅ Students should only see Published
  if (lesson.status !== "Published") throw new Error("This lesson is not available.");

  const { data: parts, error: pErr } = await supabase
    .from("lesson_parts")
    .select("part_id, lesson_id, sort_order, part_type, title, body, is_collapsed")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (pErr) throw pErr;

  return { lesson, parts: parts || [] };
}

/* =========================================================
   PAGE 1: Subjects
   Route: /student/subjects
   ✅ Back -> Dashboard
========================================================= */

export function StudentSubjectsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sy, setSy] = useState(null);
  const [student, setStudent] = useState(null);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = await requireAuthedUserId();
        const [activeSy, st] = await Promise.all([fetchActiveSchoolYear(), fetchStudentForUser(userId)]);

        if (st.sy_id !== activeSy.sy_id) {
          throw new Error(
            `Your enrollment is linked to a different school year (student.sy_id=${st.sy_id}). Active SY is ${activeSy.sy_code}.`
          );
        }

        if (!st.section_id) {
          throw new Error("Your student profile has no section assigned yet. Please contact your adviser or registrar.");
        }

        const subjGroups = await fetchSubjectsByTerm({ syId: activeSy.sy_id, sectionId: st.section_id });

        // ✅ exactly 2 terms
        const two = pickTwoTerms(subjGroups);

        if (!mounted) return;
        setSy(activeSy);
        setStudent(st);
        setGroups(two);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PageShell
      title="My Subjects"
      subtitle={
        sy ? `Active School Year: ${sy.sy_code} (${sy.start_date} to ${sy.end_date})` : "Subjects for the active school year"
      }
      right={
        <>
          <button
            type="button"
            onClick={() => navigate("/student/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
            title="Back to dashboard"
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </button>

          <Pill>
            <GraduationCap className="mr-1 h-3.5 w-3.5" />
            Student
          </Pill>

          {student?.student_number ? <Pill tone="outline">{student.student_number}</Pill> : null}
        </>
      }
    >
      {loading ? (
        <LoadingList />
      ) : error ? (
        <ErrorBlock title="Unable to load subjects" message={error} />
      ) : groups.length === 0 ? (
        <ErrorBlock title="No subjects found" message="No schedules were found for your section in the active school year." />
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <Card key={g.term.term_id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#6B4E2E]" />
                  <div className="text-sm font-extrabold">{termLabel(g.term)}</div>
                  <div className="ml-auto">
                    <Pill tone="outline">
                      {g.subjects.length} subject{g.subjects.length === 1 ? "" : "s"}
                    </Pill>
                  </div>
                </div>
              </CardHeader>

              <CardBody>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.subjects.map((s) => (
                    <Link key={s.subject_id} to={`/student/subjects/${s.subject_id}/lessons?termId=${g.term.term_id}`}>
                      <div className="rounded-2xl border border-black/10 p-4 transition hover:bg-black/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold truncate">{s.subject_code}</div>
                            <div className={`mt-1 text-sm ${UI.muted}`}>{s.subject_title}</div>
                          </div>
                          <Pill tone="outline">{s.subject_type}</Pill>
                        </div>
                        <div className={`mt-3 text-xs ${UI.muted}`}>Units: {s.units}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

/* =========================================================
   PAGE 2: Lessons per Subject
   Route: /student/subjects/:subjectId/lessons?termId=...
   ✅ Back -> Subjects list
========================================================= */

export function StudentSubjectLessonsPage() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const termId = searchParams.get("termId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [student, setStudent] = useState(null);
  const [subject, setSubject] = useState(null);
  const [term, setTerm] = useState(null);
  const [lessons, setLessons] = useState([]);

  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return lessons;
    return lessons.filter((l) => String(l.title || "").toLowerCase().includes(needle));
  }, [lessons, q]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!subjectId) throw new Error("Missing subject id.");

        setLoading(true);
        setError(null);

        const userId = await requireAuthedUserId();
        const st = await fetchStudentForUser(userId);
        if (!mounted) return;
        setStudent(st);

        const [subjRes, termRes] = await Promise.all([
          supabase
            .from("subjects")
            .select("subject_id, subject_code, subject_title, subject_type, units")
            .eq("subject_id", subjectId)
            .limit(1)
            .maybeSingle(),
          termId
            ? supabase.from("terms").select("term_id, term_code, description").eq("term_id", termId).limit(1).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (subjRes.error) throw subjRes.error;
        if (!subjRes.data) throw new Error("Subject not found.");
        if (termRes.error) throw termRes.error;

        if (!mounted) return;
        setSubject(subjRes.data);
        setTerm(termRes.data || null);

        const ls = await fetchLessonsForSubject({ subjectId, student: st });
        if (!mounted) return;
        setLessons(ls);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [subjectId, termId]);

  return (
    <PageShell
      title={subject ? `${subject.subject_code} Lessons` : "Lessons"}
      subtitle={
        subject ? `${subject.subject_title}${term ? ` • ${termLabel(term)}` : ""}` : "Published lessons for this subject"
      }
      right={
        <button
          type="button"
          onClick={() => navigate("/student/subjects")}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
          title="Back to subjects"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to subjects
        </button>
      }
    >
      {loading ? (
        <LoadingList />
      ) : error ? (
        <ErrorBlock title="Unable to load lessons" message={error} />
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className={`text-sm ${UI.muted}`}>
                  {lessons.length} published lesson{lessons.length === 1 ? "" : "s"}
                </div>

                <div className="w-full md:w-[360px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search lessons..."
                      className="w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                    />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {filtered.length === 0 ? (
            <ErrorBlock
              title="No lessons to show"
              message={q.trim() ? "No lessons match your search." : "There are no published lessons yet for this subject."}
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((l) => {
                // ✅ Lesson Detail should go back to Lesson List
                const href = `/student/lessons/${l.lesson_id}?subjectId=${subjectId}${termId ? `&termId=${termId}` : ""}`;

                return (
                  <Link key={l.lesson_id} to={href}>
                    <Card>
                      <div className="px-4 py-4 hover:bg-black/[0.02] transition">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold truncate">{l.title}</div>
                            <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${UI.muted}`}>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {l.duration_minutes} min
                              </span>
                              <span>•</span>
                              <span>{l.audience}</span>
                              <span>•</span>
                              <span>Updated: {fmtDateTime(l.updated_at)}</span>
                            </div>
                          </div>
                          <Pill>Published</Pill>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

/* =========================================================
   PAGE 3: Lesson details
   Route: /student/lessons/:lessonId
   ✅ Back -> Lesson list (for that subject)
========================================================= */

export function StudentLessonDetailPage() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const subjectId = searchParams.get("subjectId");
  const termId = searchParams.get("termId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [parts, setParts] = useState([]);
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!lessonId) throw new Error("Missing lesson id.");

        setLoading(true);
        setError(null);

        await requireAuthedUserId();

        const { lesson: l, parts: p } = await fetchLessonWithParts(lessonId);

        if (l.subject_id) {
          const { data, error: sErr } = await supabase
            .from("subjects")
            .select("subject_id, subject_code, subject_title, subject_type, units")
            .eq("subject_id", l.subject_id)
            .limit(1)
            .maybeSingle();

          if (sErr) throw sErr;
          if (mounted) setSubject(data || null);
        }

        if (!mounted) return;
        setLesson(l);
        setParts(p);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [lessonId]);

  const openedByDefault = useMemo(() => (parts || []).filter((p) => !p.is_collapsed).map((p) => p.part_id), [parts]);
  const [openSet, setOpenSet] = useState(new Set());

  useEffect(() => {
    setOpenSet(new Set(openedByDefault));
  }, [openedByDefault]);

  function togglePart(id) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ✅ Lesson detail back to lessons list (stable)
  const backHref = subjectId ? `/student/subjects/${subjectId}/lessons${termId ? `?termId=${termId}` : ""}` : null;

  return (
    <PageShell
      title={lesson ? lesson.title : "Lesson"}
      subtitle={subject ? `${subject.subject_code} • ${subject.subject_title}` : "Lesson details"}
      right={
        backHref ? (
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
            title="Back to lesson list"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to lessons
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/student/subjects")}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02]"
            title="Back to subjects"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to subjects
          </button>
        )
      }
    >
      {loading ? (
        <LoadingList rows={3} />
      ) : error ? (
        <ErrorBlock title="Unable to load lesson" message={error} />
      ) : !lesson ? (
        <ErrorBlock title="Lesson not found" message="The lesson does not exist." />
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${UI.muted}`}>Lesson</div>
                  <div className="mt-1 text-lg font-extrabold">{lesson.title}</div>

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

                <div className="flex gap-2">
                  <Pill>Published</Pill>
                  {subject?.subject_type ? <Pill tone="outline">{subject.subject_type}</Pill> : null}
                </div>
              </div>

              {Array.isArray(lesson.objectives) && lesson.objectives.length ? (
                <div className="mt-4">
                  <div className="text-sm font-extrabold">Objectives</div>
                  <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${UI.muted}`}>
                    {lesson.objectives.map((o, idx) => (
                      <li key={idx}>{String(o || "").replace(/^\s*-\s*/, "")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-extrabold">Lesson Parts</div>
            </CardHeader>
            <CardBody>
              {parts.length === 0 ? (
                <div className={`text-sm ${UI.muted}`}>No lesson parts have been added yet.</div>
              ) : (
                <div className="grid gap-3">
                  {parts.map((p) => {
                    const isOpen = openSet.has(p.part_id);

                    return (
                      <div key={p.part_id} className="rounded-2xl border border-black/10 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => togglePart(p.part_id)}
                          className="w-full px-4 py-3 text-left hover:bg-black/[0.02]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold">{p.title}</div>
                              <div className={`mt-1 text-xs ${UI.muted}`}>
                                {p.part_type} • Order {p.sort_order}
                              </div>
                            </div>
                            <Pill tone="outline">{p.part_type}</Pill>
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="px-4 pb-4">
                            {p.body ? (
                              <div className={`whitespace-pre-wrap text-sm ${UI.text}`}>{p.body}</div>
                            ) : (
                              <div className={`text-sm ${UI.muted}`}>No content.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
