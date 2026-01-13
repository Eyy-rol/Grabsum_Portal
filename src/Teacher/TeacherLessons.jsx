// src/pages/teacher/TeacherLessons.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  Search,
  Filter,
  X,
  FileText,
  FileVideo,
  FileImage,
  FileArchive,
  Presentation,
  Tag,
  Download,
  Pencil,
  Trash2,
  Eye,
  Clipboard,
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

function Modal({ open, title, onClose, children, width = "max-w-2xl" }) {
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

function fileIcon(type) {
  if (type === "PDF" || type === "DOCX") return FileText;
  if (type === "PPTX") return Presentation;
  if (type === "MP4") return FileVideo;
  if (type === "IMG") return FileImage;
  if (type === "ZIP") return FileArchive;
  return FileText;
}

export default function TeacherLessons() {
  const [view, setView] = useState("grid"); // grid|list
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [tag, setTag] = useState("All");
  const [openUpload, setOpenUpload] = useState(false);
  const [openAI, setOpenAI] = useState(false);

  const lessons = useMemo(
    () => [
      {
        id: "L-001",
        title: "Introduction to UCSP",
        className: "UCSP • STEM 11-A",
        date: "2025-12-18",
        type: "PDF",
        size: "1.2 MB",
        views: 48,
        tags: ["Unit 1", "Lecture"],
      },
      {
        id: "L-002",
        title: "General Mathematics — Functions",
        className: "MATH101 • ABM 11-B",
        date: "2025-12-17",
        type: "PPTX",
        size: "4.6 MB",
        views: 72,
        tags: ["Functions", "Presentation"],
      },
      {
        id: "L-003",
        title: "Oral Communication — Activity Sheets",
        className: "ORALCOMM • HUMSS 11-C",
        date: "2025-12-14",
        type: "ZIP",
        size: "8.1 MB",
        views: 31,
        tags: ["Worksheets", "Activity"],
      },
      {
        id: "L-004",
        title: "Video Lesson: Research Basics",
        className: "RES101 • STEM 12-A",
        date: "2025-12-12",
        type: "MP4",
        size: "120 MB",
        views: 19,
        tags: ["Research", "Video"],
      },
    ],
    []
  );

  const tagsAll = useMemo(() => {
    const set = new Set();
    lessons.forEach((l) => l.tags.forEach((t) => set.add(t)));
    return ["All", ...Array.from(set)];
  }, [lessons]);

  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      const okQ = (l.title + " " + l.className).toLowerCase().includes(q.toLowerCase());
      const okType = type === "All" ? true : l.type === type;
      const okTag = tag === "All" ? true : l.tags.includes(tag);
      return okQ && okType && okTag;
    });
  }, [lessons, q, type, tag]);

  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Lessons
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Manage your lesson library • Upload lessons • Generate plans with AI
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOpenUpload(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: BRAND.gold, color: BRAND.brown, boxShadow: "0 10px 18px rgba(212,166,47,0.24)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            >
              <Upload className="h-4 w-4" />
              Upload New Lesson
            </button>

            <button
              onClick={() => setOpenAI(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              <Sparkles className="h-4 w-4" style={{ color: BRAND.muted }} />
              AI Lesson Planner
            </button>

            <button
              onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
              className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              View: {view === "grid" ? "Grid" : "List"}
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: BRAND.muted }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search lessons by title or class…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: BRAND.muted }} />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {["All", "PDF", "DOCX", "PPTX", "MP4", "IMG", "ZIP"].map((t) => (
                <option key={t} value={t}>
                  File type: {t}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                 style={{ color: BRAND.muted }} />
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {tagsAll.map((t) => (
                <option key={t} value={t}>
                  Tag: {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Lesson Library */}
      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Lesson Library
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {filtered.length} result(s)
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              No lessons found
            </div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              Try a different search or filter.
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => {
              const Icon = fileIcon(l.type);
              return (
                <div key={l.id} className="rounded-3xl border bg-white p-5 transition hover:-translate-y-[1px]"
                     style={{ borderColor: BRAND.stroke }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl"
                           style={{ background: BRAND.softGoldBg }}>
                        <Icon className="h-5 w-5" style={{ color: BRAND.muted }} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                          {l.title}
                        </div>
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {l.className}
                        </div>
                      </div>
                    </div>
                    <Chip>{l.type}</Chip>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    <div>Date: <span style={{ color: BRAND.brown }}>{l.date}</span></div>
                    <div>Size: <span style={{ color: BRAND.brown }}>{l.size}</span></div>
                    <div>Views: <span style={{ color: BRAND.brown }}>{l.views}</span></div>
                    <div>ID: <span style={{ color: BRAND.brown }}>{l.id}</span></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {l.tags.map((t) => (
                      <span key={t} className="rounded-full border px-3 py-1 text-[11px] font-extrabold"
                            style={{ borderColor: BRAND.stroke, color: BRAND.muted }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => alert("Preview (wire later)")}
                    >
                      <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />
                      View
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition"
                      style={{ background: BRAND.gold, color: BRAND.brown }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                      onClick={() => alert("Download (wire later)")}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => alert("Edit metadata (wire later)")}
                    >
                      <Pencil className="h-4 w-4" style={{ color: BRAND.muted }} />
                      Edit
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => confirm("Delete lesson? (UI only)") && alert("Deleted (UI only)")}
                    >
                      <Trash2 className="h-4 w-4" style={{ color: BRAND.muted }} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="text-xs font-extrabold" style={{ color: BRAND.muted }}>
                  <th className="py-3">Lesson</th>
                  <th>Class</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Size</th>
                  <th>Views</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const Icon = fileIcon(l.type);
                  return (
                    <tr key={l.id} className="border-t" style={{ borderColor: BRAND.stroke }}>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                            <Icon className="h-5 w-5" style={{ color: BRAND.muted }} />
                          </div>
                          <div>
                            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{l.title}</div>
                            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>{l.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm font-semibold" style={{ color: BRAND.brown }}>{l.className}</td>
                      <td><Chip>{l.type}</Chip></td>
                      <td className="text-sm font-semibold" style={{ color: BRAND.brown }}>{l.date}</td>
                      <td className="text-sm font-semibold" style={{ color: BRAND.brown }}>{l.size}</td>
                      <td className="text-sm font-semibold" style={{ color: BRAND.brown }}>{l.views}</td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => alert("View (wire later)")}
                            aria-label="View"
                          >
                            <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => alert("Download (wire later)")}
                            aria-label="Download"
                          >
                            <Download className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => alert("Edit (wire later)")}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => confirm("Delete lesson? (UI only)") && alert("Deleted (UI only)")}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Upload modal */}
      <Modal open={openUpload} onClose={() => setOpenUpload(false)} title="Upload Lesson" width="max-w-3xl">
        <UploadLessonForm onClose={() => setOpenUpload(false)} />
      </Modal>

      {/* AI modal */}
      <Modal open={openAI} onClose={() => setOpenAI(false)} title="AI Lesson Planner ✨" width="max-w-4xl">
        <AILessonPlanner onClose={() => setOpenAI(false)} />
      </Modal>
    </div>
  );
}

function UploadLessonForm({ onClose }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [classes, setClasses] = useState(["UCSP • STEM 11-A"]);
  const [grade, setGrade] = useState("Grade 11");
  const [lessonType, setLessonType] = useState("Lecture Notes");
  const [tags, setTags] = useState("Unit 1, Introduction");
  const [visibility, setVisibility] = useState("Specific Classes");
  const [uploading, setUploading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return alert("Lesson Title is required.");
    setUploading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      alert("Uploaded (UI only). Wire to Supabase Storage later.");
      onClose();
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Lesson Title (required)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            placeholder="e.g., Functions and Relations"
          />
        </Field>

        <Field label="Lesson Type">
          <select
            value={lessonType}
            onChange={(e) => setLessonType(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {[
              "Lecture Notes",
              "Presentation",
              "Video Lesson",
              "Worksheet",
              "Activity",
              "Assessment",
              "Supplementary Material",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>

        <Field label="Subject/Class (multi-select UI)">
          <select
            multiple
            value={classes}
            onChange={(e) => setClasses(Array.from(e.target.selectedOptions).map((o) => o.value))}
            className="h-[120px] w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {[
              "UCSP • STEM 11-A",
              "MATH101 • ABM 11-B",
              "ORALCOMM • HUMSS 11-C",
              "RES101 • STEM 12-A",
            ].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            Hold Ctrl/Cmd to select multiple.
          </div>
        </Field>

        <Field label="Grade Level">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {["Grade 11", "Grade 12"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description / Summary">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          rows={4}
          placeholder="Short summary of the lesson…"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tags (comma-separated)">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          />
        </Field>

        <Field label="Visibility">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {["All Classes", "Specific Classes", "Private (Draft)"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Drag/drop area */}
      <div className="rounded-3xl border p-5" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Upload Files
        </div>
        <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
          Drag & drop files here (UI only). Supported: PDF, DOCX, PPTX, MP4, Images, ZIP.
        </div>
        <div className="mt-4 rounded-3xl border bg-white/70 p-6 text-center"
             style={{ borderColor: BRAND.stroke }}>
          <Upload className="mx-auto h-6 w-6" style={{ color: BRAND.muted }} />
          <div className="mt-2 text-sm font-semibold" style={{ color: BRAND.brown }}>
            Drop files here or click to browse
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            (Wire to Supabase Storage later)
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border bg-white/70 px-5 py-3 text-sm font-semibold hover:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
          style={{
            background: BRAND.gold,
            color: BRAND.brown,
            boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
          }}
          onMouseEnter={(e) => !uploading && (e.currentTarget.style.background = BRAND.goldHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
        >
          {uploading ? "Uploading…" : "Upload Lesson"}
        </button>
      </div>
    </form>
  );
}

function AILessonPlanner({ onClose }) {
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("Grade 11");
  const [duration, setDuration] = useState("60 minutes");
  const [level, setLevel] = useState("Intermediate");
  const [style, setStyle] = useState("Interactive");
  const [objectives, setObjectives] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic.trim()) return alert("Subject/Topic is required.");
    setLoading(true);
    setResult("");
    try {
      await new Promise((r) => setTimeout(r, 900));
      setResult(
        `Lesson Plan: ${topic}\n\n` +
          `Grade: ${grade}\nDuration: ${duration}\nStudent Level: ${level}\nTeaching Style: ${style}\n\n` +
          `1) Introduction (10 min)\n- Hook question + quick recap\n\n` +
          `2) Main Content (20 min)\n- Key concepts and examples\n\n` +
          `3) Activities (20 min)\n- Pair discussion + short worksheet\n\n` +
          `4) Assessment (5 min)\n- Exit ticket quiz\n\n` +
          `5) Homework / Follow-up (5 min)\n- Reflection and short reading\n\n` +
          `Resources Needed:\n- Slides, worksheet, board markers\n`
      );
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(result);
    alert("Copied to clipboard.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-3xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subject/Topic (required)">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                placeholder="e.g., Functions and Relations"
              />
            </Field>
            <Field label="Grade Level">
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                {["Grade 11", "Grade 12"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Lesson Duration">
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              />
            </Field>
            <Field label="Student Level">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                {["Beginner", "Intermediate", "Advanced"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Teaching Style">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                {["Lecture-based", "Interactive", "Hands-on", "Discussion-based", "Mixed"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Learning Objectives">
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              rows={3}
              placeholder="List the lesson objectives…"
            />
          </Field>

          <Field label="Additional Context">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              rows={3}
              placeholder="Student background, constraints, special notes…"
            />
          </Field>

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.brown, boxShadow: "0 10px 18px rgba(212,166,47,0.24)" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Generating…" : "Generate Lesson Plan ✨"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Output
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              <Clipboard className="h-4 w-4" style={{ color: BRAND.muted }} />
              Copy
            </button>
            <button
              onClick={() => alert("Export to PDF (wire later)")}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => result && (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="mt-3">
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="h-[520px] w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            placeholder="Generated lesson plan will appear here…"
          />
          <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
            Editable output (you can refine before saving).
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <button
            onClick={() => alert("Save as lesson plan (wire later)")}
            disabled={!result}
            className="rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
            style={{ background: BRAND.gold, color: BRAND.brown, boxShadow: "0 10px 18px rgba(212,166,47,0.24)" }}
            onMouseEnter={(e) => result && (e.currentTarget.style.background = BRAND.goldHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
          >
            Save Lesson Plan
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white disabled:opacity-60"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}
