// src/pages/teacher/TeacherClasses.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Megaphone,
  BarChart3,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient"; // ✅ you said: src/lib/supabaseClient.js

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
};

const TERM_CODES = ["1st Sem", "2nd Sem"];
const DEFAULT_TERM_CODE = "1st Sem";

function formatTimeHHMM(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5); // "HH:MM"
}

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Option 1: "Mon/Wed • 1:00 PM" (we'll do 24h unless you want AM/PM later)
function buildGroupedScheduleLabel(scheduleRows) {
  if (!scheduleRows?.length) return "—";

  // key: "HH:MM-HH:MM" -> Set(days)
  const map = new Map();
  for (const r of scheduleRows) {
    const start = formatTimeHHMM(r.start_time);
    const end = formatTimeHHMM(r.end_time);
    if (!start || !end) continue;
    const key = `${start}-${end}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(r.day_of_week);
  }

  const parts = [];
  for (const [timeRange, daysSet] of map.entries()) {
    const days = Array.from(daysSet).sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
    );
    parts.push(`${days.join("/")} • ${timeRange}`);
  }

  // Stable sort
  parts.sort((a, b) => a.localeCompare(b));
  return parts.join(" | ");
}

function Modal({ open, title, onClose, children, width = "max-w-4xl" }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative mx-auto mt-10 w-[92%] ${width}`}
          >
            <div
              className="rounded-3xl border bg-white p-5"
              style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="text-sm font-extrabold"
                  style={{ color: BRAND.brown }}
                >
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
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
      style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
    >
      {children}
    </span>
  );
}

