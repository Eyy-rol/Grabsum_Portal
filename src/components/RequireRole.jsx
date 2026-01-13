import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function routeForRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin" || r === "super_admin") return "/admin";
  if (r === "teacher") return "/teacher/dashboard";
  if (r === "student") return "/student/dashboard";
  if (r === "dev") return "/dev";
  return "/login";
}

export default function RequireRole({ allow = [] }) {
  const loc = useLocation();
  const allowSet = useMemo(
    () => new Set(allow.map((x) => String(x).toLowerCase())),
    [allow]
  );

  const [state, setState] = useState({
    loading: true,
    ok: false,
    role: null,
    mustChange: false,
    authed: false,
  });

  useEffect(() => {
    let alive = true;
    let reqId = 0; // ✅ invalidates older async runs

    const setSafe = (next) => {
      if (!alive) return;
      setState(next);
    };

    async function run(reason = "manual") {
      const myId = ++reqId;

      try {
        // ✅ Local session check
        const { data: sessionData, error: sessErr } =
          await supabase.auth.getSession();

        if (!alive || myId !== reqId) return;

        const session = sessionData?.session;
        const user = session?.user;

        // Not authenticated
        if (sessErr || !user) {
          setSafe({
            loading: false,
            ok: false,
            role: null,
            mustChange: false,
            authed: false,
          });
          return;
        }

        // ✅ Load profile + role flags
        const { data: prof, error } = await supabase
          .from("profiles")
          .select("role, is_active, is_archived, must_change_password")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!alive || myId !== reqId) return;

        if (error || !prof) {
          setSafe({
            loading: false,
            ok: false,
            role: null,
            mustChange: false,
            authed: true,
          });
          return;
        }

        const role = (prof.role || "").toLowerCase();
        const mustChange = prof.must_change_password === true;

        // Locked / archived user
        if (!prof.is_active || prof.is_archived) {
          await supabase.auth.signOut();
          if (!alive || myId !== reqId) return;

          setSafe({
            loading: false,
            ok: false,
            role: null,
            mustChange: false,
            authed: false,
          });
          return;
        }

        // Force change password routing
        if (mustChange) {
          if (
            (role === "admin" || role === "super_admin") &&
            !loc.pathname.startsWith("/admin/change-password")
          ) {
            setSafe({
              loading: false,
              ok: false,
              role,
              mustChange: true,
              authed: true,
            });
            return;
          }

          if (
            role === "teacher" &&
            !loc.pathname.startsWith("/teacher/change-password")
          ) {
            setSafe({
              loading: false,
              ok: false,
              role: "teacher",
              mustChange: true,
              authed: true,
            });
            return;
          }

          if (
            role === "student" &&
            !loc.pathname.startsWith("/student/change-password")
          ) {
            setSafe({
              loading: false,
              ok: false,
              role: "student",
              mustChange: true,
              authed: true,
            });
            return;
          }
        }

        // ✅ Allowed?
        setSafe({
          loading: false,
          ok: allowSet.has(role),
          role,
          mustChange: false,
          authed: true,
        });
      } catch (e) {
        setSafe({
          loading: false,
          ok: false,
          role: null,
          mustChange: false,
          authed: false,
        });
      }
    }

    // Initial run
    run("mount");

    // ✅ React correctly to auth events
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // ✅ Immediate state clear fixes "logout stays on dashboard"
        reqId++; // invalidate in-flight runs
        setSafe({
          loading: false,
          ok: false,
          role: null,
          mustChange: false,
          authed: false,
        });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        run(event);
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [allowSet, loc.pathname]);

  if (state.loading) {
    return <div className="p-6 text-sm text-black/60">Checking access…</div>;
  }

  // Must change password routes
  if (state.mustChange) {
    if (state.role === "teacher") return <Navigate to="/teacher/change-password" replace />;
    if (state.role === "student") return <Navigate to="/student/change-password" replace />;
    if (state.role === "admin" || state.role === "super_admin")
      return <Navigate to="/admin/change-password" replace />;
  }

  // Not allowed
  if (!state.ok) {
    if (state.role) return <Navigate to={routeForRole(state.role)} replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
