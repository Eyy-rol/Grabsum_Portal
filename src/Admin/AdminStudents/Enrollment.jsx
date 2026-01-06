// Admin/AdminStudents/Enrollment.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Save,
  RefreshCcw,
  ArchiveRestore,
  Inbox,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ClassModal from "../../components/ClassModal";

const EDGE_FN_NAME = "super-api";

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

const STATUS = ["Pending", "Approved", "Rejected"];

/** ✅ Updated to include LRN (12 digits) */
const enrollmentSchema = z.object({
  application_id: z.string().min(1, "Application ID is required").max(50),

  // ✅ NEW
  st_lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits (numbers only)."),

  st_fname: z.string().min(1, "First name is required").max(150),
  st_lname: z.string().min(1, "Last name is required").max(150),
  st_mi: z.string().max(10).optional().or(z.literal("")),
  st_ext: z.string().max(20).optional().or(z.literal("")),
  st_email: z.string().email("Valid email required"),
  st_gender: z.enum(["Male", "Female"], { message: "Gender is required" }),
  st_civil_status: z.enum(["Single", "Married", "Widowed", "Separated", "Divorced"], {
    message: "Civil status is required",
  }),
  st_bdate: z.string().min(1, "Date of birth is required"),
  st_current_address: z.string().min(1, "Address is required").max(255),

  // keep optional (ok if your table has these cols)
  st_guardian_name: z.string().optional().or(z.literal("")),
  st_guardian_contact: z.string().optional().or(z.literal("")),

  grade_id: z.string().optional().or(z.literal("")),
  track_id: z.string().optional().or(z.literal("")),
  strand_id: z.string().optional().or(z.literal("")),
  st_application_status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
});

/* ===================== Helpers ===================== */

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function fullName(r) {
  const ext = r.st_ext?.trim() ? ` ${r.st_ext.trim()}` : "";
  const mi = r.st_mi?.trim() ? ` ${r.st_mi.trim()}.` : "";
  return `${r.st_lname || ""}, ${r.st_fname || ""}${ext}${mi}`.trim();
}

