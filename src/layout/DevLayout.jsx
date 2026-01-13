// src/layouts/DevLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  FileText,
  Users,
  Search,
  Bell,
  LogOut,
  ShieldCheck,
  Server,
  Database,
  KeyRound,
} from "lucide-react";
import { TOKENS } from "../styles/tokens.js";
import { supabase } from "../lib/supabaseClient.js";

/**
 * ✅ PURPOSE-DRIVEN DEV CONSOLE
 * - Dev dashboard should focus on: health, access, diagnostics, logs, audits
 * - Keep /dev/admins page as-is (we just link to it)
 */

/** Recommended: dev and super_admin can access Dev Console */
function isDevConsoleRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "dev" || r === "super_admin";
}

/** If dev can manage admins/super_admins in your system */
function canManageAdmins(role) {
  const r = String(role || "").toLowerCase();
  return r === "dev" || r === "super_admin";
}

/** Optional: restrict dangerous operations (delete super_admin, etc.) */
function isRootOps(role) {
  const r = String(role || "").toLowerCase();
  return r === "super_admin"; // change to (r === "dev" || r === "super_admin") if you want
}

const DEV_NAV = [
  { key: "dash", label: "System Overview", icon: LayoutDashboard, to: "/dev" },
  { key: "activity", label: "Activity Logs", icon: Activity, to: "/dev/activity" },
 
];

const ADMIN_MGMT_ITEM = { key: "admins", label: "Admin Management", icon: Users, to: "/dev/admins" };

export default function DevLayout() {
  const location = useLocation();
  const nav = useNavigate();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const [me, setMe] = useState({
    loading: true,
    err: "",
    email: "",
    role: "",
    full_name: "",
    user_id: "",
  });

  const [status, setStatus] = useState({
    loading: true,
    env: getEnvLabel(),
    rls: "unknown", // ok | limited | unknown
    health: {
      auth: "unknown", // ok | down | unknown
      db: "unknown",
      edge: "unknown",
    },
  });

  // Fetch current user + profile
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user?.id) {
          nav("/login", { replace: true });
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("email, role, full_name, user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const role = String(prof?.role || "").toLowerCase();

        if (!alive) return;

        // ✅ Gate Dev Console access
        if (!isDevConsoleRole(role)) {
          nav("/login", { replace: true });
          return;
        }

        setMe({
          loading: false,
          err: profErr ? String(profErr.message || profErr) : "",
          email: String(prof?.email || user.email || ""),
          role,
          full_name: String(prof?.full_name || ""),
          user_id: String(user.id),
        });
      } catch (e) {
        if (!alive) return;
        setMe((prev) => ({
          ...prev,
          loading: false,
          err: String(e?.message || e),
        }));
      }
    }

    loadMe();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        loadMe();
      }
    });

    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [nav]);

  // ✅ System checks (lightweight): auth ok, db ok (via harmless select), rls visibility
  useEffect(() => {
    let alive = true;

    async function runChecks() {
      try {
        setStatus((s) => ({ ...s, loading: true }));

        // Auth check
        const { data: userData, error: uErr } = await supabase.auth.getUser();
        const authOk = !uErr && !!userData?.user?.id;

        // DB check + RLS visibility check:
        // Use a small table you expect dev to read (announcements/admins/profiles).
        // If RLS blocks, we'll detect limited access.
        let dbOk = true;
        let rls = "unknown";

        // Try to read one row from profiles (many apps block this w/ RLS)
        const profProbe = await supabase.from("profiles").select("user_id").limit(1);
        if (profProbe.error) {
          // DB reachable but RLS likely blocks
          dbOk = true;
          rls = "limited";
        } else {
          // readable
          rls = "ok";
        }

        // Edge: optional probe (skip if you don't want network calls)
        const edge = "unknown";

        if (!alive) return;
        setStatus((s) => ({
          ...s,
          loading: false,
          rls,
          health: {
            auth: authOk ? "ok" : "down",
            db: dbOk ? "ok" : "down",
            edge,
          },
        }));
      } catch {
        if (!alive) return;
        setStatus((s) => ({
          ...s,
          loading: false,
          rls: "unknown",
          health: { auth: "unknown", db: "unknown", edge: "unknown" },
        }));
      }
    }

    runChecks();
    return () => {
      alive = false;
    };
  }, []);

  const navItems = useMemo(() => {
    const items = [...DEV_NAV];
    if (canManageAdmins(me.role)) items.push(ADMIN_MGMT_ITEM);
    return items;
  }, [me.role]);

  return (
    <div className={`min-h-screen ${TOKENS.bg} ${TOKENS.text} font-[Nunito]`}>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
          <Sidebar me={me} navItems={navItems} status={status} />
          <main className="space-y-4">
            <Topbar title={title} me={me} status={status} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 md:p-6 shadow-sm`}
              >
                {/* ✅ If you want a dev-purpose dashboard wrapper, you can detect /dev here */}
                <Outlet context={{ me, status, isRootOps: isRootOps(me.role) }} />
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

function Sidebar({ me, navItems, status }) {
  const nav = useNavigate();

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("signOut error:", error);
    } finally {
      nav("/login", { replace: true });
    }
  }

  const displayName = me.full_name || "Developer";
  const displayEmail = me.email || "—";
  const displayRole = me.role || "—";

  return (
    <aside className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <div className="text-xs tracking-wide text-black/55">Grabsum SHS Portal</div>
          <div className="text-lg font-extrabold">Developer Console</div>
        </div>
        <div className={`h-10 w-10 rounded-2xl ${TOKENS.goldSoft} grid place-items-center`}>
          <span className={`text-sm font-black ${TOKENS.gold}`}>D</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-3">
        <div className="text-sm font-bold">{me.loading ? "Loading…" : displayName}</div>
        <div className="mt-1 text-xs text-black/55">{displayEmail}</div>
        <div className="mt-1 text-[11px] text-black/45">
          role: <span className="font-semibold">{displayRole}</span>
        </div>
        {me.err ? <div className="mt-2 text-[11px] font-semibold text-rose-600">{me.err}</div> : null}
      </div>

      {/* ✅ System status snapshot */}
      <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-black/55">System</div>
          <EnvPill env={status.env} />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatusPill icon={KeyRound} label="Auth" value={status.health.auth} />
          <StatusPill icon={Database} label="DB" value={status.health.db} />
          <StatusPill icon={Server} label="Edge" value={status.health.edge} />
        </div>

        <div className="mt-2 text-[11px] text-black/50">
          Data visibility:{" "}
          <span className="font-semibold">
            {status.rls === "ok" ? "Full" : status.rls === "limited" ? "Limited (RLS)" : "Unknown"}
          </span>
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

      <div className="mt-4">
        <button
          onClick={logout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
          type="button"
        >
          <LogOut className="h-4 w-4 text-black/60" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function Topbar({ title, me, status }) {
  const [q, setQ] = useState("");

  // You can wire this to a command palette later
  function onSubmit(e) {
    e.preventDefault();
    if (!q.trim()) return;
    alert(`Command search not wired yet.\n\nYou typed: ${q}`);
    setQ("");
  }

  return (
    <header className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-3 shadow-sm`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-black/50">Developer Console</div>
            <span className="text-[11px] text-black/40">•</span>
            <span className="text-xs font-semibold text-black/50">
              Access: {status.rls === "ok" ? "Full" : status.rls === "limited" ? "Limited" : "Unknown"}
            </span>
          </div>
          <div className="text-xl font-extrabold">{title}</div>
        </div>

        <div className="flex items-center gap-2">
        

         

          <RolePill role={me.role} />
        </div>
      </div>
    </header>
  );
}

