import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { TOKENS } from "../../styles/tokens"; // adjust if your tokens path differs

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Plus, Search, Filter, Trash2, Pencil, X, Save } from "lucide-react";

/**
 * Your table: public.enrollment
 * Editable: Student + Family + Academic + st_admin_notes
 * NOT in modal: terms/status/admin fields (except admin notes), timestamps
 */

const STATUS_OPTIONS = ["Pending", "Approved", "Enrolled", "Rejected"];
const TRACK_OPTIONS = ["STEM", "HUMSS", "GAS", "ABM", "TVL"];
const GRADE_OPTIONS = ["11", "12"]; // your schema uses varchar(10) st_grade_level

const enrollmentSchema = z.object({
  // Student
  application_id: z.string().max(50).optional().or(z.literal("")),
  st_number: z.string().max(50).optional().or(z.literal("")),

  st_fname: z.string().min(1, "First name is required").max(150),
  st_lname: z.string().min(1, "Last name is required").max(150),
  st_mi: z.string().max(10).optional().or(z.literal("")),
  st_ext: z.string().max(20).optional().or(z.literal("")),

  st_gender: z.string().max(20).optional().or(z.literal("")),
  st_bdate: z.string().optional().or(z.literal("")), // handled as string (YYYY-MM-DD)
  st_bplace: z.string().optional().or(z.literal("")),
  st_current_address: z.string().max(255).optional().or(z.literal("")),
  st_civil_status: z.string().max(50).optional().or(z.literal("")),
  st_previous_school: z.string().max(255).optional().or(z.literal("")),

  // Family
  st_father_name: z.string().max(255).optional().or(z.literal("")),
  st_mother_name: z.string().max(255).optional().or(z.literal("")),
  st_guardian_name: z.string().max(255).optional().or(z.literal("")),
  st_guardian_contact: z.string().max(30).optional().or(z.literal("")),
  st_guardian_relationship: z.string().max(100).optional().or(z.literal("")),

  // Academic
  st_grade_level: z.string().min(1, "Grade level is required").max(10),
  st_track: z.string().min(1, "Track is required").max(50),

  // Admin notes (editable)
  st_admin_notes: z.string().optional().or(z.literal("")),
});

