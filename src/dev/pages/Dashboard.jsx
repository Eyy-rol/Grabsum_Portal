// src/dev/pages/DevDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../../lib/portalCtx";

function Badge({ tone = "neutral", children }) {
  const cls = {
    success: "bg-[#e9f7ef] text-[#1e6b3a] border-[#c9ead6]",
    warning: "bg-[#fff3da] text-[#7a4b00] border-[#f3d7a3]",
    danger: "bg-[#fde8e8] text-[#8a1c1c] border-[#f5bcbc]",
    neutral: "bg-[#f5f5f5] text-black/60 border-black/10",
    info: "bg-[#eaf2ff] text-[#1d4ed8] border-[#c7dbff]",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
      <div className="text-xs text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-black/40">{hint}</div> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, right, children }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-black/50">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function tonePriority(priority) {
  if (priority === "High") return "danger";
  if (priority === "Low") return "neutral";
  return "warning";
}

export default function DevDashboard() {
  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const [sy, setSy] = useState(null);
  const [stats, setStats] = useState({
    students: "—",
    pending: "—",
    teachers: "—",
    postsToday: "—",
  });
  const [ann, setAnn] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      // role gate
      const { profile } = await getMyProfile();
      const role = String(profile?.role || "").toLowerCase();
      if (!["dev", "super_admin"].includes(role)) {
        throw new Error("Forbidden: dev only");
      }

      const activeSy = await getActiveSy();
      setSy(activeSy);

      // quick counts (head:true uses count without returning rows)
      const [stuRes, enrRes, tchRes, annTodayRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("sy_id", activeSy.sy_id),
        supabase.from("enrollment").select("id", { count: "exact", head: true }).eq("st_application_status", "Pending"),
        supabase.from("teachers").select("user_id", { count: "exact", head: true }).eq("is_archived", false),
        supabase
          .from("announcements")
          .select("id", { count: "exact", head: true })
          .eq("status", "Published")
          .eq("is_archived", false)
          .gte("posted_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      if (stuRes.error) throw stuRes.error;
      if (enrRes.error) throw enrRes.error;
      if (tchRes.error) throw tchRes.error;
      if (annTodayRes.error) throw annTodayRes.error;

      setStats({
        students: String(stuRes.count ?? 0),
        pending: String(enrRes.count ?? 0),
        teachers: String(tchRes.count ?? 0),
        postsToday: String(annTodayRes.count ?? 0),
      });

      // latest super_admin announcements (Published, current SY)
      // NOTE: we filter by audience if you want, but RLS should enforce visibility.
      const { data: annRows, error: annErr } = await supabase
        .from("announcements")
        .select("id,title,content,priority,target_audience,posted_at,posted_by")
        .eq("status", "Published")
        .eq("is_archived", false)
        .eq("sy_id", activeSy.sy_id)
        .in("target_audience", ["All Teachers", "All Students"])
        .order("posted_at", { ascending: false })
        .limit(8);

      if (annErr) throw annErr;
      setAnn(annRows || []);
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      {/* Top welcome */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs text-black/50">{today}</div>
          <div className="mt-1 text-2xl font-semibold">Dev Dashboard</div>
          <div className="mt-2 text-sm text-black/50">
            Active SY: <span className="font-semibold text-black/70">{sy?.sy_code || "—"}</span>
          </div>

          {errMsg ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {errMsg}
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[#fff6e6] p-6 shadow-sm">
          <div className="text-xs text-black/50">Quick action</div>
          <div className="mt-1 text-sm font-semibold text-black/70">Reload dashboard</div>
          <div className="mt-4">
            <button
              onClick={load}
              className="w-full rounded-2xl bg-[#e7aa2f] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students (Active SY)" value={loading ? "…" : stats.students} />
        <Stat label="Pending Enrollment" value={loading ? "…" : stats.pending} />
        <Stat label="Teachers" value={loading ? "…" : stats.teachers} />
        <Stat label="Announcements Today" value={loading ? "…" : stats.postsToday} />
      </div>

      {/* Announcements */}
      <SectionCard title="Latest Announcements" subtitle="From Super Admin (Published)">
        {loading ? (
          <div className="text-sm text-black/50">Loading…</div>
        ) : ann.length === 0 ? (
          <div className="text-sm text-black/40">No announcements found.</div>
        ) : (
          <div className="space-y-3">
            {ann.map((a) => (
              <div key={a.id} className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{a.title}</div>
                    <div className="mt-1 text-xs text-black/50">
                      {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"} • {a.target_audience}
                    </div>
                  </div>
                  <Badge tone={tonePriority(a.priority)}>{a.priority}</Badge>
                </div>
                <div className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{a.content}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
