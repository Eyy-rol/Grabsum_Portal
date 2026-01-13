// src/layouts/StudentLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, BookOpen, CalendarDays, Megaphone, User, Bell, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const BRAND = {
  bg: "#fbf6ef",
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
  gold: "#d4a62f",
  softGoldBg: "rgba(212,166,47,0.14)",
};

const NAV = [
  { key: "dash", label: "Dashboard", icon: LayoutDashboard, to: "/student/dashboard" },
  { key: "courses", label: "Courses", icon: BookOpen, to: "/student/courses" },
  { key: "schedule", label: "Schedule", icon: CalendarDays, to: "/student/schedule" },
  { key: "ann", label: "Announcements", icon: Megaphone, to: "/student/announcements" },
  { key: "profile", label: "Profile", icon: User, to: "/student/profile" },
];

function titleFromPath(path) {
  if (path.includes("/student/dashboard")) return "Dashboard";
  if (path.includes("/student/courses")) return "Courses";
  if (path.includes("/student/schedule")) return "Schedule";
  if (path.includes("/student/announcements")) return "Announcements";
  if (path.includes("/student/profile")) return "Profile";
  return "Student Portal";
}

function buildStudentName(stu) {
  const fn = String(stu?.first_name || "").trim();
  const mi = String(stu?.middle_initial || "").trim();
  const ln = String(stu?.last_name || "").trim();
  const ext = String(stu?.extension || "").trim();

  const mid = mi ? `${mi.replace(".", "")}.` : "";
  const base = [fn, mid, ln].filter(Boolean).join(" ").trim();
  return [base, ext].filter(Boolean).join(" ").trim();
}

function initialLetter(name) {
  return String(name || "S").trim().slice(0, 1).toUpperCase() || "S";
}

