import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient"; // adjust if your path differs
import { TOKENS } from "../../styles/tokens"; // adjust if needed

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Plus, Search, Trash2, Pencil, Eye, X, Save } from "lucide-react";

/**
 * teachers table columns (from your screenshot):
 * - user_id (uuid) [optional input]
 * - employee_number (varchar)
 * - department (varchar)
 * - position (varchar)
 * - status (varchar)
 * - created_at (system)
 * - updated_at (system)
 *
 * Modal must NOT include created_at/updated_at.
 */

const teacherSchema = z.object({
  user_id: z
    .string()
    .uuid("user_id must be a valid UUID")
    .optional()
    .or(z.literal("")),
  employee_number: z.string().min(1, "Employee number is required"),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  status: z.string().min(1, "Status is required"),
});

export default function Management() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const hay = `${r.employee_number || ""} ${r.department || ""} ${r.position || ""} ${r.status || ""} ${r.user_id || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  // CREATE
  const createM = useMutation({
    mutationFn: async (values) => {
      const payload = {
        user_id: values.user_id ? values.user_id : null,
        employee_number: values.employee_number,
        department: values.department,
        position: values.position,
        status: values.status,
      };

      const { error } = await supabase.from("teachers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  // UPDATE
  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const payload = {
        user_id: values.user_id ? values.user_id : null,
        employee_number: values.employee_number,
        department: values.department,
        position: values.position,
        status: values.status,
      };

      const { error } = await supabase.from("teachers").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  // DELETE
  const deleteM = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  function openCreate() {
    setModal({ open: true, mode: "create", row: null });
  }
  function openView(row) {
    setModal({ open: true, mode: "view", row });
  }
  function openEdit(row) {
    setModal({ open: true, mode: "edit", row });
  }
  function closeModal() {
    setModal({ open: false, mode: "create", row: null });
  }

  function onDelete(row) {
    const ok = window.confirm(`Delete teacher ${row.employee_number}?`);
    if (!ok) return;
    deleteM.mutate(row.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Teacher • Management</div>
          <div className="text-xs text-black/55">Add, view, update, and delete teacher records.</div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Teacher
        </button>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-black/10 bg-white/60 p-4">
        <div className="relative md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee #, department, position, status…"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">Teachers</div>
          <div className="text-xs text-black/55">Showing {filtered.length} of {rows.length}</div>
        </div>

        {teachersQ.isLoading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : teachersQ.isError ? (
          <div className="p-6 text-sm text-rose-700">
            Error: {String(teachersQ.error?.message || teachersQ.error)}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee #</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">User ID</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/10">
                  <td className="px-4 py-3 font-semibold">{r.employee_number}</td>
                  <td className="px-4 py-3 text-black/70">{r.department}</td>
                  <td className="px-4 py-3 text-black/70">{r.position}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3 text-black/60">{r.user_id || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="View" onClick={() => openView(r)} tone="neutral">
                        <Eye className="h-5 w-5" />
                      </IconBtn>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-black/55">
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
          mode={modal.mode}
          row={modal.row}
          onClose={closeModal}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(id, values) => updateM.mutate({ id, values })}
          busy={createM.isPending || updateM.isPending}
        />
      ) : null}
    </div>
  );
}

function TeacherModal({ mode, row, onClose, onCreate, onUpdate, busy }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const defaults = useMemo(() => {
    const base = {
      user_id: "",
      employee_number: "",
      department: "",
      position: "",
      status: "Active",
    };

    if (!row) return base;
    return {
      user_id: row.user_id ?? "",
      employee_number: row.employee_number ?? "",
      department: row.department ?? "",
      position: row.position ?? "",
      status: row.status ?? "Active",
    };
  }, [row]);

  const form = useForm({
    resolver: zodResolver(teacherSchema),
    defaultValues: defaults,
    values: defaults,
  });

  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  function submit(values) {
    if (isEdit) onUpdate(row.id, values);
    if (!isView && !isEdit) onCreate(values); // create mode
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div className={`fixed right-4 top-4 bottom-4 z-50 w-[92vw] max-w-xl rounded-2xl border ${TOKENS.border} ${TOKENS.panel} shadow-xl`}>
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <div>
            <div className="text-sm font-extrabold">
              {isView ? "View Teacher" : isEdit ? "Edit Teacher" : "Add Teacher"}
            </div>
            <div className="text-xs text-black/55">
              created_at / updated_at are system-generated (not editable).
            </div>
          </div>

          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="h-[calc(100%-64px)] overflow-auto p-4 space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className={`text-sm font-extrabold ${TOKENS.brown}`}>Teacher Info</div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="Employee Number *" disabled={isView} error={errors.employee_number?.message} {...register("employee_number")} />
              <Input label="Department *" disabled={isView} error={errors.department?.message} {...register("department")} />
              <Input label="Position *" disabled={isView} error={errors.position?.message} {...register("position")} />
              <Select label="Status *" disabled={isView} error={errors.status?.message} {...register("status")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
              </Select>

              {/* Optional user_id */}
              <Input
                label="User ID (optional UUID)"
                disabled={isView}
                error={errors.user_id?.message}
                {...register("user_id")}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white">
              Close
            </button>

            {!isView ? (
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

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value || "-"}</span>;
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
