// src/admin/AdminTeacher/Management.jsx
// Teacher Management (UI-first, no Supabase tables required yet)
//
// ✅ Includes:
// - Stats cards
// - Search + filters + sort
// - Table view with sticky header, pagination, row hover
// - Add/Edit teacher modal (Zod + react-hook-form validation)
// - View teacher modal with tabs + computed years of service
// - Delete dialog with: Cancel / Set to Inactive / Permanently Delete
// - Bulk select + bulk status change + export CSV (filtered or selected)
// - Profile photo upload preview (local only)
//
// ⚠️ Expected behavior question:
// When you click “Permanently Delete”, should it:
// A) Remove the teacher immediately (current UI behavior)
// B) Require typing DELETE to confirm (safer)
// Reply A or B.

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UserPlus,
  Search,
  Filter,
  X,
  Eye,
  Pencil,
  Trash2,
  Download,
  Users,
  Check,
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";

/* =======================
   CONSTANTS
======================= */

const DEPARTMENTS = [
  "Mathematics",
  "Science",
  "English",
  "Filipino",
  "Social Studies (Araling Panlipunan)",
  "STEM",
  "ABM",
  "HUMSS",
  "GAS",
  "TVL",
  "Physical Education & Health",
  "Arts & Music",
  "Others",
];

const EMPLOYMENT_STATUSES = ["Full-time", "Part-time", "Contractual"];
const TEACHER_STATUSES = ["Active", "Inactive", "On Leave"];

const SUBJECT_GROUPS = {
  "Core Subjects": [
    "Oral Communication",
    "Reading & Writing",
    "Komunikasyon at Pananaliksik",
    "General Mathematics",
    "Statistics & Probability",
    "Earth & Life Science",
    "Physical Science",
    "Personal Development",
    "Understanding Culture, Society & Politics",
    "PE & Health",
    "Practical Research",
    "Empowerment Technologies",
  ],
  STEM: [
    "Pre-Calculus",
    "Basic Calculus",
    "General Biology 1",
    "General Biology 2",
    "General Chemistry 1",
    "General Chemistry 2",
    "General Physics 1",
    "General Physics 2",
  ],
  ABM: [
    "Business Math",
    "Applied Economics",
    "Organization & Management",
    "Business Finance",
    "Fundamentals of ABM",
    "Principles of Marketing",
    "Entrepreneurship",
  ],
  HUMSS: [
    "Creative Writing",
    "Introduction to World Religions",
    "Philippine Politics & Governance",
    "Disciplines in Social Sciences",
    "Community Engagement",
  ],
  TVL: ["ICT subjects", "Home Economics", "Technical subjects"],
  Others: ["Work Immersion Coordinator", "Guidance & Counseling"],
};

const ALL_SUBJECTS = Array.from(
  new Set(Object.values(SUBJECT_GROUPS).flat())
);

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "hired_desc", label: "Date Hired (Newest first)" },
  { value: "hired_asc", label: "Date Hired (Oldest first)" },
];

/* =======================
   MOCK DATA (UI-first)
======================= */

const mockTeachers = [
  {
    id: "t1",
    teacher_id: "TCH-2024-001",
    first_name: "Roberto",
    last_name: "Cruz",
    middle_initial: "M.",
    email: "roberto.cruz@grabsum.edu",
    phone: "0917 123 4567",
    dob: "1988-05-12",
    gender: "Male",
    address: "Candelaria, Quezon",
    department: "Mathematics",
    subjects: ["General Mathematics", "Pre-Calculus", "Basic Calculus"],
    specialization: "Mathematics Education, Statistics",
    attainment: "Master's Degree",
    date_hired: "2022-06-01",
    employment_status: "Full-time",
    status: "Active",
    contract_start: "",
    contract_end: "",
    emergency_name: "Ana Cruz",
    emergency_relationship: "Spouse",
    emergency_phone: "0918 222 3333",
    admin_notes: "Strong in SHS math curriculum.",
    profile_photo_url: "", // local preview only
    updated_at: "2025-12-10T10:15:00Z",
  },
  {
    id: "t2",
    teacher_id: "TCH-2024-002",
    first_name: "Maria",
    last_name: "Santos",
    middle_initial: "L.",
    email: "maria.santos@grabsum.edu",
    phone: "+63 917 555 1212",
    dob: "1990-11-03",
    gender: "Female",
    address: "Lucena City",
    department: "Science",
    subjects: ["Earth & Life Science", "Physical Science", "General Biology 1"],
    specialization: "Biology",
    attainment: "Bachelor's Degree",
    date_hired: "2024-01-15",
    employment_status: "Part-time",
    status: "On Leave",
    contract_start: "",
    contract_end: "",
    emergency_name: "Jose Santos",
    emergency_relationship: "Parent",
    emergency_phone: "0919 000 9999",
    admin_notes: "On leave until January.",
    profile_photo_url: "",
    updated_at: "2025-12-01T08:00:00Z",
  },
];

