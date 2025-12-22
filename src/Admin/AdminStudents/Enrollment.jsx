import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { Plus, Search, Trash2, Pencil, X, Save } from "lucide-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

// ====== Status options ======
const STATUS = ["Pending", "Approved", "Enrolled", "Rejected"];
const TRACKS = ["STEM", "HUMSS", "GAS", "ABM", "TVL"];
const GRADES = ["11", "12"];

// ====== Validation (edit all fields; status in Edit modal only) ======
const enrollmentSchema = z.object({
  application_id: z.string().min(1, "Application ID is required").max(50),

  st_fname: z.string().min(1, "First name is required").max(150),
  st_lname: z.string().min(1, "Last name is required").max(150),
  st_mi: z.string().max(10).optional().or(z.literal("")),
  st_ext: z.string().max(20).optional().or(z.literal("")),

  st_gender: z.enum(["Male", "Female"], { message: "Gender is required" }),
  st_civil_status: z.enum(
    ["Single", "Married", "Widowed", "Separated", "Divorced"],
    { message: "Civil status is required" }
  ),

  st_bdate: z.string().min(1, "Date of birth is required"), // YYYY-MM-DD
  st_current_address: z.string().min(1, "Address is required").max(255),

  // optional fields (existing DB)
  st_guardian_name: z.string().optional().or(z.literal("")),
  st_guardian_contact: z.string().optional().or(z.literal("")),

  // academic (if you still want these)
  st_grade_level: z.string().optional().or(z.literal("")),
  st_track: z.string().optional().or(z.literal("")),
});