function Select({ value, onChange, options, label, icon: Icon, renderOption }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: BRAND.muted }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
        style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : `${label}: ${o}`}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TeacherClasses() {
  // UI filters
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("All");
  const [subject, setSubject] = useState("All");
  const [day, setDay] = useState("All");
  const [termCode, setTermCode] = useState(DEFAULT_TERM_CODE);
  const [sort, setSort] = useState("Name");
  const [selected, setSelected] = useState(null);

  // Data
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeSY, setActiveSY] = useState(null); // { sy_id, sy_code }
  const [classes, setClasses] = useState([]);

  // Static options
  const days = useMemo(() => ["All", ...DAY_ORDER], []);

  // Load active school year once
  useEffect(() => {
    let alive = true;

    async function loadActiveSY() {
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (alive) setErr(authErr.message);
        return;
      }
      if (!authData?.user) {
        if (alive) setErr("Not authenticated.");
        return;
      }

      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (alive) setErr(error.message);
        return;
      }
      if (!data?.sy_id) {
        if (alive) setErr("No Active school year found.");
        return;
      }

      if (alive) setActiveSY({ sy_id: data.sy_id, sy_code: data.sy_code });
    }

    loadActiveSY();
    return () => {
      alive = false;
    };
  }, []);

  // Load classes whenever active SY or term changes
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!activeSY?.sy_id || !termCode) return;

      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (alive) setErr(authErr.message);
        if (alive) setLoading(false);
        return;
      }
      const user = authData?.user;
      if (!user) {
        if (alive) setErr("Not authenticated.");
        if (alive) setLoading(false);
        return;
      }

      // term_id from term_code
      const { data: termRow, error: termErr } = await supabase
        .from("terms")
        .select("term_id, term_code")
        .eq("term_code", termCode)
        .limit(1)
        .maybeSingle();

      if (termErr) {
        if (alive) setErr(termErr.message);
        if (alive) setLoading(false);
        return;
      }
      if (!termRow?.term_id) {
        if (alive) setErr(`Term not found: ${termCode}`);
        if (alive) setLoading(false);
        return;
      }

      // 1) classes + joins (grade + strand through sections)
      const { data: rows, error } = await supabase
        .from("classes")
        .select(
          `
          class_id,
          class_code,
          subject_id,
          section_id,
          sy_id,
          term_id,
          room,
          notes,
          is_archived,
          teacher_user_id,
          subjects:subject_id (
            subject_id,
            subject_code,
            subject_title
          ),
          sections:section_id (
            section_id,
            section_name,
            grade_id,
            strand_id,
            grade_levels:grade_id (
              grade_id,
              grade_level
            ),
            strands:strand_id (
              strand_id,
              strand_code
            )
          ),
          school_years:sy_id (
            sy_id,
            sy_code,
            status
          ),
          terms:term_id (
            term_id,
            term_code
          )
        `
        )
        .eq("teacher_user_id", user.id)
        .eq("is_archived", false)
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", termRow.term_id);

      if (error) {
        if (alive) setErr(error.message);
        if (alive) setLoading(false);
        return;
      }

      const classList = rows ?? [];
      const sectionIds = Array.from(
        new Set(classList.map((r) => r.section_id).filter(Boolean))
      );

      // 2) schedules: teacher slot + active sy + term
      const { data: schedRows, error: schedErr } = await supabase
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
          subject_id,
          teacher_id,
          room
        `
        )
        .in("section_id", sectionIds)
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", termRow.term_id)
        .eq("teacher_id", user.id);

      if (schedErr) {
        // not fatal
        console.warn("schedule fetch error:", schedErr.message);
      }

      // 3) students: Enrolled only
      const { data: studentRows, error: studErr } = await supabase
        .from("students")
        .select("section_id, status, grade_id, strand_id")
        .in("section_id", sectionIds)
        .eq("status", "Enrolled");

      if (studErr) {
        console.warn("students fetch error:", studErr.message);
      }

      // Rule B: enrolled AND matches section grade_id AND (if section has strand_id) matches strand_id
      const enrolledCountBySection = new Map();
      for (const s of studentRows ?? []) {
        if (!s.section_id) continue;
        enrolledCountBySection.set(
          s.section_id,
          (enrolledCountBySection.get(s.section_id) ?? 0) + 1
        );
      }

      // For Rule B we need section metadata, so compute per class during mapping with filtering
      const mapped = classList.map((r) => {
        const subj = r.subjects;
        const sec = r.sections;
        const sy = r.school_years;
        const term = r.terms;

        const relatedSched = (schedRows ?? []).filter(
          (x) =>
            x.section_id === r.section_id &&
            x.sy_id === r.sy_id &&
            x.term_id === r.term_id &&
            x.subject_id === r.subject_id
        );

        const scheduleLabel = buildGroupedScheduleLabel(relatedSched);

        const gradeLevel = sec?.grade_levels?.grade_level;
        const gradeLabel = gradeLevel ? `Grade ${gradeLevel}` : "—";
        const strandCode = sec?.strands?.strand_code ?? "—";

        // Rule B student counting:
        // enrolled AND section match, plus grade match, plus strand match if section.strand_id is not null
        const secGradeId = sec?.grade_id ?? null;
        const secStrandId = sec?.strand_id ?? null;

        const enrolledInThisSection = (studentRows ?? []).filter((s) => {
          if (s.section_id !== r.section_id) return false;
          if (secGradeId && s.grade_id && s.grade_id !== secGradeId) return false;
          if (secStrandId) {
            // if section requires a strand, student must match it
            if (!s.strand_id) return false;
            if (s.strand_id !== secStrandId) return false;
          }
          return true;
        }).length;

        return {
          id: r.class_id,
          code: subj?.subject_code ?? r.class_code,
          subject: subj?.subject_title ?? r.class_code,
          strand: strandCode,
          grade: gradeLabel,
          section: sec?.section_name ?? "—",
          schedule: scheduleLabel,
          room: r.room ?? (relatedSched?.[0]?.room ?? "—"),
          students: enrolledInThisSection ?? enrolledCountBySection.get(r.section_id) ?? 0,
          year: sy?.sy_code ?? activeSY.sy_code ?? "—",
          semester: term?.term_code ?? termCode,
          desc: r.notes ?? "—",
          objectives: [],
          _raw: r,
          _schedules: relatedSched,
        };
      });

      if (alive) setClasses(mapped);
      if (alive) setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [activeSY?.sy_id, termCode]);

  // Filter options from fetched classes
  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(classes.map((c) => c.code)))],
    [classes]
  );
  const grades = useMemo(
    () => ["All", ...Array.from(new Set(classes.map((c) => c.grade)))],
    [classes]
  );

  const filtered = useMemo(() => {
    let list = classes.filter((c) => {
      const okQ = (c.subject + " " + c.code + " " + c.section + " " + c.strand)
        .toLowerCase()
        .includes(q.toLowerCase());

      const okG = grade === "All" ? true : c.grade === grade;
      const okS = subject === "All" ? true : c.code === subject;

      const okD =
        day === "All"
          ? true
          : (c._schedules?.some((s) => s.day_of_week === day) ?? false);

      return okQ && okG && okS && okD;
    });

    list.sort((a, b) => {
      if (sort === "Name") return a.subject.localeCompare(b.subject);
      if (sort === "Schedule") return (a.schedule ?? "").localeCompare(b.schedule ?? "");
      if (sort === "Student Count") return (b.students ?? 0) - (a.students ?? 0);
      return 0;
    });

    return list;
  }, [classes, q, grade, subject, day, sort]);

  return (
    <div className="space-y-5">
      <motion.div
        {...fadeUp}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              My Classes
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              View and manage your assigned classes
              {activeSY?.sy_code ? ` • SY ${activeSY.sy_code}` : ""}
              {termCode ? ` • ${termCode}` : ""}
            </div>
            {err ? (
              <div className="mt-2 text-xs font-semibold text-red-600">Error: {err}</div>
            ) : null}
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {loading ? "Loading…" : `${filtered.length} class(es)`}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_160px_160px_160px]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: BRAND.muted }}
            />
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

          {/* ✅ Term combobox (1st/2nd sem) */}
          <Select
            value={termCode}
            onChange={setTermCode}
            icon={Filter}
            options={TERM_CODES}
            label="Term"
            renderOption={(v) => `Term: ${v}`}
          />

          <Select
            value={sort}
            onChange={setSort}
            icon={Filter}
            options={["Name", "Schedule", "Student Count"]}
            label="Sort"
          />
        </div>
      </motion.div>

      <motion.div
        {...fadeUp}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
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

      <Modal
        open={!!selected}
        title={selected ? `${selected.subject} • ${selected.code}` : ""}
        onClose={() => setSelected(null)}
      >
        {selected ? <ClassDetailsTabs c={selected} /> : null}
      </Modal>
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
              {c.objectives?.length ? (
                <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: BRAND.muted }}>
                  {c.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                  —
                </div>
              )}

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
          ) : tab === "Schedule" ? (
            <div className="space-y-3">
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                Schedule Slots
              </div>

              {!c._schedules || c._schedules.length === 0 ? (
                <div className="text-sm font-semibold" style={{ color: BRAND.muted }}>
                  No schedule rows found for this class.
                </div>
              ) : (
                <div className="overflow-auto rounded-2xl border" style={{ borderColor: BRAND.stroke }}>
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: BRAND.stroke }}>
                        <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                          Day
                        </th>
                        <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                          Period
                        </th>
                        <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                          Time
                        </th>
                        <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                          Room
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {c._schedules
                        .slice()
                        .sort(
                          (a, b) =>
                            (DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)) ||
                            (a.period_no - b.period_no)
                        )
                        .map((s) => (
                          <tr key={s.schedule_id} className="border-b" style={{ borderColor: BRAND.stroke }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: BRAND.muted }}>
                              {s.day_of_week}
                            </td>
                            <td className="px-4 py-3 font-semibold" style={{ color: BRAND.muted }}>
                              {s.period_no}
                            </td>
                            <td className="px-4 py-3 font-semibold" style={{ color: BRAND.muted }}>
                              {formatTimeHHMM(s.start_time)}–{formatTimeHHMM(s.end_time)}
                            </td>
                            <td className="px-4 py-3 font-semibold" style={{ color: BRAND.muted }}>
                              {s.room ?? "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <EmptyState title="UI Ready" desc="This tab is ready to be wired." />
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