async function generateApplicationId() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${mm}-${dd}`;

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

async function copyCredentialsToClipboard({ student_number, temp_password }, toast) {
  try {
    const text = `Student Number: ${student_number}\nTemporary Password: ${temp_password || "—"}`;
    await navigator.clipboard.writeText(text);

    toast.push({
      tone: "success",
      title: "Copied to clipboard",
      message: "Credentials copied successfully.",
    });
    return true;
  } catch (e) {
    toast.push({
      tone: "danger",
      title: "Copy failed",
      message: String(e?.message || e),
    });
    return false;
  }
}

/* ===================== Toast ===================== */
/** ✅ Top-right now */
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
              <div className="text-sm font-extrabold text-[#1F1A14]">{t.title}</div>
              {t.message ? (
                <div className="mt-1 text-xs font-semibold text-black/60">{t.message}</div>
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

export default function Enrollment() {
  const qc = useQueryClient();
  const toast = useToasts();

  // Tabs: Pending | Approved | Enrolled
  const [tab, setTab] = useState("Pending");
  const [scope, setScope] = useState("Active"); // Active | Archived

  const [qName, setQName] = useState("");
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");

  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

  // credentials modal
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessData, setAccessData] = useState(null);

  const tracksQ = useQuery({
    queryKey: ["tracks_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("track_id, track_code, description")
        .order("track_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const gradesQ = useQuery({
    queryKey: ["grades_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_levels")
        .select("grade_id, grade_level, description")
        .order("grade_level", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const strandsQ = useQuery({
    queryKey: ["strands_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strands")
        .select("strand_id, track_id, strand_code, description")
        .order("strand_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Enrollment table
  const enrollQ = useQuery({
    queryKey: ["enrollment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollment").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Students table
  const studentsQ = useQuery({
    queryKey: ["students"],
    enabled: tab === "Enrolled",
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrollmentRows = enrollQ.data ?? [];
  const studentsRows = studentsQ.data ?? [];

  const trackMap = useMemo(() => {
    const m = new Map();
    (tracksQ.data ?? []).forEach((t) => m.set(String(t.track_id), t.track_code));
    return m;
  }, [tracksQ.data]);

  const gradeMap = useMemo(() => {
    const m = new Map();
    (gradesQ.data ?? []).forEach((g) => m.set(String(g.grade_id), String(g.grade_level)));
    return m;
  }, [gradesQ.data]);

  /* ===================== Filters ===================== */

  const baseFilteredEnrollment = useMemo(() => {
    const needle = qName.trim().toLowerCase();

    return enrollmentRows
      .filter((r) => Boolean(r.is_archived) === (scope === "Archived"))
      .filter((r) => (needle ? fullName(r).toLowerCase().includes(needle) : true))
      .filter((r) => (fTrack === "All" ? true : String(r.track_id || "") === String(fTrack)))
      .filter((r) => (fGrade === "All" ? true : String(r.grade_id || "") === String(fGrade)));
  }, [enrollmentRows, qName, fTrack, fGrade, scope]);

  const pendingRows = useMemo(() => {
    return baseFilteredEnrollment.filter((r) => norm(r.st_application_status) === "pending");
  }, [baseFilteredEnrollment]);

  const approvedRows = useMemo(() => {
    return baseFilteredEnrollment.filter(
      (r) => norm(r.st_application_status) === "approved" && !r.user_id
    );
  }, [baseFilteredEnrollment]);

  const filteredStudents = useMemo(() => {
    const needle = qName.trim().toLowerCase();

    return studentsRows.filter((r) => {
      if (!needle) return true;
      const hay = `${r.student_number || ""} ${r.first_name || ""} ${r.last_name || ""} ${r.email || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [studentsRows, qName]);

  /* ===================== Mutations ===================== */

  const createM = useMutation({
    mutationFn: async (values) => {
      const now = new Date().toISOString();
      const payload = {
        ...values,
        st_application_status: "Pending",
        st_submission_date: now,
        st_updated_at: now,
        is_archived: false,
      };
      const { error } = await supabase.from("enrollment").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      toast.push({ tone: "success", title: "Created", message: "Enrollment record added." });
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Create failed", message: String(e?.message || e) }),
  });

  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const patch = { ...values, st_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { error } = await supabase.from("enrollment").update(patch).eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      toast.push({ tone: "success", title: "Saved", message: "Changes updated." });
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Update failed", message: String(e?.message || e) }),
  });

  // Pending -> Approved
  const approveM = useMutation({
    mutationFn: async (row) => {
      const patch = {
        st_application_status: "Approved",
        st_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("enrollment").update(patch).eq("id", row.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      toast.push({ tone: "success", title: "Approved", message: "Moved to Approved tab." });
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Approve failed", message: String(e?.message || e) }),
  });

  const enrollEdgeM = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
        body: { action: "enroll", enrollment_id: row.id },
      });

      if (error) throw new Error(error.message || "Enroll failed");
      if (!data?.student_number) throw new Error("No student_number returned");

      return data;
    },
    onSuccess: async (data) => {
      setAccessData({
        student_number: data.student_number,
        temp_password: data.temp_password || null,
        class_info: { grade_level: "—", section: "—", adviser: "—", schedule: "—" },
      });
      setAccessModalOpen(true);

      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      await qc.invalidateQueries({ queryKey: ["students"] });

      toast.push({ tone: "success", title: "Enrolled", message: "Student # generated successfully." });

      // ✅ simple copy + simple toast
      await copyCredentialsToClipboard(
        { student_number: data.student_number, temp_password: data.temp_password },
        toast
      );
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Enroll failed", message: String(e?.message || e) }),
  });

  const archiveEnrollmentM = useMutation({
    mutationFn: async (row) => {
      const { error: e1 } = await supabase
        .from("enrollment")
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
          st_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (e1) throw e1;

      if (row.user_id) {
        const { error } = await supabase.functions.invoke(EDGE_FN_NAME, {
          body: { action: "archive_student", user_id: row.user_id },
        });
        if (error) throw new Error(error.message || "Failed to lock student");
      }

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      await qc.invalidateQueries({ queryKey: ["students"] });
      toast.push({ tone: "success", title: "Archived", message: "Moved to Archived and access disabled." });
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Archive failed", message: String(e?.message || e) }),
  });

  const restoreEnrollmentM = useMutation({
    mutationFn: async (row) => {
      const { error: e1 } = await supabase
        .from("enrollment")
        .update({
          is_archived: false,
          updated_at: new Date().toISOString(),
          st_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (e1) throw e1;

      if (row.user_id) {
        const { error } = await supabase.functions.invoke(EDGE_FN_NAME, {
          body: { action: "restore_student", user_id: row.user_id },
        });
        if (error) throw new Error(error.message || "Failed to restore student access");
      }
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
      await qc.invalidateQueries({ queryKey: ["students"] });
      toast.push({ tone: "success", title: "Restored", message: "Student restored." });
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Restore failed", message: String(e?.message || e) }),
  });

  const resetPwdM = useMutation({
    mutationFn: async (stuRow) => {
      if (!stuRow.user_id) throw new Error("Missing user_id");

      const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
        body: { action: "reset", user_id: stuRow.user_id },
      });

      if (error) throw new Error(error.message || "Reset failed");
      if (!data?.temp_password) throw new Error("No temp_password returned");

      return { ...data, student_number: stuRow.student_number };
    },
    onSuccess: async (data) => {
      setAccessData({
        student_number: data.student_number,
        temp_password: data.temp_password,
        class_info: { grade_level: "—", section: "—", adviser: "—", schedule: "—" },
      });
      setAccessModalOpen(true);

      toast.push({ tone: "success", title: "Password reset", message: "Temporary password generated." });

      // ✅ simple copy + simple toast
      await copyCredentialsToClipboard(
        { student_number: data.student_number, temp_password: data.temp_password },
        toast
      );
    },
    onError: (e) =>
      toast.push({ tone: "danger", title: "Reset failed", message: String(e?.message || e) }),
  });

  /* ===================== Actions ===================== */

  async function openCreate() {
    const appId = await generateApplicationId();
    setModal({
      open: true,
      mode: "create",
      row: {
        application_id: appId,

        // ✅ NEW
        st_lrn: "",

        st_fname: "",
        st_lname: "",
        st_mi: "",
        st_ext: "",
        st_email: "",
        st_gender: "Male",
        st_civil_status: "Single",
        st_bdate: "",
        st_current_address: "",
        st_guardian_name: "",
        st_guardian_contact: "",
        grade_id: "",
        track_id: "",
        strand_id: "",
        st_application_status: "Pending",
      },
    });
  }

  function openEdit(row) {
    setModal({ open: true, mode: "edit", row });
  }

  const busy =
    createM.isPending ||
    updateM.isPending ||
    approveM.isPending ||
    enrollEdgeM.isPending ||
    archiveEnrollmentM.isPending ||
    restoreEnrollmentM.isPending ||
    resetPwdM.isPending;

  async function onArchiveEnrollment(row) {
    const ok = await toast.confirm({
      title: "Archive student?",
      message: "This will move to Archived. If the student already has an account, access will be disabled.",
      confirmText: "Archive",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    archiveEnrollmentM.mutate(row);
  }

  async function onRestoreEnrollment(row) {
    const ok = await toast.confirm({
      title: "Restore student?",
      message: "This will restore the record and re-enable access (if enrolled).",
      confirmText: "Restore",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;
    restoreEnrollmentM.mutate(row);
  }

  async function onApprove(row) {
    const ok = await toast.confirm({
      title: "Approve application?",
      message: "This will move the application from Pending to Approved tab.",
      confirmText: "Approve",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;
    approveM.mutate(row);
  }

  async function onEnrollNow(row) {
    const ok = await toast.confirm({
      title: "Enroll student now?",
      message: "This will generate Student Number + temp password (if new).",
      confirmText: "Enroll",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;
    enrollEdgeM.mutate(row);
  }

  /* ===================== UI ===================== */

  const shownEnrollmentRows = tab === "Pending" ? pendingRows : approvedRows;

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Enrollment</div>
          <div className={`text-sm ${UI.muted}`}>Pending → Approve → Approved → Enroll → Enrolled (Students).</div>
        </div>

        {tab === "Pending" ? (
          <button
            onClick={openCreate}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
            disabled={scope === "Archived" || busy}
            title={scope === "Archived" ? "Switch to Active scope to add" : "Add student"}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        ) : null}
      </div>

      {/* Tabs */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("Pending")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              tab === "Pending"
                ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
            type="button"
          >
            <Inbox className="h-4 w-4" />
            Pending
          </button>

          <button
            onClick={() => setTab("Approved")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              tab === "Approved"
                ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approved
          </button>

          <button
            onClick={() => setTab("Enrolled")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              tab === "Enrolled"
                ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
            type="button"
          >
            <GraduationCap className="h-4 w-4" />
            Enrolled
          </button>
        </div>
      </div>

      {/* Scope */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setScope("Active")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              scope === "Active"
                ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
            type="button"
          >
            Active
          </button>
          <button
            onClick={() => setScope("Archived")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
              scope === "Archived"
                ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                : "bg-white border-black/10 hover:bg-black/[0.02]"
            }`}
            type="button"
          >
            Archived
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={tab === "Enrolled" ? "Search student # / name / email" : "Student name"}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder={tab === "Enrolled" ? "Search S25-0001, last name..." : "Search last/first name…"}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <Field label="Status">
            <div className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/60">
              {tab === "Pending" ? "Pending only" : tab === "Approved" ? "Approved only" : "Enrolled only"}
            </div>
          </Field>

          <Field label="Track (optional)">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="All">All</option>
              {(tracksQ.data ?? []).map((t) => (
                <option key={t.track_id} value={t.track_id}>
                  {t.track_code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grade (optional)">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="All">All</option>
              {(gradesQ.data ?? []).map((g) => (
                <option key={g.grade_id} value={g.grade_id}>
                  {g.grade_level}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">
            {tab === "Enrolled"
              ? scope === "Archived"
                ? "Archived Students (access disabled)"
                : "Enrolled Students"
              : scope === "Archived"
              ? "Archived Applications"
              : tab === "Pending"
              ? "Pending Applications"
              : "Approved Applications"}
          </div>

          <div className={`text-xs ${UI.muted}`}>
            {tab === "Enrolled"
              ? `Showing ${filteredStudents.length} of ${studentsRows.length}`
              : `Showing ${shownEnrollmentRows.length} of ${baseFilteredEnrollment.length}`}
          </div>
        </div>

        {/* Enrollment tables (Pending/Approved) */}
        {tab !== "Enrolled" ? (
          enrollQ.isLoading ? (
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
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Grade</th>
                  <th className="px-4 py-3 font-semibold">Track</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {shownEnrollmentRows.map((r) => (
                  <tr key={r.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                    <td className="px-4 py-3 font-semibold">{r.application_id || "-"}</td>
                    <td className="px-4 py-3">{fullName(r)}</td>
                    <td className="px-4 py-3 text-black/70">{r.st_email || "-"}</td>
                    <td className="px-4 py-3 text-black/70">
                      {gradeMap.get(String(r.grade_id || "")) || "-"}
                    </td>
                    <td className="px-4 py-3 text-black/70">
                      {trackMap.get(String(r.track_id || "")) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={r.st_application_status || "Pending"} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {scope === "Active" ? (
                          <>
                            <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold" disabled={busy}>
                              <Pencil className="h-5 w-5" />
                            </IconBtn>

                            {/* Pending tab: Approve only */}
                            {tab === "Pending" ? (
                              <button
                                type="button"
                                onClick={() => onApprove(r)}
                                disabled={busy}
                                className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
                                  busy ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black"
                                }`}
                                title="Approve application"
                              >
                                Approve
                              </button>
                            ) : null}

                            {/* Approved tab: Enroll */}
                            {tab === "Approved" ? (
                              <button
                                type="button"
                                onClick={() => onEnrollNow(r)}
                                disabled={busy}
                                className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
                                  busy ? "bg-black/5 text-black/40" : "bg-[#C9A227] text-black"
                                }`}
                                title="Enroll now (generate Student #)"
                              >
                                Enroll
                              </button>
                            ) : null}

                            <IconBtn title="Archive" onClick={() => onArchiveEnrollment(r)} tone="danger" disabled={busy}>
                              <Trash2 className="h-5 w-5" />
                            </IconBtn>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onRestoreEnrollment(r)}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black disabled:opacity-60"
                            title="Restore this application"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {shownEnrollmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                      No records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )
        ) : (
          // Enrolled tab (students)
          studentsQ.isLoading ? (
            <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
          ) : studentsQ.isError ? (
            <div className="p-6 text-sm text-rose-700">
              Error: {String(studentsQ.error?.message || studentsQ.error)}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs text-black/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student #</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                    <td className="px-4 py-3 font-semibold">{s.student_number}</td>
                    <td className="px-4 py-3">{`${s.last_name || ""}, ${s.first_name || ""}`.trim()}</td>
                    <td className="px-4 py-3 text-black/70">{s.email || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAccessData({
                              student_number: s.student_number,
                              temp_password: null,
                              class_info: { grade_level: "—", section: "—", adviser: "—", schedule: "—" },
                            });
                            setAccessModalOpen(true);
                          }}
                          className="rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black"
                        >
                          Show Access
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resetPwdM.mutate(s)}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-rose-600 text-white disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                      No enrolled students found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Modal for create/edit enrollment */}
      {modal.open ? (
        <StudentModal
          mode={modal.mode}
          row={modal.row}
          tracks={tracksQ.data ?? []}
          grades={gradesQ.data ?? []}
          strands={strandsQ.data ?? []}
          onClose={() => setModal({ open: false, mode: "create", row: null })}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={async (id, values) => {
            await updateM.mutateAsync({ id, values });
          }}
          busy={createM.isPending || updateM.isPending}
        />
      ) : null}

      <ClassModal open={accessModalOpen} onClose={() => setAccessModalOpen(false)} data={accessData} title="Student Login + Class" />
    </div>
  );
}

/* ================= Modal (pre-enrollment UI + LRN checker) ================= */

function StudentModal({ mode, row, tracks, grades, strands, onClose, onCreate, onUpdate, busy }) {
  const isEdit = mode === "edit";

  const defaults = useMemo(() => {
    return {
      application_id: row?.application_id || "",
      st_lrn: row?.st_lrn || "",

      st_fname: row?.st_fname || "",
      st_lname: row?.st_lname || "",
      st_mi: row?.st_mi || "",
      st_ext: row?.st_ext || "",

      st_email: row?.st_email || "",
      st_gender: row?.st_gender || "Male",
      st_civil_status: row?.st_civil_status || "Single",
      st_bdate: row?.st_bdate ? String(row.st_bdate).slice(0, 10) : "",
      st_current_address: row?.st_current_address || "",

      st_guardian_name: row?.st_guardian_name || "",
      st_guardian_contact: row?.st_guardian_contact || "",

      grade_id: row?.grade_id || "",
      track_id: row?.track_id || "",
      strand_id: row?.strand_id || "",
      st_application_status: row?.st_application_status || "Pending",
    };
  }, [row]);

  const form = useForm({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: defaults,
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, watch, formState } = form;
  const { errors, isValid } = formState;

  const watchedStatus = watch("st_application_status");
  const trackId = watch("track_id");

  const filteredStrands = useMemo(() => {
    if (!trackId) return [];
    return (strands ?? []).filter((s) => String(s.track_id) === String(trackId));
  }, [strands, trackId]);

  useEffect(() => {
    form.setValue("strand_id", "");
  }, [trackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ LRN checker
  const [lrnState, setLrnState] = useState({ checking: false, exists: false, message: "" });
  const lrn = watch("st_lrn");
  const originalLrn = row?.st_lrn || "";

  useEffect(() => {
    const cleaned = String(lrn || "").replace(/\D/g, "");
    if (lrn !== cleaned) form.setValue("st_lrn", cleaned);

    if (!cleaned || cleaned.length !== 12) {
      setLrnState({ checking: false, exists: false, message: "" });
      return;
    }

    if (isEdit && cleaned === String(originalLrn)) {
      setLrnState({ checking: false, exists: false, message: "LRN unchanged." });
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      try {
        setLrnState({ checking: true, exists: false, message: "Checking LRN..." });

        // check enrollment.st_lrn
        const { data: enr, error: e1 } = await supabase
          .from("enrollment")
          .select("id")
          .eq("st_lrn", cleaned)
          .limit(1);

        if (e1) throw e1;
        if (!alive) return;

        if (enr && enr.length > 0) {
          setLrnState({ checking: false, exists: true, message: "LRN already exists in enrollment." });
          return;
        }

        // check students.lrn (if column exists; ignore error)
        const { data: stu, error: e2 } = await supabase
          .from("students")
          .select("id")
          .eq("lrn", cleaned)
          .limit(1);

        if (e2) {
          setLrnState({ checking: false, exists: false, message: "LRN looks available." });
          return;
        }

        if (!alive) return;

        if (stu && stu.length > 0) {
          setLrnState({ checking: false, exists: true, message: "LRN already exists in students." });
          return;
        }

        setLrnState({ checking: false, exists: false, message: "LRN is available." });
      } catch (err) {
        if (!alive) return;
        setLrnState({
          checking: false,
          exists: false,
          message: `LRN check failed: ${String(err?.message || err)}`,
        });
      }
    }, 450);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [lrn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(values) {
    if (lrnState.exists) return;

    if (!isEdit) {
      onCreate(values);
      onClose();
      return;
    }
    await onUpdate(row.id, values);
    onClose();
  }

  const submitDisabled = busy || lrnState.checking || lrnState.exists || !isValid;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{isEdit ? "Edit Student" : "Add Student"}</div>
              <div className="text-xs text-black/60">Pending → Approve → Approved → Enroll → Enrolled.</div>
              <div className="mt-1 text-xs font-bold text-black/60">
                Current status: <span className="text-black">{watchedStatus}</span>
              </div>
            </div>

            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5" type="button">
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit(submit)} className="p-4 space-y-4 max-h-[75vh] overflow-auto">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Application ID" error={errors.application_id?.message} {...register("application_id")} />

              {isEdit ? (
                <Select label="Status" {...register("st_application_status")}>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="md:col-span-2 rounded-xl border border-black/10 bg-[#C9A227]/5 p-3">
                  <div className="text-xs font-semibold text-black/60">Status</div>
                  <div className="mt-1 text-sm font-extrabold text-black">Pending (default)</div>
                </div>
              )}
            </div>

            <Section title="Full Name">
              <div className="grid gap-3 md:grid-cols-4">
                <Input label="Last Name *" error={errors.st_lname?.message} {...register("st_lname")} />
                <Input label="First Name *" error={errors.st_fname?.message} {...register("st_fname")} />
                <Input label="M.I." error={errors.st_mi?.message} {...register("st_mi")} />
                <Input label="Ext." error={errors.st_ext?.message} {...register("st_ext")} />
              </div>
            </Section>

            <Section title="Personal Info">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-3">
                  <Input
                    label="LRN * (12 digits)"
                    inputMode="numeric"
                    placeholder="############"
                    error={errors.st_lrn?.message}
                    {...register("st_lrn")}
                  />
                  {lrnState.message ? (
                    <div
                      className={`mt-1 text-xs font-semibold ${
                        lrnState.exists ? "text-rose-700" : lrnState.checking ? "text-black/60" : "text-emerald-700"
                      }`}
                    >
                      {lrnState.message}
                    </div>
                  ) : null}
                </div>

                <Input label="Email *" error={errors.st_email?.message} {...register("st_email")} />
                <Select label="Gender *" error={errors.st_gender?.message} {...register("st_gender")}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </Select>
                <Select label="Civil Status *" error={errors.st_civil_status?.message} {...register("st_civil_status")}>
                  {["Single", "Married", "Widowed", "Separated", "Divorced"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-3">
                <Input label="Date of Birth *" type="date" error={errors.st_bdate?.message} {...register("st_bdate")} />
              </div>

              <div className="mt-3">
                <Input
                  label="Address *"
                  error={errors.st_current_address?.message}
                  {...register("st_current_address")}
                />
              </div>
            </Section>

            <Section title="Academic (optional)">
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Grade Level" {...register("grade_id")}>
                  <option value="">—</option>
                  {(grades ?? []).map((g) => (
                    <option key={g.grade_id} value={g.grade_id}>
                      {g.grade_level}
                    </option>
                  ))}
                </Select>

                <Select label="Track" {...register("track_id")}>
                  <option value="">—</option>
                  {(tracks ?? []).map((t) => (
                    <option key={t.track_id} value={t.track_id}>
                      {t.track_code}
                    </option>
                  ))}
                </Select>

                <Select label="Strand" {...register("strand_id")} disabled={!trackId}>
                  <option value="">{trackId ? "—" : "Select track first"}</option>
                  {filteredStrands.map((s) => (
                    <option key={s.strand_id} value={s.strand_id}>
                      {s.strand_code}
                    </option>
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
                disabled={submitDisabled}
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black hover:opacity-95 disabled:opacity-60"
                title={
                  lrnState.exists
                    ? "LRN already exists"
                    : lrnState.checking
                    ? "Checking LRN..."
                    : !isValid
                    ? "Fill required fields"
                    : ""
                }
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
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-extrabold text-[#6B4E2E]">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Input({ label, error, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        type={type}
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function Select({ label, error, children, disabled, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        {...rest}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:bg-black/[0.02]"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function IconBtn({ title, onClick, tone, disabled, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls} disabled:opacity-60`}
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
      : v === "rejected"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}
