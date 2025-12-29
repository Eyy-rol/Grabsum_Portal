// src/dev/pages/RoleManagement.jsx
import React, { useMemo, useState } from "react";

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

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
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
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const ROLE_OPTIONS = ["super_admin", "admin", "dev", "teacher", "student"];

export default function RoleManagement() {
  // UI-only demo data (replace with Supabase later)
  const [rows, setRows] = useState(() => [
    {
      id: "1",
      email: "superadmin@school.com",
      full_name: "System Owner",
      role: "super_admin",
      is_active: true,
      is_archived: false,
    },
    {
      id: "2",
      email: "admin@school.com",
      full_name: "Registrar Admin",
      role: "admin",
      is_active: true,
      is_archived: false,
    },
    {
      id: "3",
      email: "dev@school.com",
      full_name: "Dev Account",
      role: "dev",
      is_active: true,
      is_archived: false,
    },
    {
      id: "4",
      email: "teacher@school.com",
      full_name: "Ms. Reyes",
      role: "teacher",
      is_active: true,
      is_archived: false,
    },
    {
      id: "5",
      email: "student@school.com",
      full_name: "Juan Dela Cruz",
      role: "student",
      is_active: true,
      is_archived: false,
    },
  ]);

  // staged edits (id -> role)
  const [pending, setPending] = useState({});
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((r) => {
        if (!qq) return true;
        return (
          String(r.email || "").toLowerCase().includes(qq) ||
          String(r.full_name || "").toLowerCase().includes(qq)
        );
      })
      .filter((r) => (filterRole === "all" ? true : r.role === filterRole))
      .filter((r) => {
        if (filterStatus === "all") return true;
        if (filterStatus === "active") return r.is_active && !r.is_archived;
        if (filterStatus === "disabled") return !r.is_active && !r.is_archived;
        if (filterStatus === "archived") return r.is_archived;
        return true;
      });
  }, [rows, q, filterRole, filterStatus]);

  function roleTone(role) {
    if (role === "super_admin") return "danger";
    if (role === "admin") return "warning";
    if (role === "dev") return "info";
    return "neutral";
  }

  function statusBadge(r) {
    if (r.is_archived) return <Badge tone="neutral">Archived</Badge>;
    if (!r.is_active) return <Badge tone="danger">Disabled</Badge>;
    return <Badge tone="success">Active</Badge>;
  }

  function setPendingRole(id, role) {
    setPending((p) => ({ ...p, [id]: role }));
  }

  function hasUnsaved() {
    return Object.keys(pending).length > 0;
  }

  function saveAll() {
    // UI only: apply pending changes
    setRows((prev) =>
      prev.map((r) => (pending[r.id] ? { ...r, role: pending[r.id] } : r))
    );
    setPending({});
  }

  function discardAll() {
    setPending({});
  }

  function lockReason(r) {
    // Example rule: only super_admin can change super_admin (enforce later in backend too)
    if (r.role === "super_admin") return "Super Admin role changes are restricted.";
    return "";
  }

  const columns = [
    {
      key: "user",
      label: "User",
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.full_name || "—"}</div>
          <div className="text-xs text-black/50">{r.email}</div>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (r) => statusBadge(r) },
    {
      key: "currentRole",
      label: "Current Role",
      render: (r) => <Badge tone={roleTone(r.role)}>{r.role}</Badge>,
    },
    {
      key: "setRole",
      label: "Set Role",
      render: (r) => {
        const selected = pending[r.id] ?? r.role;
        const disabled = r.role === "super_admin"; // UI rule; enforce with RLS too
        return (
          <div className="flex items-center gap-2">
            <select
              value={selected}
              disabled={disabled}
              onChange={(e) => setPendingRole(r.id, e.target.value)}
              className={cn(
                "rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-xs outline-none",
                disabled && "opacity-60"
              )}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {disabled ? (
              <span className="text-[11px] text-black/40">{lockReason(r)}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-black/5">
            View
          </button>
          <button className="rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-xs font-semibold hover:bg-black/5">
            Reset Password
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Role Management"
        subtitle="Assign roles safely. Changes are staged until you click Save."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={discardAll}
              disabled={!hasUnsaved()}
              className={cn(
                "rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold",
                hasUnsaved() ? "hover:bg-black/5" : "opacity-60"
              )}
            >
              Discard
            </button>
            <button
              onClick={saveAll}
              disabled={!hasUnsaved()}
              className={cn(
                "rounded-2xl px-4 py-2 text-xs font-semibold",
                hasUnsaved()
                  ? "bg-[#e7aa2f] text-black hover:opacity-90"
                  : "border border-black/10 bg-[#fafafa] text-black/50"
              )}
            >
              Save Changes
            </button>
          </div>
        }
      >
        {/* Filters */}
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-black/60">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email…"
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-black/60">Role</div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
            >
              <option value="all">All</option>
              {ROLE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-black/60">Status</div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Info strip */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
          <div className="text-xs text-black/60">
            Tip: Keep <span className="font-semibold">Super Admin</span> accounts limited (1–2 only). Enforce role changes
            with RLS to prevent privilege escalation.
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="danger">super_admin</Badge>
            <Badge tone="warning">admin</Badge>
            <Badge tone="info">dev</Badge>
            <Badge tone="neutral">teacher/student</Badge>
          </div>
        </div>

        <Table columns={columns} rows={filtered} />
      </Card>

      <Card title="Audit note" subtitle="Record why a role changed (recommended).">
        <textarea
          className="h-28 w-full rounded-[22px] border border-black/10 bg-[#fafafa] p-4 text-sm outline-none"
          placeholder="e.g., Promoted Ms. Reyes to Admin for Enrollment management."
        />
        <div className="mt-3 flex justify-end">
          <button className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
            Attach to Save (UI only)
          </button>
        </div>
      </Card>
    </div>
  );
}
