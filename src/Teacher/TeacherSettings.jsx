// src/pages/teacher/TeacherSettings.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Save, Shield, Bell, Globe, Lock } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

export default function TeacherSettings() {
  const initial = useMemo(
    () => ({
      fullName: "Ms. Angela Reyes",
      email: "teacher@grabsum.edu.ph",
      phone: "09xx-xxx-xxxx",
      specialization: "Oral Communication, UCSP",
      officeHours: "Mon–Fri 2:30 PM – 4:00 PM",
      emailNotifs: true,
      pushNotifs: true,
      urgentOnly: false,
      language: "English",
      timeFormat: "12hr",
      twoFA: false,
    }),
    []
  );

  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);

  function update(k, v) {
    setS((x) => ({ ...x, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      alert("Saved (UI only). Wire to Supabase later.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Settings
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Profile settings and account preferences
            </div>
          </div>

          <button
            onClick={save}
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card title="Profile Settings" icon={User}>
          <Field label="Full Name">
            <input
              value={s.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Email (locked)">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
                <input
                  value={s.email}
                  disabled
                  className="w-full rounded-2xl border bg-black/5 px-11 py-3 text-sm font-semibold outline-none"
                  style={{ borderColor: BRAND.stroke, color: BRAND.muted }}
                />
              </div>
            </Field>

            <Field label="Phone">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
                <input
                  value={s.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
                  style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
                />
              </div>
            </Field>
          </div>

          <Field label="Specialization / Subjects">
            <input
              value={s.specialization}
              onChange={(e) => update("specialization", e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </Field>

          <Field label="Office Hours">
            <input
              value={s.officeHours}
              onChange={(e) => update("officeHours", e.target.value)}
              className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </Field>
        </Card>

        {/* Notifications */}
        <Card title="Notifications" icon={Bell}>
          <ToggleRow
            label="In-app notifications"
            desc="Receive notifications inside the teacher portal."
            on={s.pushNotifs}
            onToggle={() => update("pushNotifs", !s.pushNotifs)}
          />
          <ToggleRow
            label="Email notifications"
            desc="Receive important updates via email."
            on={s.emailNotifs}
            onToggle={() => update("emailNotifs", !s.emailNotifs)}
          />
          <ToggleRow
            label="Urgent only"
            desc="Notify only for urgent announcements."
            on={s.urgentOnly}
            onToggle={() => update("urgentOnly", !s.urgentOnly)}
          />
        </Card>

        {/* Preferences */}
        <Card title="Preferences" icon={Globe}>
          <SelectRow
            label="Language"
            value={s.language}
            onChange={(v) => update("language", v)}
            options={["English", "Filipino"]}
          />
          <SelectRow
            label="Time format"
            value={s.timeFormat}
            onChange={(v) => update("timeFormat", v)}
            options={["12hr", "24hr"]}
          />
        </Card>

        {/* Security */}
        <Card title="Account Security" icon={Shield}>
          <ToggleRow
            label="Two-factor authentication (2FA)"
            desc="Extra security for your account."
            on={s.twoFA}
            onToggle={() => update("twoFA", !s.twoFA)}
          />

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Change password (use Supabase reset flow)")}
            >
              <Lock className="h-4 w-4" style={{ color: BRAND.muted }} />
              Change Password
            </button>
            <button
              className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={{ background: BRAND.gold, color: BRAND.brown }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
              onClick={() => alert("View login activity (optional later)")}
            >
              Login Activity
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-3xl border bg-white p-5"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
          <Icon className="h-5 w-5" style={{ color: BRAND.muted }} />
        </div>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          {title}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ToggleRow({ label, desc, on, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
      <div>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          {label}
        </div>
        <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
          {desc}
        </div>
      </div>

      <button
        onClick={onToggle}
        className="relative h-8 w-14 rounded-full transition"
        style={{
          background: on ? BRAND.gold : "rgba(43,26,18,0.12)",
          boxShadow: on ? "0 10px 18px rgba(212,166,47,0.18)" : "none",
        }}
        aria-pressed={on}
      >
        <span
          className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white transition"
          style={{ left: on ? "calc(100% - 28px)" : "4px" }}
        />
      </button>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
      <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
        {label}
      </div>
      <div className="mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold outline-none transition focus:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
