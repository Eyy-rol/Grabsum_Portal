// src/pages/student/StudentProfile.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Mail, Phone, MapPin, User, Shield, Save } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

export default function StudentProfile() {
  // Demo profile (replace with Supabase profiles)
  const initial = useMemo(
    () => ({
      studentId: "24-000123",
      fullName: "Juan Dela Cruz",
      gradeLevel: "Grade 11",
      section: "STEM-A",
      program: "STEM",
      email: "juan.delacruz@grabsum.edu.ph",
      phone: "09XX-XXX-XXXX",
      address: "Lucena City, Quezon",
      guardianName: "Maria Dela Cruz",
      guardianContact: "09XX-XXX-XXXX",
    }),
    []
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function update(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSave() {
    setSaving(true);
    try {
      // TODO: Supabase update profiles
      await new Promise((r) => setTimeout(r, 700));
      alert("Saved (UI only). Hook to Supabase later.");
    } finally {
      setSaving(false);
    }
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
              View and update your student information
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition disabled:opacity-60"
            style={{
              background: BRAND.gold,
              color: BRAND.brown,
              boxShadow: "0 10px 18px rgba(212,166,47,0.24)",
            }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.background = BRAND.goldHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* Body */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Left card (avatar) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="grid h-20 w-20 place-items-center rounded-3xl"
                style={{ background: BRAND.softGoldBg }}
              >
                <User className="h-8 w-8" style={{ color: BRAND.muted }} />
              </div>
              <button
                className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-2xl border bg-white hover:bg-black/5 transition"
                style={{ borderColor: BRAND.stroke }}
                onClick={() => alert("Upload avatar later (wire to Supabase Storage)")}
                aria-label="Upload profile photo"
              >
                <Camera className="h-4 w-4" style={{ color: BRAND.muted }} />
              </button>
            </div>

            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                {form.fullName}
              </div>
              <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                Student ID: <span style={{ color: BRAND.brown }}>{form.studentId}</span>
              </div>
              <div className="mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold"
                   style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
                {form.gradeLevel} • {form.section}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm" style={{ color: BRAND.muted }}>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{form.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{form.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{form.address}</span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
            <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: BRAND.brown }}>
              <Shield className="h-5 w-5" style={{ color: BRAND.muted }} />
              Account Status
            </div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              Active • School Year 2025–2026 (Demo)
            </div>
          </div>
        </motion.div>

        {/* Right form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl border bg-white p-5"
          style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
        >
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Personal Information
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
            Update contact details and guardian information
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Full Name">
              <input
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
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

            <Field label="Contact Number">
              <input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
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
