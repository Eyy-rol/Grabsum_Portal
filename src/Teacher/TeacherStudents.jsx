import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, User, Mail, Phone, GraduationCap, BookOpen, BarChart3 } from "lucide-react";
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

const TERM_CODES = ["1st Sem", "2nd Sem"];

function Modal({ open, title, onClose, children, width = "max-w-4xl" }) {
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

export default function TeacherStudents() {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("All");     // subject_code
  const [grade, setGrade] = useState("All"); // "Grade 11" / "Grade 12"
  const [termCode, setTermCode] = useState("1st Sem");

  const [activeSY, setActiveSY] = useState(null); // { sy_id, sy_code }
  const [term, setTerm] = useState(null);         // { term_id, term_code }

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [rows, setRows] = useState([]);           // normalized students
  const [subjectOptions, setSubjectOptions] = useState(["All"]); // from teacher schedules
  const [gradeOptions, setGradeOptions] = useState(["All", "Grade 11", "Grade 12"]);

  const [selected, setSelected] = useState(null);

  // ---- Load Active School Year
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) { setErr(error.message); return; }
      if (!data?.sy_id) { setErr("No Active school year found."); return; }

      setActiveSY({ sy_id: data.sy_id, sy_code: data.sy_code });
    })();
    return () => { alive = false; };
  }, []);

  // ---- Load selected term
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .from("terms")
        .select("term_id, term_code")
        .eq("term_code", termCode)
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) { setErr(error.message); return; }
      if (!data?.term_id) { setErr(`Term not found: ${termCode}`); return; }

      setTerm(data);
    })();
    return () => { alive = false; };
  }, [termCode]);

  // ---- Main loader: teacher schedules -> sections -> students in those sections
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!activeSY?.sy_id || !term?.term_id) return;

      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const uid = authData?.user?.id;

      if (authErr) { setErr(authErr.message); setLoading(false); return; }
      if (!uid) { setErr("Not authenticated."); setLoading(false); return; }

      // 1) Fetch teacher's schedules for this SY+term
      const { data: sched, error: schedErr } = await supabase
        .from("section_schedules")
        .select(`
          schedule_id,
          section_id,
          subject_id,
          sections:section_id(section_id, section_name, grade_id, strand_id),
          subjects:subject_id(subject_id, subject_code)
        `)
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", term.term_id)
        .eq("teacher_id", uid);

      if (!alive) return;
      if (schedErr) { setErr(schedErr.message); setLoading(false); return; }

      const schedules = sched ?? [];

      // Teacher may have no schedules
      const sectionIds = Array.from(new Set(schedules.map((r) => r.section_id).filter(Boolean)));
      const taughtSubjects = Array.from(
        new Set(schedules.map((r) => r.subjects?.subject_code).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setSubjectOptions(["All", ...taughtSubjects]);

      if (sectionIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Students in those sections
      // NOTE: your students table uses "status" (Enrolled/Pending/Approved/Rejected)
      // You said: enrolled depending on strand and grade level — so we default to Enrolled only.
      const { data: studs, error: studsErr } = await supabase
        .from("students")
        .select(`
          id,
          student_number,
          first_name,
          last_name,
          email,
          status,
          section_id,
          grade_id,
          strand_id,
          sections:section_id(section_id, section_name),
          grade_levels:grade_id(grade_level)
        `)
        .in("section_id", sectionIds)
        .eq("status", "Enrolled");

      if (!alive) return;
      if (studsErr) { setErr(studsErr.message); setLoading(false); return; }

      const students = studs ?? [];

      // Build: per student -> which subject codes does this teacher teach in that student’s section?
      const sectionToSubjectCodes = new Map(); // section_id -> Set(subject_code)
      for (const r of schedules) {
        const sid = r.section_id;
        const code = r.subjects?.subject_code;
        if (!sid || !code) continue;
        if (!sectionToSubjectCodes.has(sid)) sectionToSubjectCodes.set(sid, new Set());
        sectionToSubjectCodes.get(sid).add(code);
      }

      const normalized = students.map((s) => {
        const fullName = `${s.last_name ?? ""}, ${s.first_name ?? ""}`.replace(/^,\s*/, "").trim();
        const g = s.grade_levels?.grade_level ? `Grade ${s.grade_levels.grade_level}` : "—";
        const secName = s.sections?.section_name ?? "—";
        const classes = Array.from(sectionToSubjectCodes.get(s.section_id) ?? []).sort((a, b) => a.localeCompare(b));

        // avg is not in DB; keep UI field but null
        return {
          id: s.student_number ?? String(s.id),
          rowId: s.id,
          name: fullName || "Unnamed Student",
          email: s.email ?? "—",
          grade: g,
          section: secName,
          classes,
          avg: null,
        };
      });

      // grade dropdown values from data (optional dynamic)
      const gradeSet = new Set(normalized.map((x) => x.grade).filter((x) => x !== "—"));
      const gradeOpts = ["All", ...Array.from(gradeSet).sort((a, b) => a.localeCompare(b))];
      setGradeOptions(gradeOpts.length ? gradeOpts : ["All", "Grade 11", "Grade 12"]);

      setRows(normalized);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [activeSY?.sy_id, term?.term_id]);

  const filtered = useMemo(() => {
    return rows.filter((s) => {
      const okQ = (s.name + " " + s.id + " " + s.section).toLowerCase().includes(q.toLowerCase());
      const okC = cls === "All" ? true : s.classes.includes(cls);
      const okG = grade === "All" ? true : s.grade === grade;
      return okQ && okC && okG;
    });
  }, [rows, q, cls, grade]);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Students
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Directory across your assigned sections
              {activeSY?.sy_code ? ` • SY ${activeSY.sy_code}` : ""}
              {termCode ? ` • ${termCode}` : ""}
            </div>
            {err ? <div className="mt-2 text-xs font-semibold text-red-600">Error: {err}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={termCode}
              onChange={(e) => setTermCode(e.target.value)}
              className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {TERM_CODES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              {loading ? "Loading…" : `${filtered.length} student(s)`}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_240px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search student name / ID / section…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <select
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {subjectOptions.map((x) => (
                <option key={x} value={x}>
                  Class: {x}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {gradeOptions.map((x) => (
                <option key={x} value={x}>
                  Grade: {x}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        {!loading && filtered.length === 0 ? (
          <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>No students found</div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              (Check if you have section_schedules for this SY/term, and students are Enrolled in those sections.)
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <button
                key={s.rowId}
                onClick={() => setSelected(s)}
                className="rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-[1px]"
                style={{ borderColor: BRAND.stroke }}
                disabled={loading}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                      <User className="h-6 w-6" style={{ color: BRAND.muted }} />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        {s.name}
                      </div>
                      <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {s.id} • {s.section}
                      </div>
                    </div>
                  </div>

                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                    style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                  >
                    {s.avg == null ? "Avg —" : `Avg ${s.avg}`}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {s.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {s.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" /> {s.grade}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(s.classes ?? []).length ? (
                    s.classes.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border px-3 py-1 text-[11px] font-extrabold"
                        style={{ borderColor: BRAND.stroke, color: BRAND.muted }}
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                      No subject codes (check section_schedules joins)
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <Modal open={!!selected} title={selected ? selected.name : ""} onClose={() => setSelected(null)} width="max-w-5xl">
        {selected ? <StudentProfileView s={selected} /> : null}
      </Modal>
    </div>
  );
}

function StudentProfileView({ s }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
            <User className="h-7 w-7" style={{ color: BRAND.muted }} />
          </div>
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              {s.name}
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              {s.id} • {s.grade} • {s.section}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm" style={{ color: BRAND.muted }}>
          <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {s.email}</div>
          <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {s.phone}</div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-2">
          <button
            className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
            style={{ background: BRAND.gold, color: BRAND.brown }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            onClick={() => alert("Message student (optional later)")}
          >
            Message
          </button>
          <button
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => alert("View submissions (optional later)")}
          >
            View Submissions
          </button>
        </div>
      </div>

      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Academic Overview
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Stat icon={BookOpen} label="Classes" value={(s.classes ?? []).length} />
          <Stat icon={BarChart3} label="Average" value={s.avg ?? "—"} />
        </div>

        <div className="mt-4 rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Enrolled Classes (teacher-taught subjects)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(s.classes ?? []).length ? (
              s.classes.map((c) => (
                <span key={c} className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                      style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
                  {c}
                </span>
              ))
            ) : (
              <span className="text-sm" style={{ color: BRAND.muted }}>—</span>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Notes (UI)
          </div>
          <textarea
            className="mt-2 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            rows={4}
            placeholder="Private notes about this student (optional later)…"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
          <Icon className="h-5 w-5" style={{ color: BRAND.muted }} />
        </div>
        <div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>{label}</div>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{value}</div>
        </div>
      </div>
    </div>
  );
}
