
// src/pages/auth/PreEnroll.jsx
import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Hash,
  Calendar,
  MapPin,
  Users,
  GraduationCap,
  CheckCircle2,
  Printer,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import logo from "../assets/grabsum-logo.png";

const BRAND = {
  bg: "#fbf6ef",
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  soft: "rgba(251,246,239,0.7)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  link: "#d4a62f",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function onlyDigits(v) {
  return String(v || "").replace(/[^0-9]/g, "");
}

// FRONTEND generated: MM-DDNN
// NOTE: Best-effort ordering; for real guaranteed sequence, do server-side.
async function generateApplicationId(supabaseClient) {
  const now = new Date();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const prefix = `${mm}-${dd}`;

  const { count, error } = await supabaseClient
    .from("enrollment")
    .select("id", { count: "exact", head: true })
    .like("application_id", `${prefix}%`);

  if (error) throw error;

  const next = (count ?? 0) + 1;
  const nn = pad2(next);
  return `${prefix}${nn}`;
}

// schedule = +3 days, default time = 8:00 AM
function computeSchedule(submittedAt = new Date()) {
  const scheduled = new Date(submittedAt);
  scheduled.setDate(scheduled.getDate() + 3);
  scheduled.setHours(8, 0, 0, 0); // 8:00 AM default

  return {
    submissionISO: submittedAt.toISOString(),
    scheduledISO: scheduled.toISOString(),
  };
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatTimeOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildFullName({ st_fname, st_lname, st_mi, st_ext }) {
  const mi = (st_mi || "").trim();
  const ext = (st_ext || "").trim();
  return [
    (st_fname || "").trim(),
    mi ? `${mi}.` : "",
    (st_lname || "").trim(),
    ext,
  ]
    .filter(Boolean)
    .join(" ");
}

// Minimal "requirements to bring" (edit as needed)
const DEFAULT_REQUIREMENTS = [
  "Printed Pre-enrollment slip (Application Code)",
  "Photocopy of PSA Birth Certificate",
  "Report Card / SF9 (original + photocopy)",
  "2x2 ID Picture (2 pcs)",
  "Good Moral Certificate",
];

const STRANDS = [
  { value: "STEM", label: "STEM (Science, Technology, Engineering, Math)" },
  { value: "ABM", label: "ABM (Accountancy, Business, Management)" },
  { value: "HUMSS", label: "HUMSS (Humanities and Social Sciences)" },
  { value: "GAS", label: "GAS (General Academic Strand)" },
  { value: "TVL", label: "TVL (Technical-Vocational-Livelihood)" },
];

const GRADE_LEVELS = [
  { value: "Grade 11", label: "Grade 11" },
  { value: "Grade 12", label: "Grade 12" },
];

export default function PreEnroll() {
  const nav = useNavigate();
  const printRef = useRef(null);

  // Student identity
  const [stNumber, setStNumber] = useState("");
  const [email, setEmail] = useState("");

  // Name fields
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [mi, setMi] = useState("");
  const [ext, setExt] = useState("");

  // Personal info
  const [gender, setGender] = useState("");
  const [bdate, setBdate] = useState(""); // yyyy-mm-dd
  const [bplace, setBplace] = useState("");
  const [address, setAddress] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [prevSchool, setPrevSchool] = useState("");

  // Family info
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  // Academic
  const [gradeLevel, setGradeLevel] = useState("");
  const [track, setTrack] = useState("");

  // Terms
  const [agreed, setAgreed] = useState(false);

  // UI state
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // receipt after insert
  const [receipt, setReceipt] = useState(null);

  const errors = useMemo(() => {
    const e = {};

    // required fields based on your table screenshot
    if (!fname.trim()) e.fname = "First name is required.";
    if (!lname.trim()) e.lname = "Last name is required.";

    if (!email.trim()) e.email = "Email is required.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";

    // student number (required in your table)
    if (!stNumber.trim()) e.stNumber = "Student number is required.";

    // guardian/contact (table requires guardian fields)
    if (!guardianName.trim()) e.guardianName = "Guardian name is required.";
    if (!guardianContact.trim()) e.guardianContact = "Guardian contact is required.";

    // academic
    if (!gradeLevel) e.gradeLevel = "Grade level is required.";
    if (!track) e.track = "Strand/Track is required.";

    // terms
    if (!agreed) e.agreed = "You must agree to the Terms & Conditions.";

    return e;
  }, [
    fname,
    lname,
    email,
    stNumber,
    guardianName,
    guardianContact,
    gradeLevel,
    track,
    agreed,
  ]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  function touch(key) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  async function submitEnrollment(payload) {
    // retry best-effort if application_id conflicts
    for (let attempt = 1; attempt <= 5; attempt++) {
      const submittedAt = new Date();
      const applicationId = await generateApplicationId(supabase);
      const { submissionISO, scheduledISO } = computeSchedule(submittedAt);

      const insertPayload = {
        ...payload,

        // FRONTEND GENERATED
        application_id: applicationId,
        st_submission_date: submissionISO,
        st_scheduled_date: scheduledISO,
        st_scheduled_time: scheduledISO,

        // SYSTEM GENERATED FIELDS (exclude these from form)
        st_application_status: "pending",
        st_agreed_terms: true,
        st_terms_agreed_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("enrollment")
        .insert(insertPayload)
        .select(
          [
            "application_id",
            "st_number",
            "st_fname",
            "st_lname",
            "st_mi",
            "st_ext",
            "st_grade_level",
            "st_track",
            "st_submission_date",
            "st_scheduled_date",
            "st_scheduled_time",
          ].join(",")
        )
        .single();

      if (!error) return data;

      const msg = String(error.message || "").toLowerCase();
      const isDuplicate = msg.includes("duplicate") || msg.includes("unique") || msg.includes("application_id");
      if (!isDuplicate) throw error;
    }

    throw new Error("Too many submissions at the same time. Please try again.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    // mark all required fields as touched
    setTouched({
      fname: true,
      lname: true,
      email: true,
      stNumber: true,
      guardianName: true,
      guardianContact: true,
      gradeLevel: true,
      track: true,
      agreed: true,
    });

    if (Object.keys(errors).length) return;

    try {
      setLoading(true);

      const payload = {
        // table fields (based on your screenshot)
        st_number: stNumber.trim(),
        st_fname: fname.trim(),
        st_lname: lname.trim(),
        st_mi: mi.trim(),
        st_ext: ext.trim(),
        st_gender: gender.trim(),
        st_bdate: bdate || null,
        st_bplace: bplace.trim(),
        st_current_address: address.trim(),
        st_civil_status: civilStatus.trim(),
        st_previous_school: prevSchool.trim(),

        st_email: email.trim(),

        st_father_name: fatherName.trim(),
        st_mother_name: motherName.trim(),

        st_guardian_name: guardianName.trim(),
        st_guardian_contact: guardianContact.trim(),
        st_guardian_relationship: guardianRelationship.trim(),

        st_grade_level: gradeLevel,
        st_track: track,
      };

      const inserted = await submitEnrollment(payload);
      setReceipt({
        ...inserted,
        full_name: buildFullName({
          st_fname: inserted.st_fname,
          st_lname: inserted.st_lname,
          st_mi: inserted.st_mi,
          st_ext: inserted.st_ext,
        }),
        requirements: DEFAULT_REQUIREMENTS,
      });

      // keep the user on the same page to print receipt
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err?.message || "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  function printSlip() {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Pre-enrollment Slip</title>
          <style>
            *{box-sizing:border-box;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
            body{margin:0;padding:24px;background:#fff;color:#1b0f0a;}
            .wrap{max-width:820px;margin:0 auto;}
            .card{border:1px solid rgba(43,26,18,0.16);border-radius:18px;padding:18px 18px 14px;}
            .row{display:flex;gap:14px;flex-wrap:wrap;}
            .col{flex:1;min-width:220px;}
            .muted{color:rgba(43,26,18,0.65)}
            .code{font-weight:900;font-size:22px;letter-spacing:0.04em;}
            .badge{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(212,166,47,0.18);border:1px solid rgba(43,26,18,0.16);font-weight:700;}
            ul{margin:10px 0 0 18px;padding:0}
            .top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
            .brand{display:flex;align-items:center;gap:10px;}
            .brand img{width:44px;height:44px;object-fit:contain;border-radius:999px;}
            .title{font-size:16px;font-weight:900;margin:0}
            .small{font-size:12px}
            .hr{height:1px;background:rgba(43,26,18,0.12);margin:12px 0}
            @media print { body{padding:0} .card{border:none} }
          </style>
        </head>
        <body>
          <div class="wrap">
            ${content.innerHTML}
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div
      className="min-h-screen font-[Nunito]"
      style={{
        background: BRAND.bg,
      }}
    >
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition"
      >
        <ArrowLeft className="h-5 w-5" style={{ color: "rgba(43,26,18,0.55)" }} />
      </button>

      <div className="mx-auto max-w-6xl px-6">
        <div className="min-h-screen grid items-center gap-10 lg:grid-cols-2">
          {/* LEFT */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center lg:text-left"
          >
            <div className="mx-auto lg:mx-0 w-fit">
              <img
                src={logo}
                alt="Grabsum School logo"
                className="h-24 w-24 rounded-full object-contain"
                draggable="false"
              />
            </div>

            <h1
              className="mt-7 text-4xl md:text-5xl font-extrabold tracking-tight"
              style={{ color: BRAND.brown }}
            >
              Pre-enrollment
            </h1>

            <p className="mt-4 max-w-xl mx-auto lg:mx-0 text-base leading-relaxed" style={{ color: BRAND.muted }}>
              Fill out the form to receive your <b>Application Code</b> and schedule.
              <br className="hidden md:block" />
              Please bring the required documents on your scheduled date.
            </p>

            <div className="mt-20 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
              © {new Date().getFullYear()} GRABSUM School, Inc. All rights reserved.
            </div>
          </motion.section>

          {/* RIGHT CARD */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 }}
            className="w-full max-w-xl lg:justify-self-end"
          >
            <div
              className="rounded-3xl bg-white"
              style={{
                border: `1px solid ${BRAND.stroke}`,
                boxShadow: "0 14px 34px rgba(43,26,18,0.12)",
              }}
            >
              <div className="p-8 md:p-10">
                {/* Receipt panel */}
                <AnimatePresence>
                  {receipt ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6"
                    >
                      <div
                        className="rounded-3xl"
                        style={{
                          background: "rgba(212,166,47,0.14)",
                          border: `1px solid ${BRAND.stroke}`,
                        }}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                                style={{ background: "rgba(251,246,239,0.8)", border: `1px solid ${BRAND.stroke}` }}>
                                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.brown }} />
                                Submitted
                              </div>
                              <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
                                Your application code and schedule are ready.
                              </div>
                            </div>
                            <button
                              onClick={printSlip}
                              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold hover:bg-white"
                            >
                              <Printer className="h-4 w-4 text-black/60" />
                              Print
                            </button>
                          </div>

                          {/* Printable content */}
                          <div ref={printRef} className="mt-4">
                            <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${BRAND.stroke}` }}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <img src={logo} alt="Logo" className="h-10 w-10 rounded-full object-contain" />
                                  <div>
                                    <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                                      GRABSUM SHS • Pre-enrollment Slip
                                    </div>
                                    <div className="text-xs" style={{ color: BRAND.muted }}>
                                      Please submit this at school (printed or soft copy).
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs" style={{ color: BRAND.muted }}>Application Code</div>
                                  <div className="text-xl font-black tracking-wide" style={{ color: BRAND.brown }}>
                                    {receipt.application_id}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl p-3" style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}>
                                  <div className="text-xs font-bold" style={{ color: BRAND.brown }}>Student</div>
                                  <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.brown }}>
                                    {receipt.full_name}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                    Student No.: {receipt.st_number}
                                  </div>
                                </div>

                                <div className="rounded-2xl p-3" style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}>
                                  <div className="text-xs font-bold" style={{ color: BRAND.brown }}>Program</div>
                                  <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.brown }}>
                                    {receipt.st_grade_level} • {receipt.st_track}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                    Submitted: {formatDateTime(receipt.st_submission_date)}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl p-3" style={{ background: "rgba(212,166,47,0.12)", border: `1px solid ${BRAND.stroke}` }}>
                                <div className="text-xs font-bold" style={{ color: BRAND.brown }}>Scheduled Date & Time</div>
                                <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                                  {formatDateOnly(receipt.st_scheduled_date)} • {formatTimeOnly(receipt.st_scheduled_time)}
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl p-3" style={{ background: "#fff", border: `1px solid ${BRAND.stroke}` }}>
                                <div className="text-xs font-bold" style={{ color: BRAND.brown }}>Requirements to Bring</div>
                                <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: BRAND.muted }}>
                                  {receipt.requirements.map((r) => (
                                    <li key={r}>{r}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="mt-3 text-xs" style={{ color: "rgba(43,26,18,0.55)" }}>
                                Note: Keep your Application Code. Present it during on-site enrollment.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <h2 className="text-lg font-extrabold" style={{ color: BRAND.brown }}>
                  Registration Form
                </h2>
                <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                  Complete the details below. Fields marked <b>*</b> are required.
                </div>

                {formError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formError}
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  {/* Row: First + Last */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="First Name *"
                      icon={User}
                      value={fname}
                      placeholder="Juan"
                      onChange={setFname}
                      onBlur={() => touch("fname")}
                      error={touched.fname && errors.fname}
                    />
                    <Field
                      label="Last Name *"
                      icon={User}
                      value={lname}
                      placeholder="Dela Cruz"
                      onChange={setLname}
                      onBlur={() => touch("lname")}
                      error={touched.lname && errors.lname}
                    />
                  </div>

                  {/* MI + Ext */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Middle Initial"
                      icon={User}
                      value={mi}
                      placeholder="M"
                      onChange={setMi}
                      maxLength={2}
                    />
                    <Field
                      label="Extension"
                      icon={User}
                      value={ext}
                      placeholder="Jr. / III"
                      onChange={setExt}
                    />
                  </div>

                  Email
                  <Field
                    label="Email Address *"
                    icon={Mail}
                    value={email}
                    placeholder="your.email@grabsum.edu.ph"
                    onChange={setEmail}
                    onBlur={() => touch("email")}
                    error={touched.email && errors.email}
                  />

                  {/* Student number + Contact */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Student Number *"
                      icon={Hash}
                      value={stNumber}
                      placeholder="2025-0001"
                      onChange={setStNumber}
                      onBlur={() => touch("stNumber")}
                      error={touched.stNumber && errors.stNumber}
                    />
                    <Field
                      label="Guardian Contact *"
                      icon={Phone}
                      value={guardianContact}
                      placeholder="09xxxxxxxxx"
                      onChange={(v) => setGuardianContact(onlyDigits(v))}
                      onBlur={() => touch("guardianContact")}
                      error={touched.guardianContact && errors.guardianContact}
                    />
                  </div>

                  {/* Guardian + Relationship */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Guardian Name *"
                      icon={Users}
                      value={guardianName}
                      placeholder="Full name of guardian"
                      onChange={setGuardianName}
                      onBlur={() => touch("guardianName")}
                      error={touched.guardianName && errors.guardianName}
                    />
                    <Field
                      label="Relationship"
                      icon={Users}
                      value={guardianRelationship}
                      placeholder="Mother / Father / Aunt / etc."
                      onChange={setGuardianRelationship}
                    />
                  </div>

                  {/* Father + Mother */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Father Name"
                      icon={Users}
                      value={fatherName}
                      placeholder="Father's full name"
                      onChange={setFatherName}
                    />
                    <Field
                      label="Mother Name"
                      icon={Users}
                      value={motherName}
                      placeholder="Mother's full name"
                      onChange={setMotherName}
                    />
                  </div>

                  {/* Gender + Birthdate */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Gender"
                      icon={User}
                      value={gender}
                      onChange={setGender}
                      options={["Male", "Female"]}
                      placeholder="Select gender"
                    />
                    <DateField
                      label="Birthdate"
                      icon={Calendar}
                      value={bdate}
                      onChange={setBdate}
                    />
                  </div>

                  {/* Birthplace */}
                  <Field
                    label="Birthplace"
                    icon={MapPin}
                    value={bplace}
                    placeholder="City / Province"
                    onChange={setBplace}
                  />

                  {/* Address */}
                  <TextareaField
                    label="Current Address"
                    icon={MapPin}
                    value={address}
                    placeholder="House no., street, barangay, city"
                    onChange={setAddress}
                  />

                  {/* Civil + Prev school */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Civil Status"
                      icon={User}
                      value={civilStatus}
                      onChange={setCivilStatus}
                      options={["Single", "Married", "Separated", "Widowed"]}
                      placeholder="Select status"
                    />
                    <Field
                      label="Previous School"
                      icon={GraduationCap}
                      value={prevSchool}
                      placeholder="Last school attended"
                      onChange={setPrevSchool}
                    />
                  </div>

                  {/* Grade + Strand */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Year Level (Grade) *"
                      icon={GraduationCap}
                      value={gradeLevel}
                      onChange={setGradeLevel}
                      options={GRADE_LEVELS.map((o) => o.label)}
                      placeholder="Select grade"
                      onBlur={() => touch("gradeLevel")}
                      error={touched.gradeLevel && errors.gradeLevel}
                    />
                    <SelectField
                      label="Strand/Track *"
                      icon={GraduationCap}
                      value={track}
                      onChange={setTrack}
                      options={STRANDS.map((o) => o.value)}
                      placeholder="Select strand"
                      onBlur={() => touch("track")}
                      error={touched.track && errors.track}
                    />
                  </div>

                  {/* Terms */}
                  <div className="pt-1">
                    <label className="inline-flex items-start gap-2 text-sm" style={{ color: BRAND.muted }}>
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        onBlur={() => touch("agreed")}
                        className="mt-1 h-4 w-4 rounded border-black/20"
                      />
                      <span>
                        I agree to the <span style={{ color: BRAND.link, fontWeight: 800 }}>Terms & Conditions</span>.
                        {touched.agreed && errors.agreed ? (
                          <span className="block mt-1 text-xs font-semibold text-red-500">{errors.agreed}</span>
                        ) : null}
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="mt-1 w-full rounded-2xl py-3 text-sm font-semibold transition"
                    style={{
                      background: BRAND.gold,
                      color: BRAND.brown,
                      boxShadow: "0 10px 18px rgba(212,166,47,0.28)",
                      opacity: canSubmit ? 1 : 0.65,
                      cursor: canSubmit ? "pointer" : "not-allowed",
                    }}
                    onMouseEnter={(e) => {
                      if (!canSubmit) return;
                      e.currentTarget.style.background = BRAND.goldHover;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = BRAND.gold;
                      e.currentTarget.style.transform = "translateY(0px)";
                    }}
                    disabled={!canSubmit}
                  >
                    {loading ? "Submitting…" : "Submit Pre-enrollment"}
                  </button>

                  <div className="pt-2 text-center text-sm" style={{ color: BRAND.muted }}>
                    Already have an account?{" "}
                    <Link to="/login" className="hover:underline" style={{ color: BRAND.link }}>
                      Sign in
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  maxLength,
}) {
  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2">
        <div className="relative">
          {Icon ? (
            <Icon
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "rgba(43,26,18,0.55)" }}
            />
          ) : null}
          <input
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className="w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
            style={{
              background: "rgba(251,246,239,0.6)",
              border: `1px solid ${error ? "rgba(239,68,68,0.55)" : "rgba(43,26,18,0.22)"}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
              e.currentTarget.style.background = "rgba(251,246,239,0.85)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
        {error ? <div className="mt-2 text-xs font-semibold text-red-500">{error}</div> : null}
      </div>
    </div>
  );
}

function TextareaField({ label, icon: Icon, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2 relative">
        {Icon ? (
          <Icon
            className="absolute left-4 top-4 h-4 w-4"
            style={{ color: "rgba(43,26,18,0.55)" }}
          />
        ) : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
          style={{
            background: "rgba(251,246,239,0.6)",
            border: `1px solid rgba(43,26,18,0.22)`,
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
            e.currentTarget.style.background = "rgba(251,246,239,0.85)";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
  onBlur,
  error,
}) {
  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2">
        <div className="relative">
          {Icon ? (
            <Icon
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "rgba(43,26,18,0.55)" }}
            />
          ) : null}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-full appearance-none rounded-xl pl-11 pr-10 py-3 text-sm outline-none transition"
            style={{
              background: "rgba(251,246,239,0.6)",
              border: `1px solid ${error ? "rgba(239,68,68,0.55)" : "rgba(43,26,18,0.22)"}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
              e.currentTarget.style.background = "rgba(251,246,239,0.85)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50">
            ▾
          </div>
        </div>
        {error ? <div className="mt-2 text-xs font-semibold text-red-500">{error}</div> : null}
      </div>
    </div>
  );
}

function DateField({ label, icon: Icon, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2">
        <div className="relative">
          {Icon ? (
            <Icon
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "rgba(43,26,18,0.55)" }}
            />
          ) : null}
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
            style={{
              background: "rgba(251,246,239,0.6)",
              border: `1px solid rgba(43,26,18,0.22)`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
              e.currentTarget.style.background = "rgba(251,246,239,0.85)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      </div>
    </div>
  );
}