function titleFromPath(path) {
  if (path === "/dev") return "System Overview";
  if (path.includes("/dev/admins")) return "Admin Management";
  if (path.includes("/dev/activity")) return "Activity Logs";
  
  return "Developer Console";
}

function getEnvLabel() {
  // Use your Vite env vars if available
  const mode = import.meta.env.MODE; // 'development' | 'production'
  const label = (import.meta.env.VITE_APP_ENV || mode || "unknown").toLowerCase();
  if (label.includes("prod")) return "PRODUCTION";
  if (label.includes("stag")) return "STAGING";
  if (label.includes("dev")) return "DEVELOPMENT";
  return label.toUpperCase();
}

function EnvPill({ env }) {
  const isProd = env === "PRODUCTION";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
      style={{
        background: isProd ? "rgba(239,68,68,0.10)" : "rgba(212,166,47,0.14)",
        color: isProd ? "#b91c1c" : "rgba(43,26,18,0.85)",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {env}
    </span>
  );
}

function RolePill({ role }) {
  const r = String(role || "").toUpperCase() || "—";
  return (
    <span
      className="hidden md:inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold"
      style={{
        background: "rgba(255,255,255,0.70)",
        border: "1px solid rgba(0,0,0,0.10)",
        color: "rgba(43,26,18,0.80)",
      }}
      title="Current RBAC role"
    >
      <ShieldCheck className="h-4 w-4 text-black/60" />
      {r}
    </span>
  );
}

function StatusPill({ icon: Icon, label, value }) {
  const v = String(value || "unknown");
  const ok = v === "ok";
  const down = v === "down";

  const bg = ok ? "rgba(34,197,94,0.10)" : down ? "rgba(239,68,68,0.10)" : "rgba(0,0,0,0.06)";
  const fg = ok ? "#15803d" : down ? "#b91c1c" : "rgba(43,26,18,0.60)";

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/60 px-2 py-2">
      <Icon className="h-4 w-4" style={{ color: "rgba(0,0,0,0.55)" }} />
      <div className="leading-tight">
        <div className="text-[10px] font-bold text-black/55">{label}</div>
        <div className="text-[10px] font-extrabold" style={{ color: fg }}>
          <span className="rounded-full px-2 py-0.5" style={{ background: bg }}>
            {v.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
