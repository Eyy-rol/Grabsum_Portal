import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RequirePasswordChange() {
  const [state, setState] = useState({ loading: true, redirect: null });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const session = s.session;

      if (!session) {
        if (mounted) setState({ loading: false, redirect: "/login" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("user_id", session.user.id)
        .single();

      if (mounted) {
        if (profile?.must_change_password) setState({ loading: false, redirect: "/student/change-password" });
        else setState({ loading: false, redirect: null });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) return null; // or a spinner
  if (state.redirect) return <Navigate to={state.redirect} replace />;
  return <Outlet />;
}