export default function StudentLayout() {
  const location = useLocation();
  const nav = useNavigate();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [me, setMe] = useState({
    loading: true,
    err: "",
    user_id: "",
    name: "Student",
    student_number: "",
    email: "",
    notifications: 0,
  });

  // ✅ Fetch: auth user -> students (preferred) + optional profiles fallback
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user?.id) {
          if (alive) {
            setMe({
              loading: false,
              err: "",
              user_id: "",
              name: "Student",
              student_number: "",
              email: "",
              notifications: 0,
            });
          }
          return;
        }

        // 1) students table (best source)
        const { data: stu, error: stuErr } = await supabase
          .from("students")
          .select("student_number, email, first_name, middle_initial, last_name, extension")
          .eq("user_id", user.id)
          .maybeSingle();

        // 2) profiles table (fallback) - keep safe, don't assume columns exist
        // If your profiles table does NOT have full_name, remove it here.
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!alive) return;

        const nameFromStudents = buildStudentName(stu);
        const nameFromProfiles = String(prof?.full_name || "").trim();

        const displayName =
          nameFromStudents ||
          nameFromProfiles ||
          String(user.user_metadata?.full_name || "").trim() ||
          user.email ||
          "Student";

        setMe({
          loading: false,
          err: stuErr ? "" : "", // keep UI clean
          user_id: user.id,
          name: String(displayName),
          student_number: String(stu?.student_number || ""),
          email: String(stu?.email || prof?.email || user.email || ""),
          notifications: 0,
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
  }, []);

  async function handleLogout() {
    try {
      setMobileOpen(false);
      setMe({
        loading: false,
        err: "",
        user_id: "",
        name: "Student",
        student_number: "",
        email: "",
        notifications: 0,
      });

      const { error } = await supabase.auth.signOut();
      if (error) console.error("signOut error:", error);
    } finally {
      nav("/login", { replace: true });
    }
  }

  return (
    <div className="min-h-screen font-[Nunito]" style={{ background: BRAND.bg }}>
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        {/* Mobile header */}
        <div className="mb-4 flex items-center justify-between md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" style={{ color: BRAND.muted }} />
          </button>

          <div className="text-center leading-tight">
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Student Portal
            </div>
            <div className="text-base font-extrabold" style={{ color: BRAND.brown }}>
              {title}
            </div>
          </div>

        
         
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <Sidebar me={me} onLogout={handleLogout} />
          </aside>

          {/* Main */}
          <main className="space-y-4">
            <Topbar title={title} me={me} onLogout={handleLogout} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="rounded-3xl border bg-white p-4 shadow-sm md:p-6"
                style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

            <div className="px-1 pb-2 text-xs" style={{ color: "rgba(43,26,18,0.45)" }}>
              © {new Date().getFullYear()} Grabsum SHS Portal • Student UI
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.35)" }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] bg-white"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}
            >
              <div className="flex items-center justify-between p-4">
                <div className="leading-tight">
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Grabsum SHS Portal
                  </div>
                  <div className="text-lg font-extrabold" style={{ color: BRAND.brown }}>
                    Student
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 hover:bg-white"
                  style={{ borderColor: BRAND.stroke }}
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" style={{ color: BRAND.muted }} />
                </button>
              </div>

              <div className="px-4 pb-4">
                <Sidebar
                  me={me}
                  onLogout={handleLogout}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ onNavigate, me, onLogout }) {
  return (
    <div
      className="rounded-3xl border bg-white p-4"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      {/* Brand */}
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <div className="text-xs tracking-wide" style={{ color: BRAND.muted }}>
            Grabsum SHS Portal
          </div>
          <div className="text-lg font-extrabold" style={{ color: BRAND.brown }}>
            Student
          </div>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
          <span className="text-sm font-black" style={{ color: BRAND.gold }}>
            {initialLetter(me.name)}
          </span>
        </div>
      </div>

      {/* Identity */}
      <div className="mt-3 rounded-2xl border bg-white/60 p-3" style={{ borderColor: BRAND.stroke }}>
        <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
          {me.loading ? "Loading…" : me.name}
        </div>
        <div className="mt-0.5 text-xs font-semibold" style={{ color: BRAND.muted }}>
          {me.student_number ? `Student #: ${me.student_number}` : me.email || ""}
        </div>
        {me.err ? <div className="mt-1 text-[11px] font-semibold text-rose-600">{me.err}</div> : null}
      </div>

      {/* Nav */}
      <div className="mt-4">
        <div className="text-xs font-semibold" style={{ color: "rgba(43,26,18,0.45)" }}>
          Navigation
        </div>

        <nav className="mt-2 space-y-1">
          {NAV.map((i) => (
            <NavLink
              key={i.key}
              to={i.to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                "group flex items-center gap-3 rounded-2xl px-3 py-2 transition" +
                (isActive ? " border" : " hover:bg-black/5")
              }
              style={({ isActive }) => ({
                borderColor: isActive ? BRAND.stroke : "transparent",
                background: isActive ? BRAND.softGoldBg : "transparent",
              })}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-2xl border bg-white/70 transition group-hover:bg-white"
                style={{ borderColor: BRAND.stroke }}
              >
                <i.icon className="h-5 w-5" style={{ color: "rgba(43,26,18,0.55)" }} />
              </span>
              <span className="font-semibold" style={{ color: "rgba(43,26,18,0.78)" }}>
                {i.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout */}
      <div className="mt-4 rounded-2xl border bg-white/60 p-3" style={{ borderColor: BRAND.stroke }}>
        <button
          onClick={onLogout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
        >
          <LogOut className="h-4 w-4" style={{ color: BRAND.muted }} />
          Logout
        </button>
      </div>
    </div>
  );
}

function Topbar({ title, me, onLogout }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="rounded-3xl border bg-white p-3 shadow-sm"
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="leading-tight">
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            Student Portal
          </div>
          <div className="text-xl font-extrabold" style={{ color: BRAND.brown }}>
            {title}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          <div className="text-right leading-tight">
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              {me.loading ? "Loading…" : me.name}
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              {me.student_number ? `Student #: ${me.student_number}` : me.email || ""}
            </div>
          </div>

          <button
            className="relative grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            aria-label="Notifications"
            onClick={() => alert("Notifications UI (wire later)")}
          >
            <Bell className="h-5 w-5" style={{ color: BRAND.muted }} />
            {me.notifications > 0 ? (
              <span
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-black"
                style={{ background: BRAND.gold }}
              >
                {me.notifications}
              </span>
            ) : null}
          </button>

          <div className="relative">
            <button
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
              aria-label="Open profile menu"
            >
              <span className="grid h-8 w-8 place-items-center rounded-2xl" style={{ background: BRAND.softGoldBg }}>
                <span className="text-xs font-black" style={{ color: BRAND.gold }}>
                  {initialLetter(me.name)}
                </span>
              </span>
              <span className="hidden sm:block">Account</span>
              <ChevronDown className="h-4 w-4" style={{ color: BRAND.muted }} />
            </button>

            <AnimatePresence>
              {open ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border bg-white shadow-lg"
                  style={{ borderColor: BRAND.stroke }}
                >
                  <button
                    onClick={() => {
                      setOpen(false);
                      nav("/student/profile");
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
                    style={{ color: BRAND.brown }}
                  >
                    View Profile
                  </button>

                  <div className="h-px" style={{ background: BRAND.stroke }} />

                  <button
                    onClick={async () => {
                      setOpen(false);
                      await onLogout();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
                    style={{ color: BRAND.brown }}
                  >
                    Logout
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
