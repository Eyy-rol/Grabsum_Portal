import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCcw, Pencil, X, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../lib/portalCtx";

const AUDIENCE_TABS = ["All", "My Students", "Section Students"];
const STATUS_TABS = ["Published", "Draft"];

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
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-[#2b1a12]">{title}</div>
                <button
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-black/60" />
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

export default function TeacherAnnouncement() {
  const [sy, setSy] = useState(null);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const [activeAudience, setActiveAudience] = useState("All");
  const [activeStatus, setActiveStatus] = useState("Published");
  const [sectionFilter, setSectionFilter] = useState("All");

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "Medium",
    target_audience: "My Students",
    section_id: "",
    status: "Published",
  });

  function patch(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      const { user, profile } = await getMyProfile();
      if (String(profile.role).toLowerCase() !== "teacher") throw new Error("Forbidden: teacher only");

      const activeSy = await getActiveSy();
      setSy(activeSy);

      const { data: ss, error: ssErr } = await supabase
        .from("section_schedules")
        .select("section_id, sections:section_id(section_name)")
        .eq("sy_id", activeSy.sy_id)
        .eq("teacher_id", user.id);

      if (ssErr) throw ssErr;

      const uniq = new Map();
      (ss || []).forEach((r) => {
        const sid = r.section_id;
        if (!sid) return;
        uniq.set(sid, { section_id: sid, section_name: r.sections?.section_name || sid });
      });

      const secList = Array.from(uniq.values()).sort((a, b) => a.section_name.localeCompare(b.section_name));
      setSections(secList);

      const { data, error } = await supabase
        .from("announcements")
        .select(`
          id,title,content,priority,target_audience,status,is_archived,posted_at,section_id,sy_id,
          sections:section_id(section_name)
        `)
        .eq("posted_by", user.id)
        .eq("sy_id", activeSy.sy_id)
        .eq("is_archived", false)
        .order("posted_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);

      if (activeAudience !== "Section Students") setSectionFilter("All");
      if (activeAudience === "Section Students" && secList.length === 0) setActiveAudience("All");
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAnnouncement() {
    setPosting(true);
    setErrMsg("");

    try {
      const { user } = await getMyProfile();
      if (!sy?.sy_id) throw new Error("No active school year.");

      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.content.trim()) throw new Error("Content is required.");
      if (form.target_audience === "Section Students" && !form.section_id) {
        throw new Error("Choose a section for Section Students.");
      }

      const payload = {
        posted_by: user.id,
        posted_by_role: "teacher",
        posted_by_teacher_id: user.id, // ✅ IMPORTANT FIX

        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        target_audience: form.target_audience,

        section_id: form.target_audience === "Section Students" ? form.section_id : null,
        status: form.status,
        is_archived: false,
        sy_id: sy.sy_id,

        term_id: null,
      };

      const { error } = await supabase.from("announcements").insert(payload);
      if (error) throw error;

      setForm((s) => ({ ...s, title: "", content: "" }));
      await load();
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setPosting(false);
    }
  }

  function openEdit(a) {
    setEditErr("");
    setEditItem({
      id: a.id,
      title: a.title || "",
      content: a.content || "",
      priority: a.priority || "Medium",
      target_audience: a.target_audience || "My Students",
      section_id: a.section_id || "",
      status: a.status || "Draft",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setSavingEdit(true);
    setEditErr("");

    try {
      const { user } = await getMyProfile();
      if (!editItem?.id) throw new Error("No announcement selected.");

      if (!editItem.title.trim()) throw new Error("Title is required.");
      if (!editItem.content.trim()) throw new Error("Content is required.");
      if (editItem.target_audience === "Section Students" && !editItem.section_id) {
        throw new Error("Choose a section for Section Students.");
      }

      const payload = {
        title: editItem.title.trim(),
        content: editItem.content.trim(),
        priority: editItem.priority,
        target_audience: editItem.target_audience,
        section_id: editItem.target_audience === "Section Students" ? editItem.section_id : null,
        status: editItem.status,
      };

      const { error } = await supabase
        .from("announcements")
        .update(payload)
        .eq("id", editItem.id)
        .eq("posted_by", user.id);

      if (error) throw error;

      setEditOpen(false);
      setEditItem(null);
      await load();
    } catch (e) {
      setEditErr(String(e?.message || e));
    } finally {
      setSavingEdit(false);
    }
  }

  const canSection = useMemo(() => sections.length > 0, [sections]);

  const counts = useMemo(() => {
    const byAudience = { All: 0, "My Students": 0, "Section Students": 0 };
    const byStatus = { Published: 0, Draft: 0 };

    for (const it of items) {
      byAudience.All += 1;
      if (it.target_audience === "My Students") byAudience["My Students"] += 1;
      if (it.target_audience === "Section Students") byAudience["Section Students"] += 1;

      if (it.status === "Published") byStatus.Published += 1;
      if (it.status === "Draft") byStatus.Draft += 1;
    }
    return { byAudience, byStatus };
  }, [items]);

  const tabItems = useMemo(() => {
    let out = items.slice();

    out = out.filter((x) => x.status === activeStatus);

    if (activeAudience === "My Students") out = out.filter((x) => x.target_audience === "My Students");
    if (activeAudience === "Section Students") {
      out = out.filter((x) => x.target_audience === "Section Students");
      if (sectionFilter !== "All") out = out.filter((x) => x.section_id === sectionFilter);
    }

    return out;
  }, [items, activeAudience, activeStatus, sectionFilter]);

  return (
    <div className="space-y-4">
      {/* CREATE */}
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[#2b1a12]">Teacher Announcements</div>
            <div className="text-xs font-semibold text-black/50">
              Post announcements • SY: <span className="text-black/70">{sy?.sy_code || "—"}</span>
            </div>
            {errMsg ? (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {errMsg}
              </div>
            ) : null}
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-black/60">Title</div>
            <input
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
              placeholder="e.g., Quiz tomorrow"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-semibold text-black/60">Priority</div>
              <select
                value={form.priority}
                onChange={(e) => patch("priority", e.target.value)}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div>
              <div className="text-xs font-semibold text-black/60">Status</div>
              <select
                value={form.status}
                onChange={(e) => patch("status", e.target.value)}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-black/60">Content</div>
            <textarea
              value={form.content}
              onChange={(e) => patch("content", e.target.value)}
              className="mt-1 h-28 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm outline-none"
              placeholder="Write the announcement…"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 md:col-span-2">
            <div>
              <div className="text-xs font-semibold text-black/60">Audience</div>
              <select
                value={form.target_audience}
                onChange={(e) => patch("target_audience", e.target.value)}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none"
              >
                <option value="My Students">My Students</option>
                <option value="Section Students" disabled={!canSection}>
                  Section Students
                </option>
              </select>
              {!canSection ? (
                <div className="mt-1 text-[11px] text-black/40">
                  No sections found for your account in section_schedules.
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs font-semibold text-black/60">Section (required if Section Students)</div>
              <select
                value={form.section_id}
                onChange={(e) => patch("section_id", e.target.value)}
                disabled={form.target_audience !== "Section Students"}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none disabled:opacity-60"
              >
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={createAnnouncement}
              disabled={posting}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-extrabold text-black hover:opacity-90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {posting ? "Posting…" : "Post Announcement"}
            </button>
          </div>
        </div>
      </div>

      {/* POSTS */}
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-sm font-extrabold text-[#2b1a12]">My Posts</div>

        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="text-sm text-black/50">Loading…</div>
          ) : tabItems.length === 0 ? (
            <div className="text-sm text-black/40">No posts here.</div>
          ) : (
            tabItems.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-black/10 bg-[#fafafa] p-4"
              >
                <div className="text-sm font-extrabold text-[#2b1a12]">{a.title}</div>
                <div className="mt-1 text-xs font-semibold text-black/50">
                  {a.status} • {a.priority} • {a.target_audience} •{" "}
                  {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-black/70">{a.content}</div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      <Modal open={editOpen} title={editItem ? `Edit: ${editItem.title}` : "Edit"} onClose={() => setEditOpen(false)}>
        {!editItem ? null : (
          <div className="space-y-3">
            {editErr ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {editErr}
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold text-black/60">Title</div>
              <input
                value={editItem.title}
                onChange={(e) => setEditItem((s) => ({ ...s, title: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-black/60">Content</div>
              <textarea
                value={editItem.content}
                onChange={(e) => setEditItem((s) => ({ ...s, content: e.target.value }))}
                className="mt-1 h-32 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-extrabold text-black hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
