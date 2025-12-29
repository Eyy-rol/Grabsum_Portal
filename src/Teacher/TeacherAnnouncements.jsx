// src/pages/teacher/TeacherAnnouncements.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, Paperclip, Bookmark, CheckCircle2, Plus } from "lucide-react";
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
const PRIORITIES = ["All", "High", "Medium", "Low"];

function Modal({ open, title, onClose, children, width = "max-w-3xl" }) {
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

function badgeColor(priority) {
  if (priority === "High") return { bg: "rgba(239,68,68,0.12)", fg: "rgba(127,29,29,0.95)" };
  if (priority === "Medium") return { bg: "rgba(249,115,22,0.12)", fg: "rgba(124,45,18,0.95)" };
  return { bg: "rgba(59,130,246,0.12)", fg: "rgba(30,64,175,0.95)" };
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeacherAnnouncements() {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("All");
  const [showDrafts, setShowDrafts] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);

  const [termCode, setTermCode] = useState("1st Sem");
  const [activeSY, setActiveSY] = useState(null); // { sy_id, sy_code }
  const [term, setTerm] = useState(null); // { term_id, term_code }

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // create form
  const [formTitle, setFormTitle] = useState("");
  const [formPriority, setFormPriority] = useState("Medium"); // matches your table
  const [formContent, setFormContent] = useState("");
  const [formTarget, setFormTarget] = useState("My Students"); // or "Section Students"
  const [formSectionId, setFormSectionId] = useState("");

  const [teacherSections, setTeacherSections] = useState([]); // from section_schedules (teacher_id)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // 1) Load Active school year
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, status, start_date")
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error) { setErr(error.message); setLoading(false); return; }
      if (!data?.sy_id) { setErr("No Active school year found."); setLoading(false); return; }

      setActiveSY({ sy_id: data.sy_id, sy_code: data.sy_code });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // 2) Load selected term
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

  // 3) Load teacher sections (optional dropdown) from section_schedules
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeSY?.sy_id || !term?.term_id) return;

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (authErr) return;
      if (!uid) return;

      const { data, error } = await supabase
        .from("section_schedules")
        .select("section_id, sections:section_id(section_id, section_name)")
        .eq("sy_id", activeSY.sy_id)
        .eq("term_id", term.term_id)
        .eq("teacher_id", uid);

      if (!alive) return;
      if (error) return;

      const map = new Map();
      for (const r of data ?? []) {
        const sid = r.section_id;
        const sn = r.sections?.section_name;
        if (sid && sn) map.set(sid, { section_id: sid, section_name: sn });
      }
      setTeacherSections(Array.from(map.values()).sort((a, b) => a.section_name.localeCompare(b.section_name)));
    })();

    return () => { alive = false; };
  }, [activeSY?.sy_id, term?.term_id]);

  // 4) Load announcements for teacher + (optional) admin All Students published
  async function loadAnnouncements() {
    if (!activeSY?.sy_id || !term?.term_id) return;

    setLoading(true);
    setErr(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const uid = authData?.user?.id;

    if (authErr) { setErr(authErr.message); setLoading(false); return; }
    if (!uid) { setErr("Not authenticated."); setLoading(false); return; }

    // Teacher’s own rows + scope to active sy + selected term
    // NOTE: If you also want to show admin All Students announcements, you can OR it here,
    // but it requires a separate query or a view. For now, teacher sees own only.
    const { data, error } = await supabase
      .from("announcements")
      .select(`
        id,
        posted_by,
        title,
        content,
        priority,
        target_audience,
        status,
        is_archived,
        posted_at,
        created_at,
        updated_at,
        sy_id,
        term_id,
        section_id,
        sections:section_id(section_id, section_name)
      `)
      .eq("posted_by", uid)
      .eq("sy_id", activeSY.sy_id)
      .eq("term_id", term.term_id)
      .order("posted_at", { ascending: false });

    if (error) { setErr(error.message); setLoading(false); return; }

    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadAnnouncements();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSY?.sy_id, term?.term_id]);

  const filtered = useMemo(() => {
    return (items ?? []).filter((a) => {
      const okQ = (a.title + " " + a.content).toLowerCase().includes(q.toLowerCase());
      const okP = priority === "All" ? true : a.priority === priority;
      const okStatus = showDrafts ? true : a.status === "Published";
      const okArchived = archivedOnly ? a.is_archived : !a.is_archived;
      return okQ && okP && okStatus && okArchived;
    });
  }, [items, q, priority, showDrafts, archivedOnly]);

  async function createAnnouncement() {
    setSaving(true);
    setErr(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (authErr) throw authErr;
      if (!uid) throw new Error("Not authenticated.");

      if (!activeSY?.sy_id || !term?.term_id) throw new Error("Missing Active SY / Term.");
      if (!formTitle.trim()) throw new Error("Title is required.");
      if (!formContent.trim()) throw new Error("Content is required.");

      if (formTarget === "Section Students" && !formSectionId) {
        throw new Error("Select a section for 'Section Students'.");
      }

      const payload = {
        posted_by: uid,
        title: formTitle.trim(),
        content: formContent.trim(),
        priority: formPriority, // High/Medium/Low
        target_audience: formTarget, // My Students / Section Students
        status: "Published", // or "Draft" if you want drafts by default
        is_archived: false,
        posted_at: new Date().toISOString(),
        sy_id: activeSY.sy_id,
        term_id: term.term_id,
        section_id: formTarget === "Section Students" ? formSectionId : null,
      };

      const { data, error } = await supabase
        .from("announcements")
        .insert(payload)
        .select(`
          id,
          posted_by,
          title,
          content,
          priority,
          target_audience,
          status,
          is_archived,
          posted_at,
          created_at,
          updated_at,
          sy_id,
          term_id,
          section_id,
          sections:section_id(section_id, section_name)
        `)
        .single();

      if (error) throw error;

      setItems((prev) => [data, ...prev]);
      setCreateOpen(false);

      setFormTitle("");
      setFormContent("");
      setFormPriority("Medium");
      setFormTarget("My Students");
      setFormSectionId("");
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + filters */}
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
              Announcements
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Teacher → Students
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

            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search announcements…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  Priority: {x}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowDrafts((s) => !s)}
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {showDrafts ? "Showing: Drafts + Published" : "Showing: Published Only"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button
            onClick={() => setArchivedOnly((s) => !s)}
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {archivedOnly ? "Showing: Archived" : "Showing: Active"}
          </button>

          <button
            onClick={loadAnnouncements}
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 text-xs font-semibold" style={{ color: BRAND.muted }}>
          {loading ? "Loading…" : `${filtered.length} item(s)`}
        </div>
      </motion.div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="space-y-3">
          {!loading && filtered.length === 0 ? (
            <div className="rounded-3xl border p-6 text-center" style={{ borderColor: BRAND.stroke }}>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                No announcements
              </div>
              <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                Click “New” to post one for your students.
              </div>
            </div>
          ) : (
            filtered.map((a) => {
              const b = badgeColor(a.priority);
              const targetLabel =
                a.target_audience === "Section Students"
                  ? `Section: ${a.sections?.section_name ?? "—"}`
                  : "All my students";

              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="w-full rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-[1px]"
                  style={{ borderColor: BRAND.stroke }}
                  disabled={loading}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        {a.title}
                      </div>
                      <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {targetLabel} • {a.status} • {fmtDate(a.posted_at)}
                      </div>
                    </div>

                    <span className="rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: b.bg, color: b.fg }}>
                      {a.priority}
                    </span>
                  </div>

                  <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
                    {a.content.length > 160 ? a.content.slice(0, 160) + "…" : a.content}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
                      style={{ background: "rgba(34,197,94,0.14)", color: BRAND.brown }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> {a.status}
                    </span>

                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
                      style={{ background: "rgba(43,26,18,0.06)", color: BRAND.brown }}
                    >
                      <Paperclip className="h-4 w-4" style={{ color: BRAND.muted }} /> Attachments (later)
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Details modal */}
      <Modal open={!!selected} title={selected ? selected.title : ""} onClose={() => setSelected(null)}>
        {selected ? <AnnouncementDetails a={selected} /> : null}
      </Modal>

      {/* Create modal */}
      <Modal open={createOpen} title="New Announcement" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>Title</div>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              placeholder="e.g. Quiz moved to Friday"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>Priority</div>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                {["High", "Medium", "Low"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>Target</div>
              <select
                value={formTarget}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormTarget(v);
                  if (v !== "Section Students") setFormSectionId("");
                }}
                className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                <option value="My Students">My Students</option>
                <option value="Section Students">Section Students</option>
              </select>
            </div>
          </div>

          {formTarget === "Section Students" ? (
            <div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>Section</div>
              <select
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none focus:bg-white"
                style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              >
                <option value="">Select section…</option>
                {teacherSections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] font-semibold" style={{ color: BRAND.muted }}>
                (Sections loaded from section_schedules for this SY/term + your user_id)
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>Message</div>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              placeholder="Write your announcement…"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Attachments via Supabase Storage (later)")}
            >
              <Bookmark className="h-4 w-4" style={{ color: BRAND.muted }} />
              Attachments (later)
            </button>

            <button
              disabled={saving}
              className="rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
              onClick={createAnnouncement}
            >
              {saving ? "Posting…" : "Publish"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AnnouncementDetails({ a }) {
  const b = badgeColor(a.priority);
  const targetLabel =
    a.target_audience === "Section Students"
      ? `Section: ${a.sections?.section_name ?? "—"}`
      : "All my students";

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Target: <span style={{ color: BRAND.brown }}>{targetLabel}</span> • {a.status} • {fmtDate(a.posted_at)}
            </div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              {a.content}
            </div>
          </div>
          <span className="w-fit rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: b.bg, color: b.fg }}>
            {a.priority}
          </span>
        </div>
      </div>

      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Attachments
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => alert("Bookmark (optional later)")}
          >
            <Bookmark className="h-4 w-4" style={{ color: BRAND.muted }} />
            Bookmark
          </button>
        </div>

        <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
          Attachments via Supabase Storage (wire later).
        </div>
      </div>
    </div>
  );
}
