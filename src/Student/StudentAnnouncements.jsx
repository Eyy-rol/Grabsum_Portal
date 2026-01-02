import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, AlertTriangle, Clock, RefreshCcw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../lib/portalCtx";

function tone(priority) {
  if (priority === "High") return "border-rose-200 bg-rose-50 text-rose-900";
  if (priority === "Low") return "border-slate-200 bg-slate-50 text-slate-900";
  return "border-amber-200 bg-amber-50 text-amber-900"; // Medium default
}

export default function StudentAnnouncement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState("all");

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      const { profile } = await getMyProfile();
      if (String(profile.role).toLowerCase() !== "student") {
        throw new Error("Forbidden: student only");
      }

      const sy = await getActiveSy();

      // IMPORTANT:
      // We do NOT manually filter by "who can see what".
      // RLS already does it.
      // But we can filter to active SY if you want consistent results.
     const { data, error } = await supabase
  .from("announcements")
  .select("id,title,content,priority,target_audience,posted_at,posted_by,section_id")
  .eq("status", "Published")
  .eq("is_archived", false)
  .in("target_audience", ["All Students", "Section Students", "My Students"])
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

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (items || [])
      .filter((x) => (prio === "all" ? true : x.priority === prio))
      .filter((x) => {
        if (!qq) return true;
        return (
          String(x.title || "").toLowerCase().includes(qq) ||
          String(x.content || "").toLowerCase().includes(qq)
        );
      });
  }, [items, q, prio]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[#2b1a12] flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-black/60" />
              Announcements
            </div>
            <div className="text-xs font-semibold text-black/50">
              Read-only. Announcements come from your teachers (and optionally super admin).
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

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or content…"
            className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
          />
          <select
            value={prio}
            onChange={(e) => setPrio(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
          >
            <option value="all">All priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/60">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/40">
          No announcements found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-black/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-[#2b1a12]">{a.title}</div>
                  <div className="mt-1 text-xs font-semibold text-black/50 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${tone(a.priority)}`}>
                  {a.priority}
                  {a.priority === "High" ? <AlertTriangle className="ml-1 inline h-3.5 w-3.5" /> : null}
                </span>
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm text-black/70">{a.content}</div>

              <div className="mt-3 text-[11px] font-semibold text-black/40">
                Audience: {a.target_audience}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
