import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Trash2, Pencil, Shield, X, Save, Upload } from "lucide-react";
import { TOKENS } from "../../styles/tokens.js";

const ROLE_OPTIONS = ["Super Admin", "Admin", "Moderator", "Staff"];
const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"];

const PERMS = [
  "View Students",
  "Add Students",
  "Edit Students",
  "Delete Students",
  "Approve Enrollments",
  "Manage Payments",
  "View Reports",
  "Export Data",
  "Manage Subjects/Classes",
  "Manage Faculty",
  "System Settings Access",
  "View Audit Logs",
];

const MOCK_ADMINS = [
  {
    id: "ADM-2025-0001",
    fullName: "Juan Dela Cruz",
    email: "juan@grabsum.edu",
    role: "Super Admin",
    status: "Active",
    phone: "0917-000-0000",
    dept: "IT",
    createdAt: "2025-01-10",
    lastLogin: "2025-12-18 09:12",
    perms: new Set(PERMS),
    avatarUrl: "",
  },
  {
    id: "ADM-2025-0002",
    fullName: "Maria Santos",
    email: "maria@grabsum.edu",
    role: "Admin",
    status: "Active",
    phone: "0917-111-2222",
    dept: "Registrar",
    createdAt: "2025-02-05",
    lastLogin: "2025-12-17 18:04",
    perms: new Set(["View Students", "Add Students", "Edit Students", "Approve Enrollments"]),
    avatarUrl: "",
  },
];

