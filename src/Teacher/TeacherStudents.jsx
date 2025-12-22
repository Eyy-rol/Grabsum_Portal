// src/pages/teacher/TeacherStudents.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, User, Mail, Phone, GraduationCap, BookOpen, BarChart3 } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

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
  const [cls, setCls] = useState("All");
  const [grade, setGrade] = useState("All");
  const [selected, setSelected] = useState(null);

  const students = useMemo(
    () => [
      { id: "S-1001", name: "Juan Dela Cruz", email: "juan@grabsum.edu.ph", phone: "09xx-xxx-xxxx", grade: "Grade 11", section: "STEM 11-A", classes: ["UCSP", "MATH101"], avg: 89 },
      { id: "S-1002", name: "Maria Santos", email: "maria@grabsum.edu.ph", phone: "09xx-xxx-xxxx", grade: "Grade 11", section: "ABM 11-B", classes: ["MATH101"], avg: 92 },
      { id: "S-1003", name: "Anne Reyes", email: "anne@grabsum.edu.ph", phone: "09xx-xxx-xxxx", grade: "Grade 11", section: "HUMSS 11-C", classes: ["ORALCOMM"], avg: 86 },
      { id: "S-1004", name: "Paul Garcia", email: "paul@grabsum.edu.ph", phone: "09xx-xxx-xxxx", grade: "Grade 12", section: "STEM 12-A", classes: ["RES101"], avg: 90 },
    ],
    []
  );

  const classOptions = useMemo(() => ["All", "UCSP", "MATH101", "ORALCOMM", "RES101"], []);
  const gradeOptions = useMemo(() => ["All", "Grade 11", "Grade 12"], []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const okQ = (s.name + " " + s.id + " " + s.section).toLowerCase().includes(q.toLowerCase());
      const okC = cls === "All" ? true : s.classes.includes(cls);
      const okG = grade === "All" ? true : s.grade === grade;
      return okQ && okC && okG;
    });
  }, [students, q, cls, grade]);

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
              Directory across your assigned classes
            </div>
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {filtered.length} student(s)
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
              {classOptions.map((x) => (
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-[1px]"
              style={{ borderColor: BRAND.stroke }}
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
                <span className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                      style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
                  Avg {s.avg}
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
                {s.classes.map((c) => (
                  <span key={c} className="rounded-full border px-3 py-1 text-[11px] font-extrabold"
                        style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                    {c}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
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
          <Stat icon={BookOpen} label="Classes" value={s.classes.length} />
          <Stat icon={BarChart3} label="Average" value={s.avg} />
        </div>

        <div className="mt-4 rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Enrolled Classes
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.classes.map((c) => (
              <span key={c} className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                    style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
                {c}
              </span>
            ))}
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
