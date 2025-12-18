// src/admin/Announcements/AnnouncementList.jsx
// Grabsum School Admin — Announcements (UI-first)
//
// ✅ Includes:
// - Header + Create Announcement button
// - Search + filters (status, audience, priority) + sort
// - Card grid list with priority left-bar + badges + actions
// - Create/Edit modal (Zod + react-hook-form)
// - View modal
// - Delete confirmation dialog
//
// ⚠️ UI-only for now: announcements stored in component state with mock seed.
// Next step later: connect to Supabase table + TanStack Query.

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
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
   MOCK SEED
===================== */

const seed = [
  {
    id: "ann_1",
    title: "Important: Midterm Exam Schedule",
    content:
      "The midterm examinations for Senior High School will be held from December 20–23, 2025. All students are required to attend. Please bring your exam permit and arrive 15 minutes early.",
    priority: "High",
    target_audience: "All Students",
    status: "Published",
    posted_by: "Admin",
    posted_at: "2025-12-12T08:30:00Z",
    updated_at: "2025-12-12T08:30:00Z",
  },
  {
    id: "ann_2",
    title: "Faculty Meeting Reminder",
    content:
      "Reminder to all teachers: Faculty meeting will be held on December 20, 2025 at 2:00 PM in the conference room. Please prepare your department updates and submit reports before the meeting.",
    priority: "Medium",
    target_audience: "All Teachers",
    status: "Draft",
    posted_by: "Admin",
    posted_at: "2025-12-10T10:05:00Z",
    updated_at: "2025-12-10T10:05:00Z",
  },
];

/* =====================
   HELPERS
===================== */

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
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

/* =====================
   MAIN
===================== */

