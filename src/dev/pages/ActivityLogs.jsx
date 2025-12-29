// src/dev/pages/ActivityLogs.jsx
import React, { useMemo, useState } from "react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

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

export default function ActivityLogs() {
  // UI-only demo data (swap to Supabase later)
  const [logs] = useState(() => [
    {
      id: "l1",
      at: "2025-12-29 09:02",
      actor: "dev@school.com",
      action: "Viewed Activity Logs",
      target: "activity_logs",
      result: "success",
      ip: "127.0.0.1",
      meta: "filters=none",
    },
    {
      id: "l2",
      at: "2025-12-29 09:10",
      actor: "admin@school.com",
      action: "Updated Role",
      target: "student@school.com",
      result: "success",
      ip: "203.0.113.45",
      meta: "student → teacher",
    },
    {
      id: "l3",
      at: "2025-12-29 09:14",
      actor: "teacher@school.com",
      action: "Login Attempt",
      target: "auth",
      result: "warning",
      ip: "203.0.113.77",
      meta: "2FA pending",
    },
    {
      id: "l4",
      at: "2025-12-29 09:16",
      actor: "unknown",
      action: "Login Attempt",
      target: "auth",
      result: "failed",
      ip: "198.51.100.12",
      meta: "invalid password",
    },
    {
      id: "l5",
      at: "2025-12-29 09:20",
      actor: "admin@school.com",
      action: "Disabled Account",
      target: "student2@school.com",
      result: "success",
      ip: "203.0.113.45",
      meta: "reason=inactive",
    },
  ]);

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [result, setResult] = useState("all");
  const [range, setRange] = useState("today"); // UI-only dropdown
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return logs.filter((l) => {
      const matchQ =
        !qq ||
        String(l.actor).toLowerCase().includes(qq) ||
        String(l.action).toLowerCase().includes(qq) ||
        String(l.target).toLowerCase().includes(qq) ||
        String(l.ip).toLowerCase().includes(qq) ||
        String(l.meta).toLowerCase().includes(qq);

      const a = (l.action || "").toLowerCase();
      const matchType =
        type === "all" ||
        (type === "auth" && (a.includes("login") || a.includes("auth") || a.includes("session"))) ||
        (type === "role" && a.includes("role")) ||
        (type === "security" && (a.includes("security") || a.includes("policy"))) ||
        (type === "users" && (a.includes("account") || a.includes("user") || a.includes("disable") || a.includes("archive"))) ||
        (type === "system" && (a.includes("system") || a.includes("config") || a.includes("migration")));

      const matchResult = result === "all" || (l.result || "").toLowerCase() === result;

      // range is UI-only; keep it for later
      return matchQ && matchType && matchResult;
    });
  }, [logs, q, type, result]);

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
      label: "Meta",
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
            <button className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5">
              Export CSV
            </button>
            <button className="rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-semibold text-black hover:opacity-90">
              Refresh
            </button>
          </div>
        }
      >
        {/* Filters */}
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-black/60">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actor, action, target, IP, meta…"
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
        </div>

        {/* Table */}
        <Table columns={columns} rows={filtered} />
      </Card>

      {/* Details drawer/modal (simple) */}
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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs text-black/50">Timestamp</div>
              <div className="mt-1 text-sm font-semibold">{selected.at}</div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs text-black/50">Result</div>
              <div className="mt-2">
                <Badge tone={toneForResult(selected.result)}>{selected.result}</Badge>
              </div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs text-black/50">Actor</div>
              <div className="mt-1 text-sm font-semibold">{selected.actor}</div>
              <div className="mt-1 text-xs text-black/50">IP: {selected.ip}</div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs text-black/50">Action</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={toneForAction(selected.action)}>{selected.action}</Badge>
                <span className="text-xs text-black/50">→</span>
                <span className="text-sm font-semibold">{selected.target}</span>
              </div>
            </div>

            <div className="md:col-span-2 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs text-black/50">Meta</div>
              <div className="mt-1 text-sm text-black/70">{selected.meta}</div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
              Copy JSON (UI)
            </button>
            <button className="rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-semibold text-black hover:opacity-90">
              Create Report (UI)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
