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
  Download,
  Hash,
  X,
  AlertCircle,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import logo from "../assets/grabsum-logo.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";


const BRAND = {
  bg: "#fbf6ef",
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  soft: "rgba(251,246,239,0.7)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  link: "#d4a62f",
  danger: "rgba(239,68,68,0.55)",
};

const DEFAULT_REQUIREMENTS = [
  "Printed Pre-enrollment slip (Application Code)",
  "Photocopy of PSA Birth Certificate",
  "Report Card / SF9 (original + photocopy)",
  "2x2 ID Picture (2 pcs)",
  "Good Moral Certificate",
];

function onlyDigits(v) {
  return String(v || "").replace(/[^0-9]/g, "");
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}
function isLRN(v) {
  return onlyDigits(v).length === 12;
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
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "2-digit" });
}
function formatTimeOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function buildFullName({ st_fname, st_lname, st_mi, st_ext }) {
  const mi = (st_mi || "").trim();
  const ext = (st_ext || "").trim();
  return [(st_fname || "").trim(), mi ? `${mi}.` : "", (st_lname || "").trim(), ext].filter(Boolean).join(" ");
}

function LockedNote({ title, subtitle }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 text-sm"
      style={{
        background: "rgba(0,0,0,0.03)",
        border: `1px solid ${BRAND.stroke}`,
        color: BRAND.brown,
      }}
    >
      <div className="font-extrabold">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export default function PreEnroll() {
  const nav = useNavigate();
  const printRef = useRef(null);

  /* =========================================================
     Steps
  ========================================================= */
  const STEPS = [
    { id: 1, title: "Basic Information" },
    { id: 2, title: "Family Information" },
    { id: 3, title: "Academic Information" },
    { id: 4, title: "Review & Submit" },
  ];
  const [step, setStep] = useState(1);

  /* =========================================================
     Returning student modal
  ========================================================= */
  const [showReturning, setShowReturning] = useState(false);
  const [returningNumber, setReturningNumber] = useState("");
  const [returningLoading, setReturningLoading] = useState(false);
  const [returningError, setReturningError] = useState("");

  // student_number from students table (returning flow)
  const [studentNumber, setStudentNumber] = useState("");
  const isReturning = !!studentNumber;

  /* =========================================================
     Form fields
  ========================================================= */
  const [email, setEmail] = useState("");
  const [lrn, setLrn] = useState("");

  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [mi, setMi] = useState("");
  const [ext, setExt] = useState("");

  const [gender, setGender] = useState("");
  const [bdate, setBdate] = useState("");
  const [bplace, setBplace] = useState("");
  const [address, setAddress] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [prevSchool, setPrevSchool] = useState("");

  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  const [gradeId, setGradeId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [strandId, setStrandId] = useState("");

  const [agreed, setAgreed] = useState(false);

  /* =========================================================
     UI state
  ========================================================= */
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [receipt, setReceipt] = useState(null);

  /* =========================================================
     LRN async check (Step 1) - NEW STUDENTS ONLY
  ========================================================= */
  const [lrnCheck, setLrnCheck] = useState({ status: "idle", message: "" }); // idle|checking|ok|error

  async function checkLRNAsync(lrnValueDigits) {
    // returning students never check
    if (isReturning) return true;

    const digits = onlyDigits(lrnValueDigits || "");
    if (digits.length !== 12) {
      setLrnCheck({ status: "error", message: "LRN must be 12 digits." });
      return false;
    }

    try {
      setLrnCheck({ status: "checking", message: "Checking LRN..." });

      const { data, error } = await supabase.functions.invoke("pre-enroll", {
        body: {
          intent: "check_lrn",
          st_lrn: digits,
        },
      });

      if (error) throw error;

      if (!data?.ok) {
        setLrnCheck({ status: "error", message: data?.error || "LRN check failed." });
        return false;
      }

      setLrnCheck({ status: "ok", message: data?.note || "LRN is available." });
      return true;
    } catch (e) {
      setLrnCheck({ status: "error", message: String(e?.message || e || "LRN check failed.") });
      return false;
    }
  }

  /* =========================================================
     Lookups: grades / tracks / strands
  ========================================================= */
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
          supabase.from("grade_levels").select("grade_id, grade_level, description").order("grade_level", { ascending: true }),
          supabase.from("tracks").select("track_id, track_code, description").order("track_code", { ascending: true }),
          supabase.from("strands").select("strand_id, track_id, strand_code, description").order("strand_code", { ascending: true }),
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

  /* =========================================================
     Validation (per-step)
  ========================================================= */
  function touch(key) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const errorsStep1 = useMemo(() => {
    const e = {};
    if (!fname.trim()) e.fname = "First name is required.";
    if (!lname.trim()) e.lname = "Last name is required.";
    if (!email.trim()) e.email = "Email is required.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";

    // LRN required ONLY for new students
    if (!isReturning) {
      if (!onlyDigits(lrn)) e.lrn = "LRN is required.";
      else if (!isLRN(lrn)) e.lrn = "LRN must be 12 digits.";
      else if (lrnCheck.status === "error") e.lrn = lrnCheck.message || "LRN is not valid.";
      else if (lrnCheck.status !== "ok") e.lrn = "Please check your LRN.";
    }

    return e;
  }, [fname, lname, email, lrn, lrnCheck.status, lrnCheck.message, isReturning]);

  const errorsStep2 = useMemo(() => {
    const e = {};
    if (!guardianName.trim()) e.guardianName = "Guardian name is required.";
    if (!guardianContact.trim()) e.guardianContact = "Guardian contact is required.";
    return e;
  }, [guardianName, guardianContact]);

  const errorsStep3 = useMemo(() => {
    const e = {};
    if (!gradeId) e.gradeId = "Grade level is required.";
    if (!trackId) e.trackId = "Track is required.";
    if (!strandId) e.strandId = "Strand is required.";
    return e;
  }, [gradeId, trackId, strandId]);

  const errorsStep4 = useMemo(() => {
    const e = {};
    if (!agreed) e.agreed = "You must agree to the Terms & Conditions.";
    return e;
  }, [agreed]);

  const stepIsComplete = (s) => {
    if (s === 1) return Object.keys(errorsStep1).length === 0;
    if (s === 2) return Object.keys(errorsStep2).length === 0;
    if (s === 3) return Object.keys(errorsStep3).length === 0;
    if (s === 4) return Object.keys(errorsStep4).length === 0;
    return false;
  };

  const canGoTo = (targetStep) => {
    for (let s = 1; s < targetStep; s++) {
      if (!stepIsComplete(s)) return false;
    }
    return true;
  };

  /* =========================================================
     Submit via Edge Function
  ========================================================= */
  const canSubmit = stepIsComplete(1) && stepIsComplete(2) && stepIsComplete(3) && stepIsComplete(4) && !loading;

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    setTouched((t) => ({
      ...t,
      fname: true,
      lname: true,
      email: true,
      lrn: true,
      guardianName: true,
      guardianContact: true,
      gradeId: true,
      trackId: true,
      strandId: true,
      agreed: true,
    }));

    if (!canSubmit) return;

    try {
      setLoading(true);

      // ✅ IMPORTANT:
      // Returning students MUST NOT send st_lrn and st_previous_school
      // (these are locked server-side and should come from old enrollment)
      const payload = {
        student_number: studentNumber || null,

        st_fname: fname.trim(),
        st_lname: lname.trim(),
        st_mi: mi.trim(),
        st_ext: ext.trim(),
        st_gender: gender.trim(),
        st_bdate: bdate || null,
        st_bplace: bplace.trim(),
        st_current_address: address.trim(),
        st_civil_status: civilStatus.trim(),

        st_email: email.trim().toLowerCase(),

        ...(isReturning ? {} : { st_lrn: onlyDigits(lrn) }),
        ...(isReturning ? {} : { st_previous_school: prevSchool.trim() }),

        st_father_name: fatherName.trim(),
        st_mother_name: motherName.trim(),

        st_guardian_name: guardianName.trim(),
        st_guardian_contact: onlyDigits(guardianContact),
        st_guardian_relationship: guardianRelationship.trim(),

        grade_id: gradeId,
        track_id: trackId,
        strand_id: strandId,

        st_grade_level: gradeMap.get(String(gradeId)) ? String(gradeMap.get(String(gradeId))) : null,
        st_track: trackMap.get(String(trackId)) ? String(trackMap.get(String(trackId))) : null,
      };

      const { data, error } = await supabase.functions.invoke("pre-enroll", { body: payload });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Submission failed.");

      const inserted = data?.data;

      setReceipt({
        ...inserted,
        full_name: buildFullName({
          st_fname: inserted.st_fname,
          st_lname: inserted.st_lname,
          st_mi: inserted.st_mi,
          st_ext: inserted.st_ext,
        }),
        requirements: DEFAULT_REQUIREMENTS,
        active_school_year: data?.active_school_year || null,
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err?.message || "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     Receipt: Print + Download (HTML file)
  ========================================================= */
  function buildSlipHTML() {
    const content = printRef.current;
    const body = content ? content.innerHTML : "<div>Slip not ready</div>";

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Pre-enrollment Slip</title>
          <style>
            *{box-sizing:border-box;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
            body{margin:0;padding:24px;background:#fff;color:#1b0f0a;}
            .wrap{max-width:820px;margin:0 auto;}
            .card{border:1px solid rgba(43,26,18,0.16);border-radius:18px;padding:18px 18px 14px;}
            .muted{color:rgba(43,26,18,0.65)}
            .badge{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(212,166,47,0.18);border:1px solid rgba(43,26,18,0.16);font-weight:700;}
            ul{margin:10px 0 0 18px;padding:0}
            @media print { body{padding:0} .card{border:none} }
          </style>
        </head>
        <body>
          <div class="wrap">${body}</div>
        </body>
      </html>
    `;
  }

  function printSlip() {
    const html = buildSlipHTML();
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html + `<script>window.onload = () => { window.print(); };</script>`);
    printWindow.document.close();
  }

  async function downloadSlipPDF() {
  try {
    if (!printRef.current) return;

    // Make sure it’s visible (in case you later hide it in UI)
    const node = printRef.current;

    // Render DOM to canvas
    const canvas = await html2canvas(node, {
      scale: 2,               // sharper
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");

    // Create PDF (A4 portrait)
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Convert canvas px to mm with scaling that fits width
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    // If content is longer than one page, split into pages
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const appId = receipt?.application_id || "application";
    pdf.save(`pre-enrollment-slip-${appId}.pdf`);
  } catch (e) {
    alert(e?.message || "Failed to download PDF.");
  }
}


  /* =========================================================
     Returning student lookup
  ========================================================= */
  async function onCheckReturningStudent() {
    setReturningError("");
    const stNo = String(returningNumber || "").trim();
    if (!stNo) {
      setReturningError("Student Number is required.");
      return;
    }

    try {
      setReturningLoading(true);

      const { data, error } = await supabase.functions.invoke("pre-enroll", {
        body: { intent: "lookup_returning", student_number: stNo },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Lookup failed.");

      const enr = data?.enrollment;

      setStudentNumber(stNo);

      // Prefill from enrollment record
      setFname(enr?.st_fname || "");
      setLname(enr?.st_lname || "");
      setMi(enr?.st_mi || "");
      setExt(enr?.st_ext || "");

      setEmail(enr?.st_email || "");

      // keep internally (optional), but UI locked/hidden
      setLrn(enr?.st_lrn ? onlyDigits(enr.st_lrn) : "");
      setPrevSchool(enr?.st_previous_school || "");

      setGender(enr?.st_gender || "");
      setBdate(enr?.st_bdate ? String(enr.st_bdate) : "");
      setBplace(enr?.st_bplace || "");
      setAddress(enr?.st_current_address || "");
      setCivilStatus(enr?.st_civil_status || "");

      setFatherName(enr?.st_father_name || "");
      setMotherName(enr?.st_mother_name || "");
      setGuardianName(enr?.st_guardian_name || "");
      setGuardianContact(enr?.st_guardian_contact ? onlyDigits(enr.st_guardian_contact) : "");
      setGuardianRelationship(enr?.st_guardian_relationship || "");

      // Force re-select academic for next school year
      setGradeId("");
      setTrackId("");
      setStrandId("");

      // Returning has no LRN check needed
      setLrnCheck({ status: "ok", message: "Locked for returning students." });

      setShowReturning(false);
      setStep(1);
    } catch (e) {
      setReturningError(String(e?.message || e || "Lookup failed."));
    } finally {
      setReturningLoading(false);
    }
  }

  /* =========================================================
     Derived strings
  ========================================================= */
  const receiptProgram = receipt
    ? `${gradeMap.get(String(receipt.grade_id || "")) || "—"} • ${trackMap.get(String(receipt.track_id || "")) || "—"} • ${
        strandMap.get(String(receipt.strand_id || "")) || "—"
      }`
    : "";

  return (
    <div className="min-h-screen font-[Nunito]" style={{ background: BRAND.bg }}>
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition"
      >
        <ArrowLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
      </button>

      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Grabsum School logo" className="h-10 w-10 rounded-full object-contain" draggable="false" />
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
                setReturningError("");
                setReturningNumber(studentNumber || "");
                setShowReturning(true);
              }}
              className="rounded-2xl px-4 py-2 text-sm font-semibold border border-black/10 bg-white/80 hover:bg-white transition"
            >
              Returning student?
            </button>

            <div
              className="rounded-2xl px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${BRAND.stroke}`, color: BRAND.brown }}
            >
              Step {step} of 4: {STEPS[step - 1]?.title}
            </div>
          </div>
        </div>
      </div>

      {/* Centered landscape card */}
      <div className="mx-auto max-w-6xl px-6 pb-14 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-[28px] bg-white"
          style={{ border: `1px solid ${BRAND.stroke}`, boxShadow: "0 14px 34px rgba(43,26,18,0.12)" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr]">
            {/* Left stepper */}
            <div className="p-6 lg:p-8" style={{ background: "rgba(251,246,239,0.55)", borderRight: `1px solid ${BRAND.stroke}` }}>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                Registration Steps
              </div>
              <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                You must complete each section to proceed.
              </div>

              <div className="mt-5 space-y-2">
                {STEPS.map((s) => {
                  const isActive = s.id === step;
                  const isUnlocked = canGoTo(s.id);
                  const done = stepIsComplete(s.id);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (!isUnlocked) return;
                        setStep(s.id);
                      }}
                      className="w-full text-left rounded-2xl px-4 py-3 transition"
                      style={{
                        background: isActive ? "rgba(212,166,47,0.18)" : "rgba(255,255,255,0.8)",
                        border: `1px solid ${isActive ? "rgba(212,166,47,0.35)" : BRAND.stroke}`,
                        opacity: isUnlocked ? 1 : 0.55,
                        cursor: isUnlocked ? "pointer" : "not-allowed",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="grid h-8 w-8 place-items-center rounded-xl"
                            style={{
                              background: isActive ? "rgba(251,246,239,0.9)" : "rgba(0,0,0,0.03)",
                              border: `1px solid ${BRAND.stroke}`,
                            }}
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.brown }} />
                            ) : (
                              <span className="text-xs font-black" style={{ color: BRAND.brown }}>
                                {s.id}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                              {s.title}
                            </div>
                            <div className="text-xs" style={{ color: BRAND.muted }}>
                              {done ? "Completed" : isUnlocked ? "In progress" : "Complete previous step first"}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {isActive ? "●" : " "}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl px-4 py-3 text-xs" style={{ background: "rgba(255,255,255,0.8)", border: `1px solid ${BRAND.stroke}`, color: BRAND.muted }}>
                Tip: If you see red messages, complete required fields to unlock the next section.
              </div>

              <div className="mt-6 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
                © {new Date().getFullYear()} GRABSUM School, Inc.
              </div>
            </div>

            {/* Right content */}
            <div className="p-6 lg:p-10">
              <AnimatePresence>
                {receipt ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mb-6"
                  >
                    <div className="rounded-3xl" style={{ background: "rgba(212,166,47,0.14)", border: `1px solid ${BRAND.stroke}` }}>
                      <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                              style={{ background: "rgba(251,246,239,0.8)", border: `1px solid ${BRAND.stroke}` }}
                            >
                              <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.brown }} />
                              Submitted
                            </div>
                            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
                              Your application code and schedule are ready.
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
  onClick={downloadSlipPDF}
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
                                <div className="text-xs" style={{ color: BRAND.muted }}>
                                  Application Code
                                </div>
                                <div className="text-xl font-black tracking-wide" style={{ color: BRAND.brown }}>
                                  {receipt.application_id}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl p-3" style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}>
                                <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                  Student
                                </div>
                                <div className="mt-1 text-sm font-semibold" style={{ color: BRAND.brown }}>
                                  {receipt.full_name}
                                </div>
                                <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                  LRN: {receipt.st_lrn || "(locked for returning students)"}
                                </div>
                                <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                                  Student No.: {receipt.st_number || "(assigned/known for returning students)"}
                                </div>
                              </div>

                              <div className="rounded-2xl p-3" style={{ background: BRAND.soft, border: `1px solid ${BRAND.stroke}` }}>
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

                            <div className="mt-3 rounded-2xl p-3" style={{ background: "rgba(212,166,47,0.12)", border: `1px solid ${BRAND.stroke}` }}>
                              <div className="text-xs font-bold" style={{ color: BRAND.brown }}>
                                Scheduled Date & Time
                              </div>
                              <div className="mt-1 text-sm font-extrabold" style={{ color: BRAND.brown }}>
                                {formatDateOnly(receipt.st_scheduled_date)} • {formatTimeOnly(receipt.st_scheduled_time)}
                              </div>
                            </div>

                            <div className="mt-3 rounded-2xl p-3" style={{ background: "#fff", border: `1px solid ${BRAND.stroke}` }}>
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

              <div>
                <h2 className="text-xl font-extrabold" style={{ color: BRAND.brown }}>
                  {STEPS[step - 1]?.title}
                </h2>
                <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                  Fields marked <b>*</b> are required.
                  {studentNumber ? (
                    <span
                      className="ml-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                      style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${BRAND.stroke}`, color: BRAND.brown }}
                    >
                      Returning Student: {studentNumber}
                    </span>
                  ) : null}
                </div>
              </div>

              {formError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {formError}
                </div>
              ) : null}

              {lookupLoading ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm font-semibold text-black/60">
                  Loading program options…
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6">
                {/* STEP 1 */}
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field
                        label="First Name *"
                        icon={User}
                        value={fname}
                        placeholder="Juan"
                        onChange={setFname}
                        onBlur={() => touch("fname")}
                        error={touched.fname && errorsStep1.fname}
                      />
                      <Field
                        label="Last Name *"
                        icon={User}
                        value={lname}
                        placeholder="Dela Cruz"
                        onChange={setLname}
                        onBlur={() => touch("lname")}
                        error={touched.lname && errorsStep1.lname}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Middle Initial" icon={User} value={mi} placeholder="M" onChange={setMi} maxLength={2} />
                      <Field label="Extension" icon={User} value={ext} placeholder="Jr. / III" onChange={setExt} />
                    </div>

                    <Field
                      label="Email Address *"
                      icon={Mail}
                      value={email}
                      placeholder="your.email@grabsum.edu.ph"
                      onChange={setEmail}
                      onBlur={() => touch("email")}
                      error={touched.email && errorsStep1.email}
                    />

                    {/* LRN hidden for returning students */}
                    {!isReturning ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field
                          label="LRN (12 digits) *"
                          icon={Hash}
                          value={lrn}
                          placeholder="123456789012"
                          onChange={(v) => {
                            const d = onlyDigits(v);
                            setLrn(d);
                            setLrnCheck({ status: "idle", message: "" });
                          }}
                          onBlur={async () => {
                            touch("lrn");
                            await checkLRNAsync(lrn);
                          }}
                          error={touched.lrn && errorsStep1.lrn}
                          maxLength={12}
                          helper={
                            lrnCheck.status === "checking"
                              ? "Checking LRN…"
                              : lrnCheck.status === "ok"
                              ? lrnCheck.message
                              : lrnCheck.status === "error"
                              ? lrnCheck.message
                              : ""
                          }
                          helperTone={lrnCheck.status === "ok" ? "ok" : lrnCheck.status === "error" ? "error" : "muted"}
                        />

                        <SelectField
                          label="Gender"
                          icon={User}
                          value={gender}
                          onChange={setGender}
                          options={["Male", "Female"]}
                          placeholder="Select gender"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <LockedNote title="LRN (Locked)" subtitle="Returning students use the LRN from your existing record." />
                        <SelectField
                          label="Gender"
                          icon={User}
                          value={gender}
                          onChange={setGender}
                          options={["Male", "Female"]}
                          placeholder="Select gender"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DateField label="Birthdate" icon={Calendar} value={bdate} onChange={setBdate} />
                      <Field label="Birthplace" icon={MapPin} value={bplace} placeholder="City / Province" onChange={setBplace} />
                    </div>

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

                      {!isReturning ? (
                        <Field
                          label="Previous School"
                          icon={GraduationCap}
                          value={prevSchool}
                          placeholder="Last school attended"
                          onChange={setPrevSchool}
                        />
                      ) : (
                        <LockedNote title="Previous School (Locked)" subtitle="Returning students use the Previous School from your existing record." />
                      )}
                    </div>
                  </motion.div>
                ) : null}

                {/* STEP 2 */}
                {step === 2 ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field
                        label="Guardian Name *"
                        icon={Users}
                        value={guardianName}
                        placeholder="Full name of guardian"
                        onChange={setGuardianName}
                        onBlur={() => touch("guardianName")}
                        error={touched.guardianName && errorsStep2.guardianName}
                      />
                      <Field
                        label="Guardian Contact *"
                        icon={Phone}
                        value={guardianContact}
                        placeholder="09xxxxxxxxx"
                        onChange={(v) => setGuardianContact(onlyDigits(v))}
                        onBlur={() => touch("guardianContact")}
                        error={touched.guardianContact && errorsStep2.guardianContact}
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
                      <Field label="Father Name" icon={Users} value={fatherName} placeholder="Father's full name" onChange={setFatherName} />
                      <Field label="Mother Name" icon={Users} value={motherName} placeholder="Mother's full name" onChange={setMotherName} />
                    </div>
                  </motion.div>
                ) : null}

                {/* STEP 3 */}
                {step === 3 ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <div
                      className="rounded-2xl px-4 py-3 text-sm"
                      style={{ background: "rgba(212,166,47,0.10)", border: `1px solid ${BRAND.stroke}`, color: BRAND.brown }}
                    >
                      <b>Important:</b> Select your Grade, Track, and Strand for the next School Year.
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <SelectField
                        label="Year Level (Grade) *"
                        icon={GraduationCap}
                        value={gradeId}
                        onChange={setGradeId}
                        options={(grades ?? []).map((g) => ({ value: g.grade_id, label: `Grade ${g.grade_level}` }))}
                        placeholder="Select grade"
                        onBlur={() => touch("gradeId")}
                        error={touched.gradeId && errorsStep3.gradeId}
                      />

                      <SelectField
                        label="Track *"
                        icon={GraduationCap}
                        value={trackId}
                        onChange={setTrackId}
                        options={(tracks ?? []).map((t) => ({ value: t.track_id, label: t.track_code }))}
                        placeholder="Select track"
                        onBlur={() => touch("trackId")}
                        error={touched.trackId && errorsStep3.trackId}
                      />

                      <SelectField
                        label="Strand *"
                        icon={GraduationCap}
                        value={strandId}
                        onChange={setStrandId}
                        options={strandsForTrack.map((s) => ({ value: s.strand_id, label: s.strand_code }))}
                        placeholder={trackId ? "Select strand" : "Select track first"}
                        onBlur={() => touch("strandId")}
                        error={touched.strandId && errorsStep3.strandId}
                        disabled={!trackId}
                      />
                    </div>
                  </motion.div>
                ) : null}

                {/* STEP 4 */}
                {step === 4 ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <ReviewCard
                      title="Basic Information"
                      onEdit={() => setStep(1)}
                      rows={[
                        ["Full Name", `${fname} ${mi ? `${mi}.` : ""} ${lname} ${ext || ""}`.replace(/\s+/g, " ").trim()],
                        ["Email", email],
                        ["Gender", gender || "—"],
                        ["Birthdate", bdate || "—"],
                        ["Birthplace", bplace || "—"],
                        ["Address", address || "—"],
                        ...(isReturning ? [["LRN", "Locked (Returning Student)"]] : [["LRN", lrn || "—"]]),
                        ...(isReturning ? [["Previous School", "Locked (Returning Student)"]] : [["Previous School", prevSchool || "—"]]),
                      ]}
                    />

                    <ReviewCard
                      title="Family Information"
                      onEdit={() => setStep(2)}
                      rows={[
                        ["Guardian Name", guardianName],
                        ["Guardian Contact", guardianContact],
                        ["Relationship", guardianRelationship || "—"],
                        ["Father", fatherName || "—"],
                        ["Mother", motherName || "—"],
                      ]}
                    />

                    <ReviewCard
                      title="Academic Information"
                      onEdit={() => setStep(3)}
                      rows={[
                        [
                          "Program",
                          `${gradeMap.get(String(gradeId)) ? `Grade ${gradeMap.get(String(gradeId))}` : "—"} • ${
                            trackMap.get(String(trackId)) || "—"
                          } • ${strandMap.get(String(strandId)) || "—"}`,
                        ],
                      ]}
                    />

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
                          {touched.agreed && errorsStep4.agreed ? (
                            <span className="block mt-1 text-xs font-semibold text-red-500">{errorsStep4.agreed}</span>
                          ) : null}
                        </span>
                      </label>
                    </div>

                    <div className="rounded-2xl px-4 py-3 text-xs" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${BRAND.stroke}`, color: BRAND.muted }}>
                      After submission, you will receive an <b>Application Code</b> and schedule. Bring the listed requirements during on-site enrollment.
                    </div>
                  </motion.div>
                ) : null}

                {/* Bottom controls */}
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold border border-black/10 bg-white hover:bg-black/[0.02] transition"
                    disabled={step === 1}
                    style={{ opacity: step === 1 ? 0.6 : 1, cursor: step === 1 ? "not-allowed" : "pointer" }}
                  >
                    Back
                  </button>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    {step < 4 ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (step === 1) {
                            setTouched((t) => ({ ...t, fname: true, lname: true, email: true, lrn: true }));

                            // ✅ LRN check only for NEW students
                            if (!isReturning && lrnCheck.status !== "ok") {
                              await checkLRNAsync(lrn);
                            }
                          }

                          if (step === 2) setTouched((t) => ({ ...t, guardianName: true, guardianContact: true }));
                          if (step === 3) setTouched((t) => ({ ...t, gradeId: true, trackId: true, strandId: true }));

                          const next = step + 1;
                          if (canGoTo(next)) setStep(next);
                        }}
                        className="rounded-2xl px-6 py-3 text-sm font-semibold transition"
                        style={{
                          background: BRAND.gold,
                          color: BRAND.brown,
                          boxShadow: "0 10px 18px rgba(212,166,47,0.28)",
                          opacity: canGoTo(step + 1) ? 1 : 0.65,
                          cursor: canGoTo(step + 1) ? "pointer" : "not-allowed",
                        }}
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="rounded-2xl px-6 py-3 text-sm font-semibold transition"
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
                    )}
                  </div>
                </div>

                <div className="pt-4 text-center text-sm" style={{ color: BRAND.muted }}>
                  Already have an account?{" "}
                  <Link to="/login" className="hover:underline" style={{ color: BRAND.link }}>
                    Sign in
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Returning Student Modal */}
      <AnimatePresence>
        {showReturning ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-xl rounded-[26px] bg-white"
              style={{ border: `1px solid ${BRAND.stroke}`, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-extrabold" style={{ color: BRAND.brown }}>
                      Returning Student
                    </div>
                    <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                      Enter your Student Number to load your record. LRN & Previous School are locked.
                    </div>
                  </div>
                  <button
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 hover:bg-black/[0.03]"
                    onClick={() => setShowReturning(false)}
                    type="button"
                  >
                    <X className="h-5 w-5 text-black/60" />
                  </button>
                </div>

                <div className="mt-6">
                  <Field label="Student Number *" icon={Hash} value={returningNumber} placeholder="S25-0007" onChange={setReturningNumber} />
                </div>

                <button
                  type="button"
                  onClick={onCheckReturningStudent}
                  className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold transition"
                  style={{
                    background: BRAND.gold,
                    color: BRAND.brown,
                    boxShadow: "0 10px 18px rgba(212,166,47,0.28)",
                    opacity: returningLoading ? 0.75 : 1,
                    cursor: returningLoading ? "not-allowed" : "pointer",
                  }}
                  disabled={returningLoading}
                >
                  {returningLoading ? "Checking…" : "Load My Record"}
                </button>

                {returningError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {returningError}
                  </div>
                ) : null}

                <div className="mt-4 flex items-start gap-2 text-xs" style={{ color: BRAND.muted }}>
                  <AlertCircle className="h-4 w-4" />
                  <div>If your student number is not found, please contact the registrar/admin.</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* -----------------------------------------------------
   UI components
----------------------------------------------------- */

function Field({ label, icon: Icon, value, onChange, onBlur, placeholder, error, maxLength, helper, helperTone }) {
  const helperColor = helperTone === "ok" ? "text-emerald-700" : helperTone === "error" ? "text-red-600" : "text-black/50";

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
              border: `1px solid ${error ? BRAND.danger : "rgba(43,26,18,0.22)"}`,
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
        {!error && helper ? <div className={`mt-2 text-xs font-semibold ${helperColor}`}>{helper}</div> : null}
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
              border: `1px solid ${error ? BRAND.danger : "rgba(43,26,18,0.22)"}`,
              opacity: disabled ? 0.75 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
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
          />
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ title, rows, onEdit }) {
  return (
    <div className="rounded-3xl" style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${BRAND.stroke}` }}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          {title}
        </div>
        <button type="button" onClick={onEdit} className="rounded-2xl px-3 py-2 text-xs font-bold border border-black/10 bg-white hover:bg-black/[0.03]">
          Edit
        </button>
      </div>
      <div className="px-5 pb-5">
        <div className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                {k}
              </div>
              <div className="text-xs font-extrabold text-right" style={{ color: BRAND.brown, maxWidth: 520 }}>
                {String(v || "—")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