/* =======================
   VALIDATION (Zod)
======================= */

const phPhoneRegex = /^(\+63\s?\d{3}\s?\d{3}\s?\d{4}|09\d{2}\s?\d{3}\s?\d{4})$/;

const teacherSchema = z
  .object({
    teacher_id: z
      .string()
      .min(1, "Teacher ID is required")
      .regex(/^TCH-\d{4}-\d{3}$/, "Format must be TCH-YYYY-###"),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    middle_initial: z.string().max(10).optional().or(z.literal("")),
    email: z.string().email("Invalid email").min(1, "Email is required"),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .regex(phPhoneRegex, "Use +63 XXX XXX XXXX or 09XX XXX XXXX"),
    dob: z.string().optional().or(z.literal("")),
    gender: z.enum(["Male", "Female", "Prefer not to say"]).optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),

    department: z.string().min(1, "Department is required"),
    subjects: z.array(z.string()).min(1, "Select at least 1 subject"),
    specialization: z.string().optional().or(z.literal("")),
    attainment: z
      .enum([
        "Bachelor's Degree",
        "Master's Degree",
        "Doctorate Degree",
        "With Master's Units",
        "Others",
      ])
      .or(z.string().min(1, "Educational attainment is required")),
    date_hired: z.string().min(1, "Date hired is required"),

    employment_status: z.enum(["Full-time", "Part-time", "Contractual"], {
      message: "Employment status is required",
    }),
    status: z.enum(["Active", "Inactive", "On Leave"], {
      message: "Status is required",
    }),
    contract_start: z.string().optional().or(z.literal("")),
    contract_end: z.string().optional().or(z.literal("")),

    emergency_name: z.string().optional().or(z.literal("")),
    emergency_relationship: z.string().optional().or(z.literal("")),
    emergency_phone: z.string().optional().or(z.literal("")),

    admin_notes: z.string().optional().or(z.literal("")),
    profile_photo_url: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) => {
      if (v.employment_status !== "Contractual") return true;
      // If contractual, contract dates recommended
      return Boolean(v.contract_start) && Boolean(v.contract_end);
    },
    {
      path: ["contract_end"],
      message: "Contract start/end dates are required for Contractual teachers",
    }
  );

// Tiny sanity “tests” (won’t break build)
console.assert(phPhoneRegex.test("0917 123 4567"), "PH phone regex should accept 09XX format");
console.assert(phPhoneRegex.test("+63 917 123 4567"), "PH phone regex should accept +63 format");

/* =======================
   HELPERS
======================= */

function fullName(t) {
  const mi = t.middle_initial ? ` ${t.middle_initial}` : "";
  return `${t.last_name}, ${t.first_name}${mi}`.trim();
}

