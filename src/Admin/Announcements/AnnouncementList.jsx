import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCcw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../../lib/portalCtx";

const STAFF_ROLES = new Set(["admin", "dev", "staff"]); // add roles here if needed

export default function AdminAnnouncement() {
  const [sy, setSy] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [role, setRole] = useState("");

  const canPost = role === "super_admin";
  const canView = canPost || STAFF_ROLES.has(role);

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "Medium",
    target_audience: "All Teachers",
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
      const r = String(profile?.role || "").toLowerCase();
      setRole(r);

      if (!r) throw new Error("Missing role in profiles.");
      if (!(r === "super_admin" || STAFF_ROLES.has(r))) {
        throw new Error("Forbidden: staff/super_admin only");
      }

      const activeSy = await getActiveSy();
      setSy(activeSy);

      // ✅ super_admin = my posts for current SY
      if (r === "super_admin") {
        const { data, error } = await supabase
          .from("announcements")
          .select("id,title,content,priority,target_audience,status,is_archived,posted_at,sy_id")
          .eq("posted_by", user.id)
          .eq("sy_id", activeSy.sy_id)
          .order("posted_at", { ascending: false });

        if (error) throw error;
        setItems(data || []);
        return;
      }

      // ✅ staff read-only = view published teacher-facing announcements
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,content,priority,target_audience,status,is_archived,posted_at,sy_id,posted_by")
        .eq("sy_id", activeSy.sy_id)
        .eq("status", "Published")
        .eq("is_archived", false)
        .eq("target_audience", "All Teachers", "All Students")
        .order("posted_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setErrMsg(String(e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAnnouncement() {
    setErrMsg("");

    if (!canPost) {
      setErrMsg("Read-only: staff users cannot post announcements.");
      return;
    }

    setPosting(true);

    try {
      const { user } = await getMyProfile();
      if (!sy?.sy_id) throw new Error("No active school year.");
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.content.trim()) throw new Error("Content is required.");

      // super_admin allowed audience
      if (!["All Teachers", "All Students"].includes(form.target_audience)) {
        throw new Error("Invalid audience for super_admin.");
      }

      const payload = {
        posted_by: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        target_audience: form.target_audience,
        status: form.status,
        is_archived: false,
        sy_id: sy.sy_id,
        section_id: null,
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

  const headerSubtitle = useMemo(() => {
    if (!sy?.sy_code) return "Current SY: —";
    return `Current SY: ${sy.sy_code}`;
  }, [sy]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[#2b1a12]">
              Admin Announcements{" "}
              <span className="ml-2 text-xs font-semibold text-black/40">({role || "—"})</span>
            </div>
            <div className="text-xs font-semibold text-black/50">
              {canPost
                ? "Super Admin posts to teachers (and optionally all students)."
                : "Read-only view for staff (admin/dev)."}{" "}
              {headerSubtitle}
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

        {/* ✅ Only show create form if super_admin */}
        {canPost ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-black/60">Title</div>
              <input
                value={form.title}
                onChange={(e) => patch("title", e.target.value)}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
                placeholder="e.g., Faculty meeting"
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
                <div className="text-xs font-semibold text-black/60">Audience</div>
                <select
                  value={form.target_audience}
                  onChange={(e) => patch("target_audience", e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none"
                >
                  <option value="All Teachers">All Teachers</option>
                  <option value="All Students">All Students</option>
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
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-sm font-extrabold text-[#2b1a12]">
          {canPost ? "My Posts" : "Announcements"}
        </div>

        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="text-sm text-black/50">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-black/40">No announcements found.</div>
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
                  {a.status} • {a.priority} • {a.target_audience} •{" "}
                  {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
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
