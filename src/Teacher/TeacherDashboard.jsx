// src/pages/teacher/TeacherDashboard.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Users,
  Upload,
  Sparkles,
  Megaphone,
  Clock,
  ArrowRight,
} from "lucide-react";

const BRAND = {
  gold: "#d4a62f",
  ink: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.08)",
};

function CardShell({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border bg-white ${className}`}
      style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
    >
      {children}
    </div>
  );
}

export default function TeacherDashboard() {
  // Demo data (replace later with Supabase)
  const stats = useMemo(
    () => [
      { label: "Total Classes", value: 6, icon: GraduationCap },
      { label: "Today's Classes", value: 3, icon: CalendarDays, sub: "Next: 8:00 AM" },
      { label: "Pending Lessons", value: 2, icon: BookOpen, sub: "Need upload" },
      { label: "Students", value: 187, icon: Users, sub: "Across classes" },
      { label: "Upcoming Schedule", value: "8:00 AM", icon: Clock, sub: "STEM 12-A" },
    ],
    []
  );

  const todaysSchedule = [
    { time: "8:00–9:00 AM", subject: "Gen Math", class: "STEM 12-A", room: "Room 302", count: 38 },
    { time: "10:00–11:00 AM", subject: "Research", class: "HUMSS 11-B", room: "Room 214", count: 41 },
    { time: "1:00–2:00 PM", subject: "Physics", class: "STEM 12-B", room: "Lab 1", count: 36 },
  ];

  const activity = [
    { what: "Uploaded lesson: Quadratic Functions", when: "10 minutes ago" },
    { what: "Posted grades: Gen Math Quiz #2", when: "2 hours ago" },
    { what: "New student submission: Activity Sheet", when: "Yesterday" },
    { what: "Updated class announcement", when: "2 days ago" },
  ];

  const announcements = [
    { title: "School Event: Foundation Day", date: "Aug 12", body: "Please remind your students about the schedule update." },
    { title: "Policy Update: ID Requirement", date: "Aug 10", body: "Students must bring their ID at all times within campus." },
    { title: "Urgent: Room Reassignment", date: "Aug 09", body: "STEM 12-A will temporarily move to Room 305." },
  ];

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: idx * 0.03 }}
            >
              <CardShell>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {s.label}
                      </div>
                      <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.ink }}>
                        {s.value}
                      </div>
                      {s.sub ? (
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {s.sub}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                      style={{ borderColor: "rgba(212,166,47,0.35)" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: BRAND.gold }} />
                    </div>
                  </div>
                </div>
              </CardShell>
            </motion.div>
          );
        })}
      </div>

      {/* Quick actions */}
      <CardShell>
        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                Quick Access
              </div>
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Common actions you can do right now
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActionButton
              icon={Upload}
              label="Upload New Lesson"
              primary
              onClick={() => alert("Open Upload Lesson modal (UI next).")}
            />
            <ActionButton
              icon={Sparkles}
              label="AI Lesson Planner ✨"
              primary
              onClick={() => alert("Open AI planner modal (UI next).")}
            />
            <ActionButton
              icon={CalendarDays}
              label="View Today's Schedule"
              onClick={() => alert("Navigate to /teacher/schedule (wire later).")}
            />
            <ActionButton
              icon={Megaphone}
              label="Create Announcement"
              onClick={() => alert("Open announcement modal (UI next).")}
            />
          </div>
        </div>
      </CardShell>

      {/* Main grid: Schedule + Activity + Announcements + Calendar */}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Today's schedule */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                    Today's Schedule
                  </div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Your classes for today
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {todaysSchedule.map((c) => (
                  <div
                    key={c.time + c.class}
                    className="rounded-2xl border bg-white p-4"
                    style={{ borderColor: BRAND.stroke }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {c.time}
                        </div>
                        <div className="mt-0.5 text-sm font-extrabold truncate" style={{ color: BRAND.ink }}>
                          {c.subject} • {c.class}
                        </div>
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {c.room} • {c.count} students
                        </div>
                      </div>

                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-black/5"
                        style={{ borderColor: "rgba(212,166,47,0.55)", color: BRAND.ink }}
                        onClick={() => alert("Open schedule details panel (UI next).")}
                      >
                        View Details <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardShell>

          {/* Recent activity */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div>
                <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                  Recent Activity
                </div>
                <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                  Latest updates from your work
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {activity.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 rounded-2xl border bg-white px-4 py-3"
                    style={{ borderColor: BRAND.stroke }}
                  >
                    <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                      {a.what}
                    </div>
                    <div className="shrink-0 text-xs font-semibold" style={{ color: BRAND.muted }}>
                      {a.when}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardShell>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Announcements preview */}
          <CardShell>
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
                    Announcements
                  </div>
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Latest from admin
                  </div>
                </div>
                <button
                  className="rounded-2xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  style={{ color: BRAND.gold }}
                  onClick={() => alert("Go to /teacher/announcements")}
                >
                  View All
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {announcements.map((an, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-4" style={{ borderColor: BRAND.stroke }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold truncate" style={{ color: BRAND.ink }}>
                          {an.title}
                        </div>
                        <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                          {an.body}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs font-semibold" style={{ color: BRAND.muted }}>
                        {an.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardShell>

          {/* Calendar widget */}
          <CalendarWidget />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary = false }) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition " +
        (primary ? "hover:-translate-y-[1px]" : "hover:bg-black/5")
      }
      style={{
        borderColor: primary ? "rgba(212,166,47,0.55)" : BRAND.stroke,
        background: primary ? "rgba(212,166,47,0.18)" : "white",
      }}
    >
      <div>
        <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
          {label}
        </div>
        <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
          {primary ? "Recommended" : "Open"}
        </div>
      </div>
      <div
        className="grid h-10 w-10 place-items-center rounded-2xl border bg-white"
        style={{ borderColor: primary ? "rgba(212,166,47,0.55)" : BRAND.stroke }}
      >
        <Icon className="h-5 w-5" style={{ color: primary ? BRAND.gold : "rgba(43,26,18,0.65)" }} />
      </div>
    </button>
  );
}

function CalendarWidget() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // sample highlight days (classes)
  const highlighted = new Set([2, 5, 9, 12, 16, 19, 22, 25]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = today.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <CardShell>
      <div className="p-4 md:p-5">
        <div>
          <div className="text-sm font-extrabold" style={{ color: BRAND.ink }}>
            Calendar
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {monthLabel}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold" style={{ color: BRAND.muted }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, idx) => {
            const isToday = d === today.getDate();
            const isHighlighted = d != null && highlighted.has(d);

            return (
              <button
                key={idx}
                className="aspect-square rounded-2xl border text-sm font-extrabold transition hover:bg-black/5"
                style={{
                  borderColor: "rgba(43,26,18,0.12)",
                  background: isToday ? "rgba(212,166,47,0.20)" : "white",
                  color: d ? BRAND.ink : "transparent",
                }}
                onClick={() => {
                  if (!d) return;
                  alert(`Clicked ${monthLabel} ${d} (show schedule list here).`);
                }}
              >
                <div className="grid h-full w-full place-items-center">
                  <div className="relative">
                    {d ?? 0}
                    {isHighlighted ? (
                      <span
                        className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                        style={{ background: BRAND.gold }}
                      />
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-xs font-semibold" style={{ color: BRAND.muted }}>
          • Gold dot indicates days with classes.
        </div>
      </div>
    </CardShell>
  );
}