function nextAdminId(existing) {
  const year = new Date().getFullYear();
  const prefix = `ADM-${year}-`;
  const nums = existing
    .map((a) => String(a.id || ""))
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export default function AdminManagement() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(MOCK_ADMINS);
  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.id} ${r.fullName} ${r.email} ${r.role} ${r.status}`.toLowerCase().includes(needle)
    );
  }, [q, rows]);

  function openCreate() {
    setModal({
      open: true,
      mode: "create",
      row: {
        id: nextAdminId(rows),
        fullName: "",
        email: "",
        role: "Admin",
        status: "Active",
        phone: "",
        dept: "",
        createdAt: new Date().toISOString().slice(0, 10),
        lastLogin: "—",
        perms: new Set(),
        avatarUrl: "",
      },
    });
  }

  function openEdit(r) {
    setModal({ open: true, mode: "edit", row: { ...r, perms: new Set(r.perms || []) } });
  }

  function close() {
    setModal({ open: false, mode: "create", row: null });
  }

  function save(next) {
    setRows((prev) => {
      const idx = prev.findIndex((p) => p.id === next.id);
      if (idx >= 0) return prev.map((p) => (p.id === next.id ? next : p));
      return [next, ...prev];
    });
    close();
  }

  function del(id) {
    const ok = window.confirm(`Delete ${id}?`);
    if (!ok) return;
    setRows((prev) => prev.filter((p) => p.id !== id));
  }

  function toggleStatus(r) {
    const next = r.status === "Active" ? "Suspended" : "Active";
    setRows((prev) => prev.map((p) => (p.id === r.id ? { ...p, status: next } : p)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Admin Account Management</div>
          <div className="text-xs text-black/55">
            UI-only: create/edit/suspend admins. Wire to Supabase later.
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

      <div className={`rounded-2xl border ${TOKENS.border} bg-white/60 p-4`}>
        <div className="relative md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search admins…"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
          />
        </div>
      </div>

      <div className={`overflow-hidden rounded-2xl border ${TOKENS.border} bg-white/70`}>
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">Admin Accounts</div>
          <div className="text-xs text-black/55">
            Showing {filtered.length} of {rows.length}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs text-black/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Admin ID</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date Created</th>
                <th className="px-4 py-3 font-semibold">Last Login</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/10 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.fullName} url={r.avatarUrl} />
                      <div>
                        <div className="font-semibold">{r.fullName}</div>
                        <div className="text-xs text-black/55">{r.dept || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.id}</td>
                  <td className="px-4 py-3 text-black/70">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{r.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3 text-black/70">{r.createdAt}</td>
                  <td className="px-4 py-3 text-black/70">{r.lastLogin}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconBtn title="Edit" tone="gold" onClick={() => openEdit(r)}>
                        <Pencil className="h-5 w-5" />
                      </IconBtn>
                      <IconBtn
                        title={r.status === "Active" ? "Suspend" : "Activate"}
                        tone="neutral"
                        onClick={() => toggleStatus(r)}
                      >
                        <Shield className="h-5 w-5" />
                      </IconBtn>
                      <IconBtn title="Delete" tone="danger" onClick={() => del(r.id)}>
                        <Trash2 className="h-5 w-5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-black/55">
                    No admins found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {modal.open ? (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/25 backdrop-blur" onClick={close} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`absolute left-1/2 top-1/2 w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border ${TOKENS.border} ${TOKENS.panel} shadow-xl`}
            >
              <AdminModal mode={modal.mode} value={modal.row} onClose={close} onSave={save} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AdminModal({ mode, value, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...value }));
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const pwScore = useMemo(() => strength(pw), [pw]);
  const pwOk = mode === "edit" ? true : pw.length >= 8 && pw === pw2;

  function set(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function togglePerm(p) {
    setDraft((d) => {
      const s = new Set(d.perms || []);
      if (s.has(p)) s.delete(p);
      else s.add(p);
      return { ...d, perms: s };
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-black/10 p-4">
        <div>
          <div className="text-sm font-extrabold">{mode === "edit" ? "Edit Admin" : "Add Admin"}</div>
          <div className="text-xs text-black/55">Center modal • blurred backdrop • gold accents</div>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
          <X className="h-5 w-5 text-black/60" />
        </button>
      </div>

      <div className="max-h-[72vh] overflow-auto p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Admin ID (auto-generated)">
            <input value={draft.id} readOnly className="mt-1 w-full rounded-2xl border border-black/10 bg-white/60 px-3 py-2 text-sm" />
          </Field>

          <Field label="Role">
            <select value={draft.role} onChange={(e) => set("role", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Full name *">
            <input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </Field>

          <Field label="Email *">
            <input value={draft.email} onChange={(e) => set("email", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </Field>

          <Field label="Phone number">
            <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </Field>

          <Field label="Department / Section">
            <input value={draft.dept} onChange={(e) => set("dept", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </Field>

          <Field label="Status">
            <select value={draft.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Profile picture (optional)">
            <button type="button" onClick={() => alert("Wire upload to Supabase Storage later.")} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white">
              <Upload className="h-4 w-4 text-black/60" />
              Upload
            </button>
          </Field>
        </div>

        {mode !== "edit" ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="text-sm font-extrabold">Password *</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Password">
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
                <div className="mt-2 h-2 w-full rounded-full bg-black/10">
                  <div className={`${TOKENS.goldBg} h-2 rounded-full`} style={{ width: `${pwScore}%` }} />
                </div>
                <div className="mt-1 text-xs text-black/55">Strength: {pwScore < 35 ? "Weak" : pwScore < 70 ? "Okay" : "Strong"}</div>
              </Field>
              <Field label="Confirm password">
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
                {pw2 && pw !== pw2 ? <div className="mt-1 text-xs text-rose-700">Passwords do not match</div> : null}
              </Field>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-extrabold">Security</div>
                <div className="text-xs text-black/55">UI-only actions</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => alert("Reset Password email (Supabase) later")} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white">
                  Reset Password
                </button>
                <button type="button" onClick={() => alert("Change Password UI later")} className={`rounded-2xl px-3 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}>
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold">Permissions</div>
              <div className="text-xs text-black/55">Checkbox grid</div>
            </div>
            <button type="button" onClick={() => alert("Save permissions to DB later")} className={`rounded-2xl px-3 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}>
              Save Permissions
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {PERMS.map((p) => (
              <label key={p} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 p-3 hover:bg-white">
                <input type="checkbox" checked={draft.perms?.has(p)} onChange={() => togglePerm(p)} />
                <span className="text-sm font-semibold text-black/70">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!draft.fullName.trim() || !draft.email.trim()) return alert("Full name and Email are required.");
              if (mode !== "edit" && !pwOk) return alert("Password must be at least 8 chars and match confirm.");
              onSave(draft);
            }}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
          >
            <Save className="h-4 w-4" />
            {mode === "edit" ? "Save Changes" : "Create Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function Badge({ children }) {
  return <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">{children}</span>;
}

function StatusPill({ value }) {
  const v = String(value || "").toLowerCase();
  const cls =
    v === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "inactive"
      ? "bg-black/10 text-black/60"
      : "bg-rose-500/10 text-rose-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
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

function Avatar({ name, url }) {
  if (url) return <img alt={name} src={url} className="h-10 w-10 rounded-2xl object-cover border border-black/10" />;
  const letter = (name || "A").trim().slice(0, 1).toUpperCase();
  return (
    <div className={`h-10 w-10 rounded-2xl ${TOKENS.goldSoft} grid place-items-center border border-black/10`}>
      <span className={`text-sm font-black ${TOKENS.gold}`}>{letter}</span>
    </div>
  );
}

function strength(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 25;
  if (/[A-Z]/.test(pw)) score += 20;
  if (/[a-z]/.test(pw)) score += 20;
  if (/[0-9]/.test(pw)) score += 20;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  return Math.min(100, score);
}
