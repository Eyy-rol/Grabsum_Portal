// src/layouts/StudentLayout.tsx
import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Megaphone,
  User,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient"; // adjust path


type IconType = React.ComponentType<{ className?: string }>;

const BRAND = {
  bg: "#fbf6ef", // warm off-white
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGold: "rgba(212,166,47,0.18)",
  softGoldBg: "rgba(212,166,47,0.14)",
};

const NAV = [
  { key: "dash", label: "Dashboard", icon: LayoutDashboard, to: "/student/dashboard" },
  { key: "courses", label: "Courses", icon: BookOpen, to: "/student/courses" },
  { key: "schedule", label: "Schedule", icon: CalendarDays, to: "/student/schedule" },
  { key: "ann", label: "Announcements", icon: Megaphone, to: "/student/announcements" },
  { key: "profile", label: "Profile", icon: User, to: "/student/profile" },
  { key: "settings", label: "Settings", icon: Settings, to: "/student/settings" },
] as const;

function titleFromPath(path: string) {
  if (path.includes("/student/dashboard")) return "Dashboard";
  if (path.includes("/student/courses")) return "Courses";
  if (path.includes("/student/schedule")) return "Schedule";
  if (path.includes("/student/announcements")) return "Announcements";
  if (path.includes("/student/profile")) return "Profile";
  if (path.includes("/student/settings")) return "Settings";
  return "Student Portal";
}

export default function StudentLayout() {
  const location = useLocation();
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const [mobileOpen, setMobileOpen] = useState(false);

  // demo header identity (replace with your auth user later)
  const student = {
    name: "Juan Dela Cruz",
    id: "2024-000123",
    notifications: 3,
  };

  return (
    <div className="min-h-screen font-[Nunito]" style={{ background: BRAND.bg }}>
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        {/* Mobile header row */}
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

          <button
            className="relative grid h-11 w-11 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" style={{ color: BRAND.muted }} />
            {student.notifications > 0 ? (
              <span
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-black"
                style={{ background: BRAND.gold }}
              >
                {student.notifications}
              </span>
            ) : null}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <Sidebar />
          </aside>

          {/* Main */}
          <main className="space-y-4">
            <Topbar title={title} student={student} />

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="rounded-3xl border bg-white p-4 shadow-sm md:p-6"
                style={{
                  borderColor: BRAND.stroke,
                  boxShadow: BRAND.cardShadow,
                }}
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
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNavigate();

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

        <div
          className="grid h-10 w-10 place-items-center rounded-2xl"
          style={{ background: BRAND.softGoldBg }}
        >
          <span className="text-sm font-black" style={{ color: BRAND.gold }}>
            S
          </span>
        </div>
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
                "group flex items-center gap-3 rounded-2xl px-3 py-2 transition"
                + (isActive ? " border" : " hover:bg-black/5")
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

      {/* Bottom actions */}
      <div className="mt-4 rounded-2xl border bg-white/60 p-3" style={{ borderColor: BRAND.stroke }}>
        <button
          onClick={() => alert("Help & Support (wire later)")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
        >
          <HelpCircle className="h-4 w-4" style={{ color: BRAND.muted }} />
          Help & Support
        </button>

        <button
          onClick={() => alert("Logout (wire Supabase later)")}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white"
          style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
        >
          <LogOut className="h-4 w-4" style={{ color: BRAND.muted }} />
          Logout
        </button>

        <button
          onClick={() => nav("/")}
          className="mt-2 w-full text-center text-xs font-semibold hover:underline"
          style={{ color: BRAND.gold }}
        >
          Back to site
        </button>
      </div>
    </div>
  );
}

function Topbar({
  title,
  student,
}: {
  title: string;
  student: { name: string; id: string; notifications: number };
}) {
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
              {student.name}
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              ID: {student.id}
            </div>
          </div>

          <button
            className="relative grid h-10 w-10 place-items-center rounded-2xl border bg-white/70 transition hover:bg-white"
            style={{ borderColor: BRAND.stroke }}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" style={{ color: BRAND.muted }} />
            {student.notifications > 0 ? (
              <span
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-black"
                style={{ background: BRAND.gold }}
              >
                {student.notifications}
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
              <span
                className="grid h-8 w-8 place-items-center rounded-2xl"
                style={{ background: BRAND.softGoldBg }}
              >
                <span className="text-xs font-black" style={{ color: BRAND.gold }}>
                  {student.name.slice(0, 1).toUpperCase()}
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
                    onClick={() => alert("View Profile")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
                    style={{ color: BRAND.brown }}
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => alert("Account Settings")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
                    style={{ color: BRAND.brown }}
                  >
                    Account Settings
                  </button>
                  <button
                    onClick={() => alert("Help")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-black/5"
                    style={{ color: BRAND.brown }}
                  >
                    Help
                  </button>
                  <button
                    onClick={() => alert("Logout (wire Supabase later)")}
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
