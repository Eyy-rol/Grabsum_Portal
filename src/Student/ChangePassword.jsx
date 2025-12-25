import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ChangePassword() {
  const nav = useNavigate();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!pw1 || pw1.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw1 !== pw2) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      // 1) Update auth password
      const { data: u, error: passErr } = await supabase.auth.updateUser({ password: pw1 });
      if (passErr) return setErr(passErr.message || "Failed to update password.");

      const userId = u?.user?.id;
      if (!userId) return setErr("Missing session user.");

      // 2) Update profile flags (must_change_password -> false)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (profErr) return setErr(profErr.message || "Password updated, but failed updating profile flags.");

      setMsg("Password changed successfully. Redirecting...");
      setTimeout(() => nav("/student"), 800);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-2xl border border-black/10 p-6">
        <h1 className="text-lg font-extrabold">Change Password</h1>
        <p className="text-sm text-black/60">
          For security, you must change your temporary password before continuing.
        </p>

        {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}
        {msg ? <div className="text-sm font-semibold text-green-700">{msg}</div> : null}

        <div>
          <label className="text-sm font-semibold">New password</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2"
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Confirm new password</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-black text-white py-2 font-bold disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
