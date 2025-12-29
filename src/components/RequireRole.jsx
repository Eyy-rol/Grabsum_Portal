import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function routeForRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "teacher") return "/teacher/dashboard";
  if (r === "student") return "/student/dashboard";
  if (r === "dev") return "/dev";
  return "/login";
}

export default function RequireRole({ allow = [] }) {
  const loc = useLocation();
  const allowSet = useMemo(() => new Set(allow.map((x) => String(x).toLowerCase())), [allow]);

  const [state, setState] = useState({
    loading: true,
    ok: false,
    role: null,
    mustChange: false,
    authed: false,
  });

  useEffect(() => {
    let alive = true;
    let running = false;

    const setSafe = (next) => {
      if (!alive) return;
      setState(next);
    };

    async function run(reason = "manual") {
      if (running) return;
      running = true;

      try {
        // ✅ Fast/local session check first
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
        const session = sessionData?.session;
        const user = session?.user;

        if (sessErr || !user) {
          setSafe({ loading: false, ok: false, role: null, mustChange: false, authed: false });
          running = false;
          return;
        }

        // ✅ Fetch profile (make sure profiles has SELECT policy for authenticated)
        const { data: prof, error } = await supabase
          .from("profiles")
          .select("role, is_active, is_archived, must_change_password")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error || !prof) {
          setSafe({ loading: false, ok: false, role: null, mustChange: false, authed: true });
          running = false;
          return;
        }

        const role = (prof.role || "").toLowerCase();
        const mustChange = prof.must_change_password === true;

        // Locked / archived users
        if (!prof.is_active || prof.is_archived) {
          await supabase.auth.signOut();
          setSafe({ loading: false, ok: false, role: null, mustChange: false, authed: false });
          running = false;
          return;
        }

        // Force password change routing
        if (mustChange) {
          if (role === "teacher" && !loc.pathname.startsWith("/teacher/change-password")) {
            setSafe({ loading: false, ok: false, role: "teacher", mustChange: true, authed: true });
            running = false;
            return;
          }
          if (role === "student" && !loc.pathname.startsWith("/student/change-password")) {
            setSafe({ loading: false, ok: false, role: "student", mustChange: true, authed: true });
            running = false;
            return;
          }
        }

        setSafe({
          loading: false,
          ok: allowSet.has(role),
          role,
          mustChange: false,
          authed: true,
        });
      } catch {
        setSafe({ loading: false, ok: false, role: null, mustChange: false, authed: false });
      } finally {
        running = false;
      }
    }

    // run once on mount
    run("mount");

    // ✅ only rerun on auth changes that matter
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        run(event);
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [allowSet, loc.pathname]); // ✅ include pathname since you use it

  if (state.loading) return <div className="p-6 text-sm text-black/60">Checking access…</div>;

  if (state.mustChange) {
    if (state.role === "teacher") return <Navigate to="/teacher/change-password" replace />;
    if (state.role === "student") return <Navigate to="/student/change-password" replace />;
  }

  if (!state.ok) {
    if (state.role) return <Navigate to={routeForRole(state.role)} replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
