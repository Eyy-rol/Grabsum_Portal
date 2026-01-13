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

/* ===================== Toast ===================== */

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-2xl border bg-white p-4 shadow-xl ${
            t.tone === "danger"
              ? "border-rose-200"
              : t.tone === "success"
              ? "border-emerald-200"
              : "border-black/10"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-black">{t.title}</div>
              {t.message ? (
                <div className="mt-1 text-xs font-semibold text-black/60">
                  {t.message}
                </div>
              ) : null}

              {t.actions?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className={`rounded-xl px-3 py-2 text-xs font-extrabold ${
                        a.variant === "danger"
                          ? "bg-rose-600 text-white"
                          : a.variant === "primary"
                          ? "bg-[#C9A227] text-black"
                          : "border border-black/10 bg-white text-black/70"
                      }`}
                      type="button"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5"
              title="Close"
              type="button"
            >
              <X className="h-4 w-4 text-black/50" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = (toast) => {
    const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
    const item = { id, tone: "info", ...toast };
    setToasts((p) => [item, ...p]);

    if (!item.actions?.length) {
      setTimeout(() => {
        setToasts((p) => p.filter((x) => x.id !== id));
      }, 3200);
    }
    return id;
  };

  const dismiss = (id) => setToasts((p) => p.filter((x) => x.id !== id));

  const confirm = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    tone = "danger",
  }) =>
    new Promise((resolve) => {
      const id = push({
        title,
        message,
        tone,
        actions: [
          {
            label: cancelText,
            variant: "secondary",
            onClick: () => {
              dismiss(id);
              resolve(false);
            },
          },
          {
            label: confirmText,
            variant: tone === "danger" ? "danger" : "primary",
            onClick: () => {
              dismiss(id);
              resolve(true);
            },
          },
        ],
      });
    });

  return { toasts, push, dismiss, confirm };
}

/* ===================== Page ===================== */