export default function Enrollment() {
  const qc = useQueryClient();

  // UI filters
  const [qName, setQName] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");
  const [tab, setTab] = useState("All Applicants");

  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

  // READ
  const enrollmentsQ = useQuery({
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

  const rows = enrollmentsQ.data ?? [];

  // counts for tabs
  const counts = useMemo(() => {
    const all = rows.length;
    const pending = rows.filter((r) => norm(r.st_application_status) === "pending").length;
    const approval = rows.filter((r) => norm(r.st_application_status) === "approved").length; // your old UI had "Approval"; mapped to Approved
    return { all, pending, approval };
  }, [rows]);

  // filtered rows
  const filtered = useMemo(() => {
    const needle = qName.trim().toLowerCase();

    return rows
      .filter((r) => (needle ? fullName(r).toLowerCase().includes(needle) : true))
      .filter((r) => (fStatus === "All" ? true : norm(r.st_application_status) === norm(fStatus)))
      .filter((r) => (fTrack === "All" ? true : (r.st_track || "") === fTrack))
      .filter((r) => (fGrade === "All" ? true : (r.st_grade_level || "") === fGrade))
      .filter((r) => {
        const st = norm(r.st_application_status);
        if (tab === "All Applicants") return true;
        if (tab === "Pending") return st === "pending";
        if (tab === "Approval") return st === "approved";
        return true;
      });
  }, [rows, qName, fStatus, fTrack, fGrade, tab]);

  // CREATE
  const createM = useMutation({
    mutationFn: async (values) => {
      // system-given fields (not in modal)
      const now = new Date().toISOString();

      const payload = {
        ...values,
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

  // UPDATE editable fields only
  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const payload = pickEditable(values);

      // keep updated_at system-ish
      payload.st_updated_at = new Date().toISOString();

      const { error } = await supabase.from("enrollment").update(payload).eq("id", id);
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

  // STATUS CHANGE (system fields auto-fill)
  const statusM = useMutation({
    mutationFn: async ({ id, nextStatus }) => {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData?.user?.email ?? "admin";

      const now = new Date().toISOString();
      const patch = {
        st_application_status: nextStatus,
        st_updated_at: now,
      };

      // Assumption:
      // Approved => reviewed_by/at
      // Enrolled => approved_by/at
      if (nextStatus === "Approved") {
        patch.st_reviewed_by = email;
        patch.st_reviewed_at = now;
      }
      if (nextStatus === "Enrolled") {
        patch.st_approved_by = email;
        patch.st_approved_at = now;
      }

      const { error } = await supabase.from("enrollment").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  function openCreate() {
    setModal({ open: true, mode: "create", row: null });
  }

  function openEdit(row) {
    setModal({ open: true, mode: "edit", row });
  }

  function onDelete(row) {
    const ok = window.confirm(`Delete ${fullName(row)}?`);
    if (!ok) return;
    deleteM.mutate(row.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Enrollment</div>
          <div className="text-xs text-black/55">
            Manage applicants (CRUD), filter/search, and update status.
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-black/10 bg-white/60 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Student name">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="Search last/first name…"
                className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
              />
            </div>
          </Field>

          <Field label="Status">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", ...STATUS_OPTIONS].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Track">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", ...TRACK_OPTIONS].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grade">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", ...GRADE_OPTIONS].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabBtn active={tab === "All Applicants"} onClick={() => setTab("All Applicants")} label="All Applicants" count={counts.all} />
            <TabBtn active={tab === "Pending"} onClick={() => setTab("Pending")} label="Pending" count={counts.pending} accent="gold" />
            <TabBtn active={tab === "Approval"} onClick={() => setTab("Approval")} label="Approved" count={counts.approval} accent="brown" />
          </div>

          <button
            onClick={() => {
              setQName("");
              setFStatus("All");
              setFTrack("All");
              setFGrade("All");
              setTab("All Applicants");
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
          >
            <Filter className="h-4 w-4 text-black/60" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">List of Students</div>
          <div className="text-xs text-black/55">
            Showing {filtered.length} of {rows.length}
          </div>
        </div>

        {enrollmentsQ.isLoading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : enrollmentsQ.isError ? (
          <div className="p-6 text-sm text-rose-700">
            Error: {String(enrollmentsQ.error?.message || enrollmentsQ.error)}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Student Number</th>
                <th className="px-4 py-3 font-semibold">Student Name</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Track</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Change Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/10">
                  <td className="px-4 py-3 text-black/60">{r.st_number || "-"}</td>
                  <td className="px-4 py-3 font-semibold">{fullName(r)}</td>
                  <td className="px-4 py-3 text-black/70">{r.st_grade_level || "-"}</td>
                  <td className="px-4 py-3 text-black/70">{r.st_track || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.st_application_status} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.st_application_status || "Pending"}
                      onChange={(e) => statusM.mutate({ id: r.id, nextStatus: e.target.value })}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-black/45">
                      Reviewed: {r.st_reviewed_by ? `${r.st_reviewed_by}` : "—"}
                    </div>
                    <div className="text-[11px] text-black/45">
                      Approved: {r.st_approved_by ? `${r.st_approved_by}` : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="Edit (allowed fields only)" onClick={() => openEdit(r)} tone="gold">
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
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-black/55">
                    No records found. Try adjusting filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {modal.open ? (
        <EnrollmentModal
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

function EnrollmentModal({ mode, row, onClose, onCreate, onUpdate, busy }) {
  const isEdit = mode === "edit";

  const defaults = useMemo(() => {
    const base = {
      application_id: "",
      st_number: "",
      st_fname: "",
      st_lname: "",
      st_mi: "",
      st_ext: "",
      st_gender: "",
      st_bdate: "",
      st_bplace: "",
      st_current_address: "",
      st_civil_status: "",
      st_previous_school: "",

      st_father_name: "",
      st_mother_name: "",
      st_guardian_name: "",
      st_guardian_contact: "",
      st_guardian_relationship: "",

      st_grade_level: "",
      st_track: "",

      st_admin_notes: "",
    };

    if (!row) return base;

    // Fill from existing row for edit
    return {
      ...base,
      ...pickEditable(row),
      st_bdate: row.st_bdate ? String(row.st_bdate).slice(0, 10) : "",
    };
  }, [row]);

  const form = useForm({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: defaults,
    values: defaults, // keep in sync when opening different rows
  });

  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  function submit(values) {
    if (isEdit) onUpdate(row.id, values);
    else onCreate(values);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div className={`fixed right-4 top-4 bottom-4 z-50 w-[92vw] max-w-2xl rounded-2xl border ${TOKENS.border} ${TOKENS.panel} shadow-xl`}>
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <div>
            <div className="text-sm font-extrabold">{isEdit ? "Edit Student (Allowed fields only)" : "Add Student"}</div>
            <div className="text-xs text-black/55">
              Terms/status/admin fields (except notes) and timestamps are system-controlled.
            </div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="h-[calc(100%-64px)] overflow-auto p-4 space-y-4">
          {/* Student Info */}
          <Section title="Student Info">
            <Grid>
              <Input label="Application ID" {...register("application_id")} error={errors.application_id?.message} />
              <Input label="Student Number" {...register("st_number")} error={errors.st_number?.message} />
              <Input label="First Name *" {...register("st_fname")} error={errors.st_fname?.message} />
              <Input label="Last Name *" {...register("st_lname")} error={errors.st_lname?.message} />
              <Input label="Middle Initial" {...register("st_mi")} error={errors.st_mi?.message} />
              <Input label="Extension" {...register("st_ext")} error={errors.st_ext?.message} />
              <Input label="Gender" {...register("st_gender")} error={errors.st_gender?.message} />
              <Input label="Birthdate" type="date" {...register("st_bdate")} error={errors.st_bdate?.message} />
              <Input label="Birthplace" {...register("st_bplace")} error={errors.st_bplace?.message} />
              <Input label="Civil Status" {...register("st_civil_status")} error={errors.st_civil_status?.message} />
              <Input label="Previous School" {...register("st_previous_school")} error={errors.st_previous_school?.message} />
              <Input label="Current Address" {...register("st_current_address")} error={errors.st_current_address?.message} />
            </Grid>
          </Section>

          {/* Family Info */}
          <Section title="Family Info">
            <Grid>
              <Input label="Father Name" {...register("st_father_name")} />
              <Input label="Mother Name" {...register("st_mother_name")} />
              <Input label="Guardian Name" {...register("st_guardian_name")} />
              <Input label="Guardian Contact" {...register("st_guardian_contact")} />
              <Input label="Guardian Relationship" {...register("st_guardian_relationship")} />
            </Grid>
          </Section>

          {/* Academic Info */}
          <Section title="Academic Info">
            <Grid>
              <Select label="Grade Level *" {...register("st_grade_level")} error={errors.st_grade_level?.message}>
                <option value="">Select…</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>

              <Select label="Track *" {...register("st_track")} error={errors.st_track?.message}>
                <option value="">Select…</option>
                {TRACK_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Grid>
          </Section>

          {/* Admin Notes (editable) */}
          <Section title="Admin Notes (Editable)">
            <label className="block">
              <span className="text-xs font-semibold text-black/55">Notes</span>
              <textarea
                {...register("st_admin_notes")}
                className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
                rows={4}
              />
            </label>
          </Section>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white">
              Cancel
            </button>
            <button
              disabled={busy}
              type="submit"
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
            >
              <Save className="h-4 w-4" />
              {isEdit ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ---------- small UI helpers ---------- */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ active, label, count, onClick, accent }) {
  const activeCls =
    accent === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : accent === "brown"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : "bg-black/5 text-black/70";

  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-sm font-semibold transition " +
        (active ? activeCls : "bg-white/70 hover:bg-white")
      }
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-extrabold text-black/60">{count}</span>
    </button>
  );
}

function StatusPill({ value }) {
  const v = norm(value || "Pending");
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

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value || "Pending"}</span>;
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : tone === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90"
      : "bg-white/70 text-black/65 hover:bg-white";

  return (
    <button title={title} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-2xl border border-black/10 ${cls}`}>
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className={`text-sm font-extrabold ${TOKENS.brown}`}>{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Input({ label, error, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        type={type}
        {...rest}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function Select({ label, error, children, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        {...rest}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

/* ---------- utils ---------- */

function fullName(r) {
  const ext = r.st_ext?.trim() ? ` ${r.st_ext.trim()}` : "";
  const mi = r.st_mi?.trim() ? ` ${r.st_mi.trim()}.` : "";
  return `${r.st_lname || ""}, ${r.st_fname || ""}${ext}${mi}`.trim();
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function pickEditable(obj) {
  // only allow edits for: student + family + academic + admin_notes
  return {
    application_id: obj.application_id ?? "",
    st_number: obj.st_number ?? "",

    st_fname: obj.st_fname ?? "",
    st_lname: obj.st_lname ?? "",
    st_mi: obj.st_mi ?? "",
    st_ext: obj.st_ext ?? "",
    st_gender: obj.st_gender ?? "",
    st_bdate: obj.st_bdate || null,
    st_bplace: obj.st_bplace ?? "",
    st_current_address: obj.st_current_address ?? "",
    st_civil_status: obj.st_civil_status ?? "",
    st_previous_school: obj.st_previous_school ?? "",

    st_father_name: obj.st_father_name ?? "",
    st_mother_name: obj.st_mother_name ?? "",
    st_guardian_name: obj.st_guardian_name ?? "",
    st_guardian_contact: obj.st_guardian_contact ?? "",
    st_guardian_relationship: obj.st_guardian_relationship ?? "",

    st_grade_level: obj.st_grade_level ?? "",
    st_track: obj.st_track ?? "",

    st_admin_notes: obj.st_admin_notes ?? "",
  };
}
