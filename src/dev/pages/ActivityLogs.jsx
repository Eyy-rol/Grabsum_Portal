// src/dev/pages/ActivityLogs.jsx
import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getMyProfile } from "../../lib/portalCtx";

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

function Card({ title, subtitle, right, children }) {
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

function Table({ columns, rows }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-black/10">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-black/60">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t border-black/5">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-middle">
                  {typeof c.render === "function" ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-10 text-center text-black/40" colSpan={columns.length}>
                No logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function toneForAction(action) {
  const a = (action || "").toLowerCase();
  if (a.includes("delete") || a.includes("archive") || a.includes("disable")) return "danger";
  if (a.includes("role") || a.includes("security") || a.includes("policy")) return "warning";
  if (a.includes("login") || a.includes("auth") || a.includes("session")) return "info";
  return "neutral";
}

function toneForResult(result) {
  const r = (result || "").toLowerCase();
  if (r === "success") return "success";
  if (r === "warning") return "warning";
  if (r === "failed") return "danger";
  return "neutral";
}

function rangeToStart(range) {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  return null; // custom/UI later
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [selected, setSelected] = useState(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [result, setResult] = useState("all");
  const [range, setRange] = useState("today");

  async function load() {
    setLoading(true);
    setErrMsg("");
    setSelected(null);

    try {
      // ✅ dev/super_admin only (adjust roles you allow)
      const { profile } = await getMyProfile();
      const role = String(profile?.role || "").toLowerCase();
      if (!["dev", "developer", "super_admin"].includes(role)) {
        throw new Error("Forbidden: dev/super_admin only");
      }

      const start = rangeToStart(range);

      // 1) Load logs
      let query = supabase
        .from("activity_logs")
        .select(
          "id, created_at, actor_user_id, action, entity_type, entity_id, message, metadata, ip_address, application_id, result"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (start) query = query.gte("created_at", start);
      if (result !== "all") query = query.eq("result", result);

      // Type filter is UI-driven, apply via action keywords (or create a real column later)
      if (type !== "all") {
        // simple filter by ilike action text
        const map = {
          auth: ["login", "auth", "session"],
          role: ["role"],
          security: ["security", "policy"],
          users: ["account", "user", "disable", "archive"],
          system: ["system", "config", "migration", "backup", "seed"],
        };
        const keys = map[type] || [];
        if (keys.length) {
          // OR filter
          const or = keys.map((k) => `action.ilike.%${k}%`).join(",");
          query = query.or(or);
        }
      }

      // Search
      const qq = q.trim();
      if (qq) {
        // Search in action/entity/message/ip/application_id
        query = query.or(
          [
            `action.ilike.%${qq}%`,
            `entity_type.ilike.%${qq}%`,
            `entity_id.ilike.%${qq}%`,
            `message.ilike.%${qq}%`,
            `ip_address.ilike.%${qq}%`,
            `application_id.ilike.%${qq}%`,
          ].join(",")
        );
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      // 2) Resolve actor display via profiles (since actor_user_id FK is auth.users)
      const actorIds = Array.from(new Set((rows || []).map((r) => r.actor_user_id).filter(Boolean)));
      let actorMap = new Map();

      if (actorIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, role")
          .in("user_id", actorIds);

        if (pErr) throw pErr;

        (profs || []).forEach((p) => {
          actorMap.set(p.user_id, {
            name: p.full_name || p.email || p.user_id,
            email: p.email || "",
            role: p.role || "",
          });
        });
      }

      const mapped = (rows || []).map((r) => {
        const actor = actorMap.get(r.actor_user_id);
        const actorLabel = actor?.name || (r.actor_user_id ? r.actor_user_id.slice(0, 8) : "unknown");

        return {
          id: r.id,
          at: r.created_at ? new Date(r.created_at).toLocaleString() : "—",
          actor: actorLabel,
          actor_email: actor?.email || "",
          action: r.action,
          target: r.entity_type ? `${r.entity_type}${r.entity_id ? `:${r.entity_id}` : ""}` : (r.entity_id || "—"),
          result: r.result,
          ip: r.ip_address || "—",
          meta: r.message || "",
          raw: r,
        };
      });

      setLogs(mapped);
    } catch (e) {
      setErrMsg(String(e?.message || e));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    // already filtered server-side, but keep client-safe
    return logs;
  }, [logs]);

  const columns = [
    { key: "at", label: "Time" },
    {
      key: "actor",
      label: "Actor",
      render: (l) => (
        <div className="leading-tight">
          <div className="font-semibold">{l.actor}</div>
          <div className="text-xs text-black/50">{l.ip}</div>
        </div>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (l) => (
        <div className="flex items-center gap-2">
          <Badge tone={toneForAction(l.action)}>{l.action}</Badge>
          <span className="text-xs text-black/50">→</span>
          <span className="text-sm font-medium">{l.target}</span>
        </div>
      ),
    },
    {
      key: "result",
      label: "Result",
      render: (l) => <Badge tone={toneForResult(l.result)}>{l.result}</Badge>,
    },
    {
      key: "meta",
      label: "Message",
      render: (l) => <span className="text-xs text-black/60">{l.meta}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (l) => (
        <button
          onClick={() => setSelected(l)}
          className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5"
        >
          View Details
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Activity Logs"
        subtitle="Track system actions, auth events, role changes, and security-related activity."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert("Export CSV: wire later")}
              className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
            >
              Export CSV
            </button>
            <button
              onClick={load}
              className="rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-semibold text-black hover:opacity-90"
            >
              Refresh
            </button>
          </div>
        }
      >
        {errMsg ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            {errMsg}
          </div>
        ) : null}

        {/* Filters */}
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-black/60">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action, entity, message, IP, application_id…"
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-black/60">Type</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
            >
              <option value="all">All</option>
              <option value="auth">Auth</option>
              <option value="role">Role</option>
              <option value="security">Security</option>
              <option value="users">Users</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-black/60">Result</div>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
            >
              <option value="all">All</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="failed">failed</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-black/60">Range</div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom (UI)</option>
            </select>
          </div>

          <div className="md:col-span-5 flex justify-end">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5 disabled:opacity-60"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/60">
            Loading…
          </div>
        ) : (
          <Table columns={columns} rows={filtered} />
        )}
      </Card>

      {/* Details */}
      {selected ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Log Details</div>
              <div className="text-xs text-black/50">Inspect the selected event.</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
            >
              Close
            </button>
          </div>

          <pre className="overflow-auto rounded-2xl border border-black/10 bg-[#fafafa] p-4 text-xs text-black/70">
{JSON.stringify(selected.raw, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
