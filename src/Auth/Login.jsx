// src/pages/auth/Login.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";

import logo from "../assets/grabsum-logo.png";
import { supabase } from "../lib/supabaseClient";

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

function isStudentNumber(v) {
  return /^s\d{2}-\d{4}$/i.test(String(v).trim());
}

function isTeacherNumber(v) {
  return /^t\d{2}-\d{4}$/i.test(String(v).trim());
}

// employee_number -> internal auth email (same rule used in create-teacher edge fn)
function teacherAuthEmail(empNo) {
  return `${String(empNo).trim().toLowerCase()}@teachers.local`;
}

function routeForRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "teacher") return "/teacher/dashboard";
  if (r === "student") return "/student/dashboard";
  if (r === "super_admin") return "/admin";
  if (r === "dev") return "/dev";
  return "/login";
}

export default function Login() {
  const nav = useNavigate();

  const [ident, setIdent] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  const [touched, setTouched] = useState({ ident: false, pw: false });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    const x = ident.trim();

    if (!x) e.ident = "Email, Student Number, or Teacher Number is required.";
    else if (!isEmail(x) && !isStudentNumber(x) && !isTeacherNumber(x)) {
      e.ident = "Enter a valid email or number (S25-0001 / T25-0001).";
    }

    if (!pw) e.pw = "Password is required.";
    return e;
  }, [ident, pw]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  async function loginByStudentNumber(studentNumber, password) {
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
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "login_student",
        student_number: studentNumber,
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Login failed.");

    const access_token = data?.session?.access_token;
    const refresh_token = data?.session?.refresh_token;

    if (!access_token || !refresh_token) {
      throw new Error("Login failed: missing session tokens from Edge.");
    }

    const { data: sessData, error: setErr } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setErr) throw new Error(setErr.message || "Failed to set session.");
    return sessData?.user;
  }

  async function fetchProfile(userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, role, is_active, is_archived, must_change_password")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("fetchProfile error:", error);
      throw error;
    }

    return profile;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ ident: true, pw: true });
    setAuthError("");

    if (!canSubmit) return;
    setLoading(true);

    try {
      const x = ident.trim();

      // ✅ A) student number login (S25-0001)
      if (isStudentNumber(x)) {
        const user = await loginByStudentNumber(x.toUpperCase(), pw);

        if (!user?.id) {
          setAuthError("Login failed: missing user session.");
          return;
        }

        const profile = await fetchProfile(user.id);
        if (!profile) {
          setAuthError("Account profile not found. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if (profile.is_archived === true) {
          setAuthError("Your account is archived. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if (profile.is_active === false) {
          setAuthError("Your account is inactive. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if ((profile.role || "").toLowerCase() === "student" && profile.must_change_password) {
          nav("/student/change-password", { replace: true });
          return;
        }

        nav(routeForRole(profile.role), { replace: true });
        return;
      }

      // ✅ A2) teacher username login (T25-0001)
      if (isTeacherNumber(x)) {
        const email = teacherAuthEmail(x);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });

        if (error) {
          setAuthError(error.message || "Login failed. Please try again.");
          return;
        }

        const userId = data?.user?.id;
        if (!userId) {
          setAuthError("Login failed: missing user session.");
          return;
        }

        const profile = await fetchProfile(userId);
        if (!profile) {
          setAuthError("Account profile not found. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if (profile.is_archived === true) {
          setAuthError("Your account is archived. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if (profile.is_active === false) {
          setAuthError("Your account is inactive. Please contact the administrator.");
          await supabase.auth.signOut();
          return;
        }

        if ((profile.role || "").toLowerCase() === "teacher" && profile.must_change_password) {
          nav("/teacher/change-password", { replace: true });
          return;
        }

        nav(routeForRole(profile.role), { replace: true });
        return;
      }

      // ✅ B) email login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: x.toLowerCase(),
        password: pw,
      });

      if (error) {
        setAuthError(error.message || "Login failed. Please try again.");
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        setAuthError("Login failed: missing user session.");
        return;
      }

      const profile = await fetchProfile(userId);
      if (!profile) {
        setAuthError("Account profile not found. Please contact the administrator.");
        await supabase.auth.signOut();
        return;
      }

      if (profile.is_archived === true) {
        setAuthError("Your account is archived. Please contact the administrator.");
        await supabase.auth.signOut();
        return;
      }

      if (profile.is_active === false) {
        setAuthError("Your account is inactive. Please contact the administrator.");
        await supabase.auth.signOut();
        return;
      }

      // ✅ force-change based on role
      const role = (profile.role || "").toLowerCase();
      if (role === "student" && profile.must_change_password) {
        nav("/student/change-password", { replace: true });
        return;
      }
      if (role === "teacher" && profile.must_change_password) {
        nav("/teacher/change-password", { replace: true });
        return;
      }

      nav(routeForRole(profile.role), { replace: true });
    } catch (err) {
      setAuthError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "w-full rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none transition disabled:opacity-70";
  const inputShell =
    "relative rounded-2xl bg-white/60 backdrop-blur border transition focus-within:ring-4";

  return (
    <div
      className="min-h-screen font-[Nunito]"
      style={{
        background: `radial-gradient(1200px 800px at 20% 10%, rgba(212,166,47,0.10), transparent 55%),
                     radial-gradient(1200px 800px at 90% 30%, rgba(43,26,18,0.07), transparent 60%),
                     ${BRAND.bg}`,
      }}
    >
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        className="absolute left-6 top-6 grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition"
      >
        <ArrowLeft className="h-5 w-5" style={{ color: BRAND.muted }} />
      </button>

      <div className="mx-auto max-w-5xl px-6">
        <div className="min-h-screen grid items-center gap-10 lg:grid-cols-2">
          {/* Left / Brand */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center lg:text-left"
          >
            <div className="mx-auto lg:mx-0 w-fit">
   <div className="lg:max-w-md">
  <div className="mx-auto lg:mx-0 lg:flex lg:justify-center lg:translate-x-1">
    <img
      src={logo}
      alt="Grabsum School logo"
      className="h-28 w-28 md:h-32 md:w-32 object-contain"
      style={{
        filter: "drop-shadow(0 8px 18px rgba(43,26,18,0.18))",
      }}
    />
  </div>
</div>


            </div>

            <h1 className="mt-6 text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: BRAND.brown }}>
              Welcome Angelicos!
            </h1>

            <p className="mt-3 max-w-xl mx-auto lg:mx-0 text-sm leading-relaxed" style={{ color: BRAND.muted }}>
              Sign in using <b>Email</b>, <b>Student Number</b> (S25-0001), or <b>Teacher Number</b> (T25-0001).
            </p>

            <div className="mt-10 hidden lg:block">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                style={{
                  border: `1px solid ${BRAND.stroke}`,
                  background: "rgba(255,255,255,0.55)",
                  color: "rgba(43,26,18,0.65)",
                }}
              >
               Role Based Access • GRABSUM School
              </div>
            </div>

            <div className="mt-10 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
              © {new Date().getFullYear()} GRABSUM School, Inc. All righfts reserved.
            </div>
          </motion.section>

          {/* Right / Card */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 }}
            className="w-full max-w-xl lg:justify-self-end"
          >
            <div
              className="rounded-3xl bg-white/70 backdrop-blur"
              style={{
                border: `1px solid ${BRAND.stroke}`,
                boxShadow: "0 18px 55px rgba(43,26,18,0.10)",
              }}
            >
              <form onSubmit={onSubmit} className="p-7 md:p-10">
                <div className="mb-7">
                  <div className="text-xl font-extrabold tracking-tight" style={{ color: BRAND.brown }}>
                    Sign in
                  </div>
                  <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                    Use your credentials to continue.
                  </div>
                </div>

                {authError ? (
                  <div
                    className="mb-5 rounded-2xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: "rgba(239,68,68,0.28)",
                      background: "rgba(239,68,68,0.06)",
                      color: "#b91c1c",
                    }}
                  >
                    <span className="font-semibold">Sign-in failed.</span> {authError}
                  </div>
                ) : null}

                {/* Identifier */}
                <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: "rgba(43,26,18,0.70)" }}>
                  Email / Student / Teacher No.
                </label>

                <div className="mt-2">
                  <div
                    className={`${inputShell}`}
                    style={{
                      borderColor: touched.ident && errors.ident ? "rgba(239,68,68,0.40)" : "rgba(43,26,18,0.14)",
                      ringColor: "rgba(212,166,47,0.25)",
                    }}
                  >
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} />
                    <input
                      value={ident}
                      onChange={(e) => setIdent(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, ident: true }))}
                      placeholder="your.email@grabsum.edu.ph or S25-0001 or T25-0001"
                      className={inputBase}
                      style={{
                        background: "transparent",
                        color: BRAND.brown,
                      }}
                      disabled={loading}
                      autoComplete="username"
                    />
                  </div>

                  {touched.ident && errors.ident ? (
                    <div className="mt-2 text-xs font-semibold text-red-500">{errors.ident}</div>
                  ) : null}
                </div>

                {/* Password */}
                <label
                  className="mt-5 block text-xs font-semibold tracking-wide uppercase"
                  style={{ color: "rgba(43,26,18,0.70)" }}
                >
                  Password
                </label>

                <div className="mt-2">
                  <div
                    className={`${inputShell}`}
                    style={{
                      borderColor: touched.pw && errors.pw ? "rgba(239,68,68,0.40)" : "rgba(43,26,18,0.14)",
                    }}
                  >
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND.muted }} />
                    <input
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      className={`${inputBase} pr-12`}
                      style={{ background: "transparent", color: BRAND.brown }}
                      disabled={loading}
                      autoComplete="current-password"
                    />

                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 hover:bg-black/5 transition"
                      aria-label={show ? "Hide password" : "Show password"}
                      disabled={loading}
                    >
                      {show ? (
                        <EyeOff className="h-4 w-4" style={{ color: BRAND.muted }} />
                      ) : (
                        <Eye className="h-4 w-4" style={{ color: BRAND.muted }} />
                      )}
                    </button>
                  </div>

                  {touched.pw && errors.pw ? (
                    <div className="mt-2 text-xs font-semibold text-red-500">{errors.pw}</div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs" style={{ color: "rgba(43,26,18,0.55)" }}>
                    Tip: S25-0001 / T25-0001
                  </div>

          
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-6 w-full rounded-2xl py-3.5 text-sm font-semibold transition active:scale-[0.99]"
                  style={{
                    background: canSubmit ? BRAND.gold : "rgba(212,166,47,0.55)",
                    color: BRAND.brown,
                    boxShadow: canSubmit ? "0 12px 22px rgba(212,166,47,0.22)" : "none",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                  onMouseEnter={(e) => {
                    if (!canSubmit) return;
                    e.currentTarget.style.background = BRAND.goldHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!canSubmit) return;
                    e.currentTarget.style.background = BRAND.gold;
                  }}
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>

                <div className="mt-7 text-center text-sm" style={{ color: BRAND.muted }}>
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
