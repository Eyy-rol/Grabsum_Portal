// src/pages/student/StudentSettings.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Mail, Shield, Globe, Clock, Save } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

export default function StudentSettings() {
  const initial = useMemo(
    () => ({
      emailNotifs: true,
      pushNotifs: true,
      announcementOnlyUrgent: false,
      timeFormat: "12hr",
      dateFormat: "MMM DD, YYYY",
      language: "English",
      twoFactor: false,
    }),
    []
  );

  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);

  function toggle(k) {
    setS((x) => ({ ...x, [k]: !x[k] }));
  }

  async function onSave() {
    setSaving(true);
    try {
      // TODO: persist settings (table or user_metadata)
      await new Promise((r) => setTimeout(r, 650));
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
              Settings
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Notifications, preferences, and account security
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>

      {/* Settings cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Notifications" icon={Bell}>
          <ToggleRow
            label="In-app notifications"
            desc="Receive notifications inside the portal."
            on={s.pushNotifs}
            onToggle={() => toggle("pushNotifs")}
          />
          <ToggleRow
            label="Email notifications"
            desc="Receive important updates via email."
            on={s.emailNotifs}
            onToggle={() => toggle("emailNotifs")}
          />
          <ToggleRow
            label="Urgent announcements only"
            desc="Only notify when announcements are urgent."
            on={s.announcementOnlyUrgent}
            onToggle={() => toggle("announcementOnlyUrgent")}
          />
        </Card>

        <Card title="Account Security" icon={Shield}>
          <ToggleRow
            label="Two-factor authentication (2FA)"
            desc="Extra protection for your account."
            on={s.twoFactor}
            onToggle={() => toggle("twoFactor")}
          />

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <button
              className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Change password via Supabase reset flow")}
            >
              Change Password
            </button>
            <button
              className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Show login history later (optional)")}
            >
              Login History
            </button>
          </div>
        </Card>

        <Card title="Preferences" icon={Globe}>
          <SelectRow
            label="Language"
            value={s.language}
            onChange={(v) => setS((x) => ({ ...x, language: v }))}
            options={["English", "Filipino"]}
          />
          <SelectRow
            label="Date format"
            value={s.dateFormat}
            onChange={(v) => setS((x) => ({ ...x, dateFormat: v }))}
            options={["MMM DD, YYYY", "DD MMM YYYY", "YYYY-MM-DD"]}
          />
          <SelectRow
            label="Time format"
            value={s.timeFormat}
            onChange={(v) => setS((x) => ({ ...x, timeFormat: v }))}
            options={["12hr", "24hr"]}
          />
        </Card>

        <Card title="Contact Preferences" icon={Mail}>
          <div className="text-sm" style={{ color: BRAND.muted }}>
            Choose how the school can reach you (demo UI only).
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <button
              className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Update email requires Supabase auth email change flow")}
            >
              Update Email
            </button>
            <button
              className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              onClick={() => alert("Update phone in profiles table")}
            >
              Update Phone
            </button>
          </div>
        </Card>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: BRAND.brown }}>
          <Clock className="h-5 w-5" style={{ color: BRAND.muted }} />
          Tip
        </div>
        <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
          When you wire this to Supabase, you can store settings either in a dedicated{" "}
          <span style={{ color: BRAND.brown, fontWeight: 800 }}>settings</span> table or in{" "}
          <span style={{ color: BRAND.brown, fontWeight: 800 }}>profiles</span> as JSON fields.
        </div>
      </motion.div>
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
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}

function ToggleRow({ label, desc, on, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border p-4"
         style={{ borderColor: BRAND.stroke }}>
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
