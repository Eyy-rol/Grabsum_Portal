import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCcw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../lib/portalCtx";

export default function TeacherAnnouncement() {
  const [sy, setSy] = useState(null);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "Medium",
    target_audience: "My Students", // default
    section_id: "",
    status: "Published", // or Draft
  });

  function patch(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      const { user, profile } = await getMyProfile();
      if (String(profile.role).toLowerCase() !== "teacher") {
        throw new Error("Forbidden: teacher only");
      }

      const activeSy = await getActiveSy();
      setSy(activeSy);

      // Sections teacher handles this SY
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
        uniq.set(sid, {
          section_id: sid,
          section_name: r.sections?.section_name || sid,
        });
      });
      setSections(Array.from(uniq.values()).sort((a, b) => a.section_name.localeCompare(b.section_name)));

      // Teacher’s own announcements (current SY)
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,content,priority,target_audience,status,is_archived,posted_at,section_id,sy_id")
        .eq("posted_by", user.id)
        .eq("sy_id", activeSy.sy_id)
        .order("posted_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        target_audience: form.target_audience,
        section_id: form.target_audience === "Section Students" ? form.section_id : null,
        status: form.status,
        is_archived: false,
        sy_id: sy.sy_id,
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

  const canSection = useMemo(() => sections.length > 0, [sections]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[#2b1a12]">Teacher Announcements</div>
            <div className="text-xs font-semibold text-black/50">
              Post announcements to your students. Current SY: <span className="text-black/70">{sy?.sy_code || "—"}</span>
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

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-sm font-extrabold text-[#2b1a12]">My Posts</div>
        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="text-sm text-black/50">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-black/40">No posts yet.</div>
          ) : (
            items.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-black/10 bg-[#fafafa] p-4"
              >
                <div className="text-sm font-extrabold text-[#2b1a12]">{a.title}</div>
                <div className="mt-1 text-xs font-semibold text-black/50">
                  {a.status} • {a.priority} • {a.target_audience} • {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-black/70">{a.content}</div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
