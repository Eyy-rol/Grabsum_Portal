// src/layout/AdminLayout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Megaphone,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

import { TOKENS } from "../styles/tokens";
import { supabase } from "../lib/supabaseClient";

/** Optional: set your logo path here (public folder recommended) */
const SCHOOL = {
  appName: "Grabsum SHS Portal",
  panelName: "Admin",
  logoUrl: "/school-logo.png", // put your logo in /public/school-logo.png (or change this)
};

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/admin" },

  {
    key: "students",
    label: "Students",
    icon: Users,
    children: [
      { key: "enrollment", label: "Enrollment", icon: ClipboardList, to: "/admin/students/enrollment" },
      { key: "schedule", label: "Student Schedule", icon: BookOpen, to: "/admin/students/schedule" },
    ],
  },

  {
    key: "academics",
    label: "Academics",
    icon: BookOpen,
    children: [
      { key: "sections", label: "Sections", icon: ClipboardList, to: "/admin/students/section" },
      { key: "subjects", label: "Subjects", icon: ClipboardList, to: "/admin/students/subject" },
    ],
  },

  {
    key: "setup",
    label: "School Setup",
    icon: ClipboardList,
    children: [{ key: "school-year", label: "School Year", icon: BookOpen, to: "/admin/students/school-year" }],
  },

  {
    key: "teachers",
    label: "Teachers",
    icon: GraduationCap,
    children: [{ key: "manage", label: "Manage", icon: Users, to: "/admin/teacher/manage" }],
  },

  { key: "calendar", label: "Calendar", icon: CalendarDays, to: "/admin/calendar" },
  { key: "announcement", label: "Announcements", icon: Megaphone, to: "/admin/announcement" },
];

