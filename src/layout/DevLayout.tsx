import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Activity,
  Shield,
  FileText,
  Search,
  Bell,
  LogOut,
} from "lucide-react";
import { TOKENS } from "../styles/tokens.js";
import { supabase } from "../lib/supabaseClient"; // ✅ adjust path if needed

// Base dev-safe navigation
const DEV_NAV_BASE = [
  { key: "dash", label: "Dashboard", icon: LayoutDashboard, to: "/dev" },
  { key: "activity", label: "Activity Logs", icon: Activity, to: "/dev/activity" },
  { key: "audit", label: "Audit & Reports", icon: FileText, to: "/dev/audit" },
  { key: "Admin", label: "Admin", icon: Users, to: "/dev/admins" },

];

// Admin Management entry (kept as requested)
const ADMIN_MGMT_ITEM = {
  key: "admins",
  label: "Admin Management",
  icon: Users,
  to: "/dev/admins",
};

export default function DevLayout() {
  const location = useLocation();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const [me, setMe] = useState({ email: "", role: "", full_name: "" });

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;

      if (!userId) {
        // not logged in → redirect to login
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("email, role, full_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      setMe({
        email: prof?.email || auth?.user?.email || "",
        role: String(prof?.role || "").toLowerCase(),
        full_name: prof?.full_name || "",
      });
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Only show Admin Management if user is allowed
  // Recommended: super_admin only
  const canSeeAdminManagement = me.role === "super_admin";

  const navItems = useMemo(() => {
    const items = [...DEV_NAV_BASE];
    if (canSeeAdminManagement) items.splice(1, 0, ADMIN_MGMT_ITEM); // insert after dashboard
    return items;
  }, [canSeeAdminManagement]);

  return (
    <div className={`min-h-screen ${TOKENS.bg} ${TOKENS.text} font-[Nunito]`}>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <Sidebar me={me} navItems={navItems} />
          <main className="space-y-4">
            <Topbar title={title} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 md:p-6 shadow-sm`}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

            <div className="px-2 pb-2 text-xs text-black/50">
              © {new Date().getFullYear()} Grabsum SHS Portal • Developer Console
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ me, navItems }) {
  const nav = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    nav("/login"); // change to your login route
  }

  const displayName = me.full_name || "Developer";
  const displayEmail = me.email || "—";
  const displayRole = me.role || "—";

  return (
    <aside className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <div className="text-xs tracking-wide text-black/55">Grabsum SHS Portal</div>
          <div className="text-lg font-extrabold">Developer</div>
        </div>
        <div className={`h-10 w-10 rounded-2xl ${TOKENS.goldSoft} grid place-items-center`}>
          <span className={`text-sm font-black ${TOKENS.gold}`}>D</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-black/50">Navigation</div>
        <nav className="mt-2 space-y-1">
          {navItems.map((i) => (
            <NavLink
              key={i.key}
              to={i.to}
              end
              className={({ isActive }) =>
                "group flex items-center gap-3 rounded-2xl px-3 py-2 transition " +
                (isActive ? `${TOKENS.goldSoft} border ${TOKENS.border}` : "hover:bg-black/5")
              }
            >
              <span className={`grid h-9 w-9 place-items-center rounded-2xl border ${TOKENS.border} bg-white/60`}>
                <i.icon className="h-5 w-5 text-black/60" />
              </span>
              <span className="font-semibold text-black/75">{i.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-3">
        <div className="text-sm font-bold">{displayName}</div>
        <div className="mt-1 text-xs text-black/55">{displayEmail}</div>
        <div className="mt-1 text-[11px] text-black/45">
          role: <span className="font-semibold">{displayRole}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => nav("/admin")}
            className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            type="button"
          >
            Admin UI
          </button>

          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            type="button"
          >
            <LogOut className="h-4 w-4 text-black/60" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title }) {
  return (
    <header className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-3 shadow-sm`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="leading-tight">
          <div className="text-xs font-semibold text-black/50">Developer Console</div>
          <div className="text-xl font-extrabold">{title}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
              placeholder="Search… (UI only)"
            />
          </div>

          <button className="relative grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80" type="button">
            <Bell className="h-5 w-5 text-black/60" />
            <span
              className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full ${TOKENS.goldBg} text-[10px] font-black text-black`}
            >
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function titleFromPath(path) {
  if (path === "/dev") return "Dashboard";
  if (path.includes("/dev/admins")) return "Admin Management";
  if (path.includes("/dev/activity")) return "Activity Logs";
  if (path.includes("/dev/audit")) return "Audit & Reports";
  return "Developer";
}
