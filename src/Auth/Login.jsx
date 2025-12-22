// src/pages/auth/Login.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";

import logo from "../assets/grabsum-logo.png";
import { supabase } from "../lib/supabaseClient"; // ✅ adjust path if needed

const BRAND = {
  bg: "#fbf6ef",
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  link: "#d4a62f",
};

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

function routeForRole(role) {
  const r = (role || "").toLowerCase();

  if (r === "super_admin" || r === "superadmin" || r === "super admin") return "/dev";
  if (r === "admin") return "/admin";
  if (r === "teacher") return "/teacher";
  if (r === "student") return "/student";

  // fallback if role is missing/unknown
  return "/admin";
}

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);

  const [touched, setTouched] = useState({ email: false, pw: false });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!email.trim()) e.email = "Email is required.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";
    if (!pw) e.pw = "Password is required.";
    return e;
  }, [email, pw]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  async function writeLoginLog({ userId, role, emailAddr, success, message }) {
    try {
      // Optional: you can include application_id if you want to distinguish apps
      const applicationId = "grabsum-portal";

      await supabase.from("activity_logs").insert({
        actor_user_id: userId,
        action: success ? "auth.login.success" : "auth.login.failed",
        entity_type: "auth",
        entity_id: userId,
        message: message || (success ? "User logged in" : "Login failed"),
        metadata: { role, email: emailAddr, remember_me: !!remember },
        ip_address: null, // browser can't reliably access client IP (usually)
        user_agent: navigator.userAgent,
        application_id: applicationId,
      });
    } catch {
      // Don’t block login if logging fails
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, pw: true });
    setAuthError("");

    if (!Object.keys(errors).length === 0) return;
    if (!canSubmit) return;

    setLoading(true);

    try {
      // ✅ Supabase auth sign-in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });

      if (error) {
        setAuthError(error.message || "Login failed. Please try again.");
        // If no user, we can't insert actor_user_id; skip log insert
        setLoading(false);
        return;
      }

      const user = data?.user;
      const userId = user?.id;

      if (!userId) {
        setAuthError("Login failed: missing user session.");
        setLoading(false);
        return;
      }

      // ✅ Fetch role from profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, role, is_active")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) {
        setAuthError("Account profile not found. Please contact the administrator.");
        await writeLoginLog({
          userId,
          role: null,
          emailAddr: email.trim(),
          success: false,
          message: "Login succeeded but profile lookup failed",
        });
        setLoading(false);
        return;
      }

      // Optional: block inactive users
      if (profile.is_active === false) {
        setAuthError("Your account is inactive. Please contact the administrator.");
        await writeLoginLog({
          userId,
          role: profile.role,
          emailAddr: profile.email || email.trim(),
          success: false,
          message: "Login blocked: inactive account",
        });

        // sign out to prevent session staying active
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // ✅ (Optional) "Remember me"
      // Supabase manages session persistence automatically in localStorage by default.
      // If you want "Remember me" to *disable* persistence, we can implement custom storage.
      // For now: keep checkbox purely UI (like your current version).

      await writeLoginLog({
        userId,
        role: profile.role,
        emailAddr: profile.email || email.trim(),
        success: true,
        message: "Login successful",
      });

      nav(routeForRole(profile.role));
    } catch (err) {
      setAuthError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen font-[Nunito]" style={{ background: BRAND.bg }}>
      {/* back arrow */}
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition"
      >
        <ArrowLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
      </button>

      <div className="mx-auto max-w-6xl px-6">
        <div className="min-h-screen grid items-center gap-10 lg:grid-cols-2">
          {/* LEFT */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center lg:text-left"
          >
            <div className="mx-auto lg:mx-0 w-fit">
              <img src={logo} alt="Grabsum School logo" className="h-24 w-24 rounded-full object-contain" />
            </div>

            <h1 className="mt-7 text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: BRAND.brown }}>
              Welcome Angelicos!
            </h1>

            <p className="mt-4 max-w-xl mx-auto lg:mx-0 text-base leading-relaxed" style={{ color: BRAND.muted }}>
              Sign in to access your personalized dashboard and
              <br className="hidden md:block" />
              continue your journey with{" "}
              <span className="font-extrabold" style={{ color: BRAND.link }}>
                GRABSUM
              </span>{" "}
              Senior High
              <br className="hidden md:block" />
              School.
            </p>

            <div className="mt-20 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
              © {new Date().getFullYear()} GRABSUM School, Inc. All rights reserved.
            </div>
          </motion.section>

          {/* RIGHT CARD */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 }}
            className="w-full max-w-xl lg:justify-self-end"
          >
            <div
              className="rounded-3xl bg-white"
              style={{
                border: `1px solid ${BRAND.stroke}`,
                boxShadow: "0 14px 34px rgba(43,26,18,0.12)",
              }}
            >
              <form onSubmit={onSubmit} className="p-8 md:p-10">
                {/* Auth error */}
                {authError ? (
                  <div
                    className="mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold"
                    style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)", color: "#b91c1c" }}
                  >
                    {authError}
                  </div>
                ) : null}

                {/* Email */}
                <label className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Email Address
                </label>

                <div className="mt-2">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="your.email@grabsum.edu.ph"
                      autoComplete="username"
                      className="w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition"
                      style={{
                        background: "rgba(251,246,239,0.6)",
                        border: `1px solid ${
                          touched.email && errors.email ? "rgba(239,68,68,0.55)" : "rgba(43,26,18,0.22)"
                        }`,
                        boxShadow: "none",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
                        e.currentTarget.style.background = "rgba(251,246,239,0.85)";
                      }}
                      onBlurCapture={(e) => {
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      disabled={loading}
                    />
                  </div>

                  {touched.email && errors.email ? (
                    <div className="mt-2 text-xs font-semibold text-red-500">{errors.email}</div>
                  ) : null}
                </div>

                {/* Password */}
                <label className="mt-6 block text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Password
                </label>

                <div className="mt-2">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} />
                    <input
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl pl-11 pr-12 py-3 text-sm outline-none transition"
                      style={{
                        background: "rgba(251,246,239,0.6)",
                        border: `1px solid ${
                          touched.pw && errors.pw ? "rgba(239,68,68,0.55)" : "rgba(43,26,18,0.22)"
                        }`,
                        boxShadow: "none",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(212,166,47,0.18)";
                        e.currentTarget.style.background = "rgba(251,246,239,0.85)";
                      }}
                      onBlurCapture={(e) => {
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 hover:bg-black/5 transition"
                      aria-label={show ? "Hide password" : "Show password"}
                      disabled={loading}
                    >
                      {show ? <EyeOff className="h-4 w-4" style={{ color: BRAND.muted }} /> : <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />}
                    </button>
                  </div>

                  {touched.pw && errors.pw ? <div className="mt-2 text-xs font-semibold text-red-500">{errors.pw}</div> : null}
                </div>

                {/* Remember + Forgot */}
                <div className="mt-4 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm" style={{ color: BRAND.muted }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-black/20"
                      disabled={loading}
                    />
                    Remember me
                  </label>

                  <Link to="/forgot-password" className="text-sm hover:underline" style={{ color: BRAND.link }}>
                    Forgot password?
                  </Link>
                </div>

                {/* Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold transition"
                  style={{
                    background: BRAND.gold,
                    color: BRAND.brown,
                    boxShadow: "0 10px 18px rgba(212,166,47,0.28)",
                    opacity: canSubmit ? 1 : 0.65,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    transform: "translateY(0px)",
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
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>

                {/* Bottom link */}
                <div className="mt-8 text-center text-sm" style={{ color: BRAND.muted }}>
                  Don&apos;t have an account?{" "}
                  <Link to="/pre-enroll" className="hover:underline" style={{ color: BRAND.link }}>
                    Pre-enroll here
                  </Link>
                </div>
              </form>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
