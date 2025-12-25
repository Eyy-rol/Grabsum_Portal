// Admin/AdminStudents/Enrollment.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { Plus, Search, Trash2, Pencil, X, Save, RefreshCcw } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ClassModal from "../../components/ClassModal"; // ✅ adjust path

const EDGE_FN_NAME = "super-api";

const UI = {
  pageBg: "bg-white",
  panel: "bg-white",
  border: "border-black/10",
  text: "text-[#1F1A14]",
  muted: "text-black/55",
  goldBg: "bg-[#C9A227]",
};

const STATUS = ["Pending", "Approved", "Enrolled", "Rejected"];
const TRACKS = ["STEM", "HUMSS", "GAS", "ABM", "TVL"];
const GRADES = ["11", "12"];

const enrollmentSchema = z.object({
  application_id: z.string().min(1, "Application ID is required").max(50),
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
  st_guardian_name: z.string().optional().or(z.literal("")),
  st_guardian_contact: z.string().optional().or(z.literal("")),
  st_grade_level: z.string().optional().or(z.literal("")),
  st_track: z.string().optional().or(z.literal("")),
  st_application_status: z.enum(["Pending", "Approved", "Enrolled", "Rejected"]).optional(),
});

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

export default function Enrollment() {
  const qc = useQueryClient();

  const [qName, setQName] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");

  const [modal, setModal] = useState({ open: false, mode: "create", row: null });

  // credentials modal
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessData, setAccessData] = useState(null); // { student_number, temp_password, class_info }

  const enrollQ = useQuery({
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

  const rows = enrollQ.data ?? [];

  const filtered = useMemo(() => {
    const needle = qName.trim().toLowerCase();
    return rows
      .filter((r) => (needle ? fullName(r).toLowerCase().includes(needle) : true))
      .filter((r) => (fStatus === "All" ? true : norm(r.st_application_status) === norm(fStatus)))
      .filter((r) => (fTrack === "All" ? true : (r.st_track || "") === fTrack))
      .filter((r) => (fGrade === "All" ? true : (r.st_grade_level || "") === fGrade));
  }, [rows, qName, fStatus, fTrack, fGrade]);

  const createM = useMutation({
    mutationFn: async (values) => {
      const now = new Date().toISOString();
      const payload = {
        ...values,
        st_application_status: "Pending",
        st_submission_date: now,
        st_updated_at: now,
      };
      const { error } = await supabase.from("enrollment").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  // ✅ IMPORTANT: use mutateAsync so we can await
  const updateM = useMutation({
    mutationFn: async ({ id, values }) => {
      const patch = { ...values, st_updated_at: new Date().toISOString() };
      const { error } = await supabase.from("enrollment").update(patch).eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  const deleteM = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("enrollment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollment"] }),
  });

  // ✅ enroll edge (ADMIN): creates user + student_number + temp_password
  const enrollEdgeM = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
        body: { action: "enroll", enrollment_id: row.id },
      });
      if (error) throw new Error(error.message || "Enroll failed");
      if (!data?.student_number) throw new Error("No student_number returned");

      return {
        ...data,
        class_info: {
          grade_level: row.st_grade_level || "11",
          section: "St. Luke (Mock)",
          adviser: "Ms. Dela Cruz (Mock)",
          schedule: "Mon-Fri 7:30AM–4:00PM (Mock)",
        },
      };
    },
    onSuccess: async (data) => {
      setAccessData(data);
      setAccessModalOpen(true);
      await qc.invalidateQueries({ queryKey: ["enrollment"] });
    },
  });

  // ✅ reset password (ADMIN)
  const resetM = useMutation({
    mutationFn: async (row) => {
      if (!row.user_id) throw new Error("No user_id yet. Enroll first.");

      const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
        body: { action: "reset", user_id: row.user_id, email: row.st_email },
      });
      if (error) throw new Error(error.message || "Reset failed");
      if (!data?.temp_password) throw new Error("No temp_password returned");

      return {
        ...data,
        student_number: row.st_number || null,
        class_info: {
          grade_level: row.st_grade_level || "11",
          section: "St. Luke (Mock)",
          adviser: "Ms. Dela Cruz (Mock)",
          schedule: "Mon-Fri 7:30AM–4:00PM (Mock)",
        },
      };
    },
    onSuccess: (data) => {
      setAccessData(data);
      setAccessModalOpen(true);
    },
  });

  async function openCreate() {
    const appId = await generateApplicationId();
    setModal({
      open: true,
      mode: "create",
      row: {
        application_id: appId,
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
        st_grade_level: "",
        st_track: "",
      },
    });
  }

  function openEdit(row) {
    setModal({ open: true, mode: "edit", row });
  }

  function onDelete(row) {
    const ok = window.confirm(`Delete application ${row.application_id || "(no id)"}?`);
    if (!ok) return;
    deleteM.mutate(row.id);
  }

  const statusTabs = ["All", ...STATUS];

  return (
    <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-extrabold">Enrollment</div>
          <div className={`text-sm ${UI.muted}`}>
            Change status to <b>Enrolled</b> to auto-generate Student # + temp password.
          </div>
        </div>

        <button
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((t) => {
            const active = norm(fStatus) === norm(t);
            return (
              <button
                key={t}
                onClick={() => setFStatus(t)}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  active
                    ? "bg-[#C9A227]/15 border-[#C9A227]/40"
                    : "bg-white border-black/10 hover:bg-black/[0.02]"
                }`}
              >
                <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Student name">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
              <input
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="Search last/first name…"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
          </Field>

          <Field label="Status">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...STATUS].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Track (optional)">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              {["All", ...TRACKS].map((o) => (
                <option key={o} value={o}>
                  {o}
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
              {["All", ...GRADES].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-sm font-extrabold">Applications</div>
          <div className={`text-xs ${UI.muted}`}>
            Showing {filtered.length} of {rows.length}
          </div>
        </div>

        {enrollQ.isLoading ? (
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
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEnrolled = norm(r.st_application_status) === "enrolled";

                return (
                  <tr key={r.id} className="border-t border-black/10 hover:bg-black/[0.01]">
                    <td className="px-4 py-3 font-semibold">{r.application_id || "-"}</td>
                    <td className="px-4 py-3">{fullName(r)}</td>
                    <td className="px-4 py-3 text-black/70">{r.st_email || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusPill value={r.st_application_status || "Pending"} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconBtn title="Edit" onClick={() => openEdit(r)} tone="gold">
                          <Pencil className="h-5 w-5" />
                        </IconBtn>
                        <IconBtn title="Delete" onClick={() => onDelete(r)} tone="danger">
                          <Trash2 className="h-5 w-5" />
                        </IconBtn>

                        {/* Show Access only if enrolled */}
                        <button
                          type="button"
                          disabled={!isEnrolled}
                          onClick={() => {
                            setAccessData({
                              student_number: r.st_number || "",
                              temp_password: null,
                              class_info: {
                                grade_level: r.st_grade_level || "11",
                                section: "St. Luke (Mock)",
                                adviser: "Ms. Dela Cruz (Mock)",
                                schedule: "Mon-Fri 7:30AM–4:00PM (Mock)",
                              },
                            });
                            setAccessModalOpen(true);
                          }}
                          className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
                            isEnrolled ? "bg-[#C9A227] text-black" : "bg-black/5 text-black/40"
                          }`}
                          title={isEnrolled ? "Show student access info" : "Only available when Enrolled"}
                        >
                          Show Access
                        </button>

                        {/* Reset password only if user_id exists */}
                        <button
                          type="button"
                          disabled={resetM.isPending || !r.user_id}
                          onClick={() => resetM.mutate(r)}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-rose-600 text-white disabled:opacity-60"
                          title={!r.user_id ? "Enroll first" : "Reset password"}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {resetM.isPending ? "Resetting..." : "Reset"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {modal.open ? (
        <StudentModal
          mode={modal.mode}
          row={modal.row}
          onClose={() => setModal({ open: false, mode: "create", row: null })}
          onCreate={(values) => createM.mutate(values)}
          onUpdate={async (id, values) => {
            await updateM.mutateAsync({ id, values });
          }}
          busy={createM.isPending || updateM.isPending}
          onEnrollNow={async (row) => {
            await enrollEdgeM.mutateAsync(row);
          }}
          enrolling={enrollEdgeM.isPending}
        />
      ) : null}

      <ClassModal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        data={accessData}
        title="Student Login + Class"
      />
    </div>
  );
}

/* ================= Modal ================= */

function StudentModal({ mode, row, onClose, onCreate, onUpdate, busy, onEnrollNow, enrolling }) {
  const isEdit = mode === "edit";

  const defaults = useMemo(() => {
    return {
      application_id: row?.application_id || "",
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
      st_grade_level: row?.st_grade_level || "",
      st_track: row?.st_track || "",
      st_application_status: row?.st_application_status || "Pending",
    };
  }, [row]);

  const form = useForm({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, watch, formState } = form;
  const { errors } = formState;

  async function submit(values) {
    if (!isEdit) {
      onCreate(values);
      onClose();
      return;
    }

    const oldStatus = norm(row?.st_application_status);
    const newStatus = norm(values?.st_application_status);

    // 1) Update enrollment first
    await onUpdate(row.id, values);

    // 2) If changed to Enrolled -> generate credentials + student #
    if (oldStatus !== "enrolled" && newStatus === "enrolled") {
      await onEnrollNow(row);
    }

    onClose();
  }

  const watchedStatus = watch("st_application_status");
  const willEnroll =
    isEdit && norm(watchedStatus) === "enrolled" && norm(row?.st_application_status) !== "enrolled";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
            <div>
              <div className="text-base font-extrabold">{isEdit ? "Edit Student" : "Add Student"}</div>
              <div className="text-xs text-black/60">
                If you set status to <b>Enrolled</b>, credentials will be generated.
              </div>
              {willEnroll ? (
                <div className="mt-2 text-xs font-bold text-emerald-700">
                  ✅ This save will ENROLL and generate Student # + temp password.
                </div>
              ) : null}
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
                <Input label="Address *" error={errors.st_current_address?.message} {...register("st_current_address")} />
              </div>
            </Section>

            <Section title="Academic (optional)">
              <div className="grid gap-3 md:grid-cols-2">
                <Select label="Grade Level" {...register("st_grade_level")}>
                  <option value="">—</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
                <Select label="Track" {...register("st_track")}>
                  <option value="">—</option>
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                disabled={busy || enrolling}
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-[#C9A227] text-black hover:opacity-95 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {enrolling ? "Enrolling..." : isEdit ? "Save Changes" : "Create"}
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

function Select({ label, error, children, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <select
        {...rest}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls}`}
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
      : v === "enrolled"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "rejected"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

function fullName(r) {
  const ext = r.st_ext?.trim() ? ` ${r.st_ext.trim()}` : "";
  const mi = r.st_mi?.trim() ? ` ${r.st_mi.trim()}.` : "";
  return `${r.st_lname || ""}, ${r.st_fname || ""}${ext}${mi}`.trim();
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}
