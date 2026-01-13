// src/pages/teacher/TeacherSubjectLessons.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import {
  Upload, Sparkles, Search, Filter, X, FileText, FileVideo, FileImage, FileArchive, Presentation,
  Tag, Download, Pencil, Trash2, Eye, Clipboard, Save, ArrowLeft,
} from "lucide-react";

const TABLE = "lessons";
const BUCKET = "lessons";

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
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{title}</div>
                <button
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                  style={{ borderColor: BRAND.stroke }}
                  aria-label="Close"
                  type="button"
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

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>{label}</div>
      <div className="mt-2">{children}</div>
    </label>
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

function detectFileTypeFromName(name = "") {
  const ext = String(name).split(".").pop()?.toLowerCase();
  if (!ext) return "DOCX";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOCX";
  if (ext === "ppt" || ext === "pptx") return "PPTX";
  if (ext === "mp4" || ext === "mov" || ext === "mkv") return "MP4";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "IMG";
  if (ext === "zip" || ext === "rar" || ext === "7z") return "ZIP";
  return ext.toUpperCase();
}

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (!b) return "—";
  const mb = b / (1024 * 1024);
  if (mb < 1) return `${Math.round(b / 1024)} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function normalizeTagsInput(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function coerceTagsFromRow(row) {
  const t = row?.tags;
  if (Array.isArray(t)) return t.filter(Boolean);
  if (typeof t === "string") return normalizeTagsInput(t);
  return [];
}

function safeDate(d) {
  if (!d) return "—";
  const iso = String(d);
  return iso.slice(0, 10);
}

async function uploadLessonFile({ file, userId }) {
  if (!file) return { file_path: null, file_type: null, file_size_bytes: null };

  const fileType = detectFileTypeFromName(file.name);
  const ext = String(file.name).split(".").pop() || "bin";
  const path = `${userId || "anon"}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  return { file_path: path, file_type: fileType, file_size_bytes: file.size };
}

