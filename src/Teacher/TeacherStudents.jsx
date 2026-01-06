// src/pages/teacher/TeacherStudents.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Mail, Phone, GraduationCap, ChevronRight, Pencil, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

function CardShell({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border bg-white ${className}`}
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      {children}
    </div>
  );
}

function Modal({ open, title, onClose, children, width = "max-w-5xl" }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative mx-auto mt-10 w-[92%] ${width}`}
          >
            <div className="rounded-3xl border bg-white p-5" style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{title}</div>
                <button
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                  style={{ borderColor: BRAND.stroke }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" style={{ color: BRAND.muted }} />
                </button>
              </div>
              <div className="mt-4">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
      {children}
    </span>
  );
}

export default function TeacherStudents() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [teacherId, setTeacherId] = useState(null);

  const [sections, setSections] = useState([]); // {section_id, section_name, student_count, isAdvisory}
  const [selectedSectionId, setSelectedSectionId] = useState(null);

  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);

  const advisorySectionId = useMemo(() => {
    const adv = sections.find((s) => s.isAdvisory);
    return adv?.section_id || null;
  }, [sections]);

  const canEditThisSection = useMemo(() => {
    if (!selectedSectionId) return false;
    return advisorySectionId && selectedSectionId === advisorySectionId;
  }, [selectedSectionId, advisorySectionId]);

  // Load sections teacher can see:
  // - sections where teacher is adviser (advisory)
  // - sections where teacher teaches (section_schedules.teacher_id)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const uid = authData?.user?.id;

      if (authErr) { setErr(authErr.message); setLoading(false); return; }
      if (!uid) { setErr("Not authenticated."); setLoading(false); return; }

      setTeacherId(uid);

      // advisory section
      const { data: advisorySec, error: advErr } = await supabase
        .from("sections")
        .select("section_id, section_name, is_archived")
        .eq("adviser_id", uid)
        .eq("is_archived", false)
        .maybeSingle();

      if (!alive) return;
      if (advErr) { setErr(advErr.message); setLoading(false); return; }

      const advisoryId = advisorySec?.section_id || null;

      // taught sections via schedules
      const { data: taughtRows, error: taughtErr } = await supabase
        .from("section_schedules")
        .select("section_id")
        .eq("teacher_id", uid);

      if (!alive) return;
      if (taughtErr) { setErr(taughtErr.message); setLoading(false); return; }

      const taughtSectionIds = Array.from(new Set((taughtRows || []).map((r) => r.section_id).filter(Boolean)));
      const allSectionIds = Array.from(new Set([...(taughtSectionIds || []), ...(advisoryId ? [advisoryId] : [])]));

      if (!allSectionIds.length) {
        setSections([]);
        setSelectedSectionId(null);
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: sectionRows, error: secErr } = await supabase
        .from("sections")
        .select("section_id, section_name, is_archived")
        .in("section_id", allSectionIds)
        .eq("is_archived", false)
        .order("section_name", { ascending: true });

      if (!alive) return;
      if (secErr) { setErr(secErr.message); setLoading(false); return; }

      // count students per section (Enrolled)
      const { data: countRows, error: cntErr } = await supabase
        .from("students")
        .select("section_id, id")
        .in("section_id", allSectionIds)
        .eq("status", "Enrolled");

      if (!alive) return;
      if (cntErr) { setErr(cntErr.message); setLoading(false); return; }

      const counts = new Map();
      for (const r of countRows || []) {
        counts.set(r.section_id, (counts.get(r.section_id) || 0) + 1);
      }

      const normalizedSections = (sectionRows || []).map((s) => ({
        section_id: s.section_id,
        section_name: s.section_name,
        student_count: counts.get(s.section_id) || 0,
        isAdvisory: advisoryId ? s.section_id === advisoryId : false,
      }));

      setSections(normalizedSections);

      // default pick: advisory else first
      setSelectedSectionId((prev) => prev || advisoryId || normalizedSections[0]?.section_id || null);

      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  // Load students for selected section
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedSectionId) return;

      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          student_number,
          first_name,
          last_name,
          middle_initial,
          extension,
          gender,
          birthdate,
          email,
          status,
          section_id,
          grade_levels:grade_id(grade_level),
          sections:section_id(section_id, section_name)
        `)
        .eq("section_id", selectedSectionId)
        .eq("status", "Enrolled")
        .order("last_name", { ascending: true });

      if (!alive) return;
      if (error) { setErr(error.message); setLoading(false); return; }

      const normalized = (data || []).map((s) => {
        const fullName = `${s.last_name ?? ""}, ${s.first_name ?? ""}`.replace(/^,\s*/, "").trim();
        const g = s.grade_levels?.grade_level ? `Grade ${s.grade_levels.grade_level}` : "—";
        const secName = s.sections?.section_name ?? "—";
        return {
          rowId: s.id,
          student_number: s.student_number ?? "",
          name: fullName || "Unnamed Student",
          first_name: s.first_name ?? "",
          last_name: s.last_name ?? "",
          middle_initial: s.middle_initial ?? "",
          extension: s.extension ?? "",
          gender: s.gender ?? "",
          birthdate: s.birthdate ?? "",
          email: s.email ?? "",
       
          grade: g,
          section: secName,
          section_id: s.section_id,
        };
      });

      setStudents(normalized);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [selectedSectionId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return students;
    return students.filter((s) => (s.name + " " + s.student_number).toLowerCase().includes(qq));
  }, [students, q]);

  const selectedSection = useMemo(
    () => sections.find((s) => s.section_id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  return (
    <div className="space-y-5">
      {/* Top header */}
      <CardShell>
        <div className="p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                Students
              </div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Select a section to view students • Edit only for advisory section
              </div>

              {selectedSection?.isAdvisory ? (
                <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  This is your <span style={{ color: BRAND.brown, fontWeight: 800 }}>Advisory</span> section. Editing is enabled.
                </div>
              ) : (
                <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  {sections.some((s) => s.isAdvisory)
                    ? "Read-only (not your advisory section)."
                    : "You have no advisory section assigned. Read-only."}
                </div>
              )}

              {err ? <div className="mt-2 text-xs font-semibold text-red-600">Error: {err}</div> : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-[360px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search student name / student no…"
                  className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                />
              </div>
              <div className="text-xs font-semibold whitespace-nowrap" style={{ color: BRAND.muted }}>
                {loading ? "Loading…" : `${filtered.length} student(s)`}
              </div>
            </div>
          </div>
        </div>
      </CardShell>

      {/* Main layout: Section list + Students */}
      <div className="grid gap-5 xl:grid-cols-[0.42fr_0.58fr]">
        {/* Section list */}
        <CardShell>
          <div className="p-5">
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Sections
            </div>
            <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
              Your advisory + the sections you teach
            </div>

            <div className="mt-4 space-y-3">
              {!sections.length && !loading ? (
                <div className="rounded-3xl border p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                  No sections assigned.
                </div>
              ) : (
                sections.map((sec) => {
                  const active = sec.section_id === selectedSectionId;
                  return (
                    <button
                      key={sec.section_id}
                      onClick={() => setSelectedSectionId(sec.section_id)}
                      className="w-full rounded-3xl border bg-white p-4 text-left transition hover:bg-black/5"
                      style={{
                        borderColor: active ? "rgba(212,166,47,0.55)" : BRAND.stroke,
                        background: active ? "rgba(212,166,47,0.10)" : "white",
                      }}
                      disabled={loading}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate" style={{ color: BRAND.brown }}>
                            {sec.section_name}
                          </div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                            {sec.student_count} student(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {sec.isAdvisory ? <Pill>Advisory</Pill> : <Pill>Read</Pill>}
                          <ChevronRight className="h-4 w-4" style={{ color: BRAND.muted }} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </CardShell>

        {/* Students list */}
        <CardShell>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold truncate" style={{ color: BRAND.brown }}>
                  {selectedSection ? selectedSection.section_name : "Students"}
                </div>
                <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  {selectedSection ? `${selectedSection.student_count} enrolled student(s)` : "Select a section"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEditThisSection ? <Pill>Editable</Pill> : <Pill>Read-only</Pill>}
              </div>
            </div>

            <div className="mt-4">
              {!loading && filtered.length === 0 ? (
                <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>No students found</div>
                  <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                    Try a different section or search.
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((s) => (
                    <button
                      key={s.rowId}
                      onClick={() => setSelectedStudent(s)}
                      className="rounded-3xl border bg-white p-4 text-left transition hover:-translate-y-[1px]"
                      style={{ borderColor: BRAND.stroke }}
                      disabled={loading}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                            <User className="h-6 w-6" style={{ color: BRAND.muted }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold truncate" style={{ color: BRAND.brown }}>
                              {s.name}
                            </div>
                            <div className="mt-1 text-xs font-semibold truncate" style={{ color: BRAND.muted }}>
                              {s.student_number || "—"} • {s.grade}
                            </div>
                          </div>
                        </div>
                        {canEditThisSection ? <Pill>Edit</Pill> : <Pill>View</Pill>}
                      </div>

                      <div className="mt-3 space-y-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" /> {s.email || "—"}
                        </div>
                       
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> {s.section}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardShell>
      </div>

      <Modal
        open={!!selectedStudent}
        title={selectedStudent ? selectedStudent.name : ""}
        onClose={() => setSelectedStudent(null)}
      >
        {selectedStudent ? (
          <StudentProfileView
            student={selectedStudent}
            canEdit={!!canEditThisSection}
            onSaved={(updated) => {
              setStudents((prev) => prev.map((p) => (p.rowId === updated.rowId ? updated : p)));
              setSelectedStudent(updated);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function StudentProfileView({ student, canEdit, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState(() => ({
    first_name: student.first_name || "",
    last_name: student.last_name || "",
    middle_initial: student.middle_initial || "",
    extension: student.extension || "",
    gender: student.gender || "",
    birthdate: student.birthdate || "",
    email: student.email || "",
  
  }));

  useEffect(() => {
    setEdit(false);
    setMsg("");
    setForm({
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      middle_initial: student.middle_initial || "",
      extension: student.extension || "",
      gender: student.gender || "",
      birthdate: student.birthdate || "",
      email: student.email || "",

    });
  }, [student.rowId]);

  const fullName = `${form.last_name}, ${form.first_name}`.replace(/^,\s*/, "").trim() || "Unnamed Student";

  async function save() {
    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("students")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        middle_initial: form.middle_initial || null,
        extension: form.extension || null,
        gender: form.gender || null,
        birthdate: form.birthdate || null,
        email: form.email || null,
       
      })
      .eq("id", student.rowId);

    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEdit(false);
    setMsg("Saved.");
    setTimeout(() => setMsg(""), 1200);

    onSaved?.({
      ...student,
      name: fullName,
      ...form,
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
              <User className="h-7 w-7" style={{ color: BRAND.muted }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold truncate" style={{ color: BRAND.brown }}>
                {fullName}
              </div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                {student.student_number || "—"} • {student.grade} • {student.section}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!canEdit ? <Pill>Read-only</Pill> : null}
            {canEdit ? (
              <button
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                onClick={() => setEdit((v) => !v)}
              >
                <Pencil className="h-4 w-4" />
                {edit ? "Stop Editing" : "Edit"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <Field label="First name" value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} disabled={!canEdit || !edit} />
          <Field label="Last name" value={form.last_name} onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} disabled={!canEdit || !edit} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Middle initial" value={form.middle_initial} onChange={(v) => setForm((p) => ({ ...p, middle_initial: v }))} disabled={!canEdit || !edit} />
            <Field label="Extension" value={form.extension} onChange={(v) => setForm((p) => ({ ...p, extension: v }))} disabled={!canEdit || !edit} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Gender" value={form.gender} onChange={(v) => setForm((p) => ({ ...p, gender: v }))} disabled={!canEdit || !edit} placeholder="Male/Female/..." />
            <Field label="Birthdate" type="date" value={form.birthdate} onChange={(v) => setForm((p) => ({ ...p, birthdate: v }))} disabled={!canEdit || !edit} />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} disabled={!canEdit || !edit} />
        

          {canEdit && edit ? (
            <button
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition"
              style={{ background: BRAND.gold, color: BRAND.brown, opacity: saving ? 0.7 : 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
              onClick={save}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          ) : null}

          {msg ? (
            <div className="mt-2 text-xs font-semibold" style={{ color: msg === "Saved." ? "green" : "red" }}>
              {msg}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Notes / Extras (later)
        </div>
        <div className="mt-2 text-sm font-semibold" style={{ color: BRAND.muted }}>
          You can add submissions, grades, etc. once there’s a table that links students to class/subject.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, placeholder, type = "text" }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white disabled:opacity-70"
        style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
      />
    </label>
  );
}
