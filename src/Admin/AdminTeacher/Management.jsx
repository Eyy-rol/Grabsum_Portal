// Management.jsx (FIXED: teachers + role-aware UI; Staff/Admin = view-only, Super Admin = full control)
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { TOKENS } from "../../styles/tokens";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Eye,
  X,
  Save,
  ArchiveRestore,
  KeyRound,
} from "lucide-react";

/**
 * ROLE RULES:
 * - admin/staff: view-only
 * - super_admin: create/edit/archive/restore/reset password
 *
 * FIXES INCLUDED:
 * 1) Modal form now updates when switching row/mode (react-hook-form reset + key)
 * 2) Create/Update/Archive/Reset blocked both in UI + mutation guard
 * 3) Archived tab shows only restore (not archive/delete) + clearer buttons
 * 4) Prevent "Archive" + "Delete (Archive)" duplication (kept ONE archive action)
 * 5) Better "archived" icon usage (ArchiveRestore used for restore; archive uses same with label)
 */

const teacherSchema = z.object({
  employee_number: z.string().optional().or(z.literal("")),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Email must be valid"),
  contact_number: z.string().optional().or(z.literal("")),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  status: z.string().min(1, "Status is required"),
  is_archived: z.boolean().default(false),
});

function errMsg(e) {
  return String(e?.message || e || "Unknown error");
}

