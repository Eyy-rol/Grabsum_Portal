// src/pages/teacher/TeacherClasses.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Users,
  CalendarDays,
  MapPin,
  BookOpen,
  GraduationCap,
  X,
  ClipboardList,
  FileText,
  Megaphone,
  BarChart3,
} from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18 } };

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
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                  {title}
                </div>
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

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
          style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
      {children}
    </span>
  );
}

export default function TeacherClasses() {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("All");
  const [subject, setSubject] = useState("All");
  const [day, setDay] = useState("All");
  const [sort, setSort] = useState("Name");
  const [selected, setSelected] = useState(null);

  const classes = useMemo(
    () => [
      {
        id: "CLS-UCSP-11A",
        code: "UCSP",
        subject: "Understanding Culture, Society and Politics",
        strand: "STEM",
        grade: "Grade 11",
        section: "11-A",
        schedule: "Mon/Wed • 1:00 PM",
        day: "Mon",
        room: "Room 109",
        students: 38,
        year: "2025–2026",
        semester: "1st Sem",
        desc: "A foundational UCSP course for senior high school learners.",
        objectives: ["Critical thinking", "Community understanding", "Social analysis"],
      },
      {
        id: "CLS-MATH-11B",
        code: "MATH101",
        subject: "General Mathematics",
        strand: "ABM",
        grade: "Grade 11",
        section: "11-B",
        schedule: "Tue/Thu • 10:00 AM",
        day: "Tue",
        room: "Room 305",
        students: 42,
        year: "2025–2026",
        semester: "1st Sem",
        desc: "Core mathematical concepts including functions, relations, and problem-solving.",
        objectives: ["Functions mastery", "Real-world applications", "Problem solving"],
      },
      {
        id: "CLS-ORAL-11C",
        code: "ORALCOMM",
        subject: "Oral Communication",
        strand: "HUMSS",
        grade: "Grade 11",
        section: "11-C",
        schedule: "Mon/Fri • 8:00 AM",
        day: "Fri",
        room: "Room 201",
        students: 36,
        year: "2025–2026",
        semester: "1st Sem",
        desc: "Develops communication confidence, speech delivery, and presentation skills.",
        objectives: ["Speaking confidence", "Speech structure", "Audience engagement"],
      },
    ],
    []
  );

  const subjects = useMemo(() => ["All", ...Array.from(new Set(classes.map((c) => c.code)))], [classes]);
  const grades = useMemo(() => ["All", ...Array.from(new Set(classes.map((c) => c.grade)))], [classes]);
  const days = useMemo(() => ["All", "Mon", "Tue", "Wed", "Thu", "Fri"], []);

  const filtered = useMemo(() => {
    let list = classes.filter((c) => {
      const okQ = (c.subject + " " + c.code + " " + c.section + " " + c.strand).toLowerCase().includes(q.toLowerCase());
      const okG = grade === "All" ? true : c.grade === grade;
      const okS = subject === "All" ? true : c.code === subject;
      const okD = day === "All" ? true : c.schedule.includes(day);
      return okQ && okG && okS && okD;
    });

    list.sort((a, b) => {
      if (sort === "Name") return a.subject.localeCompare(b.subject);
      if (sort === "Schedule") return a.schedule.localeCompare(b.schedule);
      if (sort === "Student Count") return b.students - a.students;
      return 0;
    });

    return list;
  }, [classes, q, grade, subject, day, sort]);

  return (
    <div className="space-y-5">
      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              My Classes
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              View and manage your assigned classes
            </div>
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {filtered.length} class(es)
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by class, subject, strand…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <Select value={grade} onChange={setGrade} icon={Filter} options={grades} label="Grade" />
          <Select value={subject} onChange={setSubject} icon={Filter} options={subjects} label="Subject" />
          <Select value={day} onChange={setDay} icon={Filter} options={days} label="Day" />
          <Select
            value={sort}
            onChange={setSort}
            icon={Filter}
            options={["Name", "Schedule", "Student Count"]}
            label="Sort"
          />
        </div>
      </motion.div>

      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl border bg-white p-5 transition hover:-translate-y-[1px]"
              style={{ borderColor: BRAND.stroke }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                    {c.subject}
                  </div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {c.code} • {c.grade} {c.section} • {c.strand}
                  </div>
                </div>
                <Chip>{c.year}</Chip>
              </div>

              <div className="mt-4 grid gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>{c.schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{c.room}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{c.students} students</span>
                </div>
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-2">
                <button
                  onClick={() => setSelected(c)}
                  className="rounded-2xl px-4 py-2 text-sm font-semibold transition"
                  style={{ background: BRAND.gold, color: BRAND.brown }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                >
                  View Class
                </button>
                <button
                  onClick={() => alert("Upload lesson (navigate to lessons + modal)")}
                  className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                >
                  Upload Lesson
                </button>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <button
                  onClick={() => alert("View Students (wire to route)")}
                  className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                >
                  View Students
                </button>
                <button
                  onClick={() => alert("Post Announcement (wire later)")}
                  className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                >
                  Post Announcement
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <Modal open={!!selected} title={selected ? `${selected.subject} • ${selected.code}` : ""} onClose={() => setSelected(null)}>
        {selected ? <ClassDetailsTabs c={selected} /> : null}
      </Modal>
    </div>
  );
}

function Select({ value, onChange, options, label, icon: Icon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
        style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {label}: {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ClassDetailsTabs({ c }) {
  const [tab, setTab] = useState("Overview");

  const tabs = [
    { key: "Overview", icon: ClipboardList },
    { key: "Lessons", icon: BookOpen },
    { key: "Students", icon: Users },
    { key: "Grades", icon: BarChart3 },
    { key: "Announcements", icon: Megaphone },
    { key: "Schedule", icon: CalendarDays },
  ];

  return (
    <div className="space-y-4">
      {/* Class header */}
      <div className="rounded-3xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              {c.subject}
            </div>
            <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
              {c.code} • {c.grade} {c.section} • {c.strand}
            </div>

            <div className="mt-3 grid gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> {c.schedule}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {c.room}
              </div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> {c.year} • {c.semester}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" /> {c.students} students
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const Active = tab === t.key;
              const I = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition"
                  style={{
                    borderColor: BRAND.stroke,
                    background: Active ? BRAND.softGoldBg : "white",
                    color: BRAND.brown,
                  }}
                >
                  <I className="h-4 w-4" style={{ color: BRAND.muted }} />
                  {t.key}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          className="rounded-3xl border bg-white p-4"
          style={{ borderColor: BRAND.stroke }}
        >
          {tab === "Overview" ? (
            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                Class Description
              </div>
              <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                {c.desc}
              </div>

              <div className="mt-4 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                Learning Objectives
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: BRAND.muted }}>
                {c.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <button
                  className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={{ background: BRAND.gold, color: BRAND.brown }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                  onClick={() => alert("Download syllabus (wire later)")}
                >
                  Download Syllabus
                </button>
                <button
                  className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                  onClick={() => alert("View recent activity (wire later)")}
                >
                  View Recent Activity
                </button>
              </div>
            </div>
          ) : tab === "Lessons" ? (
            <EmptyState title="Lessons Tab UI Ready" desc="List uploaded lessons for this class here." />
          ) : tab === "Students" ? (
            <EmptyState title="Students Tab UI Ready" desc="Show student list, performance, attendance, contact." />
          ) : tab === "Grades" ? (
            <EmptyState title="Grades Tab UI Ready" desc="Gradebook table + analytics can go here." />
          ) : tab === "Announcements" ? (
            <EmptyState title="Class Announcements UI Ready" desc="Post announcements and list history here." />
          ) : (
            <EmptyState title="Class Schedule UI Ready" desc="Show schedule pattern and special dates here." />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ title, desc }) {
  return (
    <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        {title}
      </div>
      <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
        {desc}
      </div>
      <div className="mt-4 text-xs font-semibold" style={{ color: BRAND.muted }}>
        (Wire with Supabase tables later.)
      </div>
    </div>
  );
}