export default function AdminLayout() {
  const location = useLocation();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    return saved ? saved === "1" : false;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("admin_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`min-h-screen ${TOKENS.bg} ${TOKENS.text} font-[Nunito]`}>
      <div className="mx-auto max-w-[1400px] px-5 py-5 md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
          </div>

          {/* Mobile sidebar overlay */}
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 md:hidden">
                <button
                  className="absolute inset-0 bg-black/30"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar overlay"
                  type="button"
                />
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-3 top-3 bottom-3 w-[320px]"
                >
                  <Sidebar mobile onClose={() => setSidebarOpen(false)} collapsed={false} setCollapsed={() => {}} />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <main className="space-y-6">
            <Topbar title={title} onOpenSidebar={() => setSidebarOpen(true)} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-5 md:p-8 shadow-sm`}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

            <Footer />
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, setCollapsed, mobile = false, onClose }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [open, setOpen] = useState({
    students: true,
    academics: true,
    setup: true,
    teachers: true,
  });

  const [logoOk, setLogoOk] = useState(true);

  // ✅ Supabase-driven user/admin details
  const [me, setMe] = useState({
    loading: true,
    err: "",
    full_name: "",
    email: "",
    role: "",
    department: "",
    phone: "",
    is_active: true,
    is_archived: false,
  });

  useEffect(() => {
    const p = loc.pathname;
    if (p.includes("/admin/students/")) {
      if (p.includes("/students/enrollment") || p.includes("/students/schedule")) setOpen((s) => ({ ...s, students: true }));
      if (p.includes("/students/section") || p.includes("/students/subject")) setOpen((s) => ({ ...s, academics: true }));
      if (p.includes("/students/school-year")) setOpen((s) => ({ ...s, setup: true }));
    }
    if (p.includes("/admin/teacher/")) setOpen((s) => ({ ...s, teachers: true }));
  }, [loc.pathname]);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const { data: sessData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        const user = sessData?.session?.user;
        if (!user?.id) {
          if (!alive) return;
          setMe({
            loading: false,
            err: "",
            full_name: "",
            email: "",
            role: "",
            department: "",
            phone: "",
            is_active: true,
            is_archived: false,
          });
          return;
        }

        const [{ data: prof, error: profErr }, { data: adminRow, error: adminErr }] = await Promise.all([
          supabase.from("profiles").select("full_name, email, role").eq("user_id", user.id).maybeSingle(),
          supabase.from("admins").select("department, phone, is_active, is_archived").eq("user_id", user.id).maybeSingle(),
        ]);

        if (!alive) return;

        const email = String(prof?.email || user.email || "");
        const full_name = String(prof?.full_name || "").trim();

        setMe({
          loading: false,
          err: profErr ? String(profErr.message || profErr) : adminErr ? String(adminErr.message || adminErr) : "",
          full_name,
          email,
          role: String(prof?.role || "admin"),
          department: String(adminRow?.department || ""),
          phone: String(adminRow?.phone || ""),
          is_active: adminRow?.is_active ?? true,
          is_archived: adminRow?.is_archived ?? false,
        });
      } catch (e) {
        if (!alive) return;
        setMe((prev) => ({ ...prev, loading: false, err: String(e?.message || e) }));
      }
    }

    loadMe();

    const { data } = supabase.auth.onAuthStateChange(() => loadMe());

    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      nav("/login", { replace: true });
      onClose?.();
    }
  }

  const width = mobile ? 320 : collapsed ? 92 : 320;

  const displayName =
    (me.full_name && me.full_name.trim()) ||
    (me.email ? me.email.split("@")[0] : "") ||
    "User";

  const roleLabel = me.role ? String(me.role).replaceAll("_", " ") : "admin";

  return (
    <aside
      className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-5 shadow-sm md:sticky md:top-8`}
      style={{ width, transition: "width 180ms ease" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`h-11 w-11 rounded-2xl ${TOKENS.goldSoft} grid place-items-center shrink-0 overflow-hidden`}>
            {SCHOOL.logoUrl ? (
              <img
                src={SCHOOL.logoUrl}
                alt="School logo"
                className="h-full w-full object-cover"
                onError={() => setLogoOk(false)}
                style={{ display: logoOk ? "block" : "none" }}
              />
            ) : null}
            {!SCHOOL.logoUrl || !logoOk ? <span className={`text-sm font-black ${TOKENS.gold}`}>G</span> : null}
          </div>

          {!collapsed ? (
            <div className="leading-tight">
              <div className="text-xs tracking-wide text-black/55">{SCHOOL.appName}</div>
              <div className="text-lg font-extrabold">{SCHOOL.panelName}</div>
            </div>
          ) : null}
        </div>

        {mobile ? (
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80"
            aria-label="Close sidebar"
            title="Close"
            type="button"
          >
            <X className="h-5 w-5 text-black/60" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed((s) => !s)}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5 text-black/60" /> : <PanelLeftClose className="h-5 w-5 text-black/60" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="mt-5">
        {!collapsed ? <div className="text-xs font-semibold text-black/50">Navigation</div> : null}

        <nav className="mt-3 space-y-2">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.key} className="space-y-2">
                <button
                  onClick={() => setOpen((s) => ({ ...s, [item.key]: !s[item.key] }))}
                  className={[
                    "group flex w-full items-center rounded-2xl border transition",
                    collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5",
                    open[item.key] ? "bg-black/[0.02] border-black/10" : "border-transparent hover:bg-black/5",
                  ].join(" ")}
                  title={collapsed ? item.label : undefined}
                  type="button"
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${TOKENS.border} bg-white/70 shrink-0`}>
                    <item.icon className="h-5 w-5 text-black/60" />
                  </span>

                  {!collapsed ? (
                    <>
                      <span className="font-semibold text-black/75">{item.label}</span>
                      <ChevronDown className={"ml-auto h-4 w-4 text-black/60 transition " + (open[item.key] ? "rotate-180" : "")} />
                    </>
                  ) : null}
                </button>

                {!collapsed && open[item.key] ? (
                  <div className="space-y-1.5">
                    {item.children.map((c) => (
                      <SubLink key={c.key} to={c.to} icon={c.icon} label={c.label} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <SideLink key={item.key} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed} />
            )
          )}
        </nav>
      </div>

      {/* Profile (keep) */}
      <div className={`mt-5 rounded-2xl border border-black/10 bg-white/60 ${collapsed ? "p-2" : "p-4"}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-10 w-10 rounded-2xl border border-black/10 bg-white grid place-items-center">
            <span className="text-sm font-black text-black/70">{displayName ? String(displayName).slice(0, 1).toUpperCase() : "A"}</span>
          </div>

          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-bold">
                {me.loading ? "Loading…" : `${roleLabel} User`}
                {!me.loading && (me.is_archived || !me.is_active) ? (
                  <span className="ml-2 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    Disabled
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-black/55 truncate">{me.email || "-"}</div>
              {!me.loading && me.full_name ? <div className="mt-0.5 text-xs font-semibold text-black/60 truncate">{me.full_name}</div> : null}
              {me.err ? <div className="mt-1 text-[11px] font-semibold text-rose-600">{me.err}</div> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          <button
            onClick={handleLogout}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm font-semibold hover:bg-white"
            title="Log out"
            type="button"
          >
            <LogOut className="h-4 w-4 text-black/60" />
            {!collapsed ? "Log out" : null}
          </button>

          {!collapsed ? (
            <button
              onClick={() => nav("/admin")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm font-semibold hover:bg-white/80"
              type="button"
            >
              <LayoutDashboard className="h-4 w-4 text-black/60" />
              Dashboard
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function SideLink({ to, icon: Icon, label, collapsed = false }) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "group flex items-center rounded-2xl border transition",
          collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5",
          isActive ? `${TOKENS.goldSoft} ${TOKENS.border}` : "border-transparent hover:bg-black/5",
        ].join(" ")
      }
    >
      <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${TOKENS.border} bg-white/70 group-hover:bg-white/80 shrink-0`}>
        <Icon className="h-5 w-5 text-black/60" />
      </span>

      {!collapsed ? <span className="font-semibold text-black/75">{label}</span> : null}
    </NavLink>
  );
}

function SubLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        [
          "group flex items-center rounded-2xl border transition",
          "pl-12 pr-3 py-2",
          isActive ? `${TOKENS.goldSoft} ${TOKENS.border}` : "border-transparent hover:bg-black/5",
        ].join(" ")
      }
    >
      <span className={`grid h-9 w-9 place-items-center rounded-2xl border ${TOKENS.border} bg-white/70 group-hover:bg-white/80 shrink-0`}>
        <Icon className="h-4 w-4 text-black/60" />
      </span>
      <span className="ml-3 text-sm font-semibold text-black/75">{label}</span>
    </NavLink>
  );
}

/** ✅ Topbar: clickable user pill -> dropdown (logout) that ENDS SESSION */
function Topbar({ title, onOpenSidebar }) {
  const nav = useNavigate();

  const [me, setMe] = useState({
    loading: true,
    full_name: "",
    email: "",
    role: "",
  });

  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        const user = sessData?.session?.user;

        if (!user?.id) {
          if (!alive) return;
          setMe({ loading: false, full_name: "", email: "", role: "" });
          return;
        }

        const { data: prof } = await supabase.from("profiles").select("full_name, email, role").eq("user_id", user.id).maybeSingle();

        if (!alive) return;

        setMe({
          loading: false,
          full_name: String(prof?.full_name || "").trim(),
          email: String(prof?.email || user.email || ""),
          role: String(prof?.role || "admin"),
        });
      } catch {
        if (!alive) return;
        setMe((p) => ({ ...p, loading: false }));
      }
    }

    loadMe();
    const { data } = supabase.auth.onAuthStateChange(() => loadMe());

    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  // close menu on click outside / escape
  useEffect(() => {
    function onDocDown(e) {
      if (!openMenu) return;
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target)) return;
      setOpenMenu(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpenMenu(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openMenu]);

  const name =
    (me.full_name && me.full_name.trim()) ||
    (me.email ? me.email.split("@")[0] : "") ||
    "Admin";

  const initials = (name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  const roleLabel = me.role ? String(me.role).replaceAll("_", " ") : "admin";

  async function handleLogout() {
    // ✅ END SESSION
    try {
      await supabase.auth.signOut();
    } finally {
      setOpenMenu(false);
      nav("/login", { replace: true });
    }
  }

  return (
    <header className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 md:p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={onOpenSidebar}
            className="md:hidden grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80"
            aria-label="Open sidebar"
            title="Menu"
            type="button"
          >
            <Menu className="h-5 w-5 text-black/60" />
          </button>

          <div className="leading-tight">
            <div className="text-xs font-semibold text-black/50">{roleLabel}</div>
            <div className="text-2xl font-extrabold">{title}</div>
          </div>
        </div>

        {/* ✅ user pill + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpenMenu((s) => !s)}
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 hover:bg-white"
            aria-haspopup="menu"
            aria-expanded={openMenu}
          >
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50">
              <span className="text-xs font-extrabold text-emerald-700">{initials || "A"}</span>
            </div>

            <div className="leading-tight text-left">
              <div className="text-sm font-extrabold text-black/80">{me.loading ? "Loading…" : name}</div>
              <div className="text-xs text-black/55">{me.email || ""}</div>
            </div>

            <ChevronDown className={`h-4 w-4 text-black/60 transition ${openMenu ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {openMenu ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 mt-2 w-[220px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
                role="menu"
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-black/75 hover:bg-black/[0.03]"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4 text-black/60" />
                  Log out
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return <div className="px-2 pb-2 text-xs text-black/50">© {new Date().getFullYear()} {SCHOOL.appName} • Admin UI</div>;
}

function titleFromPath(path) {
  if (path === "/admin") return "Dashboard";

  if (path.includes("/students/enrollment")) return "Students • Enrollment";
  if (path.includes("/students/schedule")) return "Students • Schedule";

  if (path.includes("/students/section")) return "Academics • Sections";
  if (path.includes("/students/subject")) return "Academics • Subjects";

  if (path.includes("/students/school-year")) return "School Setup • School Year";

  if (path.includes("/teacher/manage")) return "Teachers • Manage";

  if (path.includes("/calendar")) return "Scheduling • Calendar";
  if (path.includes("/announcement")) return "Communication • Announcements";

  return "Admin";
}
