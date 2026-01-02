import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { Plus, Search, Pencil, CheckCircle2, X, Save } from "lucide-react";

/**
 * School Years Page — aligned to Enrollment.jsx (white + gold, rounded-2xl, border-black/10)
 *
 * Supports (Active/Inactive only):
 * - Add school year (always created Inactive)
 * - Modify school year (code + dates)
 * - Activate school year (previous Active becomes Inactive)
 *
 * Recommended (atomic activation):
 * - Create Postgres RPC: activate_school_year(p_sy_id uuid)
 *   UI calls RPC first, then falls back to sequential updates if RPC doesn't exist.
 */

// ====== UI THEME (White + Gold, minimal brown) ======
const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  gold: "text-[#C9A227]",
  goldBg: "bg-[#C9A227]",
  goldSoft: "bg-[#C9A227]/10",
  brown: "text-[#6B4E2E]",
};

const TABS = ["All", "Active", "Inactive"];

export default function SchoolYears() {
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });
  const [confirm, setConfirm] = useState({ open: false, row: null });

  // READ
  const syQ = useQuery({
    queryKey: ["school_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("sy_id, sy_code, start_date, end_date, status, created_at, updated_at")
        .order("sy_code", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = syQ.data ?? [];

  const activeSy = useMemo(() => rows.find((r) => r.status === "Active"), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "All" ? true : (r.status || "") === tab))
      .filter((r) => {
        if (!needle) return true;
        const hay = `${r.sy_code || ""} ${r.start_date || ""} ${r.end_date || ""} ${r.status || ""}`.toLowerCase();
        return hay.includes(needle);
      });
  }, [rows, tab, q]);

  // CREATE (always Inactive)
  const createM = useMutation({
    mutationFn: async (values) => {
      const payload = {
        sy_code: values.sy_code,
        start_date: values.start_date,
        end_date: values.end_date,
        status: "Inactive",
      };
      const { error } = await supabase.from("school_years").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school_years"] }),
  });

  // UPDATE (code + dates)
  const updateM = useMutation({
    mutationFn: async ({ sy_id, values }) => {
      const patch = {
        sy_code: values.sy_code,
        start_date: values.start_date,
        end_date: values.end_date,
      };
      const { error } = await supabase.from("school_years").update(patch).eq("sy_id", sy_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school_years"] }),
  });

  // ACTIVATE (RPC first, fallback sequential)
  const activateM = useMutation({
    mutationFn: async (sy_id) => {
      const rpc = await supabase.rpc("activate_school_year", { p_sy_id: sy_id });
      if (!rpc.error) return;

      const { error: e1 } = await supabase.from("school_years").update({ status: "Inactive" }).eq("status", "Active");
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("school_years").update({ status: "Active" }).eq("sy_id", sy_id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school_years"] }),
  });

  function openCreate() {
    setModal({
      open: true,
      mode: "create",
      row: { sy_code: "", start_date: "", end_date: "" },
    });
  }

  function openEdit(row) {
    setModal({
      open: true,
      mode: "edit",
      row: {
        ...row,
        start_date: row?.start_date ? String(row.start_date).slice(0, 10) : "",
        end_date: row?.end_date ? String(row.end_date).slice(0, 10) : "",
      },
    });
  }

  function requestActivate(row) {
    setConfirm({ open: true, row });
  }

  async function onConfirmActivate() {
    if (!confirm.row) return;
    try {
      await activateM.mutateAsync(confirm.row.sy_id);
    } finally {
      setConfirm({ open: false, row: null });
    }
  }

  const hintText = useMemo(() => {
    const target = confirm.row;
    if (!target) return "";
    const prev = activeSy && activeSy.sy_id !== target.sy_id ? activeSy.sy_code : null;
    return prev
      ? `Activating ${target.sy_code} will set ${prev} to Inactive.`
      : `Activating ${target.sy_code} will make it the only Active school year.`;
  }, [confirm.row, activeSy]);

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">School Years</div>
          <div className={`text-sm ${UI.muted}`}>
            Manage academic school years. New years are created as Inactive. Activate exactly one.
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add School Year
        </button>
      </div>

      {/* Tabs */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = norm(tab) === norm(t);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active
                    ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                    : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
              >
                <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters + Active summary */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by code, date, status…"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <div className="md:col-span-2 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
            <div className="text-xs font-semibold text-black/60">Current active school year</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-sm font-extrabold text-black">{activeSy?.sy_code || "—"}</div>
              {activeSy ? <StatusPill value="Active" /> : <StatusPill value="Inactive" />}
            </div>
            <div className={`mt-1 text-xs ${UI.muted}`}>
              {activeSy ? `${activeSy.start_date} → ${activeSy.end_date}` : "No active school year set"}
            </div>
          </div>
        </div>

        {/* RPC note (kept small like Enrollment hints) */}
        <div className={`mt-3 rounded-xl border border-black/10 bg-white p-3 text-xs ${UI.muted}`}>
          Tip: For best safety, create a Postgres RPC <span className="font-semibold text-black">activate_school_year(p_sy_id uuid)</span>.
          This UI calls RPC first, then falls back to sequential updates.
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">School Years</div>
          <div className={`text-xs ${UI.muted}`}>Showing {filtered.length} of {rows.length}</div>
        </div>

        {syQ.isLoading ? (
          <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
        ) : syQ.isError ? (
          <div className="p-6 text-sm text-rose-700">Error: {String(syQ.error?.message || syQ.error)}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">School Year</th>
                <th className="px-4 py-3 font-semibold">Start Date</th>
                <th className="px-4 py-3 font-semibold">End Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.sy_id} className="border-t border-black/10 hover:bg-black/[0.01]">
                  <td className="px-4 py-3 font-semibold">{r.sy_code}</td>
                  <td className="px-4 py-3 text-black/70">{r.start_date}</td>
                  <td className="px-4 py-3 text-black/70">{r.end_date}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status || "Inactive"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="Modify" onClick={() => openEdit(r)} tone="gold">
                        <Pencil className="h-5 w-5" />
                      </IconBtn>
                      <IconBtn
                        title={r.status === "Active" ? "Already Active" : "Activate"}
                        onClick={() => requestActivate(r)}
                        tone={r.status === "Active" ? "muted" : "gold"}
                        disabled={r.status === "Active"}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create/Edit */}
      {modal.open ? (
        <SchoolYearModal
          mode={modal.mode}
          row={modal.row}
          onClose={() => setModal({ open: false, mode: "create", row: null })}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(sy_id, values) => updateM.mutate({ sy_id, values })}
          busy={createM.isPending || updateM.isPending}
        />
      ) : null}

      {/* Confirm Activate */}
      {confirm.open ? (
        <ConfirmModal
          title="Activate this school year?"
          description={hintText}
          row={confirm.row}
          onClose={() => setConfirm({ open: false, row: null })}
          onConfirm={onConfirmActivate}
          busy={activateM.isPending}
        />
      ) : null}
    </div>
  );
}

/* ================= Modals (CENTER + BACKDROP BLUR) ================= */

function SchoolYearModal({ mode, row, onClose, onCreate, onUpdate, busy }) {
  const isEdit = mode === "edit";

  const [values, setValues] = useState(() => ({
    sy_code: row?.sy_code || "",
    start_date: row?.start_date || "",
    end_date: row?.end_date || "",
  }));

  const errors = useMemo(() => {
    const e = {};
    if (!isValidSyCode(values.sy_code)) e.sy_code = "Use YYYY-YYYY (e.g., 2025-2026).";
    if (!values.start_date) e.start_date = "Start date is required.";
    if (!values.end_date) e.end_date = "End date is required.";
    if (values.start_date && values.end_date && !dateOrderOk(values.start_date, values.end_date)) {
      e.end_date = "End date must be the same as or later than start date.";
    }
    return e;
  }, [values]);

  function submit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) return;

    if (isEdit) onUpdate(row.sy_id, values);
    else onCreate(values);

    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-2xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{isEdit ? "Modify School Year" : "Add School Year"}</div>
              <div className={`text-xs ${UI.muted}`}>New records are created as Inactive by default.</div>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <form onSubmit={submit} className="p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="School Year Code *"
                placeholder="2025-2026"
                value={values.sy_code}
                onChange={(e) => setValues((v) => ({ ...v, sy_code: e.target.value }))}
                error={errors.sy_code}
              />

              <div className="md:col-span-1 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                <div className="text-xs font-semibold text-black/60">Status</div>
                <div className="mt-1 text-sm font-extrabold text-black">{isEdit ? (row.status || "Inactive") : "Inactive (default)"}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Start Date *"
                type="date"
                value={values.start_date}
                onChange={(e) => setValues((v) => ({ ...v, start_date: e.target.value }))}
                error={errors.start_date}
              />
              <Input
                label="End Date *"
                type="date"
                value={values.end_date}
                onChange={(e) => setValues((v) => ({ ...v, end_date: e.target.value }))}
                error={errors.end_date}
              />
            </div>

            {isEdit ? (
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className={`text-sm font-extrabold ${UI.brown}`}>Activation</div>
                <div className={`mt-2 text-sm ${UI.muted}`}>
                  To set this school year as Active, close this modal and click <span className="font-semibold text-black">Activate</span> in the table.
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                disabled={busy || Object.keys(errors).length > 0}
                type="submit"
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-4 w-4" />
                {isEdit ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function ConfirmModal({ title, description, row, onClose, onConfirm, busy }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-lg rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{title}</div>
              <div className={`text-xs ${UI.muted}`}>{description}</div>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4">
            <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-extrabold">{row?.sy_code}</div>
                  <div className={`text-sm ${UI.muted}`}>{row?.start_date} → {row?.end_date}</div>
                </div>
                <StatusPill value={row?.status || "Inactive"} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={onConfirm}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Activate
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= Small Components (same style as Enrollment.jsx) ================= */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      {children}
    </label>
  );
}

function Input({ label, error, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <input
        type={type}
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function IconBtn({ title, onClick, tone, disabled, children }) {
  const cls =
    tone === "muted"
      ? "bg-black/5 text-black/50"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls} disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function StatusPill({ value }) {
  const v = norm(value);
  const cls = v === "active" ? "bg-[#C9A227]/10 text-[#C9A227]" : "bg-black/5 text-black/70";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

/* ================= Utils ================= */

function isDigitString(s) {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c < "0" || c > "9") return false;
  }
  return true;
}

function isValidSyCode(code) {
  if (!code || code.length !== 9) return false;
  if (code[4] !== "-") return false;

  const a = code.slice(0, 4);
  const b = code.slice(5, 9);
  if (!isDigitString(a) || !isDigitString(b)) return false;

  const y1 = Number(a);
  const y2 = Number(b);
  return y2 === y1 + 1;
}

function dateOrderOk(start, end) {
  if (!start || !end) return false;
  return new Date(end).getTime() >= new Date(start).getTime();
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}
