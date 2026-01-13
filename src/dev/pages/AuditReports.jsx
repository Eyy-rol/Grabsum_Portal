// src/dev/pages/AuditReports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getMyProfile } from "../../lib/portalCtx";

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

function statusTone(s) {
  if (s === "ready") return "success";
  if (s === "running") return "info";
  if (s === "failed") return "danger";
  return "neutral";
}

function rangeLabel(k) {
  if (k === "today") return "Today";
  if (k === "7d") return "Last 7 days";
  if (k === "30d") return "Last 30 days";
  return k;
}

export default function AuditReports() {
  const [reports, setReports] = useState([]); // from DB
  const [selected, setSelected] = useState(null);

  const [range, setRange] = useState("7d");
  const [format, setFormat] = useState("pdf");

  const [recent, setRecent] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const reportMeta = useMemo(() => reports.find((r) => r.code === selected), [reports, selected]);

  async function ensureDev() {
    const { profile } = await getMyProfile();
    const role = String(profile?.role || "").toLowerCase();
    if (!["dev", "super_admin"].includes(role)) throw new Error("Forbidden: dev/super_admin only");
  }

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      await ensureDev();

      const [r1, r2] = await Promise.all([
        supabase.rpc("dev_list_reports"),
        supabase.rpc("dev_recent_report_runs", { p_limit: 20 }),
      ]);

      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;

      const defs = Array.isArray(r1.data) ? r1.data : [];
      setReports(defs);

      if (!selected && defs.length) setSelected(defs[0].code);

      const runs = (Array.isArray(r2.data) ? r2.data : []).map((x) => ({
        id: x.id,
        created_at: x.created_at ? new Date(x.created_at).toLocaleString() : "—",
        report_code: x.report_code,
        range: rangeLabel(x.range_key),
        format: String(x.format || "").toUpperCase(),
        status: x.status || "—",
        row_count: x.row_count ?? null,
        file_url: x.file_url || "",
      }));

      setRecent(runs);
    } catch (e) {
      setErrMsg(String(e?.message || e));
      setReports([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setSaving(true);
    setErrMsg("");

    try {
      await ensureDev();
      if (!selected) throw new Error("Select a report");

      const { data, error } = await supabase.rpc("dev_generate_report", {
        p_report_code: selected,
        p_range_key: range,
        p_format: format,
      });

      if (error) throw error;

      // reload recent runs after generation
      await load();
      return data;
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "created_at", label: "Created" },
    {
      key: "report_code",
      label: "Report",
      render: (r) => {
        const def = reports.find((x) => x.code === r.report_code);
        return (
          <div className="leading-tight">
            <div className="font-semibold">{def?.title || r.report_code}</div>
            <div className="text-xs text-black/45">{r.range}</div>
          </div>
        );
      },
    },
    { key: "format", label: "Format", render: (r) => <Badge tone="neutral">{r.format}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            disabled={!r.file_url}
            onClick={() => {
              if (!r.file_url) return;
              window.open(r.file_url, "_blank", "noopener,noreferrer");
            }}
            className={cn(
              "rounded-2xl border px-4 py-2 text-xs font-semibold",
              r.file_url ? "border-black/10 bg-white hover:bg-black/5" : "border-black/10 bg-black/5 text-black/40"
            )}
          >
            Download
          </button>

          <button
            type="button"
            onClick={() => alert("Viewer: wire to a safe preview endpoint later.")}
            className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
          >
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
        subtitle="Dev-safe reports (anonymized). No PII export is allowed on Dev."
        right={<Badge tone="info">Dev-safe</Badge>}
      >
        {errMsg ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            {errMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/60">
            Loading…
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left: report picker */}
            <div className="lg:col-span-1">
              <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
                <div className="text-xs font-semibold text-black/60">Report Types</div>
                <div className="mt-3 space-y-2">
                  {reports.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => setSelected(r.code)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        selected === r.code ? "border-black/15 bg-white" : "border-black/10 bg-[#fafafa] hover:bg-black/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{r.title}</div>
                        <Badge tone={r.tone || "neutral"}>{r.tone || "info"}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-black/50">{r.description}</div>
                    </button>
                  ))}
                  {reports.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/50">
                      No enabled report definitions.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right: generator + recent */}
            <div className="lg:col-span-2 space-y-4">
              <Card
                title="Generate Report"
                subtitle={reportMeta?.description}
                right={<Badge tone={reportMeta?.tone || "neutral"}>{reportMeta?.title || "Report"}</Badge>}
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
                      disabled={saving || !selected}
                      className={cn(
                        "w-full rounded-2xl px-4 py-2 text-xs font-semibold",
                        saving || !selected ? "bg-black/10 text-black/50" : "bg-[#e7aa2f] text-black hover:opacity-90"
                      )}
                    >
                      {saving ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </div>

                {/* Dev policy notice */}
                <div className="mt-4 rounded-[22px] border border-black/10 bg-[#eaf2ff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">PII is disabled on Dev</div>
                      <div className="text-xs text-black/50">
                        Dev reports are anonymized/system-only. For PII exports, use Admin/Super Admin tools with explicit access.
                      </div>
                    </div>
                    <Badge tone="info">Enforced</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Recent Reports"
                subtitle="System run history (safe metadata)."
                right={
                  <button
                    onClick={load}
                    className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
                  >
                    Refresh
                  </button>
                }
              >
                <Table columns={columns} rows={recent} />
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
