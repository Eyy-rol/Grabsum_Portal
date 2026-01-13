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
  Plus,
  Save,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";
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

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
};

const TERM_CODES = ["1st Sem", "2nd Sem"];
const DEFAULT_TERM_CODE = "1st Sem";
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTimeHHMM(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}

function buildGroupedScheduleLabel(scheduleRows) {
  if (!scheduleRows?.length) return "—";

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
  const [termRow, setTermRow] = useState(null); // { term_id, term_code }
  const [classes, setClasses] = useState([]);

  const days = useMemo(() => ["All", ...DAY_ORDER], []);

  // ---- Load active school year
  useEffect(() => {
    let alive = true;

    (async () => {
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
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ---- Load termRow (term_id) whenever termCode changes
  useEffect(() => {
    let alive = true;

    async function loadTerm() {
      if (!termCode) return;

      setErr(null);

      const { data, error } = await supabase
        .from("terms")
        .select("term_id, term_code")
        .eq("term_code", termCode)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (alive) setErr(error.message);
        return;
      }
      if (!data?.term_id) {
        if (alive) setErr(`Term not found: ${termCode}`);
        return;
      }

      if (alive) setTermRow(data);
    }

    loadTerm();
    return () => {
      alive = false;
    };
  }, [termCode]);

  // ---- Load teacher classes from section_schedules ONLY (SY + Term)
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!activeSY?.sy_id || !termRow?.term_id) return;

      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;

      if (authErr) {
        if (alive) setErr(authErr.message);
        if (alive) setLoading(false);
        return;
      }
      if (!user) {
        if (alive) setErr("Not authenticated.");
        if (alive) setLoading(false);
        return;
      }

      // 1) schedule rows (join subjects + sections + grade_levels + strands)
      const { data: schedRows, error: schedErr } = await supabase
        .from("section_schedules")
        .select(
          `
          schedule_id,
          sy_id,
          term_id,
          section_id,
          subject_id,
          teacher_id,
          day_of_week,
          period_no,
          start_time,
          end_time,
          room,
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
            grade_levels:grade_id ( grade_level ),
            strands:strand_id ( strand_code )
          )
        `
        )
        .eq("teacher_id", user.id)
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", termRow.term_id);

      if (schedErr) {
        if (alive) setErr(schedErr.message);
        if (alive) setLoading(false);
        return;
      }

      const sched = schedRows || [];
      if (!sched.length) {
        if (alive) setClasses([]);
        if (alive) setLoading(false);
        return;
      }

      // 2) student counts per section (roster count) in active SY
      const sectionIds = Array.from(
        new Set(sched.map((r) => r.section_id).filter(Boolean))
      );

      const { data: studRows, error: studErr } = await supabase
        .from("students")
        .select("section_id")
        .eq("sy_id", activeSY.sy_id)
        .in("section_id", sectionIds);

      if (studErr) {
        // non-fatal
        console.warn("students count fetch error:", studErr.message);
      }

      const studentCountBySection = new Map();
      (studRows || []).forEach((s) => {
        if (!s.section_id) return;
        studentCountBySection.set(
          s.section_id,
          (studentCountBySection.get(s.section_id) || 0) + 1
        );
      });

      // 3) group schedule rows into unique "class cards" by section_id + subject_id
      const schedulesByKey = new Map();
      for (const r of sched) {
        const k = `${r.section_id}:${r.subject_id}`;
        if (!schedulesByKey.has(k)) schedulesByKey.set(k, []);
        schedulesByKey.get(k).push(r);
      }

      const mapped = Array.from(schedulesByKey.entries()).map(([k, rows]) => {
        const anyRow = rows[0];
        const sec = anyRow.sections;
        const subj = anyRow.subjects;

        const gradeLevel = sec?.grade_levels?.grade_level;
        const gradeLabel = gradeLevel ? `Grade ${gradeLevel}` : "—";
        const strandCode = sec?.strands?.strand_code ?? "—";

        return {
          id: k, // composite key
          code: subj?.subject_code ?? "—",
          subject: subj?.subject_title ?? "—",
          strand: strandCode,
          grade: gradeLabel,
          section: sec?.section_name ?? "—",
          schedule: buildGroupedScheduleLabel(rows),
          room: anyRow.room ?? "—",
          students: studentCountBySection.get(anyRow.section_id) ?? 0,
          year: activeSY?.sy_code ?? "—",
          semester: termCode,
          _schedules: rows,
          _section_id: anyRow.section_id,
          _subject_id: anyRow.subject_id,
          _term_id: termRow.term_id,
          _sy_id: activeSY.sy_id,
        };
      });

      if (alive) setClasses(mapped);
      if (alive) setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [activeSY?.sy_id, termRow?.term_id, termCode]);

  // Filter options
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
      if (sort === "Schedule")
        return (a.schedule ?? "").localeCompare(b.schedule ?? "");
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
            <div
              className="text-sm font-extrabold"
              style={{ color: BRAND.brown }}
            >
              My Classes
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Derived from <code>section_schedules</code>
              {activeSY?.sy_code ? ` • SY ${activeSY.sy_code}` : ""}
              {termCode ? ` • ${termCode}` : ""}
            </div>
            {err ? (
              <div className="mt-2 text-xs font-semibold text-red-600">
                Error: {err}
              </div>
            ) : null}
          </div>

          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {loading ? "Loading…" : `${filtered.length} class(es)`}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_160px_160px_160px]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: BRAND.muted }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by subject, section, strand…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <Select
            value={grade}
            onChange={setGrade}
            icon={Filter}
            options={grades}
            label="Grade"
          />
          <Select
            value={subject}
            onChange={setSubject}
            icon={Filter}
            options={subjects}
            label="Subject"
          />
          <Select
            value={day}
            onChange={setDay}
            icon={Filter}
            options={["All", ...DAY_ORDER]}
            label="Day"
          />

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
        {!loading && filtered.length === 0 ? (
          <div
            className="rounded-3xl border p-6 text-center"
            style={{ borderColor: BRAND.stroke }}
          >
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              No classes found
            </div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              Make sure teacher has rows in <code>section_schedules</code> for this
              SY + Term.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-3xl border bg-white p-5 transition hover:-translate-y-[1px]"
                style={{ borderColor: BRAND.stroke }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className="text-sm font-extrabold"
                      style={{ color: BRAND.brown }}
                    >
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
                    onClick={() => setSelected({ ...c, _openTab: "Announcements" })}
                    className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                    style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                  >
                    Post Announcement
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <Modal
        open={!!selected}
        title={selected ? `${selected.subject} • ${selected.code}` : ""}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <ClassDetailsTabs
            c={selected}
            defaultTab={selected._openTab || "Overview"}
            sy={activeSY}
            term={termRow}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ClassDetailsTabs({ c, defaultTab, sy, term }) {
  const [tab, setTab] = useState(defaultTab || "Overview");

  const tabs = [
    { key: "Overview", icon: ClipboardList },
    { key: "Students", icon: Users },
    { key: "Announcements", icon: Megaphone },
    { key: "Schedule", icon: CalendarDays },
    { key: "Lessons", icon: BookOpen },
    { key: "Grades", icon: BarChart3 },
  ];

  useEffect(() => {
    setTab(defaultTab || "Overview");
  }, [defaultTab]);

  return (
    <div className="space-y-4">
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
            <OverviewPanel c={c} sy={sy} term={term} />
          ) : tab === "Students" ? (
            <StudentsPanel c={c} sy={sy} />
          ) : tab === "Announcements" ? (
            <AnnouncementsPanel c={c} sy={sy} term={term} />
          ) : tab === "Schedule" ? (
            <SchedulePanel c={c} />
          ) : tab === "Lessons" ? (
            <Placeholder title="Lessons" note="No lessons table wired yet." />
          ) : (
            <Placeholder title="Grades" note="No grades table wired yet." />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Placeholder({ title, note }) {
  return (
    <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        {title}
      </div>
      <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
        {note}
      </div>
    </div>
  );
}

function OverviewPanel({ c, sy, term }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        Overview
      </div>
      <div className="text-sm font-semibold" style={{ color: BRAND.muted }}>
        SY: <span style={{ color: BRAND.brown }}>{sy?.sy_code || "—"}</span> • Term:{" "}
        <span style={{ color: BRAND.brown }}>{term?.term_code || "—"}</span>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="text-xs font-extrabold" style={{ color: BRAND.brown }}>
          Internal identifiers
        </div>
        <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
          <div>section_id: {c._section_id}</div>
          <div>subject_id: {c._subject_id}</div>
          <div>term_id: {c._term_id}</div>
          <div>sy_id: {c._sy_id}</div>
        </div>
      </div>
    </div>
  );
}

function SchedulePanel({ c }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        Schedule Slots
      </div>

      {!c._schedules || c._schedules.length === 0 ? (
        <div className="text-sm font-semibold" style={{ color: BRAND.muted }}>
          No schedule rows found.
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
                    DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week) ||
                    a.period_no - b.period_no
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
  );
}

function StudentsPanel({ c, sy }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        if (!sy?.sy_id) throw new Error("Missing active school year.");
        if (!c?._section_id) throw new Error("Missing section_id.");

        // NOTE: if your students table has more fields, add them here.
        const { data, error } = await supabase
          .from("students")
          .select("id, user_id, student_number, section_id, sy_id")
          .eq("sy_id", sy.sy_id)
          .eq("section_id", c._section_id)
          .order("student_number", { ascending: true });

        if (error) throw error;

        if (alive) setRows(data || []);
      } catch (e) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [c?._section_id, sy?.sy_id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Students
        </div>
        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
          {loading ? "Loading…" : `${rows.length} student(s)`}
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm font-semibold" style={{ color: BRAND.muted }}>
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
          No students found in this section.
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border" style={{ borderColor: BRAND.stroke }}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: BRAND.stroke }}>
                <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                  Student #
                </th>
                <th className="px-4 py-3 font-extrabold" style={{ color: BRAND.brown }}>
                  user_id
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b" style={{ borderColor: BRAND.stroke }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: BRAND.muted }}>
                    {s.student_number || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: BRAND.muted }}>
                    {s.user_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnnouncementsPanel({ c, sy, term }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "Medium",
    target_audience: "Section Students", // default for class context
    status: "Published",
  });

  function patch(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function load() {
    setLoading(true);
    setErr("");

    try {
      if (!sy?.sy_id) throw new Error("Missing active school year.");
      if (!term?.term_id) throw new Error("Missing term.");
      if (!c?._section_id) throw new Error("Missing section_id.");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) throw new Error("Not authenticated.");

      // Teacher's announcements for this class context
      // - Scope: SY + term + section
      const { data, error } = await supabase
        .from("announcements")
        .select(
          `
          id,
          title,
          content,
          priority,
          target_audience,
          status,
          is_archived,
          posted_at,
          posted_by,
          posted_by_role,
          posted_by_teacher_id,
          sy_id,
          term_id,
          section_id
        `
        )
        .eq("sy_id", sy.sy_id)
        .eq("term_id", term.term_id)
        .eq("section_id", c._section_id)
        .eq("posted_by", user.id)
        .eq("is_archived", false)
        .order("posted_at", { ascending: false });

      if (error) throw error;

      setItems(data || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?._section_id, sy?.sy_id, term?.term_id]);

  async function post() {
    setPosting(true);
    setErr("");

    try {
      if (!sy?.sy_id) throw new Error("Missing active school year.");
      if (!term?.term_id) throw new Error("Missing term.");
      if (!c?._section_id) throw new Error("Missing section_id.");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) throw new Error("Not authenticated.");

      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.content.trim()) throw new Error("Content is required.");

      // ✅ IMPORTANT: set posted_by_role + posted_by_teacher_id so StudentAnnouncements can filter correctly
      const payload = {
        posted_by: user.id,
        posted_by_role: "teacher",
        posted_by_teacher_id: user.id,

        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        target_audience: form.target_audience,
        status: form.status,
        is_archived: false,

        sy_id: sy.sy_id,
        term_id: term.term_id,

        // Class context:
        // - Section Students: needs section_id
        // - My Students: keep section_id null (optional)
        section_id: form.target_audience === "Section Students" ? c._section_id : null,
      };

      const { error } = await supabase.from("announcements").insert(payload);
      if (error) throw error;

      setForm((s) => ({ ...s, title: "", content: "" }));
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Announcements
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-extrabold hover:bg-black/5"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          disabled={loading || posting}
        >
          <RefreshCcw className="h-4 w-4" style={{ color: BRAND.muted }} />
          Refresh
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {err}
          </div>
        </div>
      ) : null}

      {/* Create */}
      <div className="rounded-3xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Title
            </div>
            <input
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              placeholder="e.g., Quiz tomorrow"
              disabled={posting}
            />
          </div>

          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Priority
            </div>
            <select
              value={form.priority}
              onChange={(e) => patch("priority", e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              disabled={posting}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Status
            </div>
            <select
              value={form.status}
              onChange={(e) => patch("status", e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              disabled={posting}
            >
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Audience
            </div>
            <select
              value={form.target_audience}
              onChange={(e) => patch("target_audience", e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              disabled={posting}
            >
              <option value="Section Students">Section Students</option>
              <option value="My Students">My Students</option>
            </select>

            <div className="mt-2 text-[11px] font-semibold" style={{ color: BRAND.muted }}>
              Note: “Section Students” will attach section_id = this class section. “My Students” will not.
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Content
            </div>
            <textarea
              value={form.content}
              onChange={(e) => patch("content", e.target.value)}
              className="mt-1 h-28 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              placeholder="Write the announcement…"
              disabled={posting}
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              onClick={post}
              disabled={posting}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold transition"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            >
              <Plus className="h-4 w-4" />
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm font-semibold" style={{ color: BRAND.muted }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
            No announcements yet for this class section.
          </div>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              className="rounded-3xl border bg-white p-4"
              style={{ borderColor: BRAND.stroke }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                    {a.title}
                  </div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    {a.status} • {a.priority} • {a.target_audience} •{" "}
                    {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
                  </div>
                </div>
                <Chip>{sy?.sy_code || "SY"}</Chip>
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm" style={{ color: "rgba(0,0,0,0.68)" }}>
                {a.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
