// src/dev/pages/AdminManagement.jsx
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { TOKENS } from "../../styles/tokens";
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

function errMsg(e) {
  return String(e?.message || e || "Unknown error");
}

const ROLE_OPTIONS = [
  { value: "admin", label: "admin" },
  { value: "super_admin", label: "super_admin" },
];

export default function AdminManagement() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("active"); // active | archived
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });
  const [creds, setCreds] = useState(null); // { email, tempPassword, user_id }

  /**
   * ✅ FETCH ADMINS + PROFILE JOIN
   * Requires FK: admins.user_id -> profiles.user_id (admins_profile_fkey)
   */
  const adminsQ = useQuery({
    queryKey: ["dev-admins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admins")
        .select(`
          user_id,
          department,
          phone,
          is_active,
          is_archived,
          created_at,
          updated_at,
          profiles:profiles!admins_profile_fkey (
            email,
            full_name,
            role,
            is_active,
            is_archived,
            must_change_password
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = adminsQ.data ?? [];

  const visibleRows = useMemo(() => {
    const wantArchived = tab === "archived";
    return rows.filter((r) => !!r.is_archived === wantArchived);
  }, [rows, tab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visibleRows;

    return visibleRows.filter((r) => {
      const hay =
        `${r?.profiles?.email || ""} ${r?.profiles?.full_name || ""} ` +
        `${r?.profiles?.role || ""} ${r?.department || ""} ${r?.phone || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [visibleRows, q]);

  // ======================
  // CREATE ADMIN (Edge Function)
  // Body: { email, full_name, role: "admin"|"super_admin", department?, phone? }
  // ======================
  const createM = useMutation({
    mutationFn: async (values) => {
      setCreds(null);
      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: values,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Create failed");

      setCreds({
        email: data.email,
        tempPassword: data.tempPassword,
        user_id: data.user_id,
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dev-admins"] }),
  });

  // ======================
  // UPDATE ADMIN (admins + profiles)
  // NOTE: We do NOT change auth email here.
  // ======================
  const updateM = useMutation({
    mutationFn: async ({ user_id, values }) => {
      // admins metadata
      const { error: aErr } = await supabase
        .from("admins")
        .update({
          department: values.department || null,
          phone: values.phone || null,
          is_active: !!values.is_active,
          is_archived: !!values.is_archived,
        })
        .eq("user_id", user_id);

      if (aErr) throw aErr;

      // profiles: role controls admin vs super_admin
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          role: values.role, // ✅ admin or super_admin
          is_active: !!values.is_active,
          is_archived: !!values.is_archived,
        })
        .eq("user_id", user_id);

      if (pErr) throw pErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dev-admins"] }),
  });

  // ======================
  // ARCHIVE / RESTORE (sync both)
  // ======================
  const archiveM = useMutation({
    mutationFn: async ({ user_id, is_archived }) => {
      const { error: aErr } = await supabase
        .from("admins")
        .update({ is_archived })
        .eq("user_id", user_id);
      if (aErr) throw aErr;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ is_archived })
        .eq("user_id", user_id);
      if (pErr) throw pErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dev-admins"] }),
  });

  // ======================
  // RESET PASSWORD (Edge Function)
  // Body: { user_id }
  // Returns: { ok, user_id, tempPassword }
  // ======================
  const resetPwdM = useMutation({
    mutationFn: async ({ user_id }) => {
      setCreds(null);

      const { data, error } = await supabase.functions.invoke("admin-reset-user-password", {
        body: { user_id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Reset failed");

      // show email using the current row's profile
      const row = rows.find((r) => r.user_id === user_id);
      setCreds({
        email: row?.profiles?.email || "",
        tempPassword: data.tempPassword,
        user_id,
      });

      return data;
    },
  });

  // ======================
  // UI HANDLERS
  // ======================
  function openCreate() {
    setCreds(null);
    setModal({ open: true, mode: "create", row: null });
  }
  function openView(row) {
    setCreds(null);
    setModal({ open: true, mode: "view", row });
  }
  function openEdit(row) {
    setCreds(null);
    setModal({ open: true, mode: "edit", row });
  }
  function closeModal() {
    setModal({ open: false, mode: "create", row: null });
  }

  function onArchiveToggle(row) {
    archiveM.mutate({ user_id: row.user_id, is_archived: !row.is_archived });
  }

  function onResetPassword(row) {
    const ok = window.confirm(`Reset password for ${row?.profiles?.email || row.user_id}?`);
    if (!ok) return;
    resetPwdM.mutate({ user_id: row.user_id });
  }

  const busy =
    createM.isPending || updateM.isPending || archiveM.isPending || resetPwdM.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Admin Accounts</div>
          <div className="text-xs text-black/55">
            Create and manage admin & super admin accounts (role stored in profiles.role)
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      {/* Credentials banner */}
      {creds ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-extrabold">Login Credentials</div>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-black/60">Email:</span>
              <span className="font-extrabold">{creds.email || "-"}</span>
              <button
                className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:bg-white/80"
                onClick={() => navigator.clipboard.writeText(String(creds.email || ""))}
              >
                Copy
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-black/60">Temp Password:</span>
              <span className="font-extrabold">{creds.tempPassword}</span>
              <button
                className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:bg-white/80"
                onClick={() => navigator.clipboard.writeText(String(creds.tempPassword || ""))}
              >
                Copy
              </button>
            </div>

            <div className="text-xs text-black/55">
              User will be forced to change password on next login.
            </div>
          </div>
        </div>
      ) : null}

      {/* Search + Tabs */}
      <div className="rounded-2xl border border-black/10 bg-white/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name, role…"
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("active")}
              className={`rounded-2xl px-4 py-2 text-sm font-extrabold border border-black/10 ${
                tab === "active" ? "bg-white" : "bg-white/60"
              }`}
            >
              Active
            </button>
            <button
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
          <div className="text-sm font-extrabold">{tab === "archived" ? "Archived Admins" : "Admins"}</div>
          <div className="text-xs text-black/55">
            Showing {filtered.length} of {visibleRows.length}
          </div>
        </div>

        {adminsQ.isLoading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : adminsQ.isError ? (
          <div className="p-6 text-sm text-rose-700">Load error: {errMsg(adminsQ.error)}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold">Archived</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-t border-black/10">
                  <td className="px-4 py-3">{r?.profiles?.email || "-"}</td>
                  <td className="px-4 py-3 font-semibold">{r?.profiles?.full_name || "-"}</td>
                  <td className="px-4 py-3 font-semibold">{r?.profiles?.role || "-"}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{r.is_archived ? "Yes" : "No"}</td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="View" onClick={() => openView(r)} tone="neutral">
                        <Eye className="h-5 w-5" />
                      </IconBtn>

                      {!r.is_archived ? (
                        <>
                          <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold">
                            <Pencil className="h-5 w-5" />
                          </IconBtn>

                          <IconBtn title="Reset Password" onClick={() => onResetPassword(r)} tone="neutral">
                            <KeyRound className="h-5 w-5" />
                          </IconBtn>

                          <IconBtn title="Archive" onClick={() => onArchiveToggle(r)} tone="neutral">
                            <ArchiveRestore className="h-5 w-5" />
                          </IconBtn>

                          <IconBtn title="Delete (Archive)" onClick={() => onArchiveToggle(r)} tone="danger">
                            <Trash2 className="h-5 w-5" />
                          </IconBtn>
                        </>
                      ) : (
                        <IconBtn title="Restore" onClick={() => onArchiveToggle(r)} tone="neutral">
                          <ArchiveRestore className="h-5 w-5" />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-black/55">
                    No admin accounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal.open ? (
        <AdminModal
          mode={modal.mode}
          row={modal.row}
          busy={busy}
          onClose={closeModal}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(user_id, values) => updateM.mutate({ user_id, values })}
        />
      ) : null}

      {/* Errors */}
      {createM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Create error: {errMsg(createM.error)}
        </div>
      ) : null}

      {resetPwdM.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Reset error: {errMsg(resetPwdM.error)}
        </div>
      ) : null}
    </div>
  );
}

/** ======================
 *  MODAL
 *  ====================== */
function AdminModal({ mode, row, onClose, onCreate, onUpdate, busy }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [draft, setDraft] = useState(() => ({
    // from profiles
    email: row?.profiles?.email || "",
    full_name: row?.profiles?.full_name || "",
    role: row?.profiles?.role || "admin", // ✅ admin/super_admin

    // from admins (metadata)
    department: row?.department || "",
    phone: row?.phone || "",

    // flags
    is_active: row?.is_active ?? true,
    is_archived: row?.is_archived ?? false,
  }));

  function set(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function submit() {
    if (!draft.full_name.trim()) {
      alert("Full name is required.");
      return;
    }

    // On CREATE: email required
    if (!isEdit && !isView && !draft.email.trim()) {
      alert("Email is required.");
      return;
    }

    // CREATE
    if (!isEdit && !isView) {
      onCreate({
        email: draft.email.trim().toLowerCase(),
        full_name: draft.full_name.trim(),
        role: draft.role,
        department: draft.department || null,
        phone: draft.phone || null,
      });
      onClose();
      return;
    }

    // EDIT
    if (isEdit) {
      onUpdate(row.user_id, {
        full_name: draft.full_name.trim(),
        role: draft.role,
        department: draft.department || null,
        phone: draft.phone || null,
        is_active: !!draft.is_active,
        is_archived: !!draft.is_archived,
      });
      onClose();
      return;
    }

    onClose();
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
              {isView ? "View Admin" : isEdit ? "Edit Admin" : "Add Admin"}
            </div>
            <div className="text-xs text-black/55">
              Role is stored in <b>profiles.role</b> (admin / super_admin).
            </div>
          </div>

          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <div className="h-[calc(100%-64px)] overflow-auto p-4 space-y-4">
          {/* Email: create only (editing auth email requires admin API; keep locked for now) */}
          <Input
            label="Email *"
            disabled={isView || isEdit}
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
          />

          <Input
            label="Full name *"
            disabled={isView}
            value={draft.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />

          <Select
            label="Role (profiles.role)"
            disabled={isView}
            value={draft.role}
            onChange={(e) => set("role", e.target.value)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Input
            label="Department"
            disabled={isView}
            value={draft.department}
            onChange={(e) => set("department", e.target.value)}
          />

          <Input
            label="Phone"
            disabled={isView}
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
          />

          {/* flags only available in edit */}
          {isEdit ? (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  disabled={isView}
                  checked={!!draft.is_active}
                  onChange={(e) => set("is_active", e.target.checked)}
                />
                Active
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  disabled={isView}
                  checked={!!draft.is_archived}
                  onChange={(e) => set("is_archived", e.target.checked)}
                />
                Archived
              </label>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            >
              Close
            </button>

            {!isView ? (
              <button
                disabled={busy}
                type="button"
                onClick={submit}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-4 w-4" />
                {isEdit ? "Save Changes" : "Create Admin"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/** ======================
 *  SMALL COMPONENTS
 *  ====================== */
function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : tone === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90"
      : "bg-white/70 text-black/65 hover:bg-white";

  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-2xl border border-black/10 ${cls}`}
    >
      {children}
    </button>
  );
}

function Input({ label, disabled, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white disabled:opacity-60"
      />
    </label>
  );
}

function Select({ label, disabled, value, onChange, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}