function yearsOfService(dateHired) {
  if (!dateHired) return "—";
  const start = new Date(dateHired);
  if (Number.isNaN(start.getTime())) return "—";
  const now = new Date();
  const diff = now.getFullYear() - start.getFullYear();
  const beforeAnniv =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  return Math.max(0, diff - (beforeAnniv ? 1 : 0));
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          // escape quotes
          const escaped = s.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function badgeTone(status) {
  if (status === "Active") return "green";
  if (status === "On Leave") return "orange";
  if (status === "Inactive") return "gray";
  return "gray";
}

/* =======================
   MAIN COMPONENT
======================= */

export default function Management() {
  const [teachers, setTeachers] = useState(mockTeachers);

  // Filters
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [employment, setEmployment] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  // Table controls
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Modals
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [openView, setOpenView] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Stats
  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((t) => t.status === "Active").length;
    const onLeave = teachers.filter((t) => t.status === "On Leave").length;
    const partTime = teachers.filter((t) => t.employment_status === "Part-time").length;
    return { total, active, onLeave, partTime };
  }, [teachers]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = teachers.filter((t) => {
      if (department && t.department !== department) return false;
      if (employment && t.employment_status !== employment) return false;
      if (status && t.status !== status) return false;

      if (!q) return true;
      return (
        fullName(t).toLowerCase().includes(q) ||
        String(t.email ?? "").toLowerCase().includes(q) ||
        String(t.teacher_id ?? "").toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === "name_asc") return fullName(a).localeCompare(fullName(b));
      if (sortBy === "name_desc") return fullName(b).localeCompare(fullName(a));
      if (sortBy === "hired_desc") return String(b.date_hired).localeCompare(String(a.date_hired));
      if (sortBy === "hired_asc") return String(a.date_hired).localeCompare(String(b.date_hired));
      return 0;
    });

    return list;
  }, [teachers, search, department, employment, status, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Keep page valid when filters change
  useMemo(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setEmployment("");
    setStatus("");
    setSortBy("name_asc");
    setPage(1);
  };

  const openAdd = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setOpenForm(true);
  };

  const openProfile = (t) => {
    setViewing(t);
    setOpenView(true);
  };

  const openDeleteDialog = (t) => {
    setDeleting(t);
    setOpenDelete(true);
  };

  const toggleAllOnPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        paged.forEach((t) => next.add(t.id));
      } else {
        paged.forEach((t) => next.delete(t.id));
      }
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedList = useMemo(() => {
    const set = selectedIds;
    return teachers.filter((t) => set.has(t.id));
  }, [teachers, selectedIds]);

  const bulkSetStatus = (nextStatus) => {
    if (selectedList.length === 0) return;
    if (!window.confirm(`Set status to "${nextStatus}" for ${selectedList.length} teacher(s)?`)) return;
    setTeachers((prev) =>
      prev.map((t) => (selectedIds.has(t.id) ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t))
    );
  };

  const exportCsv = (mode) => {
    const rows = [];
    rows.push(["Teacher ID", "Name", "Department", "Subjects", "Email", "Phone", "Employment Status", "Status", "Date Hired"]);

    const source = mode === "selected" ? selectedList : filtered;

    source.forEach((t) => {
      rows.push([
        t.teacher_id,
        fullName(t),
        t.department,
        (t.subjects ?? []).join("; "),
        t.email,
        t.phone,
        t.employment_status,
        t.status,
        t.date_hired,
      ]);
    });

    downloadCsv(`teachers_${mode}_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const hasSelectionOnPage = paged.some((t) => selectedIds.has(t.id));
  const allSelectedOnPage = paged.length > 0 && paged.every((t) => selectedIds.has(t.id));

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Teacher Management</h1>
          <div style={styles.sub}>Manage teacher information and assignments</div>
        </div>

        <button style={styles.primaryBtn} onClick={openAdd}>
          <UserPlus size={18} /> Add Teacher
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard title="Total Teachers" value={stats.total} tone="brown" icon={<Users size={18} />} />
        <StatCard title="Active Teachers" value={stats.active} tone="green" icon={<Check size={18} />} />
        <StatCard title="On Leave" value={stats.onLeave} tone="orange" icon={<AlertTriangle size={18} />} />
        <StatCard title="Part-Time" value={stats.partTime} tone="gold" icon={<Users size={18} />} />
      </div>

      {/* Filters */}
      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          <div style={styles.searchWrap}>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search teachers by name, email, or ID…"
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterGrid}>
            <Select label="Department" value={department} onChange={(v) => { setDepartment(v); setPage(1); }} options={[{ value: "", label: "All" }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} />
            <Select label="Employment" value={employment} onChange={(v) => { setEmployment(v); setPage(1); }} options={[{ value: "", label: "All" }, ...EMPLOYMENT_STATUSES.map((d) => ({ value: d, label: d }))]} />
            <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All" }, ...TEACHER_STATUSES.map((d) => ({ value: d, label: d }))]} />
            <Select label="Sort By" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={styles.ghostBtn} onClick={clearFilters} title="Clear filters">
              <Filter size={16} /> Clear
            </button>
            <button style={styles.ghostBtn} onClick={() => exportCsv("filtered")} title="Export filtered">
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        <div style={styles.filterMeta}>
          Showing <b>{filtered.length}</b> teacher(s)
        </div>

        {/* Bulk toolbar */}
        {selectedList.length > 0 && (
          <div style={styles.bulkBar}>
            <div>
              <b>{selectedList.length}</b> selected
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={styles.bulkBtn} onClick={() => bulkSetStatus("Active")}>Set Active</button>
              <button style={styles.bulkBtn} onClick={() => bulkSetStatus("Inactive")}>Set Inactive</button>
              <button style={styles.bulkBtn} onClick={() => exportCsv("selected")}>
                <Download size={16} /> Export Selected
              </button>
              <button
                style={{ ...styles.bulkBtn, color: "#EF4444" }}
                onClick={() => {
                  if (!window.confirm(`Clear selection (${selectedList.length})?`)) return;
                  setSelectedIds(new Set());
                }}
              >
                <X size={16} /> Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <Th align="center">
                <input
                  type="checkbox"
                  checked={allSelectedOnPage}
                  onChange={(e) => toggleAllOnPage(e.target.checked)}
                  aria-label="Select all on page"
                />
              </Th>
              <Th>Teacher ID</Th>
              <Th>Full Name</Th>
              <Th>Department</Th>
              <Th>Subjects</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Employment</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 16, color: "#6B7280" }}>
                  No teachers found.
                </td>
              </tr>
            ) : (
              paged.map((t) => (
                <tr key={t.id} style={styles.tr}>
                  <Td align="center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      aria-label={`Select ${fullName(t)}`}
                    />
                  </Td>
                  <Td>{t.teacher_id}</Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar url={t.profile_photo_url} name={fullName(t)} />
                      <div>
                        <div style={{ fontWeight: 900 }}>{fullName(t)}</div>
                        <div style={{ color: "#6B7280", fontSize: 12 }}>
                          Hired: {t.date_hired || "—"}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>{t.department}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(t.subjects ?? []).slice(0, 3).map((s) => (
                        <Pill key={s}>{s}</Pill>
                      ))}
                      {(t.subjects ?? []).length > 3 && (
                        <Pill>+{(t.subjects ?? []).length - 3}</Pill>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span style={styles.linkLike}>
                      <Mail size={14} /> {t.email}
                    </span>
                  </Td>
                  <Td>
                    <span style={styles.linkLike}>
                      <Phone size={14} /> {t.phone}
                    </span>
                  </Td>
                  <Td>{t.employment_status}</Td>
                  <Td>
                    <MiniBadge tone={badgeTone(t.status)}>{t.status}</MiniBadge>
                  </Td>
                  <Td align="right">
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button style={styles.iconBtn} onClick={() => openProfile(t)} title="View">
                        <Eye size={16} />
                      </button>
                      <button style={styles.iconBtn} onClick={() => openEdit(t)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button style={{ ...styles.iconBtn, color: "#EF4444" }} onClick={() => openDeleteDialog(t)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={styles.paginationRow}>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          Page <b>{page}</b> of <b>{totalPages}</b>
          {hasSelectionOnPage && <span style={{ marginLeft: 10 }}>• selections on this page</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={styles.smallSelect}>
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>

          <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(1)}>First</button>
          <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={openForm}
        title={editing ? `Edit Teacher — ${fullName(editing)}` : "Add New Teacher"}
        onClose={() => setOpenForm(false)}
        wide
      >
        <TeacherForm
          initial={editing}
          existing={teachers}
          onCancel={() => setOpenForm(false)}
          onSave={(payload) => {
            // Uniqueness checks (UI-level)
            const emailLower = payload.email.toLowerCase();
            const idUpper = payload.teacher_id.toUpperCase();

            const emailConflict = teachers.some(
              (t) => t.id !== editing?.id && String(t.email).toLowerCase() === emailLower
            );
            if (emailConflict) {
              alert("Email must be unique.");
              return;
            }

            const idConflict = teachers.some(
              (t) => t.id !== editing?.id && String(t.teacher_id).toUpperCase() === idUpper
            );
            if (idConflict) {
              alert("Teacher ID must be unique.");
              return;
            }

            if (editing) {
              setTeachers((prev) =>
                prev.map((t) =>
                  t.id === editing.id
                    ? { ...t, ...payload, updated_at: new Date().toISOString() }
                    : t
                )
              );
            } else {
              setTeachers((prev) => [
                {
                  id: `t_${crypto.randomUUID()}`,
                  ...payload,
                  updated_at: new Date().toISOString(),
                },
                ...prev,
              ]);
            }

            setOpenForm(false);
          }}
        />
      </Modal>

      {/* View Modal */}
      <Modal
        open={openView}
        title={viewing ? `Teacher Profile — ${fullName(viewing)}` : "Teacher Profile"}
        onClose={() => setOpenView(false)}
        wide
      >
        {viewing && (
          <TeacherProfile
            teacher={viewing}
            onEdit={() => {
              setOpenView(false);
              openEdit(viewing);
            }}
            onClose={() => setOpenView(false)}
          />
        )}
      </Modal>

      {/* Delete Dialog */}
      <Modal
        open={openDelete}
        title={deleting ? `Delete Teacher — ${fullName(deleting)}` : "Delete Teacher"}
        onClose={() => setOpenDelete(false)}
      >
        {deleting && (
          <DeleteDialog
            teacher={deleting}
            // In UI-first mode, classes assigned is mocked
            assignedClasses={["STEM 11-A - Pre-Calculus", "General Mathematics - Grade 11"]}
            onCancel={() => setOpenDelete(false)}
            onSetInactive={() => {
              setTeachers((prev) =>
                prev.map((t) =>
                  t.id === deleting.id
                    ? { ...t, status: "Inactive", updated_at: new Date().toISOString() }
                    : t
                )
              );
              setOpenDelete(false);
            }}
            onDelete={() => {
              setTeachers((prev) => prev.filter((t) => t.id !== deleting.id));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(deleting.id);
                return next;
              });
              setOpenDelete(false);
            }}
          />
        )}
      </Modal>

      <div style={{ marginTop: 10, color: "#6B7280", fontSize: 12 }}>
        Note: This page is UI-first (in-memory). Next step: connect to Supabase tables + classes integration.
      </div>
    </div>
  );
}

/* =======================
   FORMS / MODALS
======================= */

function TeacherForm({ initial, existing, onCancel, onSave }) {
  const defaults = {
    teacher_id: initial?.teacher_id ?? autoTeacherId(existing),
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    middle_initial: initial?.middle_initial ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    dob: initial?.dob ?? "",
    gender: initial?.gender ?? "Prefer not to say",
    address: initial?.address ?? "",

    department: initial?.department ?? "Mathematics",
    subjects: initial?.subjects ?? ["General Mathematics"],
    specialization: initial?.specialization ?? "",
    attainment: initial?.attainment ?? "Bachelor's Degree",
    date_hired: initial?.date_hired ?? "",

    employment_status: initial?.employment_status ?? "Full-time",
    status: initial?.status ?? "Active",
    contract_start: initial?.contract_start ?? "",
    contract_end: initial?.contract_end ?? "",

    emergency_name: initial?.emergency_name ?? "",
    emergency_relationship: initial?.emergency_relationship ?? "",
    emergency_phone: initial?.emergency_phone ?? "",

    admin_notes: initial?.admin_notes ?? "",
    profile_photo_url: initial?.profile_photo_url ?? "",
  };

  const form = useForm({
    defaultValues: defaults,
    resolver: zodResolver(teacherSchema),
  });

  const employment = form.watch("employment_status");
  const subjects = form.watch("subjects");

  const [photoPreview, setPhotoPreview] = useState(initial?.profile_photo_url ?? "");

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        onSave({ ...values, profile_photo_url: photoPreview });
      })}
    >
      <Section title="Personal Information">
        <Grid>
          <RHFText form={form} name="teacher_id" label="Teacher ID *" placeholder="TCH-2024-001" />
          <RHFText form={form} name="first_name" label="First Name *" />
          <RHFText form={form} name="last_name" label="Last Name *" />
          <RHFText form={form} name="middle_initial" label="Middle Initial" placeholder="e.g., M." />
          <RHFText form={form} name="email" label="Email Address *" placeholder="name@grabsum.edu" />
          <RHFText form={form} name="phone" label="Phone Number *" placeholder="09XX XXX XXXX or +63 XXX XXX XXXX" />
          <RHFDate form={form} name="dob" label="Date of Birth" />
          <RHFSelect
            form={form}
            name="gender"
            label="Gender"
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Prefer not to say", label: "Prefer not to say" },
            ]}
          />
        </Grid>
        <RHFTextArea form={form} name="address" label="Address" placeholder="Home address" />
      </Section>

      <Section title="Professional Information">
        <Grid>
          <RHFSelect
            form={form}
            name="department"
            label="Department *"
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
          <div style={{ display: "grid", gap: 6 }}>
            <div style={styles.label}>Subjects Qualified to Teach *</div>
            <SubjectPicker
              selected={subjects}
              onToggle={(subj) => {
                const next = new Set(subjects);
                if (next.has(subj)) next.delete(subj);
                else next.add(subj);
                form.setValue("subjects", Array.from(next), { shouldValidate: true });
              }}
            />
            {form.formState.errors.subjects?.message && (
              <div style={styles.fieldErr}>{String(form.formState.errors.subjects.message)}</div>
            )}
          </div>
          <RHFText form={form} name="specialization" label="Specialization/Expertise" placeholder="e.g., Statistics" />
          <RHFSelect
            form={form}
            name="attainment"
            label="Highest Educational Attainment *"
            options={[
              "Bachelor's Degree",
              "Master's Degree",
              "Doctorate Degree",
              "With Master's Units",
              "Others",
            ].map((x) => ({ value: x, label: x }))}
          />
          <RHFDate form={form} name="date_hired" label="Date Hired *" />
        </Grid>
      </Section>

      <Section title="Employment Details">
        <Grid>
          <RadioGroup
            label="Employment Status *"
            value={form.watch("employment_status")}
            onChange={(v) => form.setValue("employment_status", v, { shouldValidate: true })}
            options={EMPLOYMENT_STATUSES}
          />
          <RadioGroup
            label="Status *"
            value={form.watch("status")}
            onChange={(v) => form.setValue("status", v, { shouldValidate: true })}
            options={TEACHER_STATUSES}
          />
        </Grid>

        {employment === "Contractual" && (
          <Grid>
            <RHFDate form={form} name="contract_start" label="Contract Start Date *" />
            <RHFDate form={form} name="contract_end" label="Contract End Date *" />
          </Grid>
        )}
      </Section>

      <Section title="Emergency Contact (Optional)">
        <Grid>
          <RHFText form={form} name="emergency_name" label="Emergency Contact Name" />
          <RHFText form={form} name="emergency_relationship" label="Emergency Contact Relationship" />
          <RHFText form={form} name="emergency_phone" label="Emergency Contact Number" />
        </Grid>
      </Section>

      <Section title="Additional Information (Optional)">
        <div style={styles.photoRow}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={styles.label}>Profile Photo</div>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert("Max file size is 2MB.");
                  return;
                }
                const url = URL.createObjectURL(file);
                setPhotoPreview(url);
              }}
            />
            <div style={{ color: "#6B7280", fontSize: 12 }}>Preview is local only for now.</div>
          </div>

          <div style={styles.photoPreviewBox}>
            {photoPreview ? (
              <img src={photoPreview} alt="Profile preview" style={styles.photoPreviewImg} />
            ) : (
              <div style={{ color: "#6B7280", fontSize: 12 }}>No photo</div>
            )}
          </div>
        </div>

        <RHFTextArea form={form} name="admin_notes" label="Admin Notes" placeholder="Internal notes (not visible to teacher)" />
      </Section>

      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.ghostBtn}>
          Cancel
        </button>
        <button type="submit" style={styles.primaryBtn}>
          {initial ? "Update Teacher" : "Save Teacher"}
        </button>
      </div>

      {initial?.updated_at && (
        <div style={{ marginTop: 10, color: "#6B7280", fontSize: 12 }}>
          Last updated: {new Date(initial.updated_at).toLocaleString()}
        </div>
      )}
    </form>
  );
}

function TeacherProfile({ teacher, onEdit, onClose }) {
  const [tab, setTab] = useState("personal");
  const yos = yearsOfService(teacher.date_hired);

  return (
    <div>
      <div style={styles.profileHeader}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={styles.profileAvatar}>
            {teacher.profile_photo_url ? (
              <img src={teacher.profile_photo_url} alt="Profile" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
            ) : (
              <Avatar url="" name={fullName(teacher)} big />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>{fullName(teacher)}</div>
            <div style={{ color: "#6B7280", fontSize: 13 }}>
              {teacher.teacher_id} • {teacher.department}
            </div>
            <div style={{ marginTop: 6 }}>
              <MiniBadge tone={badgeTone(teacher.status)}>{teacher.status}</MiniBadge>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.primaryBtn} onClick={onEdit}>
            <Pencil size={18} /> Edit Teacher
          </button>
          <button style={styles.ghostBtn} onClick={() => alert("Hook this to /admin/teachers/schedule later")}
            title="View Schedule">
            <Calendar size={18} /> View Schedule
          </button>
          <button style={styles.ghostBtn} onClick={() => alert("Hook this to /admin/students/classes later")}
            title="View Classes">
            <Users size={18} /> View Classes
          </button>
          <button style={styles.ghostBtn} onClick={onClose}>
            <X size={18} /> Close
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        <TabButton active={tab === "personal"} onClick={() => setTab("personal")}>Personal</TabButton>
        <TabButton active={tab === "professional"} onClick={() => setTab("professional")}>Professional</TabButton>
        <TabButton active={tab === "employment"} onClick={() => setTab("employment")}>Employment</TabButton>
        <TabButton active={tab === "load"} onClick={() => setTab("load")}>Teaching Load</TabButton>
        <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>Schedule</TabButton>
        <TabButton active={tab === "emergency"} onClick={() => setTab("emergency")}>Emergency</TabButton>
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>Admin Notes</TabButton>
      </div>

      <div style={styles.profileBody}>
        {tab === "personal" && (
          <InfoGrid
            items={[
              ["Full name", fullName(teacher)],
              ["Email", teacher.email],
              ["Phone", teacher.phone],
              ["Date of birth", teacher.dob || "—"],
              ["Gender", teacher.gender || "—"],
              ["Address", teacher.address || "—"],
            ]}
          />
        )}

        {tab === "professional" && (
          <>
            <InfoGrid
              items={[
                ["Department", teacher.department],
                ["Specialization", teacher.specialization || "—"],
                ["Educational attainment", teacher.attainment],
                ["Date hired", teacher.date_hired],
                ["Years of service", `${yos} year(s)`],
              ]}
            />
            <div style={{ marginTop: 12 }}>
              <div style={styles.sectionTitle}>Subjects qualified</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(teacher.subjects ?? []).map((s) => (
                  <Pill key={s}>{s}</Pill>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "employment" && (
          <InfoGrid
            items={[
              ["Employment status", teacher.employment_status],
              ["Current status", teacher.status],
              ["Contract start", teacher.contract_start || "—"],
              ["Contract end", teacher.contract_end || "—"],
            ]}
          />
        )}

        {tab === "load" && (
          <div>
            <div style={styles.sectionTitle}>Classes currently teaching</div>
            <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 10 }}>
              (UI placeholder) This will be pulled from the Classes page later.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>STEM 11-A - Pre-Calculus (MWF 8:00–9:00 AM) — Room 301</li>
              <li>General Mathematics (TTh 10:00–11:30 AM) — Room 205</li>
            </ul>
          </div>
        )}

        {tab === "schedule" && (
          <div>
            <div style={styles.sectionTitle}>Weekly schedule</div>
            <div style={{ color: "#6B7280", fontSize: 13 }}>
              (UI placeholder) Integrate with Teacher Schedule page later.
            </div>
            <div style={styles.scheduleStub}>
              <div><b>Mon</b> • 8:00–9:00 Pre-Calculus</div>
              <div><b>Wed</b> • 8:00–9:00 Pre-Calculus</div>
              <div><b>Fri</b> • 8:00–9:00 Pre-Calculus</div>
            </div>
          </div>
        )}

        {tab === "emergency" && (
          <InfoGrid
            items={[
              ["Name", teacher.emergency_name || "—"],
              ["Relationship", teacher.emergency_relationship || "—"],
              ["Phone", teacher.emergency_phone || "—"],
            ]}
          />
        )}

        {tab === "notes" && (
          <div>
            <div style={styles.sectionTitle}>Internal notes</div>
            <div style={styles.notesBox}>{teacher.admin_notes || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteDialog({ teacher, assignedClasses, onCancel, onSetInactive, onDelete }) {
  return (
    <div>
      <div style={styles.dangerBox}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={20} />
          <div>
            <div style={{ fontWeight: 950 }}>Delete Teacher?</div>
            <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              Are you sure you want to delete <b>{fullName(teacher)}</b>?
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.sectionTitle}>Assigned classes</div>
        <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 8 }}>
          This teacher is currently assigned to <b>{assignedClasses.length}</b> class(es):
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {assignedClasses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <div style={styles.warnBox}>
          <AlertTriangle size={18} />
          <div>
            <div style={{ fontWeight: 900 }}>Recommendation</div>
            <div style={{ fontSize: 13 }}>
              Set status to <b>Inactive</b> instead of deleting to preserve history.
            </div>
          </div>
        </div>
      </div>

      <div style={styles.formActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={{ ...styles.ghostBtn, borderColor: "#10B981" }} onClick={onSetInactive}>
          Set to Inactive
        </button>
        <button style={{ ...styles.dangerBtn }} onClick={onDelete}>
          Permanently Delete
        </button>
      </div>
    </div>
  );
}

/* =======================
   SMALL UI COMPONENTS
======================= */

function autoTeacherId(existing) {
  // Finds the max ### for current year and increments
  const year = new Date().getFullYear();
  const prefix = `TCH-${year}-`;
  const nums = existing
    .map((t) => String(t.teacher_id || ""))
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function SubjectPicker({ selected, onToggle }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ALL_SUBJECTS;
    return ALL_SUBJECTS.filter((x) => x.toLowerCase().includes(s));
  }, [q]);

  return (
    <div style={styles.subjectPicker}>
      <div style={styles.subjectSearch}>
        <Search size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subjects…"
          style={styles.subjectSearchInput}
        />
      </div>

      <div style={styles.subjectChips}>
        {selected.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            style={styles.subjectChipSelected}
            title="Click to remove"
          >
            {s} <X size={14} />
          </button>
        ))}
      </div>

      <div style={styles.subjectList}>
        {filtered.slice(0, 60).map((s) => {
          const isSel = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              style={isSel ? styles.subjectItemSelected : styles.subjectItem}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div style={{ color: "#6B7280", fontSize: 12, marginTop: 6 }}>
        Selected: <b>{selected.length}</b>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ title, value, tone, icon }) {
  const top =
    tone === "gold"
      ? "#DAA520"
      : tone === "green"
      ? "#10B981"
      : tone === "orange"
      ? "#F59E0B"
      : "#A0826D";

  return (
    <div style={{ ...styles.statCard, borderTopColor: top }}>
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{title}</div>
      </div>
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
          width: wide ? "min(1040px, 100%)" : "min(820px, 100%)",
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

function MiniBadge({ tone = "gray", children }) {
  const map = {
    green: { bg: "#ECFDF5", fg: "#065F46", bd: "#10B981" },
    orange: { bg: "#FFFBEB", fg: "#92400E", bd: "#F59E0B" },
    gray: { bg: "#F3F4F6", fg: "#374151", bd: "#E5E7EB" },
    blue: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#60A5FA" },
  };
  const c = map[tone] || map.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Pill({ children }) {
  return <span style={styles.pill}>{children}</span>;
}

function Th({ children, align }) {
  return <th style={{ ...styles.th, textAlign: align || "left" }}>{children}</th>;
}

function Td({ children, align }) {
  return <td style={{ ...styles.td, textAlign: align || "left" }}>{children}</td>;
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div style={styles.formGrid}>{children}</div>;
}

function RHFText({ form, name, label, placeholder }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <input {...form.register(name)} placeholder={placeholder} style={styles.input} />
      {err && <div style={styles.fieldErr}>{String(err)}</div>}
    </div>
  );
}

function RHFDate({ form, name, label }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <input type="date" {...form.register(name)} style={styles.input} />
      {err && <div style={styles.fieldErr}>{String(err)}</div>}
    </div>
  );
}

function RHFSelect({ form, name, label, options }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <select {...form.register(name)} style={styles.input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {err && <div style={styles.fieldErr}>{String(err)}</div>}
    </div>
  );
}

function RHFTextArea({ form, name, label, placeholder }) {
  const err = form.formState.errors?.[name]?.message;
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
      <div style={styles.label}>{label}</div>
      <textarea {...form.register(name)} placeholder={placeholder} rows={3} style={styles.textarea} />
      {err && <div style={styles.fieldErr}>{String(err)}</div>}
    </div>
  );
}

function RadioGroup({ label, value, onChange, options }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.label}>{label}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {options.map((o) => (
          <label key={o} style={styles.radioLabel}>
            <input type="radio" checked={value === o} onChange={() => onChange(o)} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

function Avatar({ url, name, big }) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const size = big ? 56 : 36;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        background: "#FAF9F6",
        display: "grid",
        placeItems: "center",
        fontWeight: 950,
        color: "#A0826D",
        overflow: "hidden",
      }}
    >
      {url ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials || "T"
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        borderColor: active ? "#DAA520" : "#E5E7EB",
        background: active ? "#FFFBEB" : "#fff",
      }}
    >
      {children}
    </button>
  );
}

function InfoGrid({ items }) {
  return (
    <div style={styles.infoGrid}>
      {items.map(([k, v]) => (
        <div key={k} style={styles.infoItem}>
          <div style={styles.infoKey}>{k}</div>
          <div style={styles.infoVal}>{String(v ?? "—")}</div>
        </div>
      ))}
    </div>
  );
}

/* =======================
   STYLES
======================= */

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
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 20px rgba(160,130,109,0.35)",
  },

  dangerBtn: {
    background: "#EF4444",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  ghostBtn: {
    background: "transparent",
    color: "#2C2C2C",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  statCard: {
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    gap: 12,
    borderTop: "5px solid",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
    border: "1px solid #E5E7EB",
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "#FAF9F6",
    display: "grid",
    placeItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: 950 },
  statLabel: { color: "#6B7280" },

  filterCard: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    marginBottom: 14,
  },

  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },

  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    borderRadius: 999,
    padding: "10px 12px",
    minWidth: 260,
    flex: "1 1 260px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    color: "#2C2C2C",
  },

  filterGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
    alignItems: "end",
    flex: "2 1 640px",
  },

  filterMeta: { marginTop: 10, color: "#6B7280", fontSize: 13 },

  bulkBar: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FDFBF7",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  bulkBtn: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#2C2C2C",
  },

  label: { fontSize: 12, color: "#6B7280" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
  },

  smallSelect: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#fff",
    outline: "none",
    fontWeight: 900,
  },

  tableWrap: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    position: "sticky",
    top: 0,
    background: "#FDFBF7",
    color: "#6B7280",
    fontSize: 12,
    fontWeight: 950,
    padding: 12,
    borderBottom: "1px solid #E5E7EB",
    zIndex: 1,
  },
  td: { padding: 12, borderBottom: "1px solid #F3F4F6", verticalAlign: "top" },
  tr: {
    transition: "background 120ms ease",
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

  linkLike: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#2C2C2C",
  },

  pill: {
    fontSize: 12,
    fontWeight: 900,
    color: "#2C2C2C",
    background: "#FAF9F6",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "4px 10px",
  },

  paginationRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  pageBtn: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#2C2C2C",
  },

  /* Modal */
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

  /* Form */
  section: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed #E5E7EB" },
  sectionTitle: { fontWeight: 950, color: "#A0826D", marginBottom: 10 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  fieldErr: { color: "#EF4444", fontSize: 12, fontWeight: 950 },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    outline: "none",
    resize: "vertical",
  },
  formActions: { marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },

  radioLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    fontWeight: 800,
  },

  /* Subject picker */
  subjectPicker: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 10,
    background: "#FDFBF7",
  },
  subjectSearch: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #E5E7EB",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 10px",
  },
  subjectSearchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    background: "transparent",
  },
  subjectChips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  subjectChipSelected: {
    background: "#FFFBEB",
    border: "1px solid #DAA520",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#92400E",
  },
  subjectList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 8,
    marginTop: 10,
    maxHeight: 220,
    overflow: "auto",
    paddingRight: 4,
  },
  subjectItem: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  },
  subjectItemSelected: {
    background: "#ECFDF5",
    border: "1px solid #10B981",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 900,
    color: "#065F46",
  },

  /* Photo */
  photoRow: { display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" },
  photoPreviewBox: {
    width: 120,
    height: 120,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },
  photoPreviewImg: { width: "100%", height: "100%", objectFit: "cover" },

  /* Profile */
  profileHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  profileAvatar: {},
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  tabBtn: {
    border: "1px solid #E5E7EB",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#2C2C2C",
  },
  profileBody: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  infoItem: { display: "grid", gap: 6 },
  infoKey: { fontSize: 12, color: "#6B7280", fontWeight: 900 },
  infoVal: { fontWeight: 900, color: "#2C2C2C" },
  scheduleStub: {
    marginTop: 10,
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    padding: 12,
    display: "grid",
    gap: 8,
    fontWeight: 800,
  },
  notesBox: {
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FAF9F6",
    padding: 12,
    fontWeight: 800,
    color: "#2C2C2C",
    whiteSpace: "pre-wrap",
  },

  dangerBox: {
    borderRadius: 12,
    border: "1px solid #EF4444",
    background: "#FEF2F2",
    padding: 12,
  },

  warnBox: {
    marginTop: 12,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#FFFBEB",
    border: "1px solid #F59E0B",
    color: "#92400E",
    fontWeight: 900,
  },
};