function getPublicOrSignedUrl(file_path) {
  if (!file_path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(file_path);
  if (data?.publicUrl) return data.publicUrl;
  return null;
}

export default function TeacherSubjectLessons() {
  const { subjectId } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();

  const subjectFromState = loc.state?.subject || null;

  const [view, setView] = useState("grid");
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [tag, setTag] = useState("All");

  const [openUpload, setOpenUpload] = useState(false);
  const [openAI, setOpenAI] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, row: null });

  // Used to “apply” AI output to Upload form
  const [aiDraft, setAiDraft] = useState("");

  // who is teacher
  const teacherQ = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const uid = data?.user?.id;
      if (!uid) throw new Error("Not logged in.");
      return { userId: uid };
    },
  });

  // Fetch subject info if not in route state
  const subjectInfoQ = useQuery({
    queryKey: ["subject_info", subjectId],
    enabled: !!subjectId && !subjectFromState,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("subject_id, subject_code, subject_title, subject_type, units")
        .eq("subject_id", subjectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const subject = subjectFromState || subjectInfoQ.data || null;

  // ✅ Fetch lessons (only this teacher + this subject)
  const lessonsQ = useQuery({
    queryKey: ["teacher_lessons_by_subject", subjectId],
    enabled: !!subjectId && !!teacherQ.data?.userId,
    queryFn: async () => {
      const teacherId = teacherQ.data.userId;

      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((r) => {
        const tags = coerceTagsFromRow(r);
        return {
          ...r,
          id: r.id,
          title: r.title || "—",
          className: r.class_name || "—",
          date: safeDate(r.created_at || r.date),
          type: r.file_type || r.type || "DOCX",
          size: r.file_size ? String(r.file_size) : r.file_size_bytes ? formatBytes(r.file_size_bytes) : "—",
          views: Number(r.views || 0),
          tags,
          _file_path: r.file_path || null,
          _public_url: getPublicOrSignedUrl(r.file_path),
        };
      });
    },
  });

  // ✅ Create lesson (auto-inject teacher_id + subject_id)
  const createLessonM = useMutation({
    mutationFn: async (payload) => {
      const teacherId = teacherQ.data.userId;

      let fileMeta = { file_path: null, file_type: null, file_size_bytes: null };
      if (payload.file) fileMeta = await uploadLessonFile({ file: payload.file, userId: teacherId });

      const insertRow = {
        teacher_id: teacherId,
        subject_id: subjectId,

        title: payload.title,
        description: payload.desc || "",
        class_name: payload.className || "",
        grade_level: payload.grade || "",
        lesson_type: payload.lessonType || "",
        visibility: payload.visibility || "Specific Classes",
        tags: payload.tagsArr,

        file_path: fileMeta.file_path,
        file_type: fileMeta.file_type,
        file_size_bytes: fileMeta.file_size_bytes,

        views: 0,
      };

      const { error } = await supabase.from(TABLE).insert(insertRow);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teacher_lessons_by_subject", subjectId] });
    },
  });

  // ✅ Update lesson
  const updateLessonM = useMutation({
    mutationFn: async ({ id, patch }) => {
      const teacherId = teacherQ.data.userId;

      let finalPatch = { ...patch };

      if (patch?.file) {
        const fileMeta = await uploadLessonFile({ file: patch.file, userId: teacherId });
        finalPatch = {
          ...finalPatch,
          file_path: fileMeta.file_path,
          file_type: fileMeta.file_type,
          file_size_bytes: fileMeta.file_size_bytes,
        };
        delete finalPatch.file;
      }

      const { error } = await supabase.from(TABLE).update(finalPatch).eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teacher_lessons_by_subject", subjectId] });
    },
  });

  // ✅ Delete lesson
  const deleteLessonM = useMutation({
    mutationFn: async (row) => {
      const ok = confirm("Delete lesson? This will remove the row from the database.");
      if (!ok) return false;

      const { error } = await supabase.from(TABLE).delete().eq("id", row.id);
      if (error) throw error;

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teacher_lessons_by_subject", subjectId] });
    },
  });

  async function onDownload(row) {
    if (row._public_url) {
      window.open(row._public_url, "_blank");
      return;
    }

    if (row._file_path) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row._file_path, 60);
      if (error) return alert(String(error.message || error));
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      return;
    }

    alert("No file attached for this lesson.");
  }

  const lessons = lessonsQ.data ?? [];

  const tagsAll = useMemo(() => {
    const set = new Set();
    lessons.forEach((l) => (l.tags || []).forEach((t) => set.add(t)));
    return ["All", ...Array.from(set)];
  }, [lessons]);

  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      const okQ = (String(l.title || "") + " " + String(l.className || "")).toLowerCase().includes(q.toLowerCase());
      const okType = type === "All" ? true : l.type === type;
      const okTag = tag === "All" ? true : (l.tags || []).includes(tag);
      return okQ && okType && okTag;
    });
  }, [lessons, q, type, tag]);

  const busy = lessonsQ.isLoading || createLessonM.isPending || updateLessonM.isPending || deleteLessonM.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => nav("/teacher/lessons")}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              <ArrowLeft className="h-4 w-4" style={{ color: BRAND.muted }} />
              Back to Subjects
            </button>

            <div className="mt-3 text-sm font-extrabold" style={{ color: BRAND.brown }}>
              {subject ? `${String(subject.subject_code || "").toUpperCase()} — ${subject.subject_title}` : "Subject Lessons"}
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              View and manage your uploaded lesson plans for this subject • Use AI to structure plans
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setAiDraft(""); setOpenUpload(true); }}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.brown, boxShadow: "0 10px 18px rgba(212,166,47,0.24)" }}
              onMouseEnter={(e) => !busy && (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
              type="button"
            >
              <Upload className="h-4 w-4" />
              Upload Lesson Plan
            </button>

            <button
              onClick={() => setOpenAI(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              type="button"
            >
              <Sparkles className="h-4 w-4" style={{ color: BRAND.muted }} />
              AI Lesson Planner
            </button>

            <button
              onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
              className="rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              type="button"
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
              placeholder="Search lesson plans by title…"
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
                <option key={t} value={t}>File type: {t}</option>
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
                <option key={t} value={t}>Tag: {t}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Lesson Library */}
      <motion.div {...fadeUp} className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>Lesson Plans</div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {lessonsQ.isLoading ? "Loading…" : `${filtered.length} result(s)`}
          </div>
        </div>

        {lessonsQ.isError ? (
          <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>Failed to load lessons</div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              {String(lessonsQ.error?.message || lessonsQ.error)}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.stroke }}>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>No lesson plans found</div>
            <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
              Upload a lesson plan for this subject.
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
                      <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                        <Icon className="h-5 w-5" style={{ color: BRAND.muted }} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{l.title}</div>
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>{l.className}</div>
                      </div>
                    </div>
                    <Chip>{l.type}</Chip>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
                    <div>Date: <span style={{ color: BRAND.brown }}>{l.date}</span></div>
                    <div>Size: <span style={{ color: BRAND.brown }}>{l.size}</span></div>
                    <div>Views: <span style={{ color: BRAND.brown }}>{l.views}</span></div>
                    <div>ID: <span style={{ color: BRAND.brown }}>{String(l.id).slice(0, 8)}</span></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(l.tags || []).map((t) => (
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
                      onClick={() => alert("Preview UI (wire later)")}
                      type="button"
                    >
                      <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />
                      View
                    </button>

                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
                      style={{ background: BRAND.gold, color: BRAND.brown }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                      onClick={() => onDownload(l)}
                      disabled={deleteLessonM.isPending}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => setEditModal({ open: true, row: l })}
                      type="button"
                    >
                      <Pencil className="h-4 w-4" style={{ color: BRAND.muted }} />
                      Edit
                    </button>

                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60"
                      style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                      onClick={() => deleteLessonM.mutate(l)}
                      disabled={deleteLessonM.isPending}
                      type="button"
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
                            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>{String(l.id).slice(0, 12)}</div>
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
                            type="button"
                          >
                            <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => onDownload(l)}
                            aria-label="Download"
                            type="button"
                          >
                            <Download className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => setEditModal({ open: true, row: l })}
                            aria-label="Edit"
                            type="button"
                          >
                            <Pencil className="h-4 w-4" style={{ color: BRAND.muted }} />
                          </button>
                          <button
                            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5 disabled:opacity-60"
                            style={{ borderColor: BRAND.stroke }}
                            onClick={() => deleteLessonM.mutate(l)}
                            aria-label="Delete"
                            disabled={deleteLessonM.isPending}
                            type="button"
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
      <Modal open={openUpload} onClose={() => setOpenUpload(false)} title="Upload Lesson Plan" width="max-w-3xl">
        <UploadLessonForm
          mode="create"
          busy={createLessonM.isPending}
          aiDraft={aiDraft}
          onClose={() => setOpenUpload(false)}
          onSubmit={async (payload) => {
            await createLessonM.mutateAsync(payload);
            setOpenUpload(false);
          }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, row: null })} title="Edit Lesson Plan" width="max-w-3xl">
        <UploadLessonForm
          mode="edit"
          initialRow={editModal.row}
          busy={updateLessonM.isPending}
          aiDraft="" // no auto apply for edit
          onClose={() => setEditModal({ open: false, row: null })}
          onSubmit={async (payload) => {
            const row = editModal.row;
            if (!row?.id) return;

            await updateLessonM.mutateAsync({
              id: row.id,
              patch: {
                title: payload.title,
                description: payload.desc || "",
                class_name: payload.className || "",
                grade_level: payload.grade || "",
                lesson_type: payload.lessonType || "",
                visibility: payload.visibility || "Specific Classes",
                tags: payload.tagsArr,
                ...(payload.file ? { file: payload.file } : {}),
              },
            });

            setEditModal({ open: false, row: null });
          }}
        />
      </Modal>

      {/* AI modal */}
      <Modal open={openAI} onClose={() => setOpenAI(false)} title="AI Lesson Planner ✨" width="max-w-4xl">
        <AILessonPlanner
          onClose={() => setOpenAI(false)}
          onUse={(text) => {
            // Save AI output, then open upload modal with it prefilled
            setAiDraft(text);
            setOpenAI(false);
            setOpenUpload(true);
          }}
        />
      </Modal>
    </div>
  );
}

