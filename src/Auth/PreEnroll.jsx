// src/pages/auth/PreEnroll.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Users,
  GraduationCap,
  CheckCircle2,
  Printer,
  Hash,
  Sparkles,
  ClipboardCheck,
  Download,
} from "lucide-react";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

function onlyDigits(v) {
  return String(v || "").replace(/[^0-9]/g, "");
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function isLRN(v) {
  const s = onlyDigits(v);
  return s.length === 12;
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
  return [(st_fname || "").trim(), mi ? `${mi}.` : "", (st_lname || "").trim(), ext]
    .filter(Boolean)
    .join(" ");
}

const DEFAULT_REQUIREMENTS = [
  "Printed Pre-enrollment slip (Application Code)",
  "Photocopy of PSA Birth Certificate",
  "Report Card / SF9 (original + photocopy)",
  "2x2 ID Picture (2 pcs)",
  "Good Moral Certificate",
];

const STEPS = [
  { key: "basic", title: "Basic Information", icon: Sparkles },
  { key: "family", title: "Family Information", icon: Users },
  { key: "academic", title: "Academic Information", icon: GraduationCap },
  { key: "review", title: "Review & Submit", icon: ClipboardCheck },
];

const STEP_FIELDS = {
  basic: ["fname", "lname", "email", "lrn"],
  family: ["guardianName", "guardianContact"],
  academic: ["gradeId", "trackId", "strandId"],
  review: ["agreed"],
};

export default function PreEnroll() {
  const nav = useNavigate();
  const printRef = useRef(null);

  // Steps
  const [step, setStep] = useState(0);
  const stepKey = STEPS[step]?.key;

  // Student identity
  const [email, setEmail] = useState("");
  const [lrn, setLrn] = useState("");

  // Name fields
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [mi, setMi] = useState("");
  const [ext, setExt] = useState("");

  // Personal info
  const [gender, setGender] = useState("");
  const [bdate, setBdate] = useState("");
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
  const [gradeId, setGradeId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [strandId, setStrandId] = useState("");

  // Terms
  const [agreed, setAgreed] = useState(false);

  // UI
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // receipt after insert
  const [receipt, setReceipt] = useState(null);

  // LRN check state (basic step)
  const [lrnCheck, setLrnCheck] = useState({ status: "idle", message: "" });
  // status: idle | checking | ok | error

  /* ===================== Returning Student (Simplified) ===================== */
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnStudentNo, setReturnStudentNo] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [foundStudent, setFoundStudent] = useState(null);

  // update fields shown in modal
  const [updEmail, setUpdEmail] = useState("");
  const [updAddress, setUpdAddress] = useState("");
  const [updGuardianName, setUpdGuardianName] = useState("");
  const [updGuardianContact, setUpdGuardianContact] = useState("");

  /* ===================== Lookups: grades/tracks/strands ===================== */

  const [grades, setGrades] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [strands, setStrands] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLookupLoading(true);

        const [gRes, tRes, sRes] = await Promise.all([
          supabase
            .from("grade_levels")
            .select("grade_id, grade_level, description")
            .order("grade_level", { ascending: true }),
          supabase
            .from("tracks")
            .select("track_id, track_code, description")
            .order("track_code", { ascending: true }),
          supabase
            .from("strands")
            .select("strand_id, track_id, strand_code, description")
            .order("strand_code", { ascending: true }),
        ]);

        if (gRes.error) throw gRes.error;
        if (tRes.error) throw tRes.error;
        if (sRes.error) throw sRes.error;

        if (!alive) return;
        setGrades(gRes.data ?? []);
        setTracks(tRes.data ?? []);
        setStrands(sRes.data ?? []);
      } catch (e) {
        setFormError(String(e?.message || e || "Failed to load program options."));
      } finally {
        if (alive) setLookupLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const strandsForTrack = useMemo(() => {
    if (!trackId) return [];
    return (strands ?? []).filter((s) => String(s.track_id) === String(trackId));
  }, [strands, trackId]);

  useEffect(() => {
    setStrandId("");
  }, [trackId]);

  const gradeMap = useMemo(() => {
    const m = new Map();
    (grades ?? []).forEach((g) => m.set(String(g.grade_id), String(g.grade_level)));
    return m;
  }, [grades]);

  const trackMap = useMemo(() => {
    const m = new Map();
    (tracks ?? []).forEach((t) => m.set(String(t.track_id), String(t.track_code)));
    return m;
  }, [tracks]);

  const strandMap = useMemo(() => {
    const m = new Map();
    (strands ?? []).forEach((s) => m.set(String(s.strand_id), String(s.strand_code)));
    return m;
  }, [strands]);

  /* ===================== Validation ===================== */

  const errors = useMemo(() => {
    const e = {};

    if (!fname.trim()) e.fname = "First name is required.";
    if (!lname.trim()) e.lname = "Last name is required.";

    if (!email.trim()) e.email = "Email is required.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";

    if (!onlyDigits(lrn)) e.lrn = "LRN is required.";
    else if (!isLRN(lrn)) e.lrn = "LRN must be 12 digits.";

    if (!guardianName.trim()) e.guardianName = "Guardian name is required.";
    if (!guardianContact.trim()) e.guardianContact = "Guardian contact is required.";

    if (!gradeId) e.gradeId = "Grade level is required.";
    if (!trackId) e.trackId = "Track is required.";
    if (!strandId) e.strandId = "Strand is required.";

    if (!agreed) e.agreed = "You must agree to the Terms & Conditions.";

    return e;
  }, [fname, lname, email, lrn, guardianName, guardianContact, gradeId, trackId, strandId, agreed]);

  function touch(key) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  function touchMany(keys) {
    setTouched((t) => {
      const next = { ...t };
      keys.forEach((k) => (next[k] = true));
      return next;
    });
  }

  /* ===================== LRN CHECK (Basic Step) ===================== */

  async function checkLrnNow(raw) {
    const digits = onlyDigits(raw);

    if (!digits) {
      setLrnCheck({ status: "idle", message: "" });
      return;
    }
    if (digits.length !== 12) {
      setLrnCheck({ status: "error", message: "LRN must be 12 digits." });
      return;
    }

    try {
      setLrnCheck({ status: "checking", message: "Checking LRN..." });

      // edge function check_lrn returns 200 always:
      // { ok:true } or { ok:false, error:"..." }
      const { data, error } = await supabase.functions.invoke("pre-enroll", {
        body: { intent: "check_lrn", st_lrn: digits },
      });

      if (error) throw new Error(error.message || "LRN check failed.");
      if (!data?.ok) throw new Error(data?.error || "LRN not available.");

      setLrnCheck({ status: "ok", message: "LRN is available." });
    } catch (e) {
      setLrnCheck({ status: "error", message: String(e?.message || "LRN is not available.") });
    }
  }

  /* ===================== Step blocking ===================== */

  const stepHasBlockingErrors = useMemo(() => {
    const fields = STEP_FIELDS[stepKey] || [];
    const hasFieldErrors = fields.some((f) => Boolean(errors[f]));

    if (stepKey === "basic") {
      const lrnReady = onlyDigits(lrn).length === 12;
      const lrnOk = lrnCheck.status === "ok";
      if (lrnReady && !lrnOk) return true;
    }

    return hasFieldErrors;
  }, [errors, stepKey, lrn, lrnCheck.status]);

  const isStepComplete = (key) => {
    const fields = STEP_FIELDS[key] || [];
    const baseOk = fields.every((f) => !errors[f]);
    if (key === "basic") {
      const lrnReady = onlyDigits(lrn).length === 12;
      return baseOk && lrnReady && lrnCheck.status === "ok";
    }
    return baseOk;
  };

  function canGoToStep(targetIndex) {
    if (targetIndex <= step) return true;
    for (let i = 0; i < targetIndex; i++) {
      const k = STEPS[i].key;
      if (!isStepComplete(k)) return false;
    }
    return true;
  }

  function goToStep(targetIndex) {
    if (!canGoToStep(targetIndex)) {
      const fields = STEP_FIELDS[stepKey] || [];
      touchMany(fields);
      return;
    }
    setStep(targetIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextStep() {
    const fields = STEP_FIELDS[stepKey] || [];
    touchMany(fields);
    if (stepHasBlockingErrors) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ===================== Returning Student: lookup + apply ===================== */

  async function lookupReturningStudent(studentNoRaw) {
    const stNo = String(studentNoRaw || "").trim();
    if (!stNo) throw new Error("Please enter your Student Number.");

    const { data, error } = await supabase.functions.invoke("pre-enroll", {
      body: { intent: "lookup_student", st_number: stNo },
    });

    if (error) throw new Error(error.message || "Lookup failed.");
    if (!data?.ok) throw new Error(data?.error || "Student not found.");

    return data.student;
  }

  async function onCheckReturningStudent() {
    try {
      setReturnError("");
      setFoundStudent(null);
      setReturnLoading(true);

      const student = await lookupReturningStudent(returnStudentNo);
      setFoundStudent(student);

      // prefill modal update fields from record
      setUpdEmail(student?.st_email || "");
      setUpdAddress(student?.st_current_address || "");
      setUpdGuardianName(student?.st_guardian_name || "");
      setUpdGuardianContact(student?.st_guardian_contact || "");
    } catch (e) {
      setReturnError(String(e?.message || e));
    } finally {
      setReturnLoading(false);
    }
  }

  function onApplyReturningUpdates() {
    if (!foundStudent) return;

    // apply updates to MAIN FORM (so student continues updated)
    setEmail((updEmail || "").trim());
    setAddress((updAddress || "").trim());
    setGuardianName((updGuardianName || "").trim());
    setGuardianContact(onlyDigits(updGuardianContact || ""));

    // optionally load stable identity fields from record (safe defaults)
    if (foundStudent?.st_fname) setFname(foundStudent.st_fname);
    if (foundStudent?.st_lname) setLname(foundStudent.st_lname);
    if (foundStudent?.st_mi !== undefined) setMi(foundStudent.st_mi || "");
    if (foundStudent?.st_ext !== undefined) setExt(foundStudent.st_ext || "");

    if (foundStudent?.st_lrn) {
      setLrn(onlyDigits(foundStudent.st_lrn));
      setLrnCheck({ status: "idle", message: "" });
      if (onlyDigits(foundStudent.st_lrn).length === 12) checkLrnNow(foundStudent.st_lrn);
    }

    setReturnOpen(false);
  }

  /* ===================== Edge function submit ===================== */

  async function submitEnrollment(payload) {
    const { data, error } = await supabase.functions.invoke("pre-enroll", { body: payload });

    if (error) throw new Error(error.message || "Submission failed.");
    if (data?.error) throw new Error(data.error);

    return data.data;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    touchMany([
      "fname",
      "lname",
      "email",
      "lrn",
      "guardianName",
      "guardianContact",
      "gradeId",
      "trackId",
      "strandId",
      "agreed",
    ]);

    if (Object.keys(errors).length) return;
    if (lrnCheck.status !== "ok") {
      setFormError("Please verify LRN first.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
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

        st_email: email.trim().toLowerCase(),
        st_lrn: onlyDigits(lrn),

        st_father_name: fatherName.trim(),
        st_mother_name: motherName.trim(),

        st_guardian_name: guardianName.trim(),
        st_guardian_contact: guardianContact.trim(),
        st_guardian_relationship: guardianRelationship.trim(),

        grade_id: gradeId,
        track_id: trackId,
        strand_id: strandId,

        // legacy (optional)
        st_grade_level: gradeMap.get(String(gradeId)) ? String(gradeMap.get(String(gradeId))) : null,
        st_track: trackMap.get(String(trackId)) ? String(trackMap.get(String(trackId))) : null,
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

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err?.message || "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== Print / Download slip ===================== */

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
            .muted{color:rgba(43,26,18,0.65)}
            ul{margin:10px 0 0 18px;padding:0}
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

  async function downloadSlipPdf() {
    const content = printRef.current;
    if (!content) return;

    const canvas = await html2canvas(content, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const marginTop = 8;
    const marginBottom = 8;
    const usableHeight = pageHeight - marginTop - marginBottom;

    if (imgHeight <= usableHeight) {
      pdf.addImage(imgData, "PNG", 0, marginTop, imgWidth, imgHeight);
    } else {
      let remaining = imgHeight;
      let sourceY = 0;
      const pxPerMm = canvas.height / imgHeight;
      const sliceMm = usableHeight;

      while (remaining > 0) {
        const currentSliceMm = Math.min(sliceMm, remaining);
        const currentSlicePx = currentSliceMm * pxPerMm;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSlicePx;

        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, sourceY, canvas.width, currentSlicePx, 0, 0, canvas.width, currentSlicePx);

        const pageImg = pageCanvas.toDataURL("image/png");
        pdf.addImage(pageImg, "PNG", 0, marginTop, imgWidth, currentSliceMm);

        remaining -= currentSliceMm;
        sourceY += currentSlicePx;

        if (remaining > 0) pdf.addPage();
      }
    }

    const filename = `PreEnrollment-${receipt?.application_id || "ApplicationCode"}.pdf`;
    pdf.save(filename);
  }

  const receiptProgram = receipt
    ? `${gradeMap.get(String(receipt.grade_id || "")) || "—"} • ${
        trackMap.get(String(receipt.track_id || "")) || "—"
      } • ${strandMap.get(String(receipt.strand_id || "")) || "—"}`
    : "";

  const programSummary = `${gradeId ? `Grade ${gradeMap.get(String(gradeId)) || "—"}` : "—"} • ${
    trackId ? trackMap.get(String(trackId)) || "—" : "—"
  } • ${strandId ? strandMap.get(String(strandId)) || "—" : "—"}`;

  return (
    <div className="min-h-screen font-[Nunito]" style={{ background: BRAND.bg }}>
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition"
      >
        <ArrowLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
      </button>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="min-h-screen grid items-center">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <div
              className="rounded-[28px] bg-white"
              style={{
                border: `1px solid ${BRAND.stroke}`,
                boxShadow: "0 18px 44px rgba(43,26,18,0.12)",
              }}
            >
              <div className="p-6 md:p-8">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={logo}
                      alt="Grabsum School logo"
                      className="h-12 w-12 rounded-full object-contain"
                      draggable="false"
                    />
                    <div>
                      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        GRABSUM School • Pre-enrollment
                      </div>
                      <div className="text-xs" style={{ color: BRAND.muted }}>
                        Complete each section to unlock the next.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReturnError("");
                        setFoundStudent(null);
                        setReturnStudentNo("");
                        setReturnOpen(true);
                      }}
                      className="rounded-2xl px-4 py-2 text-sm font-extrabold transition hover:bg-black/5"
                      style={{
                        border: `1px solid ${BRAND.stroke}`,
                        color: BRAND.brown,
                        background: "rgba(255,255,255,0.7)",
                      }}
                    >
                      Returning student?
                    </button>

                    <div
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: "rgba(212,166,47,0.14)",
                        border: `1px solid ${BRAND.stroke}`,
                        color: BRAND.brown,
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Step {step + 1} of {STEPS.length}: {STEPS[step].title}
                    </div>
                  </div>
                </div>

                {/* Receipt */}
                <AnimatePresence>
                  {receipt ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="mt-6"
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
                              <div
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                                style={{
                                  background: "rgba(251,246,239,0.8)",
                                  border: `1px solid ${BRAND.stroke}`,
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.brown }} />
                                Submitted
                              </div>
                              <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
                                Your application code and schedule are ready.
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={downloadSlipPdf}
                                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold hover:bg-white"
                                type="button"
                              >
                                <Download className="h-4 w-4 text-black/60" />
                                Download
                              </button>

                              <button
                                onClick={printSlip}
                                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold hover:bg-white"
                                type="button"
                              >
                                <Printer className="h-4 w-4 text-black/60" />
                                Print
                              </button>
                            </div>
                          </div>

                          <div ref={printRef} className="mt-4">
                            <div
                              className="rounded-2xl bg-white p-4"
                              style={{ border: `1px solid ${BRAND.stroke}` }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={logo}
                                    alt="Logo"
                                    className="h-10 w-10 rounded-full object-contain"
                                  />
                                  <div>
                                    <div
                                      className="text-sm font-extrabold"
                                      style={{ color: BRAND.brown }}
                                    >
                                      GRABSUM SHS • Pre-enrollment Slip
                                    </div>
                                    <div className="text-xs" style={{ color: BRAND.muted }}>
                                      Please submit this at school (printed or soft copy).
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs" style={{ color: BRAND.muted }}>
                                    Application Code
                                  </div>
                                  <div
                                    className="text-xl font-black tracking-wide"
                                    style={{ color: BRAND.brown }}
                                  >
                                    {receipt.application_id}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div
                                  className="rounded-2xl p-3"
                                  style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}
                                >
                                  <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                    Student
                                  </div>
                                  <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.brown }}>
                                    {receipt.full_name}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                    LRN: {receipt.st_lrn || "(not saved)"}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                    Student No.: (assigned upon enrollment)
                                  </div>
                                </div>

                                <div
                                  className="rounded-2xl p-3"
                                  style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}
                                >
                                  <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                    Program
                                  </div>
                                  <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.brown }}>
                                    {receiptProgram}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                    Submitted: {formatDateTime(receipt.st_submission_date)}
                                  </div>
                                </div>
                              </div>

                              <div
                                className="mt-3 rounded-2xl p-3"
                                style={{
                                  background: "rgba(212,166,47,0.12)",
                                  border: `1px solid ${BRAND.stroke}`,
                                }}
                              >
                                <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                  Scheduled Date & Time
                                </div>
                                <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                                  {formatDateOnly(receipt.st_scheduled_date)} •{" "}
                                  {formatTimeOnly(receipt.st_scheduled_time)}
                                </div>
                              </div>

                              <div
                                className="mt-3 rounded-2xl p-3"
                                style={{ background: "#fff", border: `1px solid ${BRAND.stroke}` }}
                              >
                                <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                  Requirements to Bring
                                </div>
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

                {formError ? (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formError}
                  </div>
                ) : null}

                {lookupLoading ? (
                  <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm font-semibold text-black/60">
                    Loading program options…
                  </div>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
                  {/* Stepper */}
                  <aside className="md:col-span-4">
                    <div
                      className="rounded-3xl p-4"
                      style={{ background: "rgba(251,246,239,0.55)", border: `1px solid ${BRAND.stroke}` }}
                    >
                      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                        Registration Steps
                      </div>
                      <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                        You must complete each section to proceed.
                      </div>

                      <div className="mt-4 space-y-2">
                        {STEPS.map((s, idx) => {
                          const Icon = s.icon;
                          const active = idx === step;
                          const complete = isStepComplete(s.key);
                          const allowed = canGoToStep(idx);

                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => goToStep(idx)}
                              disabled={!allowed}
                              className="w-full text-left rounded-2xl px-3 py-3 transition"
                              style={{
                                background: active ? "rgba(212,166,47,0.18)" : "rgba(255,255,255,0.65)",
                                border: `1px solid ${active ? "rgba(212,166,47,0.45)" : BRAND.stroke}`,
                                opacity: allowed ? 1 : 0.55,
                                cursor: allowed ? "pointer" : "not-allowed",
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="grid h-9 w-9 place-items-center rounded-2xl"
                                  style={{
                                    background: active ? "rgba(212,166,47,0.20)" : "rgba(43,26,18,0.04)",
                                    border: `1px solid ${BRAND.stroke}`,
                                  }}
                                >
                                  <Icon className="h-4 w-4" style={{ color: BRAND.brown }} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold truncate" style={{ color: BRAND.brown }}>
                                    {s.title}
                                  </div>
                                  <div className="text-xs" style={{ color: BRAND.muted }}>
                                    {complete ? "Completed" : allowed ? "In progress" : "Complete previous step first"}
                                  </div>
                                </div>
                                <div className="ml-auto">
                                  {complete ? (
                                    <CheckCircle2 className="h-5 w-5" style={{ color: BRAND.gold }} />
                                  ) : (
                                    <div className="h-5 w-5 rounded-full" style={{ border: `2px solid rgba(43,26,18,0.18)` }} />
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div
                        className="mt-4 rounded-2xl px-3 py-3 text-xs"
                        style={{
                          background: "#fff",
                          border: `1px solid ${BRAND.stroke}`,
                          color: BRAND.muted,
                        }}
                      >
                        Tip: If you see red messages, complete required fields to unlock the next section.
                      </div>
                    </div>
                  </aside>

                  {/* Form */}
                  <main className="md:col-span-8">
                    <form onSubmit={onSubmit} className="space-y-5">
                      <AnimatePresence mode="wait">
                        {stepKey === "basic" ? (
                          <motion.div
                            key="basic"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4"
                          >
                            <SectionTitle
                              title="Basic Information"
                              subtitle="Tell us about the student. Required fields are marked *."
                            />

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

                            <Field
                              label="Email Address *"
                              icon={Mail}
                              value={email}
                              placeholder="your.email@grabsum.edu.ph"
                              onChange={setEmail}
                              onBlur={() => touch("email")}
                              error={touched.email && errors.email}
                            />

                            <Field
                              label="LRN (12 digits) *"
                              icon={Hash}
                              value={lrn}
                              placeholder="123456789012"
                              onChange={(v) => {
                                setLrn(onlyDigits(v));
                                setLrnCheck({ status: "idle", message: "" });
                              }}
                              onBlur={async () => {
                                touch("lrn");
                                await checkLrnNow(lrn);
                              }}
                              error={
                                touched.lrn &&
                                (errors.lrn || (lrnCheck.status === "error" ? lrnCheck.message : ""))
                              }
                              maxLength={12}
                            />

                            {lrnCheck.status !== "idle" ? (
                              <div
                                className="text-xs font-semibold"
                                style={{
                                  color:
                                    lrnCheck.status === "ok"
                                      ? "rgba(22,163,74,0.95)"
                                      : lrnCheck.status === "checking"
                                      ? "rgba(43,26,18,0.65)"
                                      : "rgba(239,68,68,0.9)",
                                }}
                              >
                                {lrnCheck.message}
                              </div>
                            ) : null}

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

                            <Field
                              label="Birthplace"
                              icon={MapPin}
                              value={bplace}
                              placeholder="City / Province"
                              onChange={setBplace}
                            />
                            <TextareaField
                              label="Current Address"
                              icon={MapPin}
                              value={address}
                              placeholder="House no., street, barangay, city"
                              onChange={setAddress}
                            />

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
                          </motion.div>
                        ) : null}

                        {stepKey === "family" ? (
                          <motion.div
                            key="family"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4"
                          >
                            <SectionTitle
                              title="Family Information"
                              subtitle="Provide guardian details. Required fields are marked *."
                            />

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
                                label="Guardian Contact *"
                                icon={Phone}
                                value={guardianContact}
                                placeholder="09xxxxxxxxx"
                                onChange={(v) => setGuardianContact(onlyDigits(v))}
                                onBlur={() => touch("guardianContact")}
                                error={touched.guardianContact && errors.guardianContact}
                                maxLength={11}
                              />
                            </div>

                            <Field
                              label="Relationship"
                              icon={Users}
                              value={guardianRelationship}
                              placeholder="Mother / Father / Aunt / etc."
                              onChange={setGuardianRelationship}
                            />

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
                          </motion.div>
                        ) : null}

                        {stepKey === "academic" ? (
                          <motion.div
                            key="academic"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4"
                          >
                            <SectionTitle
                              title="Academic Information"
                              subtitle="Select the student’s program. All fields here are required *."
                            />

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <SelectField
                                label="Year Level (Grade) *"
                                icon={GraduationCap}
                                value={gradeId}
                                onChange={setGradeId}
                                options={(grades ?? []).map((g) => ({
                                  value: g.grade_id,
                                  label: `Grade ${g.grade_level}`,
                                }))}
                                placeholder="Select grade"
                                onBlur={() => touch("gradeId")}
                                error={touched.gradeId && errors.gradeId}
                              />

                              <SelectField
                                label="Track *"
                                icon={GraduationCap}
                                value={trackId}
                                onChange={setTrackId}
                                options={(tracks ?? []).map((t) => ({
                                  value: t.track_id,
                                  label: t.track_code,
                                }))}
                                placeholder="Select track"
                                onBlur={() => touch("trackId")}
                                error={touched.trackId && errors.trackId}
                              />

                              <SelectField
                                label="Strand *"
                                icon={GraduationCap}
                                value={strandId}
                                onChange={setStrandId}
                                options={strandsForTrack.map((s) => ({
                                  value: s.strand_id,
                                  label: s.strand_code,
                                }))}
                                placeholder={trackId ? "Select strand" : "Select track first"}
                                onBlur={() => touch("strandId")}
                                error={touched.strandId && errors.strandId}
                                disabled={!trackId}
                              />
                            </div>
                          </motion.div>
                        ) : null}

                        {stepKey === "review" ? (
                          <motion.div
                            key="review"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4"
                          >
                            <SectionTitle
                              title="Review & Submit"
                              subtitle="Check all details carefully before submitting."
                            />

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <ReviewCard title="Basic Information" onEdit={() => setStep(0)}>
                                <ReviewRow
                                  label="Full Name"
                                  value={`${fname || "—"} ${mi ? `${mi}.` : ""} ${lname || "—"} ${ext || ""}`.trim()}
                                />
                                <ReviewRow label="Email" value={email || "—"} />
                                <ReviewRow label="LRN" value={lrn || "—"} />
                                <ReviewRow label="Gender" value={gender || "—"} />
                                <ReviewRow label="Birthdate" value={bdate || "—"} />
                                <ReviewRow label="Birthplace" value={bplace || "—"} />
                                <ReviewRow label="Address" value={address || "—"} />
                                <ReviewRow label="Previous School" value={prevSchool || "—"} />
                              </ReviewCard>

                              <ReviewCard title="Family Information" onEdit={() => setStep(1)}>
                                <ReviewRow label="Guardian Name" value={guardianName || "—"} />
                                <ReviewRow label="Guardian Contact" value={guardianContact || "—"} />
                                <ReviewRow label="Relationship" value={guardianRelationship || "—"} />
                                <ReviewRow label="Father" value={fatherName || "—"} />
                                <ReviewRow label="Mother" value={motherName || "—"} />
                              </ReviewCard>
                            </div>

                            <ReviewCard title="Academic Information" onEdit={() => setStep(2)}>
                              <ReviewRow label="Program" value={programSummary} />
                            </ReviewCard>

                            <div className="pt-1">
                              <label
                                className="inline-flex items-start gap-2 text-sm"
                                style={{ color: BRAND.muted }}
                              >
                                <input
                                  type="checkbox"
                                  checked={agreed}
                                  onChange={(e) => setAgreed(e.target.checked)}
                                  onBlur={() => touch("agreed")}
                                  className="mt-1 h-4 w-4 rounded border-black/20"
                                />
                                <span>
                                  I agree to the{" "}
                                  <span style={{ color: BRAND.link, fontWeight: 800 }}>
                                    Terms & Conditions
                                  </span>
                                  .
                                  {touched.agreed && errors.agreed ? (
                                    <span className="block mt-1 text-xs font-semibold text-red-500">
                                      {errors.agreed}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {/* Navigation */}
                      <div className="pt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={prevStep}
                            disabled={step === 0}
                            className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                            style={{
                              background: "rgba(43,26,18,0.06)",
                              border: `1px solid ${BRAND.stroke}`,
                              color: BRAND.brown,
                              opacity: step === 0 ? 0.55 : 1,
                              cursor: step === 0 ? "not-allowed" : "pointer",
                            }}
                          >
                            Back
                          </button>

                          {step < STEPS.length - 1 ? (
                            <button
                              type="button"
                              onClick={nextStep}
                              className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                              style={{
                                background: BRAND.gold,
                                color: BRAND.brown,
                                boxShadow: "0 10px 18px rgba(212,166,47,0.26)",
                                opacity: stepHasBlockingErrors ? 0.65 : 1,
                                cursor: stepHasBlockingErrors ? "not-allowed" : "pointer",
                              }}
                              onMouseEnter={(e) => {
                                if (stepHasBlockingErrors) return;
                                e.currentTarget.style.background = BRAND.goldHover;
                                e.currentTarget.style.transform = "translateY(-1px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = BRAND.gold;
                                e.currentTarget.style.transform = "translateY(0px)";
                              }}
                            >
                              Next
                            </button>
                          ) : (
                            <button
                              type="submit"
                              className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                              style={{
                                background: BRAND.gold,
                                color: BRAND.brown,
                                boxShadow: "0 10px 18px rgba(212,166,47,0.28)",
                                opacity: Object.keys(errors).length === 0 && !loading ? 1 : 0.65,
                                cursor: Object.keys(errors).length === 0 && !loading ? "pointer" : "not-allowed",
                              }}
                              onMouseEnter={(e) => {
                                if (Object.keys(errors).length || loading) return;
                                e.currentTarget.style.background = BRAND.goldHover;
                                e.currentTarget.style.transform = "translateY(-1px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = BRAND.gold;
                                e.currentTarget.style.transform = "translateY(0px)";
                              }}
                              disabled={Object.keys(errors).length > 0 || loading}
                            >
                              {loading ? "Submitting…" : "Submit Pre-enrollment"}
                            </button>
                          )}
                        </div>

                        <div className="text-center sm:text-right text-sm" style={{ color: BRAND.muted }}>
                          Already have an account?{" "}
                          <Link to="/login" className="hover:underline" style={{ color: BRAND.link }}>
                            Sign in
                          </Link>
                        </div>
                      </div>

                      {stepHasBlockingErrors && step < STEPS.length - 1 ? (
                        <div className="text-xs font-semibold" style={{ color: "rgba(239,68,68,0.85)" }}>
                          Please complete required fields in this section to continue.
                        </div>
                      ) : null}
                    </form>
                  </main>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Returning Student Modal (simplified) */}
      <ReturningStudentModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        brand={BRAND}
        studentNo={returnStudentNo}
        setStudentNo={setReturnStudentNo}
        loading={returnLoading}
        error={returnError}
        found={foundStudent}
        updEmail={updEmail}
        setUpdEmail={setUpdEmail}
        updAddress={updAddress}
        setUpdAddress={setUpdAddress}
        updGuardianName={updGuardianName}
        setUpdGuardianName={setUpdGuardianName}
        updGuardianContact={updGuardianContact}
        setUpdGuardianContact={setUpdGuardianContact}
        onCheck={onCheckReturningStudent}
        onApply={onApplyReturningUpdates}
      />
    </div>
  );
}

/* -----------------------------------------------------
   UI components
----------------------------------------------------- */

function SectionTitle({ title, subtitle }) {
  return (
    <div className="pb-1">
      <div className="text-lg font-extrabold" style={{ color: BRAND.brown }}>
        {title}
      </div>
      <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
        {subtitle}
      </div>
    </div>
  );
}

function ReviewCard({ title, children, onEdit }) {
  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "rgba(251,246,239,0.55)", border: `1px solid ${BRAND.stroke}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          {title}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl px-3 py-1 text-xs font-bold transition hover:bg-black/5"
          style={{ border: `1px solid ${BRAND.stroke}`, color: BRAND.brown, background: "rgba(255,255,255,0.7)" }}
        >
          Edit
        </button>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs font-bold" style={{ color: "rgba(43,26,18,0.65)" }}>
        {label}
      </div>
      <div className="text-sm font-semibold text-right" style={{ color: BRAND.brown }}>
        {String(value || "—")}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, onBlur, placeholder, error, maxLength }) {
  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2">
        <div className="relative">
          {Icon ? <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} /> : null}
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
        {Icon ? <Icon className="absolute left-4 top-4 h-4 w-4" style={{ color: BRAND.muted }} /> : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
          style={{ background: "rgba(251,246,239,0.6)", border: `1px solid rgba(43,26,18,0.22)` }}
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

function SelectField({ label, icon: Icon, value, onChange, options, placeholder, onBlur, error, disabled }) {
  const normalized = (options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  return (
    <div>
      <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
        {label}
      </label>
      <div className="mt-2">
        <div className="relative">
          {Icon ? <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} /> : null}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            className="w-full appearance-none rounded-xl pl-11 pr-10 py-3 text-sm outline-none transition"
            style={{
              background: disabled ? "rgba(0,0,0,0.03)" : "rgba(251,246,239,0.6)",
              border: `1px solid ${error ? "rgba(239,68,68,0.55)" : "rgba(43,26,18,0.22)"}`,
              opacity: disabled ? 0.75 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            onFocus={(e) => {
              if (disabled) return;
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
              e.currentTarget.style.background = "rgba(251,246,239,0.85)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="">{placeholder}</option>
            {normalized.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50">▾</div>
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
          {Icon ? <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} /> : null}
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
            style={{ background: "rgba(251,246,239,0.6)", border: `1px solid rgba(43,26,18,0.22)` }}
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

/* -----------------------------------------------------
   Returning Student Modal (Simplified: Student Number only)
----------------------------------------------------- */
function ReturningStudentModal({
  open,
  onClose,
  brand,
  studentNo,
  setStudentNo,
  loading,
  error,
  found,
  updEmail,
  setUpdEmail,
  updAddress,
  setUpdAddress,
  updGuardianName,
  setUpdGuardianName,
  updGuardianContact,
  setUpdGuardianContact,
  onCheck,
  onApply,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="absolute left-1/2 top-1/2 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="rounded-[28px] bg-white p-6 md:p-7"
          style={{
            border: `1px solid ${brand.stroke}`,
            boxShadow: "0 18px 44px rgba(43,26,18,0.18)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold" style={{ color: brand.brown }}>
                Returning Student
              </div>
              <div className="mt-1 text-sm" style={{ color: brand.muted }}>
                Enter your Student Number to load your record and update details if needed.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-2xl hover:bg-black/5 transition"
              style={{ border: `1px solid ${brand.stroke}` }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Student number */}
          <div className="mt-5 space-y-2">
            <div className="text-sm font-semibold" style={{ color: brand.brown }}>
              Student Number
            </div>
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              placeholder="e.g., 2023-000123"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              style={{ background: "rgba(251,246,239,0.6)", border: `1px solid ${brand.stroke}` }}
              disabled={loading}
            />

            <button
              type="button"
              onClick={onCheck}
              disabled={loading}
              className="w-full rounded-2xl py-3 text-sm font-extrabold transition"
              style={{
                background: brand.gold,
                color: brand.brown,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 10px 18px rgba(212,166,47,0.26)",
              }}
            >
              {loading ? "Checking..." : "Check Student Number"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {/* Found: show update fields */}
          {found ? (
            <div className="mt-5">
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(251,246,239,0.55)", border: `1px solid ${brand.stroke}` }}
              >
                <div className="text-sm font-extrabold" style={{ color: brand.brown }}>
                  Record Found
                </div>
                <div className="mt-1 text-xs" style={{ color: brand.muted }}>
                  Update any detail below if it changed.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <input
                    value={updEmail}
                    onChange={(e) => setUpdEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    style={{ background: "rgba(255,255,255,0.8)", border: `1px solid ${brand.stroke}` }}
                  />

                  <textarea
                    value={updAddress}
                    onChange={(e) => setUpdAddress(e.target.value)}
                    placeholder="Current Address"
                    rows={3}
                    className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition"
                    style={{ background: "rgba(255,255,255,0.8)", border: `1px solid ${brand.stroke}` }}
                  />

                  <input
                    value={updGuardianName}
                    onChange={(e) => setUpdGuardianName(e.target.value)}
                    placeholder="Guardian Name"
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    style={{ background: "rgba(255,255,255,0.8)", border: `1px solid ${brand.stroke}` }}
                  />

                  <input
                    value={updGuardianContact}
                    onChange={(e) => setUpdGuardianContact(onlyDigits(e.target.value))}
                    placeholder="Guardian Contact"
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    style={{ background: "rgba(255,255,255,0.8)", border: `1px solid ${brand.stroke}` }}
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold transition hover:bg-black/5"
                  style={{ border: `1px solid ${brand.stroke}`, color: brand.brown, background: "rgba(255,255,255,0.7)" }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onApply}
                  className="rounded-2xl px-4 py-3 text-sm font-extrabold transition"
                  style={{
                    background: brand.gold,
                    color: brand.brown,
                    boxShadow: "0 10px 18px rgba(212,166,47,0.26)",
                  }}
                >
                  Apply Updates
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