/** fetch my role once */
async function fetchMyRole() {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  const user = sess?.session?.user;
  if (!user?.id) return null;

  const { data: prof, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (prof?.role || "").toLowerCase() || null;
}

export default function Management() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("active"); // "active" | "archived"

  const [modal, setModal] = useState({
    open: false,
    mode: "create", // "create" | "view" | "edit"
    row: null,
  });

  const [creds, setCreds] = useState(null); // { employee_number, tempPassword, user_id }

  // Role query
  const roleQ = useQuery({
    queryKey: ["me", "role"],
    queryFn: fetchMyRole,
    staleTime: 60_000,
  });

  const role = roleQ.data || null;
  const isSuperAdmin = role === "super_admin";
  const canManage = isSuperAdmin;

  const requireSuperAdmin = () => {
    if (!canManage) throw new Error("View-only: Super Admin required.");
  };

  const teachersQ = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = teachersQ.data ?? [];

  const visibleRows = useMemo(() => {
    const wantArchived = tab === "archived";
    return rows.filter((r) => Boolean(r.is_archived) === wantArchived);
  }, [rows, tab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visibleRows;

    return visibleRows.filter((r) => {
      const hay =
        `${r.employee_number || ""} ${r.department || ""} ${r.position || ""} ${r.status || ""} ` +
        `${r.first_name || ""} ${r.last_name || ""} ${r.email || ""} ${r.contact_number || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [visibleRows, q]);

  // CREATE via Edge Function: create-teacher
  const createM = useMutation({
    mutationFn: async (values) => {
      requireSuperAdmin();
      setCreds(null);

      const { data, error } = await supabase.functions.invoke("create-teacher", {
        body: {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          contact_number: values.contact_number || null,
          department: values.department,
          position: values.position,
          status: values.status,
        },
      });

      if (error) throw error;
      if (!data?.employee_number || !data?.tempPassword) {
        throw new Error("Edge function did not return employee_number/tempPassword.");
      }

      setCreds({
        employee_number: data.employee_number,
        tempPassword: data.tempPassword,
        user_id: data.user_id,
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  // UPDATE (teachers table only)
  const updateM = useMutation({
    mutationFn: async ({ user_id, values }) => {
      requireSuperAdmin();

      const payload = {
        department: values.department,
        position: values.position,
        status: values.status,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        contact_number: values.contact_number ? values.contact_number : null,
        // NOTE: archive/restore is handled by archiveM, not edit form checkbox.
      };

      const { error } = await supabase.from("teachers").update(payload).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  // ARCHIVE / RESTORE (teachers + profiles)
  const archiveM = useMutation({
    mutationFn: async ({ user_id, is_archived }) => {
      requireSuperAdmin();

      const { error: tErr } = await supabase
        .from("teachers")
        .update({ is_archived })
        .eq("user_id", user_id);
      if (tErr) throw tErr;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ is_archived })
        .eq("user_id", user_id);
      if (pErr) throw pErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  // Reset Password via Edge Function
  const resetPwdM = useMutation({
    mutationFn: async ({ user_id }) => {
      requireSuperAdmin();
      setCreds(null);

      const { data, error } = await supabase.functions.invoke("admin-reset-teacher-password", {
        body: { user_id },
      });

      if (error) throw error;
      if (!data?.tempPassword) throw new Error("Edge function did not return tempPassword.");

      const row = rows.find((r) => r.user_id === user_id);
      setCreds({
        employee_number: row?.employee_number,
        tempPassword: data.tempPassword,
        user_id,
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  function openCreate() {
    if (!canManage) return;
    setCreds(null);
    setModal({ open: true, mode: "create", row: null });
  }

  function openView(row) {
    setCreds(null);
    setModal({ open: true, mode: "view", row });
  }

  function openEdit(row) {
    if (!canManage) return;
    setCreds(null);
    setModal({ open: true, mode: "edit", row });
  }

  function closeModal() {
    setModal({ open: false, mode: "create", row: null });
  }

  function onArchive(row) {
    if (!canManage) return;
    const ok = window.confirm(
      `Archive teacher ${row.employee_number}? (Hidden from UI. You can restore from Archived tab.)`
    );
    if (!ok) return;
    archiveM.mutate({ user_id: row.user_id, is_archived: true });
  }

  function onRestore(row) {
    if (!canManage) return;
    archiveM.mutate({ user_id: row.user_id, is_archived: false });
  }

  function onResetPassword(row) {
    if (!canManage) return;
    const ok = window.confirm(
      `Reset password for ${row.employee_number}? This will generate a new temp password and force password change on next login.`
    );
    if (!ok) return;
    resetPwdM.mutate({ user_id: row.user_id });
  }

  const busy = createM.isPending || updateM.isPending || archiveM.isPending || resetPwdM.isPending;

  const actionTip = !canManage
    ? "View-only (Super Admin required for create/edit/archive/restore/reset)."
    : "You have full access.";

  const roleBadge = canManage ? (
    <span className="ml-2 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 px-2 py-0.5 text-[11px] font-semibold text-[#6B4E2E]">
      Can manage
    </span>
  ) : (
    <span className="ml-2 rounded-full border border-black/10 bg-black/[0.02] px-2 py-0.5 text-[11px] font-semibold text-black/60">
      Read-only
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">
            Teacher • Management {roleBadge}
          </div>
          <div className="text-xs text-black/55">{actionTip}</div>
        </div>

        <button
          onClick={openCreate}
          disabled={!canManage}
          title={!canManage ? "View-only (Super Admin required)" : "Add Teacher"}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95 disabled:opacity-50`}
        >
          <Plus className="h-4 w-4" />
          Add Teacher
        </button>
      </div>

      {/* Credentials banner (after create/reset) */}
      {creds ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-extrabold">Login Credentials</div>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-black/60">Username (Employee #):</span>
              <span className="font-extrabold">{creds.employee_number || "-"}</span>
              <button
                type="button"
                className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:bg-white/80"
                onClick={() => navigator.clipboard.writeText(String(creds.employee_number || ""))}
              >
                Copy
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-black/60">Temp Password:</span>
              <span className="font-extrabold">{creds.tempPassword}</span>
              <button
                type="button"
                className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:bg-white/80"
                onClick={() => navigator.clipboard.writeText(String(creds.tempPassword || ""))}
              >
                Copy
              </button>
            </div>
            <div className="text-xs text-black/55">
              Teacher will be forced to change password after login.
            </div>
          </div>
        </div>
      ) : null}

      {/* Search + Tabs */}
      <div className="rounded-2xl border border-black/10 bg-white/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative md:max-w-md w-full md:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, employee #, department, status…"
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`rounded-2xl px-4 py-2 text-sm font-extrabold border border-black/10 ${
                tab === "active" ? "bg-white" : "bg-white/60"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTab("archived")}
              className={`rounded-2xl px-4 py-2 text-sm font-extrabold border border-black/10 ${
                tab === "archived" ? "bg-white" : "bg-white/60"
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">{tab === "archived" ? "Archived Teachers" : "Teachers"}</div>
          <div className="text-xs text-black/55">Showing {filtered.length} of {visibleRows.length}</div>
        </div>

        {teachersQ.isLoading || roleQ.isLoading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : teachersQ.isError ? (
          <div className="p-6 text-sm text-rose-700">Error: {errMsg(teachersQ.error)}</div>
        ) : roleQ.isError ? (
          <div className="p-6 text-sm text-rose-700">Role error: {errMsg(roleQ.error)}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee #</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-t border-black/10">
                  <td className="px-4 py-3 font-semibold">{r.employee_number}</td>
                  <td className="px-4 py-3 font-semibold">
                    {r.last_name}, {r.first_name}
                  </td>
                  <td className="px-4 py-3 text-black/70">{r.email || "-"}</td>
                  <td className="px-4 py-3 text-black/70">{r.contact_number || "-"}</td>
                  <td className="px-4 py-3 text-black/70">{r.department}</td>
                  <td className="px-4 py-3 text-black/70">{r.position}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="View" onClick={() => openView(r)} tone="neutral">
                        <Eye className="h-5 w-5" />
                      </IconBtn>

                      {canManage ? (
                        tab === "active" ? (
                          <>
                            <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold">
                              <Pencil className="h-5 w-5" />
                            </IconBtn>

                            <IconBtn title="Reset Password" onClick={() => onResetPassword(r)} tone="neutral">
                              <KeyRound className="h-5 w-5" />
                            </IconBtn>

                            <IconBtn title="Archive" onClick={() => onArchive(r)} tone="neutral">
                              <ArchiveRestore className="h-5 w-5" />
                            </IconBtn>
                          </>
                        ) : (
                          <IconBtn title="Restore" onClick={() => onRestore(r)} tone="neutral">
                            <ArchiveRestore className="h-5 w-5" />
                          </IconBtn>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-black/55">
                    No teachers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {modal.open ? (
        <TeacherModal
          // KEY forces remount so RHF defaults always match current row/mode
          key={`${modal.mode}:${modal.row?.user_id || "new"}`}
          mode={modal.mode}
          row={modal.row}
          onClose={closeModal}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(user_id, values) => updateM.mutate({ user_id, values })}
          busy={busy}
          canManage={canManage}
        />
      ) : null}

      {/* lightweight feedback */}
      {createM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Create error: {errMsg(createM.error)}
        </div>
      ) : null}
      {resetPwdM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Reset password error: {errMsg(resetPwdM.error)}
        </div>
      ) : null}
      {updateM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Update error: {errMsg(updateM.error)}
        </div>
      ) : null}
      {archiveM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Archive/restore error: {errMsg(archiveM.error)}
        </div>
      ) : null}
    </div>
  );
}

function TeacherModal({ mode, row, onClose, onCreate, onUpdate, busy, canManage }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  // hard safety: staff cannot save even if modal opened somehow
  const allowWrite = canManage && !isView;

  const defaults = useMemo(() => {
    const base = {
      employee_number: "",
      department: "",
      position: "",
      status: "Active",
      first_name: "",
      last_name: "",
      email: "",
      contact_number: "",
      is_archived: false,
    };

    if (!row) return base;

    return {
      employee_number: row.employee_number ?? "",
      department: row.department ?? "",
      position: row.position ?? "",
      status: row.status ?? "Active",
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
      email: row.email ?? "",
      contact_number: row.contact_number ?? "",
      is_archived: Boolean(row.is_archived),
    };
  }, [row]);

  const form = useForm({
    resolver: zodResolver(teacherSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const { register, handleSubmit, formState, reset } = form;
  const { errors } = formState;

  // ✅ Fix: update form values when row/mode changes
  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  function submit(values) {
    if (!allowWrite) return;

    if (isEdit) {
      onUpdate(row.user_id, values);
      onClose();
      return;
    }

    if (isCreate) {
      onCreate(values);
      onClose();
      return;
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div
        className={`fixed right-4 top-4 bottom-4 z-50 w-[92vw] max-w-xl rounded-2xl border ${TOKENS.border} ${TOKENS.panel} shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <div>
            <div className="text-sm font-extrabold">
              {isView ? "View Teacher" : isEdit ? "Edit Teacher" : "Add Teacher"}
            </div>
            <div className="text-xs text-black/55">
              Employee # is generated by the server (Edge Function).
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5"
          >
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="h-[calc(100%-64px)] overflow-auto p-4 space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className={`text-sm font-extrabold ${TOKENS.brown}`}>Teacher Info</div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                label="Employee Number"
                disabled={true}
                error={errors.employee_number?.message}
                placeholder={isCreate ? "Auto-generated on create" : ""}
                {...register("employee_number")}
              />

              <Input label="First Name *" disabled={isView || !canManage} error={errors.first_name?.message} {...register("first_name")} />
              <Input label="Last Name *" disabled={isView || !canManage} error={errors.last_name?.message} {...register("last_name")} />

              <Input label="Email (real) *" disabled={isView || !canManage} error={errors.email?.message} {...register("email")} />
              <Input label="Contact Number" disabled={isView || !canManage} error={errors.contact_number?.message} {...register("contact_number")} />

              <Input label="Department *" disabled={isView || !canManage} error={errors.department?.message} {...register("department")} />
              <Input label="Position *" disabled={isView || !canManage} error={errors.position?.message} {...register("position")} />

              <Select label="Status *" disabled={isView || !canManage} error={errors.status?.message} {...register("status")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>

              {/* Keep checkbox for DISPLAY in view/edit, but don't rely on it for archiving (archive/restore is table action) */}
              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm">
                <input type="checkbox" disabled={true} {...register("is_archived")} />
                Archived (managed from table)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            >
              Close
            </button>

            {allowWrite ? (
              <button
                disabled={busy}
                type="submit"
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-4 w-4" />
                {isEdit ? "Save Changes" : "Create Teacher"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}

function StatusPill({ value }) {
  const v = String(value || "").toLowerCase();
  const cls =
    v === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "inactive"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-[#6B4E2E]/10 text-[#6B4E2E]";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {value || "-"}
    </span>
  );
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : tone === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90"
      : "bg-white/70 text-black/65 hover:bg-white";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-2xl border border-black/10 ${cls}`}
    >
      {children}
    </button>
  );
}

function Input({ label, error, disabled, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        disabled={disabled}
        {...rest}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white disabled:opacity-60"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function Select({ label, error, disabled, children, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        disabled={disabled}
        {...rest}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white disabled:opacity-60"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}
