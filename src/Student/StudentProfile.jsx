// src/pages/student/StudentProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, User, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

function safeStr(x) {
  return x == null ? "" : String(x);
}

function buildNameFromEnrollment(enr) {
  if (!enr) return "";
  const fn = safeStr(enr.st_fname).trim();
  const mi = safeStr(enr.st_mi).trim();
  const ln = safeStr(enr.st_lname).trim();
  const ext = safeStr(enr.st_ext).trim();
  return [fn, mi ? `${mi}.` : "", ln, ext].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export default function StudentProfile() {
  const initial = useMemo(
    () => ({
      // display-only
      studentId: "",
      gradeLevel: "—",
      track: "—",
      strand: "—",
      // editable
      fullName: "",
      email: "",
      address: "",
      guardianName: "",
      guardianContact: "",
      // internal (minimal)
      _enrollment_id: null,
    }),
    []
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  function update(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrMsg("");

      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = authRes?.user;
        if (!user?.id) throw new Error("Not logged in.");

        // enrollment: latest non-archived for this user
        const { data: enr, error: enrErr } = await supabase
          .from("enrollment")
          .select(`
            id,
            st_number,
            st_email,
            st_fname,
            st_lname,
            st_mi,
            st_ext,
            st_current_address,
            st_guardian_name,
            st_guardian_contact,
            grade_id,
            track_id,
            strand_id,
            is_archived
          `)
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrErr) throw enrErr;
        if (!enr) throw new Error("Enrollment record not found. Please contact the administrator.");

        // lookups (optional; skip if ids are null)
        const [gradeRes, trackRes, strandRes] = await Promise.all([
          enr.grade_id
            ? supabase.from("grade_levels").select("grade_level").eq("grade_id", enr.grade_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          enr.track_id
            ? supabase.from("tracks").select("track_code").eq("track_id", enr.track_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          enr.strand_id
            ? supabase.from("strands").select("strand_code").eq("strand_id", enr.strand_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (gradeRes?.error) throw gradeRes.error;
        if (trackRes?.error) throw trackRes.error;
        if (strandRes?.error) throw strandRes.error;

        const gradeLabel = gradeRes?.data?.grade_level ? `Grade ${gradeRes.data.grade_level}` : "—";
        const trackLabel = trackRes?.data?.track_code ?? "—";
        const strandLabel = strandRes?.data?.strand_code ?? "—";

        const fullName = buildNameFromEnrollment(enr) || "—";
        const email = safeStr(enr.st_email || user.email);

        if (!mounted) return;

        setForm({
          studentId: safeStr(enr.st_number),
          gradeLevel: gradeLabel,
          track: trackLabel,
          strand: strandLabel,
          fullName,
          email,
          address: safeStr(enr.st_current_address || ""),
          guardianName: safeStr(enr.st_guardian_name || ""),
          guardianContact: safeStr(enr.st_guardian_contact || ""),
          _enrollment_id: enr.id,
        });
      } catch (e) {
        if (!mounted) return;
        setErrMsg(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [initial]);

  async function onSave() {
    setSaving(true);
    setErrMsg("");

    try {
      if (!form._enrollment_id) throw new Error("No enrollment record found. Contact admin.");

      const now = new Date().toISOString();

      // Update only editable fields in enrollment
      const { error: upErr } = await supabase
        .from("enrollment")
        .update({
          // If you want full name editable, you can split it into fname/lname/mi/ext.
          // For now, we'll save only address + guardian info (safe & simple).
          st_current_address: form.address,
          st_guardian_name: form.guardianName,
          st_guardian_contact: form.guardianContact,
          st_updated_at: now,
          updated_at: now,
        })
        .eq("id", form._enrollment_id);

      if (upErr) throw upErr;

      alert("Saved successfully.");
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white p-5" style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          Loading profile…
        </div>
        <div className="mt-2 text-xs font-semibold" style={{ color: BRAND.muted }}>
          Please wait.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Profile
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Update your contact and guardian information
            </div>

            {errMsg ? (
              <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {errMsg}
              </div>
            ) : null}
          </div>

      
        </div>
      </motion.div>

      {/* Body */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Left summary (no avatar image) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-3xl" style={{ background: BRAND.softGoldBg }}>
              <User className="h-8 w-8" style={{ color: BRAND.muted }} />
            </div>

            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                {form.fullName || "—"}
              </div>
              <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                Student ID: <span style={{ color: BRAND.brown }}>{form.studentId || "—"}</span>
              </div>
              <div
                className="mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold"
                style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
              >
                {form.gradeLevel} • {form.track}
                {form.strand && form.strand !== "—" ? ` • ${form.strand}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm" style={{ color: BRAND.muted }}>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{form.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{form.address || "—"}</span>
            </div>
          </div>
        </motion.div>

        {/* Right form (only necessary + editable) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Contact Information
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            You can update your address and guardian details
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Full Name" locked>
              <input
                value={form.fullName}
                disabled
                className="w-full rounded-2xl border bg-black/5 px-4 py-3 text-sm outline-none"
                style={{ borderColor: BRAND.stroke, color: BRAND.muted }}
              />
            </Field>

            <Field label="Student ID" locked>
              <input
                value={form.studentId}
                disabled
                className="w-full rounded-2xl border bg-black/5 px-4 py-3 text-sm outline-none"
                style={{ borderColor: BRAND.stroke, color: BRAND.muted }}
              />
            </Field>

            <Field label="Email" locked>
              <input
                value={form.email}
                disabled
                className="w-full rounded-2xl border bg-black/5 px-4 py-3 text-sm outline-none"
                style={{ borderColor: BRAND.stroke, color: BRAND.muted }}
              />
            </Field>

            <Field label="Address" wide>
              <input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
            </Field>
          </div>

          <div className="mt-6 text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Guardian Information
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Guardian Name">
              <input
                value={form.guardianName}
                onChange={(e) => update("guardianName", e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
            </Field>

            <Field label="Guardian Contact">
              <input
                value={form.guardianContact}
                onChange={(e) => update("guardianContact", e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
            </Field>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, children, locked, wide }) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <div className="text-xs font-semibold" style={{ color: "rgba(43,26,18,0.55)" }}>
        {label} {locked ? <span className="ml-1 text-[10px] font-extrabold">(locked)</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}
