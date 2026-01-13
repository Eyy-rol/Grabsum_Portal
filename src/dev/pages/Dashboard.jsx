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

  const [annMeta, setAnnMeta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  function friendlyErr(e) {
    const msg = String(e?.message || e || "");
    // Common supabase RLS text patterns:
    if (msg.toLowerCase().includes("permission denied") || msg.toLowerCase().includes("row level security")) {
      return "Limited by RLS: dev dashboard uses anonymized metrics RPC. Verify RPC + grants are applied.";
    }
    return msg || "Something went wrong.";
  }

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      // ✅ role gate (allowed: dev + super_admin)
      const { profile } = await getMyProfile();
      const role = String(profile?.role || "").toLowerCase();
      if (!["dev", "super_admin"].includes(role)) {
        throw new Error("Forbidden: dev only");
      }

      const activeSy = await getActiveSy();
      setSy(activeSy);

      // ✅ IMPORTANT:
      // Do NOT query students/teachers/enrollment/announcements directly.
      // Use RPC that returns aggregated counts only.
      const { data: m, error: mErr } = await supabase.rpc("dev_dashboard_metrics", {
        p_sy_id: activeSy.sy_id,
      });
      if (mErr) throw mErr;

      // supabase rpc returns array for table-returning SQL functions
      const row = Array.isArray(m) ? m[0] : m;

      setStats({
        students: String(row?.students_active_sy ?? 0),
        pending: String(row?.pending_enrollment ?? 0),
        teachers: String(row?.teachers_active ?? 0),
        postsToday: String(row?.announcements_today ?? 0),
      });

      // ✅ Optional metadata-only “feed” (no announcement content)
      const { data: a, error: aErr } = await supabase.rpc("dev_latest_announcements_meta", {
        p_sy_id: activeSy.sy_id,
      });

      if (aErr) {
        // Not fatal; you can hide the section if RPC not created
        setAnnMeta([]);
      } else {
        setAnnMeta(Array.isArray(a) ? a : []);
      }
    } catch (e) {
      setErrMsg(friendlyErr(e));
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
          <div className="mt-1 text-2xl font-semibold">System Overview</div>
          <div className="mt-2 text-sm text-black/50">
            Active SY: <span className="font-semibold text-black/70">{sy?.sy_code || "—"}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">Anonymized Metrics</Badge>
            <Badge tone="neutral">No PII Reads</Badge>
            <Badge tone="success">Dev-safe</Badge>
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
        <Stat label="Students (Active SY)" value={loading ? "…" : stats.students} hint="Aggregated count (no records)" />
        <Stat label="Pending Enrollment" value={loading ? "…" : stats.pending} hint="Aggregated count (no records)" />
        <Stat label="Teachers" value={loading ? "…" : stats.teachers} hint="Aggregated count (no records)" />
        <Stat label="Announcements Today" value={loading ? "…" : stats.postsToday} hint="Count only" />
      </div>

      {/* Safe metadata feed */}
      <SectionCard
        title="Recent Notices (metadata)"
        subtitle="Published announcements metadata only (no content)"
        right={<Badge tone="neutral">Safe feed</Badge>}
      >
        {loading ? (
          <div className="text-sm text-black/50">Loading…</div>
        ) : annMeta.length === 0 ? (
          <div className="text-sm text-black/40">No notices found (or RPC not enabled).</div>
        ) : (
          <div className="space-y-3">
            {annMeta.map((a) => (
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
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