function UploadLessonForm({ onClose, onSubmit, busy, mode = "create", initialRow, aiDraft }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [className, setClassName] = useState("—");
  const [grade, setGrade] = useState("Grade 11");
  const [lessonType, setLessonType] = useState("Lecture Notes");
  const [tags, setTags] = useState("Unit 1, Introduction");
  const [visibility, setVisibility] = useState("Specific Classes");
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (mode === "edit" && initialRow) {
      setTitle(initialRow.title || "");
      setDesc(initialRow.description || "");
      setClassName(initialRow.className || initialRow.class_name || "—");
      setGrade(initialRow.grade_level || initialRow.grade || "Grade 11");
      setLessonType(initialRow.lesson_type || initialRow.lessonType || "Lecture Notes");
      setVisibility(initialRow.visibility || "Specific Classes");

      const existingTags = Array.isArray(initialRow.tags)
        ? initialRow.tags
        : typeof initialRow.tags === "string"
        ? initialRow.tags.split(",")
        : initialRow?.tagsArr || [];
      setTags((existingTags || []).filter(Boolean).join(", "));
    }
  }, [mode, initialRow]);

  // ✅ apply AI draft when opening upload
  useEffect(() => {
    if (mode !== "create") return;
    if (!aiDraft) return;
    setDesc(aiDraft);
  }, [aiDraft, mode]);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return alert("Lesson Title is required.");

    const payload = {
      title: title.trim(),
      desc,
      className,
      grade,
      lessonType,
      visibility,
      tagsArr: normalizeTagsInput(tags),
      file,
    };

    await onSubmit(payload);
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
            placeholder="e.g., Introduction and Motivation"
          />
        </Field>

        <Field label="Lesson Type">
          <select
            value={lessonType}
            onChange={(e) => setLessonType(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {["Lecture Notes", "Presentation", "Video Lesson", "Worksheet", "Activity", "Assessment", "Supplementary Material"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>

        <Field label="Class / Section (optional)">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            placeholder="e.g., STEM 11-A"
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
      </div>

      <Field label="Description / Lesson Plan Content">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          rows={10}
          placeholder="Write your lesson plan here… or use AI to generate a structured draft."
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

      {/* File upload */}
      <div className="rounded-3xl border p-5" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Attach File (optional)
        </div>
        <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
          Upload to Supabase Storage bucket: <b>{BUCKET}</b>
        </div>

        <div className="mt-4 rounded-3xl border bg-white/70 p-5" style={{ borderColor: BRAND.stroke }}>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
            disabled={busy}
          />
          <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
            {file ? `Selected: ${file.name} (${formatBytes(file.size)})` : "No file selected."}
          </div>
          {mode === "edit" ? (
            <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
              Selecting a new file will replace the previous file reference.
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border bg-white/70 px-5 py-3 text-sm font-semibold hover:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          disabled={busy}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
          style={{ background: BRAND.gold, color: BRAND.brown, boxShadow: "0 10px 18px rgba(212,166,47,0.24)" }}
          onMouseEnter={(e) => !busy && (e.currentTarget.style.background = BRAND.goldHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
        >
          <Save className="h-4 w-4" />
          {busy ? "Saving…" : mode === "edit" ? "Save Changes" : "Upload Lesson Plan"}
        </button>
      </div>
    </form>
  );
}

function AILessonPlanner({ onClose, onUse }) {
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
      await new Promise((r) => setTimeout(r, 600));

      const objLines = objectives
        ? objectives.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => `- ${x}`).join("\n")
        : "- (Add objectives)";

      setResult(
        `Lesson Plan: ${topic}\n` +
        `Grade: ${grade}\nDuration: ${duration}\nStudent Level: ${level}\nTeaching Style: ${style}\n\n` +
        `Learning Objectives:\n${objLines}\n\n` +
        `I. Introduction (5–10 min)\n- Hook / Motivation\n- Review of prior knowledge\n\n` +
        `II. Lesson Proper (15–25 min)\n- Key concepts\n- Examples\n\n` +
        `III. Guided Practice (10–15 min)\n- Teacher-led activity\n\n` +
        `IV. Independent Practice (10–15 min)\n- Worksheet / task\n\n` +
        `V. Assessment (5 min)\n- Exit ticket / short quiz\n\n` +
        `VI. Assignment / Enrichment (5 min)\n- Homework / reflection\n\n` +
        `Materials:\n- Slides\n- Handouts\n- Board/markers\n\n` +
        (context ? `Notes/Context:\n${context}\n` : "")
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

          <Field label="Learning Objectives (one per line)">
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              rows={4}
              placeholder={"e.g.\nDefine function\nIdentify domain and range\nSolve basic function problems"}
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
              {loading ? "Generating…" : "Generate Structured Plan ✨"}
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
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>Output</div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              type="button"
            >
              <Clipboard className="h-4 w-4" style={{ color: BRAND.muted }} />
              Copy
            </button>

            <button
              onClick={() => result && onUse(result)}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => result && (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
              type="button"
            >
              Use in Upload Form
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
            Editable output (you can refine before applying).
          </div>
        </div>
      </div>
    </div>
  );
}