export default function AnnouncementList() {
  const [items, setItems] = useState(seed);

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

  const filtered = useMemo(() => {
    let list = [...items];

    // search
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(s));
    }

    // filters
    if (status !== "All") list = list.filter((a) => a.status === status);
    if (audience !== "All") list = list.filter((a) => a.target_audience === audience);
    if (priority !== "All") list = list.filter((a) => a.priority === priority);

    // sort
    const prRank = { High: 0, Medium: 1, Low: 2 };
    if (sortBy === "Newest First") {
      list.sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at)));
    } else if (sortBy === "Oldest First") {
      list.sort((a, b) => String(a.posted_at).localeCompare(String(b.posted_at)));
    } else if (sortBy === "Priority") {
      list.sort((a, b) => prRank[a.priority] - prRank[b.priority]);
    }

    return list;
  }, [items, q, status, audience, priority, sortBy]);

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

  const saveAnnouncement = (payload) => {
    if (editing) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === editing.id
            ? { ...x, ...payload, updated_at: new Date().toISOString() }
            : x
        )
      );
    } else {
      setItems((prev) => [
        {
          id: `ann_${crypto.randomUUID()}`,
          ...payload,
          posted_by: "Admin",
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const deleteAnnouncement = () => {
    setItems((prev) => prev.filter((x) => x.id !== deleting.id));
    setOpenDelete(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Announcements</h1>
          <div style={styles.sub}>Manage school announcements for teachers and students</div>
        </div>

        <button style={styles.primaryBtn} onClick={openCreate}>
          <Plus size={18} /> Create Announcement
        </button>
      </div>

      {/* Search & Filters */}
      <div style={styles.filterCard}>
        <div style={styles.searchRow}>
          <div style={styles.searchBox}>
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search announcements by title..."
              style={styles.searchInput}
            />
            {q ? (
              <button style={styles.iconBtn} onClick={() => setQ("")} title="Clear search">
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div style={styles.sortBox}>
            <ArrowUpDown size={16} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Priority</option>
            </select>
          </div>
        </div>

        <div style={styles.filtersRow}>
          <SelectField label="Status" value={status} onChange={setStatus} options={["All", ...STATUSES]} />
          <SelectField label="Target Audience" value={audience} onChange={setAudience} options={["All", ...AUDIENCES]} />
          <SelectField label="Priority" value={priority} onChange={setPriority} options={["All", ...PRIORITIES]} />

          <div style={{ display: "flex", alignItems: "end" }}>
            <button style={styles.ghostBtn} onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          No announcements found. Click <b>Create Announcement</b> to add one.
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((a) => {
            const pColor = PRIORITY_COLOR[a.priority] || "#6B7280";
            return (
              <div key={a.id} style={styles.card}>
                {/* priority indicator */}
                <div style={{ ...styles.priorityBar, background: pColor }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.cardTopRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.cardTitle} title={a.title}>{a.title}</div>
                      <div style={styles.preview}>
                        {a.content.slice(0, 150)}{a.content.length > 150 ? "…" : ""}
                      </div>
                    </div>
                    <div style={styles.actions}>
                      <button style={styles.iconBtn} onClick={() => openDetails(a)} title="View">
                        <Eye size={16} />
                      </button>
                      <button style={styles.iconBtn} onClick={() => openEdit(a)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button style={{ ...styles.iconBtn, color: "#EF4444" }} onClick={() => confirmDelete(a)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={styles.badgesRow}>
                    <Badge color={pColor}>{a.priority} Priority</Badge>
                    <Badge color="#A0826D">{a.target_audience}</Badge>
                    <StatusBadge status={a.status} />
                  </div>

                  <div style={styles.meta}>
                    Posted by <b>{a.posted_by}</b> • {formatDate(a.posted_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit */}
      <Modal
        open={openForm}
        title={editing ? "Edit Announcement" : "Create New Announcement"}
        onClose={() => setOpenForm(false)}
        wide
      >
        <AnnouncementForm
          initial={editing}
          onCancel={() => setOpenForm(false)}
          onSave={(payload) => {
            saveAnnouncement(payload);
            setOpenForm(false);
          }}
        />
      </Modal>

      {/* View */}
      <Modal
        open={openView}
        title="Announcement Details"
        onClose={() => setOpenView(false)}
        wide
      >
        {viewing && (
          <AnnouncementDetails
            item={viewing}
            onClose={() => setOpenView(false)}
            onEdit={() => {
              setOpenView(false);
              openEdit(viewing);
            }}
            onDelete={() => {
              setOpenView(false);
              confirmDelete(viewing);
            }}
          />
        )}
      </Modal>

      {/* Delete */}
      <Modal
        open={openDelete}
        title="Delete Announcement?"
        onClose={() => setOpenDelete(false)}
      >
        {deleting && (
          <DeleteDialog
            item={deleting}
            onCancel={() => setOpenDelete(false)}
            onDelete={deleteAnnouncement}
          />
        )}
      </Modal>

      {/* Tiny schema smoke test */}
      <span style={{ display: "none" }}>
        {String(
          announcementSchema.safeParse({
            title: "abcd",
            content: "too short",
            priority: "Medium",
            target_audience: "All Teachers",
            status: "Draft",
          }).success
        )}
      </span>
    </div>
  );
}

/* =====================
   FORM
===================== */

function AnnouncementForm({ initial, onCancel, onSave }) {
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
    <form
      onSubmit={form.handleSubmit((values) => onSave(values))}
      style={{ display: "grid", gap: 14 }}
    >
      <div style={styles.formGrid}>
        <RHFText form={form} name="title" label="Title *" placeholder="e.g., Important: Midterm Exam Schedule" helper={`${title.length}/200`} />

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Priority *</div>
          <RadioGroup
            value={form.watch("priority")}
            onChange={(v) => form.setValue("priority", v, { shouldValidate: true })}
            options={PRIORITIES}
            colors={PRIORITY_COLOR}
          />
          {form.formState.errors.priority?.message ? <div style={styles.err}>{String(form.formState.errors.priority.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Target Audience *</div>
          <RadioGroup
            value={form.watch("target_audience")}
            onChange={(v) => form.setValue("target_audience", v, { shouldValidate: true })}
            options={AUDIENCES}
          />
          {form.formState.errors.target_audience?.message ? <div style={styles.err}>{String(form.formState.errors.target_audience.message)}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Status *</div>
          <RadioGroup
            value={form.watch("status")}
            onChange={(v) => form.setValue("status", v, { shouldValidate: true })}
            options={STATUSES}
          />
          {form.formState.errors.status?.message ? <div style={styles.err}>{String(form.formState.errors.status.message)}</div> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={styles.label}>Content * <span style={{ color: "#6B7280", fontWeight: 900 }}>({content.length}/2000)</span></div>
        <textarea
          {...form.register("content")}
          rows={8}
          maxLength={2000}
          placeholder="Write your announcement..."
          style={styles.textarea}
        />
        {form.formState.errors.content?.message ? <div style={styles.err}>{String(form.formState.errors.content.message)}</div> : null}
      </div>

      <div style={styles.modalActions}>
        <button type="button" style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" style={styles.primaryBtn}>{initial ? "Update" : "Save"}</button>
      </div>
    </form>
  );
}

/* =====================
   DETAILS + DELETE
===================== */

function AnnouncementDetails({ item, onClose, onEdit, onDelete }) {
  const pColor = PRIORITY_COLOR[item.priority] || "#6B7280";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.detailsHeader}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge color={pColor} big>{item.priority} Priority</Badge>
          <StatusBadge status={item.status} big />
          <Badge color="#A0826D" big>{item.target_audience}</Badge>
        </div>
      </div>

      <div>
        <div style={styles.detailsTitle}>{item.title}</div>
        <div style={styles.detailsMeta}>
          Posted by <b>{item.posted_by}</b> • {formatDateTime(item.posted_at)}
        </div>
        {item.updated_at && item.updated_at !== item.posted_at ? (
          <div style={styles.detailsMeta}>Last updated: {formatDateTime(item.updated_at)}</div>
        ) : null}
      </div>

      <div style={styles.detailsContent}>
        {item.content}
      </div>

      <div style={styles.modalActions}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={16} /> Close</button>
        <button style={styles.primaryBtn} onClick={onEdit}><Pencil size={16} /> Edit</button>
        <button style={styles.dangerBtn} onClick={onDelete}><Trash2 size={16} /> Delete</button>
      </div>
    </div>
  );
}

function DeleteDialog({ item, onCancel, onDelete }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.deleteBox}>
        <div style={{ fontWeight: 950 }}>Delete Announcement?</div>
        <div style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>
          Are you sure you want to delete this announcement?
          <div style={{ marginTop: 10 }}>
            <div><b>Title:</b> {item.title}</div>
            <div style={{ marginTop: 6 }}><b>Target:</b> {item.target_audience}</div>
          </div>
          <div style={{ marginTop: 10, color: "#EF4444", fontWeight: 900 }}>
            This action cannot be undone.
          </div>
        </div>
      </div>

      <div style={styles.modalActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.dangerBtn} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

/* =====================
   UI PRIMITIVES
===================== */

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function RadioGroup({ value, onChange, options, colors }) {
  return (
    <div style={styles.radioWrap}>
      {options.map((opt) => {
        const active = value === opt;
        const c = colors?.[opt] || "#A0826D";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              ...styles.radioBtn,
              borderColor: active ? c : "#E5E7EB",
              background: active ? "#FFFBEB" : "#fff",
            }}
            aria-pressed={active}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: active ? c : "#E5E7EB",
              }}
            />
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
        color: "#2C2C2C",
        fontWeight: 950,
        fontSize: big ? 13 : 12,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Badge({ color, children, big }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 12px" : "6px 10px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: "#fff",
        color: "#2C2C2C",
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
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={styles.label}>{label}</div>
        {helper ? <div style={{ color: "#6B7280", fontSize: 12, fontWeight: 900 }}>{helper}</div> : null}
      </div>
      <input {...form.register(name)} placeholder={placeholder} style={styles.input} />
      {err ? <div style={styles.err}>{String(err)}</div> : null}
    </div>
  );
}

function Modal({ open, title, onClose, wide, children }) {
  if (!open) return null;
  return (
    <div style={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        style={{
          ...styles.modal,
          width: wide ? "min(980px, 100%)" : "min(760px, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <button style={styles.iconBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* =====================
   STYLES
===================== */

const styles = {
  title: { margin: 0, fontWeight: 950, color: "#2C2C2C" },
  sub: { marginTop: 6, color: "#6B7280" },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  primaryBtn: {
    background: "#A0826D",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 20px rgba(160,130,109,0.35)",
  },

  ghostBtn: {
    background: "transparent",
    color: "#2C2C2C",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  dangerBtn: {
    background: "#EF4444",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    background: "#FAF9F6",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "8px 10px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2C2C2C",
  },

  filterCard: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    marginBottom: 14,
  },

  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 12,
  },

  searchBox: {
    flex: "1 1 520px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    borderRadius: 999,
    padding: "10px 12px",
    color: "#6B7280",
  },

  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    color: "#2C2C2C",
    fontWeight: 900,
  },

  sortBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #E5E7EB",
    background: "#FDFBF7",
    borderRadius: 999,
    padding: "10px 12px",
    color: "#6B7280",
    fontWeight: 900,
  },

  filtersRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "end",
  },

  label: { fontSize: 12, color: "#6B7280", fontWeight: 900 },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
    fontWeight: 900,
  },

  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
    fontWeight: 900,
    color: "#2C2C2C",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
  },

  card: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    display: "flex",
    gap: 12,
    minHeight: 160,
  },

  priorityBar: { width: 6, borderRadius: 999 },

  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },

  cardTitle: {
    fontWeight: 950,
    color: "#2C2C2C",
    fontSize: 16,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  preview: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 1.5,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
  },

  actions: { display: "inline-flex", gap: 8 },

  badgesRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },

  meta: { marginTop: 10, color: "#6B7280", fontSize: 12 },

  empty: {
    border: "1px dashed #E5E7EB",
    borderRadius: 16,
    padding: 18,
    background: "#FDFBF7",
    color: "#6B7280",
  },

  // Forms
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  radioWrap: { display: "flex", gap: 10, flexWrap: "wrap" },
  radioBtn: {
    border: "1px solid #E5E7EB",
    background: "#fff",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    color: "#2C2C2C",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
    resize: "vertical",
    fontWeight: 900,
    color: "#2C2C2C",
    lineHeight: 1.5,
  },

  err: { color: "#EF4444", fontSize: 12, fontWeight: 900 },

  // Modals
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    padding: 14,
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  modalBody: { padding: 14 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },

  detailsHeader: { borderRadius: 16, border: "1px solid #E5E7EB", background: "#FDFBF7", padding: 12 },
  detailsTitle: { fontSize: 20, fontWeight: 950, color: "#2C2C2C", marginTop: 6 },
  detailsMeta: { color: "#6B7280", fontSize: 13, marginTop: 6 },
  detailsContent: {
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "#fff",
    padding: 12,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    color: "#2C2C2C",
  },

  deleteBox: { borderRadius: 16, border: "1px solid #EF4444", background: "#FEF2F2", padding: 12 },
};
