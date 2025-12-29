import React, { useMemo, useState } from "react";

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
                No tables found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DatabaseManagement() {
  // UI-only table catalog (replace with actual schema later)
  const [tables] = useState(() => [
    { name: "profiles", desc: "User profiles + roles", sensitivity: "medium", rows: "—" },
    { name: "students", desc: "Student records", sensitivity: "high", rows: "—" },
    { name: "teachers", desc: "Teacher records", sensitivity: "high", rows: "—" },
    { name: "sections", desc: "Sections/schedules", sensitivity: "low", rows: "—" },
    { name: "attendance", desc: "Attendance logs", sensitivity: "high", rows: "—" },
    { name: "grades", desc: "Gradebook entries", sensitivity: "high", rows: "—" },
    { name: "activity_logs", desc: "System/audit events", sensitivity: "medium", rows: "—" },
    { name: "system_flags", desc: "Feature flags", sensitivity: "low", rows: "—" },
  ]);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("profiles");
  const [mode, setMode] = useState("browse"); // browse | rls | sql
  const [sql, setSql] = useState("-- Read-only console recommended.\n-- Avoid enabling SQL execution in production.\n");
  const [limit, setLimit] = useState(25);

  const filteredTables = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(qq) ||
        String(t.desc || "").toLowerCase().includes(qq) ||
        String(t.sensitivity || "").toLowerCase().includes(qq)
    );
  }, [tables, q]);

  const tableInfo = useMemo(() => {
    return tables.find((t) => t.name === selected) || tables[0];
  }, [tables, selected]);

  // UI-only preview rows
  const preview = useMemo(() => {
    if (selected === "profiles") {
      return {
        columns: [
          { key: "user_id", label: "user_id" },
          { key: "email", label: "email" },
          { key: "role", label: "role" },
          { key: "is_active", label: "active" },
          { key: "is_archived", label: "archived" },
        ],
        rows: [
          { user_id: "…", email: "admin@school.com", role: "admin", is_active: true, is_archived: false },
          { user_id: "…", email: "dev@school.com", role: "dev", is_active: true, is_archived: false },
        ],
      };
    }
    if (selected === "activity_logs") {
      return {
        columns: [
          { key: "created_at", label: "created_at" },
          { key: "actor", label: "actor" },
          { key: "action", label: "action" },
          { key: "result", label: "result" },
        ],
        rows: [
          { created_at: "2025-12-29 09:10", actor: "admin@school.com", action: "Updated Role", result: "success" },
          { created_at: "2025-12-29 09:16", actor: "unknown", action: "Login Attempt", result: "failed" },
        ],
      };
    }
    return {
      columns: [
        { key: "col1", label: "col1" },
        { key: "col2", label: "col2" },
        { key: "col3", label: "col3" },
      ],
      rows: [],
    };
  }, [selected]);

  function sensitivityTone(s) {
    if (s === "high") return "danger";
    if (s === "medium") return "warning";
    return "success";
  }

  return (
    <div className="space-y-4">
      <Card
        title="Database Management"
        subtitle="Read-only database explorer (UI only)."
        right={
          <div className="flex items-center gap-2">
            <Badge tone="info">Read-only</Badge>
            <button className="rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-semibold text-black hover:opacity-90">
              Refresh
            </button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: table list */}
          <div className="lg:col-span-1">
            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold text-black/60">Tables</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tables…"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />

              <div className="mt-3 space-y-2">
                {filteredTables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelected(t.name)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selected === t.name
                        ? "border-black/15 bg-white"
                        : "border-black/10 bg-[#fafafa] hover:bg-black/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <Badge tone={sensitivityTone(t.sensitivity)}>{t.sensitivity}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-black/50">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: table inspector */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-[22px] border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{tableInfo?.name}</div>
                  <div className="text-xs text-black/50">{tableInfo?.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm outline-none"
                  >
                    <option value="browse">Browse</option>
                    <option value="rls">RLS & Policies</option>
                    <option value="sql">SQL Console</option>
                  </select>
                  <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-2">
                    <span className="text-xs text-black/50">Limit</span>
                    <input
                      type="number"
                      value={limit}
                      min={1}
                      max={500}
                      onChange={(e) => setLimit(Number(e.target.value || 25))}
                      className="w-16 bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {mode === "browse" && (
              <Card
                title="Preview"
                subtitle={`Showing up to ${limit} rows (UI only).`}
                right={
                  <button className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5">
                    Export
                  </button>
                }
              >
                <Table columns={preview.columns} rows={preview.rows} />
              </Card>
            )}

            {mode === "rls" && (
              <Card title="RLS & Policies" subtitle="Quick check for common issues (UI only).">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
                    <div className="text-xs text-black/50">Row Level Security</div>
                    <div className="mt-1 text-sm font-semibold">Enabled</div>
                    <div className="mt-1 text-xs text-black/45">
                      Ensure policies exist for select/update/insert as needed.
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
                    <div className="text-xs text-black/50">Policy recursion</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="success">OK</Badge>
                      <span className="text-xs text-black/45">Use SECURITY DEFINER for admin checks.</span>
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-[22px] border border-black/10 bg-white p-4">
                    <div className="text-xs font-semibold text-black/60">Policies (example)</div>
                    <div className="mt-2 space-y-2 text-xs text-black/60">
                      <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-3">
                        profiles_select_own (SELECT) → user_id = auth.uid()
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-3">
                        profiles_update_own (UPDATE) → user_id = auth.uid()
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-3">
                        profiles_admin_manage_all (ALL) → public.is_admin()
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {mode === "sql" && (
              <Card title="SQL Console" subtitle="Disabled by default (recommended).">
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="h-44 w-full rounded-[22px] border border-black/10 bg-[#fafafa] p-4 text-xs outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setSql("")}
                    className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5"
                  >
                    Clear
                  </button>
                  <button className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                    Run (UI only)
                  </button>
                </div>

                <div className="mt-3 rounded-[22px] border border-black/10 bg-[#fff3da] p-4 text-xs text-black/60">
                  <span className="font-semibold">Security note:</span> never allow arbitrary SQL execution in production.
                  If you need admin scripts, use server-side functions with strict permissions.
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
