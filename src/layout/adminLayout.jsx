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
  Search,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

import { TOKENS } from "../styles/tokens";
import { supabase } from "../lib/supabaseClient";

// -------------------------------------------
// NAV
// -------------------------------------------
const NAV = [
  { key: "home", label: "Home", icon: LayoutDashboard, to: "/admin" },
  {
    key: "students",
    label: "Students",
    icon: Users,
    children: [
      { key: "enrollment", label: "Enrollment", icon: ClipboardList, to: "/admin/students/enrollment" },
      { key: "classes", label: "Classes", icon: BookOpen, to: "/admin/students/classes" },
      { key: "schedule", label: "Schedule", icon: BookOpen, to: "/admin/students/schedule" },
      { key: "section", label: "Section", icon: BookOpen, to: "/admin/students/section" },
      { key: "subject", label: "Subject", icon: BookOpen, to: "/admin/students/subject" },
      { key: "school-year", label: "School Year", icon: BookOpen, to: "/admin/students/school-year" },
    ],
  },
  {
    key: "teacher",
    label: "Teacher",
    icon: GraduationCap,
    children: [
      { key: "manage", label: "Manage", icon: Users, to: "/admin/teacher/manage" },
      { key: "schedule", label: "Schedule", icon: BookOpen, to: "/admin/teacher/schedule" },
    ],
  },
  { key: "calendar", label: "Calendar", icon: CalendarDays, to: "/admin/calendar" },
  { key: "announcement", label: "Announcement", icon: Megaphone, to: "/admin/announcement" },
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 md:hidden"
              >
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

  const [open, setOpen] = useState({ students: true, teacher: true });

  const [me, setMe] = useState({
    loading: true,
    err: "",
    email: "",
    role: "",
  });

  useEffect(() => {
    const p = loc.pathname;
    if (p.includes("/admin/students/")) setOpen((s) => ({ ...s, students: true }));
    if (p.includes("/admin/teacher/")) setOpen((s) => ({ ...s, teacher: true }));
  }, [loc.pathname]);

  // Load user info (session -> profiles fallback)
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const { data: sessData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        const user = sessData?.session?.user;
        if (!user?.id) {
          if (!alive) return;
          setMe({ loading: false, err: "", email: "", role: "" });
          return;
        }

        // If profiles select fails because of missing cols or RLS, we still show auth email.
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("email, role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (profErr) {
          setMe({
            loading: false,
            err: "",
            email: user.email || "",
            role: "admin",
          });
          return;
        }

        setMe({
          loading: false,
          err: "",
          email: String(prof?.email || user.email || ""),
          role: String(prof?.role || "admin"),
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

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadMe();
    });

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

  return (
    <aside
      className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-5 shadow-sm md:sticky md:top-8`}
      style={{ width, transition: "width 180ms ease" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`h-11 w-11 rounded-2xl ${TOKENS.goldSoft} grid place-items-center shrink-0`}>
            <span className={`text-sm font-black ${TOKENS.gold}`}>G</span>
          </div>

          {!collapsed ? (
            <div className="leading-tight">
              <div className="text-xs tracking-wide text-black/55">Grabsum SHS Portal</div>
              <div className="text-lg font-extrabold">Admin</div>
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
                    "flex w-full items-center rounded-2xl transition",
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    "hover:bg-black/5",
                  ].join(" ")}
                  title={collapsed ? item.label : undefined}
                  type="button"
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${TOKENS.border} bg-white/60`}>
                    <item.icon className="h-5 w-5 text-black/60" />
                  </span>

                  {!collapsed ? (
                    <>
                      <span className="flex-1 font-semibold text-black/75">{item.label}</span>
                      <ChevronDown
                        className={"h-4 w-4 text-black/60 transition " + (open[item.key] ? "rotate-180" : "")}
                      />
                    </>
                  ) : null}
                </button>

                {!collapsed && open[item.key] ? (
                  <div className="ml-3 space-y-1.5 border-l border-black/10 pl-3">
                    {item.children.map((c) => (
                      <SideLink key={c.key} to={c.to} icon={c.icon} label={c.label} compact />
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

      {/* Profile */}
      <div className={`mt-5 rounded-2xl border border-black/10 bg-white/60 ${collapsed ? "p-2" : "p-4"}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-10 w-10 rounded-2xl border border-black/10 bg-white grid place-items-center">
            <span className="text-sm font-black text-black/70">A</span>
          </div>

          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-bold">{me.loading ? "Loading…" : me.role ? `${me.role} User` : "User"}</div>
              <div className="mt-0.5 text-xs text-black/55 truncate">{me.email || "-"}</div>
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
              Home
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function SideLink({ to, icon: Icon, label, compact = false, collapsed = false }) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "group flex items-center rounded-2xl transition",
          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          compact ? "text-sm" : "",
          isActive ? `${TOKENS.goldSoft} border ${TOKENS.border}` : "hover:bg-black/5",
        ].join(" ")
      }
    >
      <span
        className={[
          "grid place-items-center rounded-2xl border transition",
          compact ? "h-9 w-9" : "h-10 w-10",
          `${TOKENS.border} bg-white/60 group-hover:bg-white/80`,
        ].join(" ")}
      >
        <Icon className={compact ? "h-4 w-4 text-black/60" : "h-5 w-5 text-black/60"} />
      </span>

      {!collapsed ? <span className="font-semibold text-black/75">{label}</span> : null}
    </NavLink>
  );
}

function Topbar({ title, onOpenSidebar }) {
  return (
    <header className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 md:p-5 shadow-sm`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start justify-between gap-3 md:block">
          <div className="leading-tight">
            <div className="text-xs font-semibold text-black/50">Admin Panel</div>
            <div className="text-2xl font-extrabold">{title}</div>
          </div>

          <button
            onClick={onOpenSidebar}
            className="md:hidden grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80"
            aria-label="Open sidebar"
            title="Menu"
            type="button"
          >
            <Menu className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2.5 text-sm outline-none focus:bg-white"
              placeholder="Search…"
            />
          </div>

          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80"
            type="button"
            onClick={() => alert("Notifications UI (wire later)")}
          >
            <Bell className="h-5 w-5 text-black/60" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return <div className="px-2 pb-2 text-xs text-black/50">© {new Date().getFullYear()} Grabsum SHS Portal • Admin UI</div>;
}

function titleFromPath(path) {
  if (path === "/admin") return "Home";
  if (path.includes("/students/enrollment")) return "Students • Enrollment";
  if (path.includes("/students/classes")) return "Students • Classes";
  if (path.includes("/students/schedule")) return "Students • Schedule";
  if (path.includes("/students/section")) return "Students • Section";
  if (path.includes("/students/subject")) return "Students • Subject";
  if (path.includes("/students/school-year")) return "Students • School Year";
  if (path.includes("/teacher/manage")) return "Teacher • Manage";
  if (path.includes("/teacher/schedule")) return "Teacher • Schedule";
  if (path.includes("/calendar")) return "Calendar";
  if (path.includes("/announcement")) return "Announcement";
  return "Admin";
}
