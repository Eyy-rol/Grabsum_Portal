// src/pages/student/StudentProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Mail, Phone, MapPin, User, Shield, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient"; // ✅ adjust if needed

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

export default function StudentProfile() {
  const initial = useMemo(
    () => ({
      studentId: "",
      fullName: "",
      gradeLevel: "—",
      section: "—",
      program: "—",
      email: "",
      address: "",
      guardianName: "",
      guardianContact: "",
      // internal ids
      _user_id: "",
      _enrollment_id: null,
      _status: null,
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

  // ✅ LOAD from students + enrollment (+ optional profiles)
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrMsg("");

      try {
        // 1) Auth user
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = authRes?.user;
        if (!user?.id) throw new Error("Not logged in.");

        const user_id = user.id;

        // 2) students row (primary source for student_number + email + academic ids)
        const { data: stu, error: stuErr } = await supabase
          .from("students")
          .select(
            "id, user_id, enrollment_id, student_number, email, first_name, last_name, middle_initial, extension, grade_id, track_id, strand_id, section_id, sy_id, status"
          )
          .eq("user_id", user_id)
          .maybeSingle();

        if (stuErr) throw stuErr;
        if (!stu) throw new Error("Student record not found. Contact admin.");

        // 3) enrollment row (guardian + address usually lives here)
        let enr = null;
        if (stu.enrollment_id) {
          const { data: enrRow, error: enrErr } = await supabase
            .from("enrollment")
            .select("id, st_current_address, st_guardian_name, st_guardian_contact")
            .eq("id", stu.enrollment_id)
            .maybeSingle();
          if (enrErr) throw enrErr;
          enr = enrRow;
        }

        // 4) Lookups for display text
        const [gradeRes, sectionRes, trackRes, strandRes, syRes] = await Promise.all([
          stu.grade_id
            ? supabase
                .from("grade_levels")
                .select("grade_level")
                .eq("grade_id", stu.grade_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          stu.section_id
            ? supabase
                .from("sections")
                .select("section_name")
                .eq("section_id", stu.section_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          stu.track_id
            ? supabase
                .from("tracks")
                .select("track_code")
                .eq("track_id", stu.track_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          stu.strand_id
            ? supabase
                .from("strands")
                .select("strand_code")
                .eq("strand_id", stu.strand_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),

          // ✅ FIX: your table has sy_code, NOT school_year
          stu.sy_id
            ? supabase
                .from("school_years")
                .select("sy_code, start_date, end_date, status")
                .eq("sy_id", stu.sy_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (gradeRes?.error) throw gradeRes.error;
        if (sectionRes?.error) throw sectionRes.error;
        if (trackRes?.error) throw trackRes.error;
        if (strandRes?.error) throw strandRes.error;
        if (syRes?.error) throw syRes.error;

        const gradeLabel = gradeRes?.data?.grade_level
          ? `Grade ${gradeRes.data.grade_level}`
          : "—";

        const sectionLabel = sectionRes?.data?.section_name ?? "—";
        const trackLabel = trackRes?.data?.track_code ?? "—";
        const strandLabel = strandRes?.data?.strand_code ?? "";

        // 5) Optional profiles (full_name + phone + flags)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, is_active, is_archived, role")
          .eq("user_id", user_id)
          .maybeSingle();

        if (profErr) throw profErr;

        // Full name fallback if profiles.full_name missing
        const fromStudentsName = [
          safeStr(stu.first_name),
          safeStr(stu.middle_initial ? `${stu.middle_initial}.` : ""),
          safeStr(stu.last_name),
          safeStr(stu.extension),
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        const fullName = safeStr(prof?.full_name) || fromStudentsName || "—";

        // school year label (use sy_code, or derive from dates)
        const sy = syRes?.data;
        const syLabel = safeStr(sy?.sy_code || "");
        const syStatus = safeStr(sy?.status || "");

        if (!mounted) return;

        setForm({
          studentId: safeStr(stu.student_number),
          fullName,
          gradeLevel: gradeLabel,
          section: sectionLabel,
          program: strandLabel ? `${trackLabel} • ${strandLabel}` : trackLabel,
          email: safeStr(stu.email || user.email),
          
          address: safeStr(enr?.st_current_address || ""),
          guardianName: safeStr(enr?.st_guardian_name || ""),
          guardianContact: safeStr(enr?.st_guardian_contact || ""),
          _user_id: user_id,
          _enrollment_id: stu.enrollment_id ?? null,
          _status: {
            is_active: prof?.is_active ?? true,
            is_archived: prof?.is_archived ?? false,
            role: safeStr(prof?.role || "student"),
            sy: syLabel,
            sy_status: syStatus,
          },
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

  // ✅ SAVE (optional) — if students should be READ ONLY, disable this in UI
  async function onSave() {
    setSaving(true);
    setErrMsg("");

    try {
      if (!form._user_id) throw new Error("Missing user. Please login again.");
      if (!form._enrollment_id) throw new Error("No enrollment record linked. Contact admin.");

      // Update enrollment fields
      const { error: enrUpErr } = await supabase
        .from("enrollment")
        .update({
          st_current_address: form.address,
          st_guardian_name: form.guardianName,
          st_guardian_contact: form.guardianContact,
          st_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", form._enrollment_id);

      if (enrUpErr) throw enrUpErr;

      // Optional: update profile phone/full_name if your schema allows student edits
      const profPatch = {
        full_name: form.fullName,
        phone: form.phone,
        updated_at: new Date().toISOString(),
      };

      const { error: profUpErr } = await supabase
        .from("profiles")
        .update(profPatch)
        .eq("user_id", form._user_id);

      if (profUpErr) throw profUpErr;

      alert("Saved successfully.");
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const accountStatusText = useMemo(() => {
    const s = form._status;
    if (!s) return "—";
    if (s.is_archived) return "Archived";
    if (!s.is_active) return "Disabled";
    return "Active";
  }, [form._status]);

  const schoolYearText = useMemo(() => {
    const s = form._status;
    if (!s?.sy) return "School Year: —";
    return `School Year ${s.sy}${s.sy_status ? ` (${s.sy_status})` : ""}`;
  }, [form._status]);

  if (loading) {
    return (
      <div
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
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
              View and update your student information
            </div>

            {errMsg ? (
              <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {errMsg}
              </div>
            ) : null}
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
            type="button"
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
                type="button"
              >
                <Camera className="h-4 w-4" style={{ color: BRAND.muted }} />
              </button>
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
                {form.gradeLevel} • {form.section}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm" style={{ color: BRAND.muted }}>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{form.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{form.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{form.address || "—"}</span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: BRAND.stroke }}>
            <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: BRAND.brown }}>
              <Shield className="h-5 w-5" style={{ color: BRAND.muted }} />
              Account Status
            </div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              {accountStatusText} • {schoolYearText}
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
