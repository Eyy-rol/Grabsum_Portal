//// src/layouts/TeacherLayout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Megaphone,
  Users,
  Settings,
  Sparkles,
  LogOut,
  HelpCircle,
  UserCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import logo from "../assets/grabsum-logo.png";
import { supabase } from "../lib/supabaseClient";

// -----------------------------------------------------
// Brand tokens (modern, minimalist, aesthetic)
// -----------------------------------------------------
const BRAND = {
  pageBg: "bg-[#fbf6ef]",
  ink: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldSoft: "rgba(212,166,47,0.18)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

const TEACHER_NAV = [
  { key: "dash", label: "Dashboard", to: "/teacher/dashboard", icon: LayoutDashboard },
  { key: "lessons", label: "Lessons", to: "/teacher/lessons", icon: BookOpen },
  { key: "lesson-sampler", label: "Lesson Sampler", to: "/teacher/lesson-sampler", icon: Sparkles },
  { key: "lesson-library", label: "Lesson Library", to: "/teacher/lesson-library", icon: BookOpen },
  { key: "assign-lesson", label: "Assign Lesson", to: "/teacher/assign-lesson", icon: BookOpen },
  { key: "classes", label: "My Classes", to: "/teacher/classes", icon: GraduationCap },
  { key: "schedule", label: "Schedule", to: "/teacher/schedule", icon: CalendarDays },
  { key: "ann", label: "Announcements", to: "/teacher/announcements", icon: Megaphone },
  { key: "students", label: "Students", to: "/teacher/students", icon: Users },
  { key: "profile", label: "Profile", to: "/teacher/settings", icon: UserCircle2 },
];

function titleFromPath(path) {
  if (path.includes("/teacher/dashboard")) return "Dashboard";
  if (path.includes("/teacher/lessons")) return "Lessons";
  if (path.includes("/teacher/lesson-sampler")) return "Lesson Sampler";
  if (path.includes("/teacher/classes")) return "My Classes";
  if (path.includes("/teacher/schedule")) return "Schedule";
  if (path.includes("/teacher/announcements")) return "Announcements";
  if (path.includes("/teacher/students")) return "Students";
  if (path.includes("/teacher/settings")) return "Profile";
  if (path.includes("/teacher/lesson-library")) return "Lesson Library";
  return "Teacher";
}

function getInitials(first, last, fallback = "Teacher") {
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  const base = `${f} ${l}`.trim();
  const src = base || fallback;
  const parts = src.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "T").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "C").toUpperCase();
  return `${a}${b}`;
}

function safeFullName(first, last, fallback = "Teacher") {
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  const name = `${f}${f && l ? " " : ""}${l}`.trim();
  return name || fallback;
}

