import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RequireRole({ allow = [] }) {
  const loc = useLocation();
  const [state, setState] = useState({ loading: true, ok: false, role: null });

  useEffect(() => {
    let alive = true;

    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user?.id) {
        if (alive) setState({ loading: false, ok: false, role: null });
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      const role = (prof?.role || "").toLowerCase();
      const active = prof?.is_active !== false;

      if (!alive) return;

      if (!active) {
        await supabase.auth.signOut();
        setState({ loading: false, ok: false, role: null });
        return;
      }

      const ok = allow.map((x) => x.toLowerCase()).includes(role);
      setState({ loading: false, ok, role });
    }

    run();
    return () => {
      alive = false;
    };
  }, [allow]);

  if (state.loading) return null; // pwede mo lagyan loader
  if (!state.ok) {
    // if logged in but wrong role, send to correct home
    if (state.role === "student") return <Navigate to="/student" replace state={{ from: loc }} />;
    if (state.role === "teacher") return <Navigate to="/teacher" replace state={{ from: loc }} />;
    if (state.role === "admin") return <Navigate to="/admin" replace state={{ from: loc }} />;
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return <Outlet />;
}
