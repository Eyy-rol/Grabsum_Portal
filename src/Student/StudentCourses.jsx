// src/pages/student/StudentCourses.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ArrowUpDown,
  BookOpen,
  Users,
  CalendarDays,
  MapPin,
  ChevronRight,
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

export default function StudentCourses() {
  const [q, setQ] = useState("");
  const [filterSemester, setFilterSemester] = useState("All");
  const [filterDay, setFilterDay] = useState("All");
  const [sort, setSort] = useState("A-Z"); // A-Z | Updated | Schedule
  const [selected, setSelected] = useState(null);

  // Demo course data (replace with Supabase later)
  const courses = useMemo(
    () => [
      {
        id: "MATH101",
        name: "General Mathematics",
        teacher: "Mr. Santos",
        grade: "Grade 11",
        section: "STEM-A",
        room: "Room 305",
        schedule: "Mon/Wed/Fri • 10:00 AM",
        dayTags: ["Mon", "Wed", "Fri"],
        semester: "1st Sem",
        lessonsCount: 12,
        updatedAt: "2025-12-18",
        thumbnail: "📘",
        description:
          "Focus on functions, equations, and foundational quantitative reasoning for SHS.",
      },
      {
        id: "ORALCOMM",
        name: "Oral Communication",
        teacher: "Ms. Reyes",
        grade: "Grade 11",
        section: "STEM-A",
        room: "Room 201",
        schedule: "Mon/Wed • 8:00 AM",
        dayTags: ["Mon", "Wed"],
        semester: "1st Sem",
        lessonsCount: 8,
        updatedAt: "2025-12-20",
        thumbnail: "🗣️",
        description:
          "Build confidence and skill in speaking, listening, and effective communication.",
      },
      {
        id: "UCSP",
        name: "Understanding Culture, Society & Politics",
        teacher: "Ms. Dizon",
        grade: "Grade 11",
        section: "STEM-A",
        room: "Room 109",
        schedule: "Tue/Thu • 1:00 PM",
        dayTags: ["Tue", "Thu"],
        semester: "1st Sem",
        lessonsCount: 10,
        updatedAt: "2025-12-17",
        thumbnail: "🌍",
        description:
          "Explore social structures, cultural practices, and civic engagement in society.",
      },
      {
        id: "ENG101",
        name: "Reading & Writing Skills",
        teacher: "Mr. Garcia",
        grade: "Grade 11",
        section: "STEM-A",
        room: "Room 114",
        schedule: "Tue/Thu • 9:30 AM",
        dayTags: ["Tue", "Thu"],
        semester: "1st Sem",
        lessonsCount: 9,
        updatedAt: "2025-12-16",
        thumbnail: "📖",
        description:
          "Develop academic reading strategies and structured writing for school outputs.",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = courses
      .filter((c) => {
        const matchQ =
          !q.trim() ||
          (c.name + " " + c.id + " " + c.teacher).toLowerCase().includes(q.trim().toLowerCase());
        const matchSemester = filterSemester === "All" || c.semester === filterSemester;
        const matchDay = filterDay === "All" || c.dayTags.includes(filterDay);
        return matchQ && matchSemester && matchDay;
      })
      .slice();

    if (sort === "A-Z") s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Updated") s.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (sort === "Schedule") s.sort((a, b) => a.schedule.localeCompare(b.schedule));
    return s;
  }, [courses, q, filterSemester, filterDay, sort]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Courses
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Browse your enrolled subjects • open a course to view lessons
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: BRAND.muted }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search course, code, or teacher…"
                className="w-full rounded-2xl border bg-white/70 py-2 pl-10 pr-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2"
                   style={{ borderColor: BRAND.stroke }}>
                <Filter className="h-4 w-4" style={{ color: BRAND.muted }} />
                <select
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none"
                  style={{ color: BRAND.brown }}
                >
                  <option>All</option>
                  <option>1st Sem</option>
                  <option>2nd Sem</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2"
                   style={{ borderColor: BRAND.stroke }}>
                <CalendarDays className="h-4 w-4" style={{ color: BRAND.muted }} />
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none"
                  style={{ color: BRAND.brown }}
                >
                  <option>All</option>
                  <option>Mon</option>
                  <option>Tue</option>
                  <option>Wed</option>
                  <option>Thu</option>
                  <option>Fri</option>
                </select>
              </div>

              <button
                className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                onClick={() => setSort((s) => (s === "A-Z" ? "Updated" : s === "Updated" ? "Schedule" : "A-Z"))}
                title="Sort"
              >
                <ArrowUpDown className="h-4 w-4" style={{ color: BRAND.muted }} />
                Sort: {sort}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Courses grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSelected(c)}
            className="group text-left rounded-3xl border bg-white p-5 transition"
            style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 place-items-center rounded-2xl"
                  style={{ background: BRAND.softGoldBg }}
                >
                  <span className="text-lg">{c.thumbnail}</span>
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {c.id} • {c.semester}
                  </div>
                  <div className="mt-1 text-base font-extrabold" style={{ color: BRAND.brown }}>
                    {c.name}
                  </div>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 opacity-60 transition group-hover:opacity-100"
                            style={{ color: BRAND.muted }} />
            </div>

            <div className="mt-3 text-sm font-semibold" style={{ color: BRAND.muted }}>
              Teacher: <span style={{ color: BRAND.brown }}>{c.teacher}</span>
            </div>

            <div className="mt-3 grid gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{c.schedule}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{c.room}</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>{c.lessonsCount} Lessons</span>
              </div>
            </div>

            <div className="mt-4 line-clamp-2 text-sm" style={{ color: BRAND.muted }}>
              {c.description}
            </div>

            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold"
              style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
            >
              {c.grade} • {c.section}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Course details modal */}
      <AnimatePresence>
        {selected ? (
          <CourseDetailsModal course={selected} onClose={() => setSelected(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CourseDetailsModal({ course, onClose }) {
  const [tab, setTab] = useState("Lessons"); // Lessons | Announcements | Info
  const [view, setView] = useState("List"); // List | Grid
  const [lessonOpen, setLessonOpen] = useState(null);

  const lessons = useMemo(
    () => [
      {
        id: "L-001",
        title: "Lesson 1 — Introduction",
        topic: "Overview",
        type: "PDF",
        size: "1.2 MB",
        date: "Dec 20, 2025",
        desc: "Introduction to the unit and key outcomes.",
      },
      {
        id: "L-002",
        title: "Lesson 2 — Core Concepts",
        topic: "Unit 1",
        type: "PPTX",
        size: "4.8 MB",
        date: "Dec 18, 2025",
        desc: "Core concepts with guided examples.",
      },
      {
        id: "L-003",
        title: "Worksheet — Practice",
        topic: "Unit 1",
        type: "DOCX",
        size: "780 KB",
        date: "Dec 16, 2025",
        desc: "Practice worksheet for reinforcement.",
      },
    ],
    []
  );

  const announcements = useMemo(
    () => [
      {
        title: "Quiz Reminder",
        date: "Dec 20, 2025 • 9:10 AM",
        preview: "Quiz tomorrow. Please review the last lesson and bring a pen.",
        tag: "Important",
      },
      {
        title: "Seatwork Upload",
        date: "Dec 18, 2025 • 3:30 PM",
        preview: "Seatwork is now available under Lesson 2 resources.",
        tag: "General",
      },
    ],
    []
  );

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={onClose}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 w-[94%] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border bg-white p-5 md:p-6"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{ borderColor: BRAND.stroke, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}
        >
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                <span className="text-lg">{course.thumbnail}</span>
              </div>
              <div>
                <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                  {course.id} • {course.semester}
                </div>
                <div className="mt-1 text-xl font-extrabold" style={{ color: BRAND.brown }}>
                  {course.name}
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.muted }}>
                  Teacher: <span style={{ color: BRAND.brown }}>{course.teacher}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                  <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                        style={{ borderColor: BRAND.stroke }}>
                    <CalendarDays className="h-4 w-4" /> {course.schedule}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                        style={{ borderColor: BRAND.stroke }}>
                    <MapPin className="h-4 w-4" /> {course.room}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                        style={{ borderColor: BRAND.stroke }}>
                    <Users className="h-4 w-4" /> {course.grade} • {course.section}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              Close
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex flex-wrap gap-2">
            {["Lessons", "Announcements", "Info"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: BRAND.stroke,
                  background: tab === t ? BRAND.softGoldBg : "white",
                  color: BRAND.brown,
                }}
              >
                {t}
              </button>
            ))}

            {tab === "Lessons" ? (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setView((v) => (v === "List" ? "Grid" : "List"))}
                  className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                >
                  View: {view}
                </button>
              </div>
            ) : null}
          </div>

          {/* Content */}
          <div className="mt-4">
            {tab === "Lessons" ? (
              <div className={view === "Grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
                {lessons.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLessonOpen(l)}
                    className="w-full rounded-2xl border bg-white p-4 text-left transition hover:bg-black/5"
                    style={{ borderColor: BRAND.stroke }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {l.topic} • {l.date}
                        </div>
                        <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                          {l.title}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                      >
                        {l.type}
                      </span>
                    </div>
                    <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                      {l.desc}
                    </div>
                    <div className="mt-3 text-xs font-semibold" style={{ color: BRAND.muted }}>
                      Size: {l.size}
                    </div>
                  </button>
                ))}
              </div>
            ) : tab === "Announcements" ? (
              <div className="space-y-3">
                {announcements.map((a, idx) => (
                  <div key={idx} className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        {a.title}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                        style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                      >
                        {a.tag}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                      {a.date}
                    </div>
                    <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                      {a.preview}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                  Course Information
                </div>
                <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                  {course.description}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoRow label="Teacher" value={course.teacher} />
                  <InfoRow label="Room" value={course.room} />
                  <InfoRow label="Schedule" value={course.schedule} />
                  <InfoRow label="Section" value={`${course.grade} • ${course.section}`} />
                </div>

                <button
                  className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold transition"
                  style={{
                    background: BRAND.gold,
                    color: BRAND.brown,
                    boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                  onClick={() => alert("Download syllabus (wire later)")}
                >
                  Download Syllabus (Sample)
                </button>
              </div>
            )}
          </div>

          {/* Lesson Viewer Modal */}
          <AnimatePresence>
            {lessonOpen ? (
              <LessonViewer lesson={lessonOpen} onClose={() => setLessonOpen(null)} />
            ) : null}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
        {value}
      </div>
    </div>
  );
}

function LessonViewer({ lesson, onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 w-[94%] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border bg-white p-5 md:p-6"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        style={{ borderColor: BRAND.stroke, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              {lesson.type} • {lesson.size}
            </div>
            <div className="mt-1 text-lg font-extrabold" style={{ color: BRAND.brown }}>
              {lesson.title}
            </div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              {lesson.desc}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            Close
          </button>
        </div>

        <div
          className="mt-5 rounded-2xl border bg-white p-4"
          style={{ borderColor: BRAND.stroke }}
        >
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Preview (UI Only)
          </div>
          <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
            This is a placeholder viewer. When you connect Supabase Storage,
            you can embed:
            <ul className="mt-2 list-disc pl-6">
              <li>PDF viewer</li>
              <li>Video player</li>
              <li>Docs/PPT preview</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <button
            className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => alert("Mark as completed (wire later)")}
          >
            Mark Completed
          </button>
          <button
            className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => alert("Bookmark (wire later)")}
          >
            Bookmark
          </button>
          <button
            className="rounded-2xl py-2 text-sm font-semibold transition"
            style={{
              background: BRAND.gold,
              color: BRAND.brown,
              boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            onClick={() => alert("Download (wire later)")}
          >
            View / Download
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
