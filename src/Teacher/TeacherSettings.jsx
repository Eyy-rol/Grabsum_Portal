import React, { useEffect, useMemo, useState } from "react";
import { Save, RefreshCcw, User2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function clsx(...a) {
  return a.filter(Boolean).join(" ");
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[12px] font-semibold text-black/60">{label}</label>
        {hint ? <span className="text-[11px] font-semibold text-black/35">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, disabled, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={clsx(
        "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-black",
        "border-black/10 placeholder:text-black/30",
        "outline-none transition",
        "focus:border-black/20 focus:ring-4 focus:ring-black/5",
        "disabled:opacity-60 disabled:bg-black/[0.02]"
      )}
    />
  );
}

export default function TeacherSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [teacher, setTeacher] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    department: "",
    position: "",
  });

  function patch(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const dirty = useMemo(() => {
    if (!teacher) return false;
    return (
      (teacher.first_name || "") !== form.first_name ||
      (teacher.last_name || "") !== form.last_name ||
      (teacher.email || "") !== form.email ||
      (teacher.contact_number || "") !== form.contact_number ||
      (teacher.department || "") !== form.department ||
      (teacher.position || "") !== form.position
    );
  }, [teacher, form]);

  async function load() {
    setLoading(true);
    setErrMsg("");
    setOkMsg("");

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = auth?.user;
      if (!user) throw new Error("Not authenticated.");

      const { data, error } = await supabase
        .from("teachers")
        .select(
          `
          user_id,
          first_name,
          last_name,
          email,
          contact_number,
          department,
          position,
          status
        `
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Teacher record not found.");

      setTeacher(data);
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        contact_number: data.contact_number || "",
        department: data.department || "",
        position: data.position || "",
      });
    } catch (e) {
      setErrMsg(String(e?.message || e));
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setErrMsg("");
    setOkMsg("");

    try {
      if (!teacher?.user_id) throw new Error("No teacher loaded.");

      if (!form.first_name.trim()) throw new Error("First name is required.");
      if (!form.last_name.trim()) throw new Error("Last name is required.");

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        contact_number: form.contact_number.trim() || null,
        department: form.department.trim() || null,
        position: form.position.trim() || null,
      };

      const { error } = await supabase
        .from("teachers")
        .update(payload)
        .eq("user_id", teacher.user_id);

      if (error) throw error;

      setOkMsg("Saved successfully.");
      await load();
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-black/10 bg-white">
              <User2 className="h-5 w-5 text-black/60" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-[#2b1a12]">Teacher Settings</div>
              <div className="text-xs font-semibold text-black/45">
                Basic profile information only
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={loading || saving}
            className={clsx(
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-extrabold transition",
              "border-black/10 bg-white text-black/70 hover:bg-black/[0.03]",
              "disabled:opacity-60"
            )}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <button
            onClick={save}
            disabled={loading || saving || !dirty}
            className={clsx(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold transition",
              "bg-[#e7aa2f] text-black hover:opacity-90",
              "disabled:opacity-60"
            )}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {errMsg}
        </div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {okMsg}
        </div>
      ) : null}

      {/* Main Card */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
        <div className="grid gap-5 md:grid-cols-2">
          {/* Left */}
          <div className="space-y-4">
            <div className="text-sm font-extrabold text-[#2b1a12]">Personal</div>

            <Field label="First name" hint="required">
              <Input
                value={form.first_name}
                onChange={(e) => patch("first_name", e.target.value)}
                placeholder="e.g., Juan"
                disabled={loading}
              />
            </Field>

            <Field label="Last name" hint="required">
              <Input
                value={form.last_name}
                onChange={(e) => patch("last_name", e.target.value)}
                placeholder="e.g., Dela Cruz"
                disabled={loading}
              />
            </Field>

            <Field label="Email" hint="optional">
              <Input
                value={form.email}
                onChange={(e) => patch("email", e.target.value)}
                placeholder="e.g., teacher@email.com"
                disabled={loading}
                type="email"
              />
            </Field>

            <Field label="Contact number" hint="optional">
              <Input
                value={form.contact_number}
                onChange={(e) => patch("contact_number", e.target.value)}
                placeholder="e.g., 09xxxxxxxxx"
                disabled={loading}
              />
            </Field>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <div className="text-sm font-extrabold text-[#2b1a12]">Work</div>

            <Field label="Department" hint="optional">
              <Input
                value={form.department}
                onChange={(e) => patch("department", e.target.value)}
                placeholder="e.g., English Department"
                disabled={loading}
              />
            </Field>

            <Field label="Position" hint="optional">
              <Input
                value={form.position}
                onChange={(e) => patch("position", e.target.value)}
                placeholder="e.g., Subject Teacher"
                disabled={loading}
              />
            </Field>

            {/* Status chip */}
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="text-[12px] font-semibold text-black/50">Status</div>
              <div className="mt-2 inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-extrabold text-black/70">
                {teacher?.status || "—"}
              </div>

              <div className="mt-3 text-[11px] font-semibold text-black/35">
                User ID: <span className="font-mono">{teacher?.user_id || "—"}</span>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-black/35">
              Only your own teacher profile can be edited.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
