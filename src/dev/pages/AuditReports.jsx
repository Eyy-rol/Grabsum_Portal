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
                No reports generated yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const REPORTS = [
  {
    id: "user_access",
    title: "User Access Report",
    desc: "Logins, role changes, security events, and account status.",
    tone: "info",
  },
  {
    id: "role_changes",
    title: "Role Changes Report",
    desc: "Who changed roles, when, and to what.",
    tone: "warning",
  },
  {
    id: "security_events",
    title: "Security Events Report",
    desc: "Failed logins, lockouts, policy updates, suspicious activity.",
    tone: "danger",
  },
  {
    id: "data_integrity",
    title: "Data Integrity Check",
    desc: "Missing profiles, orphaned records, consistency checks.",
    tone: "success",
  },
];

export default function AuditReports() {
  const [selected, setSelected] = useState("user_access");
  const [range, setRange] = useState("7d");
  const [format, setFormat] = useState("pdf");
  const [includePII, setIncludePII] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI-only “recent generated reports”
  const [recent, setRecent] = useState(() => [
    {
      id: "r1",
      name: "Role Changes Report",
      range: "Today",
      created_at: "2025-12-29 09:35",
      status: "ready",
      format: "csv",
    },
    {
      id: "r2",
      name: "Security Events Report",
      range: "Last 7 days",
      created_at: "2025-12-28 18:10",
      status: "ready",
      format: "pdf",
    },
  ]);

  const reportMeta = useMemo(() => REPORTS.find((r) => r.id === selected), [selected]);

  async function generate() {
    setSaving(true);

    // UI-only: simulate generation
    setTimeout(() => {
      setRecent((prev) => [
        {
          id: "r" + (prev.length + 1),
          name: reportMeta?.title ?? "Report",
          range: range === "today" ? "Today" : range === "7d" ? "Last 7 days" : "Last 30 days",
          created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
          status: "ready",
          format,
        },
        ...prev,
      ]);
      setSaving(false);
    }, 800);
  }

  function statusTone(s) {
    if (s === "ready") return "success";
    if (s === "running") return "info";
    return "neutral";
  }

  const columns = [
    { key: "created_at", label: "Created" },
    { key: "name", label: "Report" },
    { key: "range", label: "Range" },
    { key: "format", label: "Format", render: (r) => <Badge tone="neutral">{String(r.format).toUpperCase()}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    {
      key: "actions",
      label: "",
      render: () => (
        <div className="flex gap-2">
          <button className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
            Download
          </button>
          <button className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5">
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Audit & Reports"
        subtitle="Generate compliance and operational reports. (UI only)"
        right={<Badge tone="info">Tracked</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: report picker */}
          <div className="lg:col-span-1">
            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold text-black/60">Report Types</div>
              <div className="mt-3 space-y-2">
                {REPORTS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selected === r.id
                        ? "border-black/15 bg-white"
                        : "border-black/10 bg-[#fafafa] hover:bg-black/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{r.title}</div>
                      <Badge tone={r.tone}>{r.tone}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-black/50">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: generator + recent */}
          <div className="lg:col-span-2 space-y-4">
            <Card
              title="Generate Report"
              subtitle={reportMeta?.desc}
              right={<Badge tone={reportMeta?.tone ?? "neutral"}>{reportMeta?.title ?? "Report"}</Badge>}
            >
              <div className="grid gap-3 md:grid-cols-3">
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
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-black/60">Format</div>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
                  >
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={generate}
                    disabled={saving}
                    className={cn(
                      "w-full rounded-2xl px-4 py-2 text-xs font-semibold",
                      saving ? "bg-black/10 text-black/50" : "bg-[#e7aa2f] text-black hover:opacity-90"
                    )}
                  >
                    {saving ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-black/10 bg-[#fff3da] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">PII / Sensitive data</div>
                    <div className="text-xs text-black/50">
                      Keep OFF unless required (protect student personal information).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludePII((v) => !v)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-semibold border",
                      includePII ? "bg-black text-white border-black" : "bg-white border-black/10"
                    )}
                  >
                    {includePII ? "Include PII" : "Exclude PII"}
                  </button>
                </div>
              </div>
            </Card>

            <Card title="Recent Reports" subtitle="Generated outputs (UI only).">
              <Table columns={columns} rows={recent} />
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