export default function AdminManagement() {
  const qc = useQueryClient();
  const toast = useToasts();

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dev-admins"] });
      toast.push({ tone: "success", title: "Created", message: "Admin account created." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Create failed", message: errMsg(e) }),
  });

  // ======================
  // UPDATE ADMIN (admins + profiles)
  // NOTE: We do NOT change auth email here.
  // ======================
  const updateM = useMutation({
    mutationFn: async ({ user_id, values }) => {
      // ✅ enforce rule:
      // if archived => active must be false
      const willArchive = !!values.is_archived;
      const nextActive = willArchive ? false : !!values.is_active;

      // admins metadata
      const { error: aErr } = await supabase
        .from("admins")
        .update({
          department: values.department || null,
          phone: values.phone || null,
          is_active: nextActive,
          is_archived: willArchive,
        })
        .eq("user_id", user_id);

      if (aErr) throw aErr;

      // profiles: role controls admin vs super_admin
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          role: values.role, // ✅ admin or super_admin
          is_active: nextActive,
          is_archived: willArchive,
        })
        .eq("user_id", user_id);

      if (pErr) throw pErr;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dev-admins"] });
      toast.push({ tone: "success", title: "Saved", message: "Admin updated." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Update failed", message: errMsg(e) }),
  });

  // ======================
  // ARCHIVE / RESTORE (sync both + disable access)
  // RULE:
  // - archive  => is_archived=true AND is_active=false
  // - restore  => is_archived=false AND is_active=true
  // ======================
  const archiveM = useMutation({
    mutationFn: async ({ user_id, makeArchived }) => {
      const patch = makeArchived
        ? { is_archived: true, is_active: false }
        : { is_archived: false, is_active: true };

      const { error: aErr } = await supabase
        .from("admins")
        .update(patch)
        .eq("user_id", user_id);
      if (aErr) throw aErr;

      const { error: pErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user_id);
      if (pErr) throw pErr;
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["dev-admins"] });

      if (vars.makeArchived) {
        toast.push({
          tone: "success",
          title: "Archived",
          message: "Access disabled. They can login again only after restore.",
        });
      } else {
        toast.push({
          tone: "success",
          title: "Restored",
          message: "Access enabled again.",
        });
      }
    },
    onError: (e) => toast.push({ tone: "danger", title: "Action failed", message: errMsg(e) }),
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
    onSuccess: () => {
      toast.push({ tone: "success", title: "Password reset", message: "Temporary password generated." });
    },
    onError: (e) => toast.push({ tone: "danger", title: "Reset failed", message: errMsg(e) }),
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

  async function onArchiveToggle(row) {
    const email = row?.profiles?.email || row.user_id;
    const makeArchived = !row.is_archived;

    const ok = await toast.confirm({
      title: makeArchived ? "Archive admin?" : "Restore admin?",
      message: makeArchived
        ? `Archiving will DISABLE access immediately for: ${email}`
        : `Restoring will ENABLE access again for: ${email}`,
      confirmText: makeArchived ? "Archive" : "Restore",
      cancelText: "Cancel",
      tone: makeArchived ? "danger" : "info",
    });

    if (!ok) return;
    archiveM.mutate({ user_id: row.user_id, makeArchived });
  }

  async function onResetPassword(row) {
    const email = row?.profiles?.email || row.user_id;

    const ok = await toast.confirm({
      title: "Reset password?",
      message: `Reset password for ${email}?`,
      confirmText: "Reset",
      cancelText: "Cancel",
      tone: "danger",
    });

    if (!ok) return;
    resetPwdM.mutate({ user_id: row.user_id });
  }

  const busy =
    createM.isPending || updateM.isPending || archiveM.isPending || resetPwdM.isPending;

  return (
    <div className="space-y-4">
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Admin Accounts</div>
          <div className="text-xs text-black/55">
            Create and manage admin & super admin accounts (role stored in profiles.role)
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
          disabled={busy}
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
                onClick={() => {
                  navigator.clipboard.writeText(String(creds.email || ""));
                  toast.push({ tone: "success", title: "Copied", message: "Email copied." });
                }}
                type="button"
              >
                Copy
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-black/60">Temp Password:</span>
              <span className="font-extrabold">{creds.tempPassword}</span>
              <button
                className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:bg-white/80"
                onClick={() => {
                  navigator.clipboard.writeText(String(creds.tempPassword || ""));
                  toast.push({ tone: "success", title: "Copied", message: "Password copied." });
                }}
                type="button"
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
              type="button"
            >
              Active
            </button>
            <button
              onClick={() => setTab("archived")}
              className={`rounded-2xl px-4 py-2 text-sm font-extrabold border border-black/10 ${
                tab === "archived" ? "bg-white" : "bg-white/60"
              }`}
              type="button"
            >
              Archived
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">
            {tab === "archived" ? "Archived Admins" : "Admins"}
          </div>
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

                          <IconBtn title="Archive (disable access)" onClick={() => onArchiveToggle(r)} tone="danger">
                            <Trash2 className="h-5 w-5" />
                          </IconBtn>
                        </>
                      ) : (
                        <IconBtn title="Restore (enable access)" onClick={() => onArchiveToggle(r)} tone="neutral">
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
          toast={toast}
          onClose={closeModal}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={(user_id, values) => updateM.mutate({ user_id, values })}
        />
      ) : null}
    </div>
  );
}

/** ======================
 *  MODAL
 *  ====================== */
function AdminModal({ mode, row, onClose, onCreate, onUpdate, busy, toast }) {
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
      toast.push({ tone: "danger", title: "Validation", message: "Full name is required." });
      return;
    }

    // On CREATE: email required
    if (!isEdit && !isView && !draft.email.trim()) {
      toast.push({ tone: "danger", title: "Validation", message: "Email is required." });
      return;
    }

    // ✅ enforce rule inside modal too:
    // if archived => active must be false
    const willArchive = !!draft.is_archived;
    const nextActive = willArchive ? false : !!draft.is_active;

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
        is_active: nextActive,
        is_archived: willArchive,
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

          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5"
            type="button"
          >
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <div className="h-[calc(100%-64px)] overflow-auto p-4 space-y-4">
          {/* Email: create only */}
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
                  disabled={isView || !!draft.is_archived} // ✅ if archived, active is forced false
                  checked={!!draft.is_active && !draft.is_archived}
                  onChange={(e) => set("is_active", e.target.checked)}
                />
                Active
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  disabled={isView}
                  checked={!!draft.is_archived}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    set("is_archived", checked);
                    if (checked) set("is_active", false); // ✅ force off
                  }}
                />
                Archived (disables access)
              </label>

              {draft.is_archived ? (
                <div className="text-xs font-semibold text-rose-700">
                  Archived admins cannot access their account until restored.
                </div>
              ) : null}
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
      type="button"
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
