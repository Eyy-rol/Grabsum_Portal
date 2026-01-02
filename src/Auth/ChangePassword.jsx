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
      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;
      if (!s.session) throw new Error("No active session. Please log in again.");

      const accessToken = s.session.access_token;

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/super-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`, // ✅ required for change_password
        },
        body: JSON.stringify({
          action: "change_password",
          new_password: pw1,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to change password.");

      setMsg("Password changed successfully. Redirecting to login...");
      await supabase.auth.signOut();
      nav("/login", { replace: true });
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || String(e2));
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
            autoComplete="new-password"
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
            autoComplete="new-password"
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
