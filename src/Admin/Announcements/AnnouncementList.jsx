// src/admin/Announcements/AnnouncementList.jsx
// Connected to Supabase: public.announcements
// Requires: @tanstack/react-query + supabase client configured

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient"; // ✅ adjust path if needed

import {
  Plus,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  Filter,
  Megaphone,
  FileText,
  AlertTriangle,
} from "lucide-react";

/* =====================
   CONSTANTS
===================== */

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Published", "Draft"];
const AUDIENCES = ["All Teachers", "All Students"];

const PRIORITY_COLOR = {
  High: "#EF4444",
  Medium: "#F59E0B",
  Low: "#6B7280",
};

/* =====================
   ZOD
===================== */

const announcementSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200, "Max 200 characters"),
  content: z.string().min(20, "Content must be at least 20 characters").max(2000, "Max 2000 characters"),
  priority: z.enum(["High", "Medium", "Low"], { required_error: "Priority is required" }),
  target_audience: z.enum(["All Teachers", "All Students"], { required_error: "Target audience is required" }),
  status: z.enum(["Published", "Draft"], { required_error: "Status is required" }),
});

/* =====================
   HELPERS
===================== */

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clampText(str, n = 120) {
  if (!str) return "";
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

function prRank(v) {
  return v === "High" ? 0 : v === "Medium" ? 1 : 2;
}

/* =====================
   MAIN
===================== */

export default function AnnouncementList() {
  const qc = useQueryClient();

  // search & filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [audience, setAudience] = useState("All");
  const [priority, setPriority] = useState("All");
  const [sortBy, setSortBy] = useState("Newest First");

  // modals
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openView, setOpenView] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // ✅ FETCH from Supabase
  const announcementsQ = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("posted_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const items = announcementsQ.data ?? [];

  const filtered = useMemo(() => {
    let list = [...items];

    // default: hide archived
    list = list.filter((x) => !x.is_archived);

    // search
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((a) => String(a.title || "").toLowerCase().includes(s));
    }

    // filters
    if (status !== "All") list = list.filter((a) => a.status === status);
    if (audience !== "All") list = list.filter((a) => a.target_audience === audience);
    if (priority !== "All") list = list.filter((a) => a.priority === priority);

    // sort
    if (sortBy === "Newest First") {
      list.sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at)));
    } else if (sortBy === "Oldest First") {
      list.sort((a, b) => String(a.posted_at).localeCompare(String(b.posted_at)));
    } else if (sortBy === "Priority") {
      list.sort((a, b) => prRank(a.priority) - prRank(b.priority));
    }

    return list;
  }, [items, q, status, audience, priority, sortBy]);

  const stats = useMemo(() => {
    const total = items.filter((x) => !x.is_archived).length;
    const published = items.filter((x) => !x.is_archived && x.status === "Published").length;
    const drafts = items.filter((x) => !x.is_archived && x.status === "Draft").length;
    const high = items.filter((x) => !x.is_archived && x.priority === "High").length;
    return { total, published, drafts, high };
  }, [items]);

  const clearFilters = () => {
    setQ("");
    setStatus("All");
    setAudience("All");
    setPriority("All");
    setSortBy("Newest First");
  };

  const openCreate = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setOpenForm(true);
  };

  const openDetails = (a) => {
    setViewing(a);
    setOpenView(true);
  };

  const confirmDelete = (a) => {
    setDeleting(a);
    setOpenDelete(true);
  };

  // ✅ CREATE
  const createM = useMutation({
    mutationFn: async (values) => {
      const {
        data: { user },
        error: uerr,
      } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      if (!user) throw new Error("Not authenticated.");

      const payload = {
        posted_by: user.id,
        title: values.title,
        content: values.content,
        priority: values.priority,
        target_audience: values.target_audience,
        status: values.status,
        is_archived: false,
        posted_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("announcements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  // ✅ UPDATE
  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const payload = {
        title: values.title,
        content: values.content,
        priority: values.priority,
        target_audience: values.target_audience,
        status: values.status,
        // updated_at handled by trigger
      };

      const { error } = await supabase.from("announcements").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  // ✅ ARCHIVE (soft delete)
  const archiveM = useMutation({
    mutationFn: async ({ id, is_archived }) => {
      const { error } = await supabase.from("announcements").update({ is_archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  // ✅ HARD DELETE (optional)
  const deleteM = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const saveAnnouncement = (payload) => {
    if (editing) {
      updateM.mutate({ id: editing.id, values: payload });
    } else {
      createM.mutate(payload);
    }
  };

  const deleteAnnouncement = () => {
    if (!deleting) return;
    // choose one: archive instead of delete
    archiveM.mutate({ id: deleting.id, is_archived: true });
    // or hard delete:
    // deleteM.mutate(deleting.id);
    setOpenDelete(false);
  };

  const busy = createM.isPending || updateM.isPending || archiveM.isPending || deleteM.isPending;

  return (
    <div style={ui.page}>
      {/* Header */}
      <div style={ui.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={ui.iconChip}>
            <Megaphone size={18} />
          </div>
          <div>
            <h1 style={ui.title}>Announcements</h1>
            <div style={ui.sub}>Manage announcements for teachers and students</div>
          </div>
        </div>

        <button style={ui.primaryBtn} onClick={openCreate} disabled={busy}>
          <Plus size={18} /> Create Announcement
        </button>
      </div>

      {/* Overview */}
      <div style={ui.kpis}>
        <KpiCard label="Total" value={stats.total} icon={<FileText size={18} />} />
        <KpiCard label="Published" value={stats.published} tone="ok" icon={<FileText size={18} />} />
        <KpiCard label="Drafts" value={stats.drafts} tone="muted" icon={<FileText size={18} />} />
        <KpiCard label="High Priority" value={stats.high} tone="warn" icon={<AlertTriangle size={18} />} />
      </div>

      {/* Toolbar */}
      <div style={ui.toolbar}>
        <div style={ui.searchWrap}>
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title…"
            style={ui.searchInput}
          />
          {q ? (
            <button style={ui.iconBtn} onClick={() => setQ("")} title="Clear search">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div style={ui.toolbarRight}>
          <div style={ui.chipRow}>
            <ChipSelect label="Status" value={status} onChange={setStatus} options={["All", ...STATUSES]} />
            <ChipSelect label="Audience" value={audience} onChange={setAudience} options={["All", ...AUDIENCES]} />
            <ChipSelect label="Priority" value={priority} onChange={setPriority} options={["All", ...PRIORITIES]} />
          </div>

          <div style={ui.sortWrap}>
            <ArrowUpDown size={16} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={ui.select}>
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Priority</option>
            </select>
          </div>

          <button style={ui.ghostBtn} onClick={clearFilters} title="Reset filters">
            <Filter size={16} /> Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={ui.tableCard}>
        <div style={ui.tableHeader}>
          <div style={{ fontWeight: 950, color: "#111827" }}>Announcements</div>
          <div style={{ color: "#6B7280", fontSize: 12 }}>
            {announcementsQ.isLoading ? "Loading…" : announcementsQ.isError ? "Error" : `Showing ${filtered.length}`}
          </div>
        </div>

        {announcementsQ.isLoading ? (
          <div style={ui.empty}>Loading announcements…</div>
        ) : announcementsQ.isError ? (
          <div style={ui.empty}>
            Failed to load: {String(announcementsQ.error?.message || announcementsQ.error)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={ui.empty}>
            No announcements found. Click <b>Create Announcement</b> to add one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Audience</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Posted</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const pColor = PRIORITY_COLOR[a.priority] || "#6B7280";
                  return (
                    <tr key={a.id} style={ui.tr}>
                      <td style={ui.td}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ ...ui.prBar, background: pColor }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={ui.rowTitle} title={a.title}>
                              {a.title}
                            </div>
                            <div style={ui.rowPreview}>{clampText(a.content, 140)}</div>
                          </div>
                        </div>
                      </td>

                      <td style={ui.td}>
                        <Badge soft color="#A0826D">{a.target_audience}</Badge>
                      </td>

                      <td style={ui.td}>
                        <Badge soft color={pColor}>{a.priority}</Badge>
                      </td>

                      <td style={ui.td}>
                        <StatusBadge status={a.status} />
                      </td>

                      <td style={ui.td}>
                        <div style={{ color: "#111827", fontWeight: 900 }}>{formatDate(a.posted_at)}</div>
                        <div style={{ color: "#6B7280", fontSize: 12 }}>
                          by <b style={{ color: "#374151" }}>{a.posted_by?.slice?.(0, 8) ?? "User"}</b>
                        </div>
                      </td>

                      <td style={{ ...ui.td, textAlign: "right" }}>
                        <div style={ui.actionRow}>
                          <button style={ui.iconBtn} onClick={() => openDetails(a)} title="View">
                            <Eye size={16} />
                          </button>
                          <button style={ui.iconBtn} onClick={() => openEdit(a)} title="Edit">
                            <Pencil size={16} />
                          </button>
                          <button style={{ ...ui.iconBtn, color: "#EF4444" }} onClick={() => confirmDelete(a)} title="Archive/Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit */}
      <Modal
        open={openForm}
        title={editing ? "Edit Announcement" : "Create New Announcement"}
        onClose={() => setOpenForm(false)}
        wide
      >
        <AnnouncementForm
          initial={editing}
          busy={busy}
          onCancel={() => setOpenForm(false)}
          onSave={(payload) => {
            saveAnnouncement(payload);
            setOpenForm(false);
          }}
        />
      </Modal>

      {/* View */}
      <Modal open={openView} title="Announcement Details" onClose={() => setOpenView(false)} wide>
        {viewing && (
          <AnnouncementDetails
            item={viewing}
            onClose={() => setOpenView(false)}
            onEdit={() => {
              setOpenView(false);
              openEdit(viewing);
            }}
            onArchive={() => {
              archiveM.mutate({ id: viewing.id, is_archived: true });
              setOpenView(false);
            }}
          />
        )}
      </Modal>

      {/* Archive confirm */}
      <Modal open={openDelete} title="Archive Announcement?" onClose={() => setOpenDelete(false)}>
        {deleting && (
          <ArchiveDialog
            item={deleting}
            busy={busy}
            onCancel={() => setOpenDelete(false)}
            onArchive={deleteAnnouncement}
          />
        )}
      </Modal>
    </div>
  );
}

/* =====================
   FORM
===================== */

function AnnouncementForm({ initial, onCancel, onSave, busy }) {
  const defaults = {
    title: initial?.title ?? "",
    content: initial?.content ?? "",
    priority: initial?.priority ?? "Medium",
    target_audience: initial?.target_audience ?? "All Teachers",
    status: initial?.status ?? "Draft",
  };

  const form = useForm({
    defaultValues: defaults,
    resolver: zodResolver(announcementSchema),
    mode: "onBlur",
  });

  const title = form.watch("title");
  const content = form.watch("content");

  return (
    <form onSubmit={form.handleSubmit((values) => onSave(values))} style={ui.form}>
      <div style={ui.formGrid}>
        <RHFText
          form={form}
          name="title"
          label="Title *"
          placeholder="e.g., Important: Midterm Exam Schedule"
          helper={`${title.length}/200`}
        />

        <div style={{ display: "grid", gap: 8 }}>
          <div style={ui.label}>Priority *</div>
          <RadioGroup
            value={form.watch("priority")}
            onChange={(v) => form.setValue("priority", v, { shouldValidate: true })}
            options={PRIORITIES}
            colors={PRIORITY_COLOR}
          />
          {form.formState.errors.priority?.message ? <div style={ui.err}>{String(form.formState.errors.priority.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={ui.label}>Target Audience *</div>
          <RadioGroup
            value={form.watch("target_audience")}
            onChange={(v) => form.setValue("target_audience", v, { shouldValidate: true })}
            options={AUDIENCES}
          />
          {form.formState.errors.target_audience?.message ? <div style={ui.err}>{String(form.formState.errors.target_audience.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={ui.label}>Status *</div>
          <RadioGroup
            value={form.watch("status")}
            onChange={(v) => form.setValue("status", v, { shouldValidate: true })}
            options={STATUSES}
          />
          {form.formState.errors.status?.message ? <div style={ui.err}>{String(form.formState.errors.status.message)}</div> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={ui.label}>
          Content * <span style={{ color: "#6B7280", fontWeight: 900 }}>({content.length}/2000)</span>
        </div>
        <textarea
          {...form.register("content")}
          rows={9}
          maxLength={2000}
          placeholder="Write your announcement..."
          style={ui.textarea}
        />
        {form.formState.errors.content?.message ? <div style={ui.err}>{String(form.formState.errors.content.message)}</div> : null}
      </div>

      <div style={ui.modalActions}>
        <button type="button" style={ui.ghostBtn} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" style={ui.primaryBtn} disabled={busy}>
          {initial ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}

/* =====================
   DETAILS + ARCHIVE
===================== */

function AnnouncementDetails({ item, onClose, onEdit, onArchive }) {
  const pColor = PRIORITY_COLOR[item.priority] || "#6B7280";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={ui.detailsTop}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge color={pColor} soft big>{item.priority} Priority</Badge>
          <StatusBadge status={item.status} big />
          <Badge color="#A0826D" soft big>{item.target_audience}</Badge>
        </div>
      </div>

      <div>
        <div style={ui.detailsTitle}>{item.title}</div>
        <div style={ui.detailsMeta}>
          Posted • {formatDateTime(item.posted_at)}
        </div>
        {item.updated_at && item.updated_at !== item.posted_at ? (
          <div style={ui.detailsMeta}>Last updated: {formatDateTime(item.updated_at)}</div>
        ) : null}
      </div>

      <div style={ui.detailsContent}>{item.content}</div>

      <div style={ui.modalActions}>
        <button style={ui.ghostBtn} onClick={onClose}><X size={16} /> Close</button>
        <button style={ui.primaryBtn} onClick={onEdit}><Pencil size={16} /> Edit</button>
        <button style={ui.dangerBtn} onClick={onArchive}><Trash2 size={16} /> Archive</button>
      </div>
    </div>
  );
}

function ArchiveDialog({ item, onCancel, onArchive, busy }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={ui.deleteBox}>
        <div style={{ fontWeight: 950, display: "flex", gap: 10, alignItems: "center" }}>
          <AlertTriangle size={18} /> Archive Announcement?
        </div>
        <div style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>
          This will hide it from the list but keep the record in the database.
          <div style={{ marginTop: 10 }}>
            <div><b>Title:</b> {item.title}</div>
            <div style={{ marginTop: 6 }}><b>Target:</b> {item.target_audience}</div>
          </div>
        </div>
      </div>

      <div style={ui.modalActions}>
        <button style={ui.ghostBtn} onClick={onCancel} disabled={busy}>Cancel</button>
        <button style={ui.dangerBtn} onClick={onArchive} disabled={busy}>Archive</button>
      </div>
    </div>
  );
}

/* =====================
   UI PRIMITIVES
===================== */

function KpiCard({ label, value, icon, tone }) {
  const t =
    tone === "ok"
      ? { bg: "#ECFDF5", bd: "#A7F3D0", fg: "#065F46" }
      : tone === "warn"
      ? { bg: "#FFFBEB", bd: "#FDE68A", fg: "#92400E" }
      : tone === "muted"
      ? { bg: "#F3F4F6", bd: "#E5E7EB", fg: "#374151" }
      : { bg: "#FFFFFF", bd: "#E5E7EB", fg: "#111827" };

  return (
    <div style={{ ...ui.kpiCard, background: t.bg, borderColor: t.bd }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ color: "#6B7280", fontSize: 12, fontWeight: 900 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 950, color: "#111827", marginTop: 6 }}>{value}</div>
        </div>
        <div style={{ ...ui.kpiIcon, color: t.fg }}>{icon}</div>
      </div>
    </div>
  );
}

function ChipSelect({ label, value, onChange, options }) {
  return (
    <label style={ui.chip}>
      <span style={{ color: "#6B7280", fontSize: 12, fontWeight: 900 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={ui.chipSelect}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Th({ children, right }) {
  return (
    <th style={{ ...ui.th, textAlign: right ? "right" : "left" }}>
      {children}
    </th>
  );
}

function RadioGroup({ value, onChange, options, colors }) {
  return (
    <div style={ui.radioWrap}>
      {options.map((opt) => {
        const active = value === opt;
        const c = colors?.[opt] || "#A0826D";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              ...ui.radioBtn,
              borderColor: active ? c : "#E5E7EB",
              background: active ? "#FFFBEB" : "#fff",
            }}
            aria-pressed={active}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: active ? c : "#E5E7EB" }} />
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, big }) {
  const isPublished = status === "Published";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 12px" : "6px 10px",
        borderRadius: 999,
        background: isPublished ? "#D1FAE5" : "#F3F4F6",
        border: `1px solid ${isPublished ? "#10B981" : "#E5E7EB"}`,
        color: "#111827",
        fontWeight: 950,
        fontSize: big ? 13 : 12,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Badge({ color, children, big, soft }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 12px" : "6px 10px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: soft ? "#FFFFFF" : "#fff",
        color: "#111827",
        fontWeight: 950,
        fontSize: big ? 13 : 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RHFText({ form, name, label, placeholder, helper }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={ui.label}>{label}</div>
        {helper ? <div style={{ color: "#6B7280", fontSize: 12, fontWeight: 900 }}>{helper}</div> : null}
      </div>
      <input {...form.register(name)} placeholder={placeholder} style={ui.input} />
      {err ? <div style={ui.err}>{String(err)}</div> : null}
    </div>
  );
}

function Modal({ open, title, onClose, wide, children }) {
  if (!open) return null;
  return (
    <div style={ui.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        style={{
          ...ui.modal,
          width: wide ? "min(980px, 100%)" : "min(760px, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={ui.modalHeader}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <button style={ui.iconBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={ui.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* =====================
   STYLES
===================== */

const ui = {
  page: { display: "grid", gap: 14 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#FFFBEB",
    display: "grid",
    placeItems: "center",
    color: "#92400E",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },
  title: { margin: 0, fontWeight: 950, color: "#111827" },
  sub: { marginTop: 6, color: "#6B7280" },

  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  kpiCard: { border: "1px solid #E5E7EB", borderRadius: 16, padding: 14, boxShadow: "0 10px 25px rgba(0,0,0,0.06)" },
  kpiIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.75)",
    display: "grid",
    placeItems: "center",
  },

  toolbar: {
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    background: "#fff",
  },

  searchWrap: {
    flex: "1 1 340px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #E5E7EB",
    background: "#FAFAFA",
    borderRadius: 999,
    padding: "10px 12px",
    color: "#6B7280",
  },
  searchInput: { border: "none", outline: "none", background: "transparent", width: "100%", color: "#111827", fontWeight: 900 },

  toolbarRight: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  chipRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  chip: { display: "grid", gap: 4, padding: "8px 10px", borderRadius: 14, border: "1px solid #E5E7EB", background: "#FFFFFF" },
  chipSelect: { border: "none", outline: "none", background: "transparent", fontWeight: 950, color: "#111827" },

  sortWrap: { display: "flex", alignItems: "center", gap: 10, border: "1px solid #E5E7EB", background: "#FFFFFF", borderRadius: 14, padding: "10px 12px", color: "#6B7280", fontWeight: 900 },
  select: { border: "none", outline: "none", background: "transparent", fontWeight: 950, color: "#111827" },

  tableCard: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.06)", overflow: "hidden" },
  tableHeader: { padding: 14, borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: { padding: "12px 14px", fontSize: 12, color: "#6B7280", fontWeight: 950, background: "#FAFAFA", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" },
  tr: {},
  td: { padding: "12px 14px", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" },

  prBar: { width: 6, height: 34, borderRadius: 999, flex: "0 0 auto", marginTop: 2 },
  rowTitle: { fontWeight: 950, color: "#111827", fontSize: 14, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 },
  rowPreview: { marginTop: 6, color: "#6B7280", fontSize: 13, lineHeight: 1.5, maxWidth: 720 },
  actionRow: { display: "inline-flex", gap: 8, justifyContent: "flex-end" },

  empty: { padding: 18, background: "#FFFBEB", color: "#6B7280" },

  form: { display: "grid", gap: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  label: { fontSize: 12, color: "#6B7280", fontWeight: 900 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FAFAFA", outline: "none", fontWeight: 900, color: "#111827" },
  radioWrap: { display: "flex", gap: 10, flexWrap: "wrap" },
  radioBtn: { border: "1px solid #E5E7EB", background: "#fff", borderRadius: 999, padding: "10px 12px", cursor: "pointer", fontWeight: 950, color: "#111827", display: "inline-flex", alignItems: "center", gap: 10 },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FAFAFA", outline: "none", resize: "vertical", fontWeight: 900, color: "#111827", lineHeight: 1.5 },
  err: { color: "#EF4444", fontSize: 12, fontWeight: 900 },

  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 4 },

  primaryBtn: { background: "#A0826D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 10px 20px rgba(160,130,109,0.35)" },
  ghostBtn: { background: "transparent", color: "#111827", border: "1px solid #E5E7EB", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 8 },
  dangerBtn: { background: "#EF4444", color: "#fff", border: "none", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 8 },
  iconBtn: { background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 999, padding: "8px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#111827" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 14, zIndex: 50 },
  modal: { background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 16px 40px rgba(0,0,0,0.18)", overflow: "hidden" },
  modalHeader: { padding: 14, borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  modalBody: { padding: 14 },

  detailsTop: { borderRadius: 16, border: "1px solid #E5E7EB", background: "#FFFBEB", padding: 12 },
  detailsTitle: { fontSize: 20, fontWeight: 950, color: "#111827", marginTop: 6 },
  detailsMeta: { color: "#6B7280", fontSize: 13, marginTop: 6 },
  detailsContent: { borderRadius: 16, border: "1px solid #E5E7EB", background: "#fff", padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#111827" },

  deleteBox: { borderRadius: 16, border: "1px solid #EF4444", background: "#FEF2F2", padding: 12 },
};
