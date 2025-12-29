// src/dev/pages/DevDashboard.jsx
import React, { useMemo } from "react";

function Badge({ tone = "neutral", children }) {
  const cls = {
    success: "bg-[#e9f7ef] text-[#1e6b3a] border-[#c9ead6]",
    warning: "bg-[#fff3da] text-[#7a4b00] border-[#f3d7a3]",
    danger: "bg-[#fde8e8] text-[#8a1c1c] border-[#f5bcbc]",
    neutral: "bg-[#f5f5f5] text-black/60 border-black/10",
    info: "bg-[#eaf2ff] text-[#1d4ed8] border-[#c7dbff]",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
      <div className="text-xs text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-black/40">{hint}</div> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, right, children }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-black/50">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function TimelineRow({ time, title, meta, status, tone }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
      <div className="min-w-[140px]">
        <div className="text-xs text-black/50">{time}</div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-black/50">{meta}</div>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={tone}>{status}</Badge>
        <button className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
          View Details
        </button>
      </div>
    </div>
  );
}

export default function DevDashboard() {
  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const timeline = [
    { time: "08:00 AM", title: "auth.refresh", meta: "Token auto-refresh cycle", status: "Completed", tone: "success" },
    { time: "08:12 AM", title: "profiles.select", meta: "Query latency 850ms", status: "Slow", tone: "warning" },
    { time: "08:40 AM", title: "backup.daily", meta: "Storage: 2.1GB", status: "Running", tone: "info" },
    { time: "09:10 AM", title: "seed-demo-users", meta: "Create demo teacher/student", status: "Upcoming", tone: "neutral" },
  ];

  return (
    <div className="space-y-4">
      {/* Top welcome + next item */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs text-black/50">{today}</div>
          <div className="mt-1 text-2xl font-semibold">Welcome back, Developer!</div>
          <div className="mt-2 text-sm text-black/50">
            Tip of the day: Summarize system changes in 2–3 sentences for clean audit trails.
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[#fff6e6] p-6 shadow-sm">
          <div className="text-xs text-black/50">Next scheduled task in</div>
          <div className="mt-1 text-2xl font-semibold">Now</div>
          <div className="mt-1 text-sm text-black/60">
            audit-log-sync • 09:15 AM
          </div>
          <div className="mt-4">
            <button className="w-full rounded-2xl bg-[#e7aa2f] px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
              View Queue
            </button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Stat label="Active Sessions" value="128" hint="Last 15 minutes" />
        <Stat label="API Errors" value="3" hint="Today" />
        <Stat label="RLS Policy Health" value="OK" hint="0 failing checks" />
        <Stat label="Pending Migrations" value="1" hint="Needs review" />
      </div>

      {/* Main content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard
            title="Today’s System Timeline"
            subtitle="Chronological view • with status"
            right={
              <button className="rounded-2xl bg-[#e7aa2f] px-4 py-2 text-xs font-semibold text-black hover:opacity-90">
                View Full Timeline
              </button>
            }
          >
            <div className="space-y-3">
              {timeline.map((t) => (
                <TimelineRow key={t.time + t.title} {...t} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Quick Actions" subtitle="Developer shortcuts (UI only).">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { t: "Seed Sample Users", d: "Create demo teacher/student/dev." },
                { t: "Toggle Feature Flag", d: "Enable/disable modules safely." },
                { t: "Review Slow Queries", d: "Inspect latency & indexes." },
              ].map((x) => (
                <button
                  key={x.t}
                  className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4 text-left hover:bg-black/5"
                >
                  <div className="text-sm font-semibold">{x.t}</div>
                  <div className="mt-1 text-xs text-black/50">{x.d}</div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right column widgets */}
        <div className="space-y-4">
          <SectionCard
            title="Announcements"
            subtitle="Latest updates from Super Admin"
            right={<button className="text-xs font-semibold text-[#e7aa2f] hover:underline">View All</button>}
          >
            <div className="text-sm text-black/50">Loading announcements…</div>
          </SectionCard>

          <SectionCard title="Release Calendar" subtitle="Official schedule (read-only)">
            <div className="flex items-center justify-between">
              <button className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-[#fafafa] hover:bg-black/5">
                ‹
              </button>
              <div className="rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-semibold">
                December 2025
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-[#fafafa] hover:bg-black/5">
                ›
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-black/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl border border-black/10 bg-[#fafafa] grid place-items-center text-xs text-black/70"
                >
                  {i < 2 ? "" : i - 1}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="info">Maintenance</Badge>
              <Badge tone="warning">Release</Badge>
              <Badge tone="danger">Incident</Badge>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