export default function TeacherLayout() {
  const location = useLocation();
  const nav = useNavigate();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  // sidebar collapse state (persist)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("teacher_sidebar_collapsed");
    return saved ? saved === "1" : false;
  });

  useEffect(() => {
    localStorage.setItem("teacher_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // teacher profile data from Supabase
  const [me, setMe] = useState({
    loading: true,
    err: "",
    userId: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) {
          if (alive) {
            setMe({
              loading: false,
              err: "Not authenticated.",
              userId: "",
              email: "",
              first_name: "",
              last_name: "",
              role: "",
            });
          }
          return;
        }

        // ✅ IMPORTANT:
        // Your screenshot shows: "column profiles.first_name does not exist"
        // So we safely query only columns that exist: user_id, email, role
        // Then we fallback to teachers table for names.
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, email, role")
          .eq("user_id", user.id)
          .maybeSingle();

        // if profiles is blocked by RLS or missing fields, we still proceed with auth email
        const role = String(prof?.role || "").toLowerCase();

        // optional: fetch teacher name from teachers table (likely has first_name/last_name)
        let tFirst = "";
        let tLast = "";

        const { data: tRow, error: tErr } = await supabase
          .from("teachers")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!tErr && tRow) {
          tFirst = tRow.first_name || "";
          tLast = tRow.last_name || "";
        }

        if (!alive) return;

        setMe({
          loading: false,
          err: pErr ? "" : "", // keep UI clean; don't block layout
          userId: user.id,
          email: prof?.email || user.email || "",
          first_name: tFirst,
          last_name: tLast,
          role,
        });

        // OPTIONAL ROLE GUARD (uncomment if you want)
        // if (role && role !== "teacher") nav("/login", { replace: true });
      } catch (e) {
        if (!alive) return;
        setMe({
          loading: false,
          err: String(e?.message || e),
          userId: "",
          email: "",
          first_name: "",
          last_name: "",
          role: "",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav]);

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("signOut error:", error);
    } finally {
      nav("/login", { replace: true });
    }
  }

  return (
    <div className={`min-h-screen font-[Nunito] ${BRAND.pageBg}`}>
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
          <TeacherSidebar
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            onLogout={handleLogout}
            me={me}
          />

          <main className="space-y-4">
            <TeacherTopbar title={title} onLogout={handleLogout} me={me} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="rounded-3xl border bg-white/80 p-4 shadow-sm backdrop-blur md:p-6"
                style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

            <div className="px-2 pb-2 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
              © {new Date().getFullYear()} GRABSUM School, Inc. • Teacher Portal
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Sidebar
// -----------------------------------------------------
function TeacherSidebar({ collapsed, setCollapsed, onLogout, me }) {
  const nav = useNavigate();

  const name = safeFullName(me.first_name, me.last_name, "Teacher");
  const initials = getInitials(me.first_name, me.last_name, "Teacher");
  const avatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(initials)}`;

  return (
    <aside
      className="rounded-3xl border bg-white/80 p-4 shadow-sm backdrop-blur"
      style={{
        borderColor: BRAND.stroke,
        boxShadow: BRAND.cardShadow,
        width: collapsed ? 88 : 280,
        transition: "width 180ms ease",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src={logo}
            alt="Grabsum Logo"
            className="h-11 w-11 rounded-2xl bg-white object-contain p-1"
            draggable={false}
          />
          {!collapsed ? (
            <div className="leading-tight">
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Grabsum SHS Portal
              </div>
              <div className="text-lg font-extrabold" style={{ color: BRAND.ink }}>
                Teacher
              </div>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => setCollapsed((s) => !s)}
          className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
          style={{ borderColor: BRAND.stroke }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" style={{ color: "rgba(43,26,18,0.70)" }} />
          ) : (
            <PanelLeftClose className="h-5 w-5" style={{ color: "rgba(43,26,18,0.70)" }} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="mt-5">
        {!collapsed ? (
          <div className="text-xs font-semibold" style={{ color: "rgba(43,26,18,0.50)" }}>
            Navigation
          </div>
        ) : null}

        <nav className="mt-2 space-y-1">
          {TEACHER_NAV.map((item) => (
            <TeacherSideLink key={item.key} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Bottom profile */}
      <div
        className="mt-5 rounded-3xl border bg-white/70 p-3"
        style={{ borderColor: "rgba(43,26,18,0.12)" }}
      >
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl}
            alt="Teacher avatar"
            className="h-10 w-10 rounded-2xl border bg-white"
            style={{ borderColor: BRAND.stroke }}
          />

          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                {me.loading ? "Loading…" : name}
              </div>
              <div className="text-xs truncate" style={{ color: BRAND.muted }}>
                {me.loading ? "—" : me.email || "—"}
              </div>
              {me.err ? (
                <div className="mt-1 text-[11px] font-semibold text-rose-600">
                  {me.err}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`mt-3 ${collapsed ? "grid gap-2" : "grid grid-cols-2 gap-2"}`}>
          <button
            onClick={() => nav("/teacher/settings")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
            style={{ borderColor: "rgba(43,26,18,0.12)", color: BRAND.ink }}
            title="Settings"
          >
            <Settings className="h-4 w-4" style={{ color: "rgba(43,26,18,0.60)" }} />
            {!collapsed ? "Settings" : null}
          </button>

          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
            style={{ borderColor: "rgba(43,26,18,0.12)", color: "#b91c1c" }}
            title="Logout"
          >
            <LogOut className="h-4 w-4" style={{ color: "#b91c1c" }} />
            {!collapsed ? "Logout" : null}
          </button>
        </div>
      </div>
    </aside>
  );
}

function TeacherSideLink({ item, collapsed }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) =>
        "group flex items-center gap-3 rounded-2xl px-3 py-2 transition " +
        (isActive ? "border bg-white" : "hover:bg-black/5")
      }
      style={({ isActive }) => ({
        borderColor: isActive ? BRAND.gold : "transparent",
      })}
      title={collapsed ? item.label : undefined}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 transition group-hover:bg-white"
        style={{ borderColor: "rgba(43,26,18,0.12)" }}
      >
        <Icon className="h-5 w-5" style={{ color: "rgba(43,26,18,0.65)" }} />
      </span>

      {!collapsed ? (
        <span className="font-semibold" style={{ color: "rgba(43,26,18,0.82)" }}>
          {item.label}
        </span>
      ) : null}
    </NavLink>
  );
}

// -----------------------------------------------------
// Topbar
// -----------------------------------------------------
function TeacherTopbar({ title, onLogout, me }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const name = safeFullName(me.first_name, me.last_name, "Teacher");
  const initials = getInitials(me.first_name, me.last_name, "Teacher");
  const avatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(initials)}`;

  useEffect(() => {
    function onDocClick(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header
      className="rounded-3xl border bg-white/80 p-3 shadow-sm backdrop-blur md:p-4"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="leading-tight">
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            Teacher Portal
          </div>
          <div className="text-xl font-extrabold" style={{ color: BRAND.ink }}>
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search (UI only) */}
          <div className="relative w-full md:w-[360px]">
            <input
              className="w-full rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: "rgba(43,26,18,0.14)", color: BRAND.ink }}
              placeholder="Search… (UI only)"
            />
          </div>

          {/* AI button (UI only) */}
          <button
            onClick={() => alert("AI Lesson Planner modal later.")}
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
            style={{ borderColor: "rgba(212,166,47,0.55)", color: BRAND.ink }}
          >
            <Sparkles className="h-4 w-4" style={{ color: BRAND.gold }} />
            AI Planner
          </button>

          {/* Notifications (UI only) */}
          <button
            className="relative grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
            style={{ borderColor: "rgba(43,26,18,0.14)" }}
            aria-label="Notifications"
            onClick={() => alert("Notifications UI (connect later).")}
          >
            <Bell className="h-5 w-5" style={{ color: "rgba(43,26,18,0.65)" }} />
            {/* set to 0 if you want none */}
            <span
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-black"
              style={{ background: BRAND.gold }}
            >
              3
            </span>
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-2 py-1.5 transition hover:bg-white"
              style={{ borderColor: "rgba(43,26,18,0.14)" }}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <img
                src={avatarUrl}
                alt="Teacher profile"
                className="h-8 w-8 rounded-xl border bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                  {me.loading ? "Loading…" : name}
                </div>
                <div className="text-xs" style={{ color: BRAND.muted }}>
                  {me.loading ? "—" : me.email || "—"}
                </div>
              </div>
              <ChevronDown className="h-4 w-4" style={{ color: "rgba(43,26,18,0.55)" }} />
            </button>

            <AnimatePresence>
              {open ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border bg-white shadow-lg"
                  style={{ borderColor: BRAND.stroke }}
                  role="menu"
                >
                  <DropdownItem
                    icon={UserCircle2}
                    label="View Profile"
                    onClick={() => {
                      setOpen(false);
                      nav("/teacher/settings");
                    }}
                  />
                  <DropdownItem
                    icon={Settings}
                    label="Account Settings"
                    onClick={() => {
                      setOpen(false);
                      nav("/teacher/settings");
                    }}
                  />
                  <DropdownItem icon={HelpCircle} label="Help & Support" onClick={() => alert("Help & Support")} />
                  <div className="h-px" style={{ background: BRAND.stroke }} />
                  <DropdownItem
                    icon={LogOut}
                    label="Logout"
                    danger
                    onClick={async () => {
                      setOpen(false);
                      await onLogout();
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

function DropdownItem({ icon, label, onClick, danger = false }) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
      style={{ color: danger ? "#b91c1c" : BRAND.ink }}
      role="menuitem"
    >
      <Icon className="h-4 w-4" style={{ color: danger ? "#b91c1c" : "rgba(43,26,18,0.65)" }} />
      {label}
    </button>
  );
}