// ========= Application ID generator =========
// Format: MM-DDNN  (NN starts at 01 per day)
async function generateApplicationId() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${mm}-${dd}`;

  // Find latest application_id for today
  const { data, error } = await supabase
    .from("enrollment")
    .select("application_id")
    .ilike("application_id", `${prefix}%`)
    .order("application_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  let next = 1;
  if (data && data.length > 0 && data[0]?.application_id) {
    const last = String(data[0].application_id);
    const nn = last.replace(prefix, "").replace("-", "").trim();
    const parsed = parseInt(nn.slice(-2), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  const nn2 = String(next).padStart(2, "0");
  return `${prefix}${nn2}`;
}

export default function Enrollment() {
  const qc = useQueryClient();

  // Filters
  const [qName, setQName] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");

  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

  // READ
  const enrollQ = useQuery({
    queryKey: ["enrollment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment")
        .select("*")
        .order("id", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = enrollQ.data ?? [];

  // Filtered rows
  const filtered = useMemo(() => {
    const needle = qName.trim().toLowerCase();
    return rows
      .filter((r) => (needle ? fullName(r).toLowerCase().includes(needle) : true))
      .filter((r) =>
        fStatus === "All" ? true : norm(r.st_application_status) === norm(fStatus)
      )
      .filter((r) => (fTrack === "All" ? true : (r.st_track || "") === fTrack))
      .filter((r) => (fGrade === "All" ? true : (r.st_grade_level || "") === fGrade));
  }, [rows, qName, fStatus, fTrack, fGrade]);

  // CREATE
  const createM = useMutation({
    mutationFn: async (values) => {
      const now = new Date().toISOString();

      const payload = {
        ...values,

        // system-given
        st_application_status: "Pending",
        st_submission_date: now,
        st_agreed_terms: false,
        st_terms_agreed_at: null,

        st_reviewed_by: null,
        st_reviewed_at: null,
        st_approved_by: null,
        st_approved_at: null,

        st_scheduled_date: null,
        st_scheduled_time: null,
      };

      const { error } = await supabase.from("enrollment").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  // UPDATE (all fields editable in Edit modal)
  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const patch = {
        ...values,
        st_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("enrollment").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  // DELETE
  const deleteM = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("enrollment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  async function openCreate() {
    const appId = await generateApplicationId();
    setModal({
      open: true,
      mode: "create",
      row: {
        application_id: appId,
        st_fname: "",
        st_lname: "",
        st_mi: "",
        st_ext: "",
        st_gender: "Male",
        st_civil_status: "Single",
        st_bdate: "",
        st_current_address: "",
        st_guardian_name: "",
        st_guardian_contact: "",
        st_grade_level: "",
        st_track: "",
      },
    });
  }

  function openEdit(row) {
    setModal({ open: true, mode: "edit", row });
  }

  function onDelete(row) {
    const ok = window.confirm(`Delete application ${row.application_id || "(no id)"}?`);
    if (!ok) return;
    deleteM.mutate(row.id);
  }

  // NEW: Status Tabs (Pending/Approved/Enrolled/Rejected)
  const statusTabs = ["All", ...STATUS];

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Enrollment</div>
          <div className={`text-sm ${UI.muted}`}>
            Clean, white + gold admin enrollment management.
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      {/* NEW: Tabs */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((t) => {
            const active = norm(fStatus) === norm(t);
            return (
              <button
                key={t}
                onClick={() => setFStatus(t)}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
              >
                <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Student name">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="Search last/first name…"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <Field label="Status">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...STATUS].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="Track (optional)">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...TRACKS].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="Grade (optional)">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...GRADES].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">Applications</div>
          <div className={`text-xs ${UI.muted}`}>
            Showing {filtered.length} of {rows.length}
          </div>
        </div>

        {enrollQ.isLoading ? (
          <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
        ) : enrollQ.isError ? (
          <div className="p-6 text-sm text-rose-700">
            Error: {String(enrollQ.error?.message || enrollQ.error)}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Application ID</th>
                <th className="px-4 py-3 font-semibold">Full Name</th>
                <th className="px-4 py-3 font-semibold">Gender</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                  <td className="px-4 py-3 font-semibold">{r.application_id || "-"}</td>
                  <td className="px-4 py-3">{fullName(r)}</td>
                  <td className="px-4 py-3 text-black/70">{r.st_gender || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.st_application_status || "Pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold">
                        <Pencil className="h-5 w-5" />
                      </IconBtn>
                      <IconBtn title="Delete" onClick={() => onDelete(r)} tone="danger">
                        <Trash2 className="h-5 w-5" />
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

      {/* Modal */}
      {modal.open ? (
        <StudentModal
          mode={modal.mode}
          row={modal.row}
          onClose={() => setModal({ open: false, mode: "create", row: null })}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(id, values) => updateM.mutate({ id, values })}
          busy={createM.isPending || updateM.isPending}
        />
      ) : null}
    </div>
  );
}

/* ================= Modal (CENTER + BACKDROP BLUR) ================= */

function StudentModal({ mode, row, onClose, onCreate, onUpdate, busy }) {
  const isEdit = mode === "edit";

  // NEW: Last updated timestamp for edit mode
  const lastUpdatedAt = useMemo(() => {
    if (!row) return null;
    const raw =
      row.st_updated_at ||
      row.updated_at ||
      row.created_at ||
      row.st_submission_date ||
      null;
    if (!raw) return null;

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
  }, [row]);

  const defaults = useMemo(() => {
    const base = {
      application_id: row?.application_id || "",
      st_fname: row?.st_fname || "",
      st_lname: row?.st_lname || "",
      st_mi: row?.st_mi || "",
      st_ext: row?.st_ext || "",
      st_gender: row?.st_gender || "Male",
      st_civil_status: row?.st_civil_status || "Single",
      st_bdate: row?.st_bdate ? String(row.st_bdate).slice(0, 10) : "",
      st_current_address: row?.st_current_address || "",
      st_guardian_name: row?.st_guardian_name || "",
      st_guardian_contact: row?.st_guardian_contact || "",
      st_grade_level: row?.st_grade_level || "",
      st_track: row?.st_track || "",
      st_application_status: row?.st_application_status || "Pending", // only used in Edit
    };
    return base;
  }, [row]);

  const form = useForm({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: defaults,
    values: defaults,
  });

  const { register, handleSubmit, formState, watch } = form;
  const { errors } = formState;

  function submit(values) {
    const status = isEdit ? watch("st_application_status") : "Pending";

    const payload = {
      ...values,
      ...(isEdit ? { st_application_status: status } : {}),
    };

    if (isEdit) onUpdate(row.id, payload);
    else onCreate(payload);

    onClose();
  }

  return (
    <>
      {/* Backdrop blur */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Center modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-3xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">
                {isEdit ? "Edit Student" : "Add Student"}
              </div>
              <div className={`text-xs ${UI.muted}`}>
                White + gold minimal design. Application ID auto-generated.
              </div>
            </div>

            {/* NEW: timestamp display outside form, in header right */}
            <div className="text-right">
              {isEdit ? (
                <div className="rounded-xl border border-black/10 bg-[#C9A227]/5 px-3 py-2">
                  <div className="text-[11px] font-semibold text-black/60">
                    Last updated at:
                  </div>
                  <div className="text-xs font-extrabold text-black">
                    {lastUpdatedAt || "—"}
                  </div>
                </div>
              ) : null}

              <button
                onClick={onClose}
                className="mt-2 grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ml-auto"
              >
                <X className="h-5 w-5 text-black/60" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(submit)} className="p-4 space-y-4 max-h-[75vh] overflow-auto">
            {/* App ID + Status */}
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Application ID (auto-generated, editable)"
                error={errors.application_id?.message}
                {...register("application_id")}
              />

              {isEdit ? (
                <Select label="Change Status" {...register("st_application_status")}>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              ) : (
                <div className="md:col-span-2 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                  <div className="text-xs font-semibold text-black/60">Status</div>
                  <div className="mt-1 text-sm font-extrabold text-black">Pending (default)</div>
                </div>
              )}
            </div>

            {/* Name */}
            <Section title="Full Name">
              <div className="grid gap-3 md:grid-cols-4">
                <Input label="Last Name *" error={errors.st_lname?.message} {...register("st_lname")} />
                <Input label="First Name *" error={errors.st_fname?.message} {...register("st_fname")} />
                <Input label="M.I." error={errors.st_mi?.message} {...register("st_mi")} />
                <Input label="Ext." error={errors.st_ext?.message} {...register("st_ext")} />
              </div>
            </Section>

            {/* Personal */}
            <Section title="Personal Info">
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Gender *" error={errors.st_gender?.message} {...register("st_gender")}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </Select>

                <Select
                  label="Civil Status *"
                  error={errors.st_civil_status?.message}
                  {...register("st_civil_status")}
                >
                  {["Single", "Married", "Widowed", "Separated", "Divorced"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>

                <Input
                  label="Date of Birth *"
                  type="date"
                  error={errors.st_bdate?.message}
                  {...register("st_bdate")}
                />
              </div>

              <div className="mt-3">
                <Input
                  label="Address *"
                  error={errors.st_current_address?.message}
                  {...register("st_current_address")}
                />
              </div>
            </Section>

            {/* Guardian */}
            <Section title="Guardian / Parent (if applicable)">
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Guardian/Parent Name" {...register("st_guardian_name")} />
                <Input label="Guardian Contact" {...register("st_guardian_contact")} />
              </div>
            </Section>

            {/* Optional academic */}
            <Section title="Academic (optional)">
              <div className="grid gap-3 md:grid-cols-2">
                <Select label="Grade Level" {...register("st_grade_level")}>
                  <option value="">—</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
                <Select label="Track" {...register("st_track")}>
                  <option value="">—</option>
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
            </Section>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                disabled={busy}
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

/* ================= Small Components ================= */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
      <div className={`text-sm font-extrabold ${UI.brown}`}>{title}</div>
      <div className="mt-3">{children}</div>
    </div>
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

function Select({ label, error, children, ...rest }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
      <select
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ value }) {
  const v = norm(value);
  const cls =
    v === "pending"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : v === "approved"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : v === "enrolled"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "rejected"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {value}
    </span>
  );
}

/* ================= Utils ================= */

function fullName(r) {
  const ext = r.st_ext?.trim() ? ` ${r.st_ext.trim()}` : "";
  const mi = r.st_mi?.trim() ? ` ${r.st_mi.trim()}.` : "";
  return `${r.st_lname || ""}, ${r.st_fname || ""}${ext}${mi}`.trim();
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}
