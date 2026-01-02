// src/layout/adminLayout.tsx

import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
} from "lucide-react";

import { TOKENS } from "../styles/tokens";

// Generic icon type for lucide-react icons
type IconType = React.ComponentType<{ className?: string }>;

// Navigation item types
type NavItem =
  | { key: "home" | "calendar" | "announcement"; label: string; icon: IconType; to: string }
  | {
      key: "students" | "teacher";
      label: string;
      icon: IconType;
      children: { key: string; label: string; icon: IconType; to: string }[];
    };

const NAV: NavItem[] = [
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

  return (
    <div className={`min-h-screen ${TOKENS.bg} ${TOKENS.text} font-[Nunito]`}>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <Sidebar />

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

            <Footer />
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  // allow dynamic keys (students, teacher)
  const [open, setOpen] = useState<Record<string, boolean>>({
    students: true,
    teacher: true,
  });

  return (
    <aside className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <div className="text-xs tracking-wide text-black/55">Grabsum SHS Portal</div>
          <div className="text-lg font-extrabold">Admin</div>
        </div>
        <div className={`h-10 w-10 rounded-2xl ${TOKENS.goldSoft} grid place-items-center`}>
          <span className={`text-sm font-black ${TOKENS.gold}`}>G</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-black/50">Navigation</div>
        <nav className="mt-2 space-y-1">
          {NAV.map((item) =>
            "children" in item ? (
              <div key={item.key} className="space-y-1">
                <button
                  onClick={() => setOpen((s) => ({ ...s, [item.key]: !s[item.key] }))}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-black/5"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-2xl border ${TOKENS.border} bg-white/60`}>
                    {(() => {
                      const Icon = item.icon;
                      return <Icon className="h-5 w-5 text-black/60" />;
                    })()}
                  </span>

                  <span className="flex-1 font-semibold text-black/75">{item.label}</span>
                  <ChevronDown
                    className={"h-4 w-4 text-black/60 transition " + (open[item.key] ? "rotate-180" : "")}
                  />
                </button>

                {open[item.key] ? (
                  <div className="ml-3 space-y-1 border-l border-black/10 pl-3">
                    {item.children.map((c) => (
                      <SideLink key={c.key} to={c.to} icon={c.icon} label={c.label} compact />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <SideLink key={item.key} to={item.to} icon={item.icon} label={item.label} />
            )
          )}
        </nav>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-3">
        <div className="text-sm font-bold">Admin User</div>
        <div className="mt-1 text-xs text-black/55">admin@grabsum.edu</div>
        <button
          onClick={() => alert("Logout later (Supabase Auth).")}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
        >
          <LogOut className="h-4 w-4 text-black/60" />
          Log out
        </button>
      </div>
    </aside>
  );
}

function SideLink({
  to,
  icon,
  label,
  compact = false,
}: {
  to: string;
  icon: IconType;
  label: string;
  compact?: boolean;
}) {
  const Icon = icon;

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        "group flex items-center gap-3 rounded-2xl px-3 py-2 transition " +
        (isActive ? `${TOKENS.goldSoft} border ${TOKENS.border}` : "hover:bg-black/5") +
        (compact ? " text-sm" : "")
      }
    >
      <span
        className={
          "grid place-items-center rounded-2xl border transition " +
          (compact ? "h-8 w-8" : "h-9 w-9") +
          ` ${TOKENS.border} bg-white/60 group-hover:bg-white/80`
        }
      >
        <Icon className={compact ? "h-4 w-4 text-black/60" : "h-5 w-5 text-black/60"} />
      </span>
      <span className="font-semibold text-black/75">{label}</span>
    </NavLink>
  );
}

function Topbar({ title }: { title: string }) {
  return (
    <header className={`rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-3 shadow-sm`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="leading-tight">
          <div className="text-xs font-semibold text-black/50">Admin Panel</div>
          <div className="text-xl font-extrabold">{title}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-10 py-2 text-sm outline-none focus:bg-white"
              placeholder="Search…"
            />
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white/60 hover:bg-white/80">
            <Bell className="h-5 w-5 text-black/60" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <div className="px-2 pb-2 text-xs text-black/50">
      © {new Date().getFullYear()} Grabsum SHS Portal • Admin UI
    </div>
  );
}

function titleFromPath(path: string) {
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
