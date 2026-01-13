// src/Admin/Admins/AdminHome.jsx
// Admin Home (wired to Supabase) — UI refresh (Tailwind + shadcn)
// ✅ Keeps Supabase + React Query wiring intact
// ✅ Retains gold brand accent
// ✅ Removes Tabs (shows all recent activities)
// ✅ Recent Activity uses divider lines (no box borders)
// ✅ Reduced white blank space in Recent Activity
// ✅ Adds Enrollment visualizations (perfect donut; no extra deps)
// ✅ Removes “Status mix / Snapshot…” text (per request) + prevents donut distortion on wide screens

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  Users,
  Clock,
  GraduationCap,
  CalendarDays,
  Megaphone,
  LayoutList,
  Activity,
  ArrowRight,
  UserCog,
  Bell,
  ShieldCheck,
  BookOpenCheck,
  PieChart,
  BarChart3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CalendarWidget from "../../components/CalendarWidget";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* =======================
   BRAND TOKENS (gold)
======================= */
const BRAND = {
  gold: "#DAA520",
  goldSoft: "rgba(218,165,32,0.14)",
  goldBorder: "rgba(218,165,32,0.28)",
  goldBorderSoft: "rgba(218,165,32,0.25)",
};

/* =======================
   DATA FETCHERS (UNCHANGED)
======================= */

async function fetchEnrollmentStats() {
  const totalRes = await supabase.from("enrollment").select("id", { count: "exact", head: true });
  if (totalRes.error) throw totalRes.error;

  const pendingRes = await supabase
    .from("enrollment")
    .select("id", { count: "exact", head: true })
    .eq("st_application_status", "Pending");
  if (pendingRes.error) throw pendingRes.error;

  const enrolledRes = await supabase
    .from("enrollment")
    .select("id", { count: "exact", head: true })
    .eq("st_application_status", "Enrolled");
  if (enrolledRes.error) throw enrolledRes.error;

  return {
    total: totalRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    enrolled: enrolledRes.count ?? 0,
  };
}

async function fetchTeachersCount() {
  const r1 = await supabase.from("teachers").select("id", { count: "exact", head: true });
  if (!r1.error) return r1.count ?? 0;

  const r2 = await supabase.from("teachers").select("user_id", { count: "exact", head: true });
  if (!r2.error) return r2.count ?? 0;

  throw r1.error;
}

function formatStudentName(e) {
  if (!e) return null;
  const mi = e.st_mi ? ` ${String(e.st_mi).replace(".", "")}.` : "";
  const ext = e.st_ext ? ` ${e.st_ext}` : "";
  return `${e.st_lname}, ${e.st_fname}${mi}${ext}`.trim();
}

async function fetchActivities() {
  const { data, error } = await supabase
    .from("activity_logs")
    .select(
      `
      id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      message,
      metadata,
      created_at,
      application_id,
      enrollment:enrollment!activity_logs_application_id_fkey (
        application_id,
        st_fname,
        st_lname,
        st_mi,
        st_ext,
        st_number,
        st_application_status
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw error;

  return (data || []).map((a) => {
    const e = a.enrollment;
    const studentName = formatStudentName(e);

    let type = "system";
    const action = String(a.action || "");
    if (action.startsWith("enrollment")) type = "student";
    if (action.startsWith("teacher")) type = "teacher";
    if (action.startsWith("announcement")) type = "announcement";
    if (action.startsWith("calendar")) type = "calendar";
    if (action.startsWith("section") || action.startsWith("student.section")) type = "section";

    let text = a.message || a.action || "Activity";

    if (a.action === "enrollment.created" && studentName) {
      text = `New application submitted: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""}`;
    }

    if (a.action === "enrollment.status_changed") {
      const from = a.metadata?.from ?? a.metadata?.old ?? a.metadata?.prev;
      const to = a.metadata?.to ?? a.metadata?.new ?? a.metadata?.next;
      if (studentName) {
        text = `Status updated: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""} — ${from ?? "?"} → ${to ?? "?"}`;
      } else {
        text = `Enrollment status updated — ${from ?? "?"} → ${to ?? "?"}`;
      }
    }

    if (a.action === "enrollment.status_changed" && a.metadata?.to === "Enrolled") {
      text = studentName
        ? `Student enrolled: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""}`
        : `Student enrolled`;
    }

    if (a.action === "teacher.created") {
      const tname = a.metadata?.name || a.metadata?.teacher_name;
      text = tname ? `New teacher added: ${tname}` : a.message || "New teacher added";
    }

    if (a.action === "teacher.deleted") {
      const tname = a.metadata?.name || a.metadata?.teacher_name;
      text = tname ? `Teacher deleted: ${tname}` : a.message || "Teacher deleted";
    }

    if (a.action === "calendar.created") {
      const title = a.metadata?.title;
      text = title ? `Calendar event added: ${title}` : a.message || "Calendar event added";
    }

    if (a.action === "calendar.deleted") {
      const title = a.metadata?.title;
      text = title ? `Calendar event deleted: ${title}` : a.message || "Calendar event deleted";
    }

    if (a.action === "student.section_assigned" && studentName) {
      text = `Section assignment updated: ${studentName}`;
    }

    return {
      id: a.id,
      type,
      text,
      at: new Date(a.created_at),
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
    };
  });
}

/* =======================
   COMPONENT
======================= */

export default function AdminHome({ onNavigate }) {
  const statsQ = useQuery({
    queryKey: ["adminhome", "stats"],
    queryFn: fetchEnrollmentStats,
    refetchInterval: 30000,
  });

  const teachersQ = useQuery({
    queryKey: ["adminhome", "teachersCount"],
    queryFn: fetchTeachersCount,
    refetchInterval: 30000,
  });

  const activityQ = useQuery({
    queryKey: ["adminhome", "activity"],
    queryFn: fetchActivities,
    refetchInterval: 15000,
  });

  const anyError = statsQ.error || teachersQ.error || activityQ.error;

  const liveText = useMemo(() => {
    const fetching = statsQ.isFetching || teachersQ.isFetching || activityQ.isFetching;
    return fetching ? "Refreshing data…" : null;
  }, [statsQ.isFetching, teachersQ.isFetching, activityQ.isFetching]);

  const viz = useMemo(() => {
    const total = statsQ.data?.total ?? 0;
    const pending = statsQ.data?.pending ?? 0;
    const enrolled = statsQ.data?.enrolled ?? 0;
    const other = Math.max(0, total - pending - enrolled);

    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return {
      total,
      pending,
      enrolled,
      other,
      pPending: pct(pending),
      pEnrolled: pct(enrolled),
      pOther: pct(other),
    };
  }, [statsQ.data]);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Admin Home
            </h1>
            <p className="text-sm text-muted-foreground">Overview of enrollment and school activity</p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-sm">
            <span
              className="grid h-7 w-7 place-items-center rounded-full border"
              style={{ background: BRAND.goldSoft, borderColor: BRAND.goldBorder }}
            >
              <Activity size={16} style={{ color: BRAND.gold }} />
            </span>
            <span className="font-extrabold text-foreground">Live</span>
            <span className="text-muted-foreground">updates</span>
          </div>
        </div>

        {anyError ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">
            <strong>Dashboard data error:</strong> {String(anyError?.message || anyError)}
          </div>
        ) : null}

        {/* Stats */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Applications"
            value={statsQ.data?.total}
            icon={<Users className="h-4 w-4" />}
            loading={statsQ.isLoading}
            onClick={() => onNavigate?.("enrollment")}
          />
          <StatCard
            title="Pending Applications"
            value={statsQ.data?.pending}
            icon={<Clock className="h-4 w-4" />}
            loading={statsQ.isLoading}
            onClick={() => onNavigate?.("enrollment")}
          />
          <StatCard
            title="Total Enrolled"
            value={statsQ.data?.enrolled}
            icon={<GraduationCap className="h-4 w-4" />}
            loading={statsQ.isLoading}
            onClick={() => onNavigate?.("students")}
          />
          <StatCard
            title="Total Teachers"
            value={teachersQ.data}
            icon={<Users className="h-4 w-4" />}
            loading={teachersQ.isLoading}
            onClick={() => onNavigate?.("teachers")}
          />
        </div>

        {/* Enrollment Visualizations */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base font-extrabold">Enrollment Overview</CardTitle>
                  <CardDescription className="text-xs">
                    Status distribution based on current applications
                  </CardDescription>
                </div>

                <div
                  className="grid h-9 w-9 place-items-center rounded-xl border"
                  style={{ background: BRAND.goldSoft, borderColor: BRAND.goldBorderSoft }}
                  aria-hidden="true"
                >
                  <PieChart className="h-4 w-4" style={{ color: BRAND.gold }} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {statsQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : (
                <EnrollmentViz
                  total={viz.total}
                  pending={viz.pending}
                  enrolled={viz.enrolled}
                  other={viz.other}
                  pPending={viz.pPending}
                  pEnrolled={viz.pEnrolled}
                  pOther={viz.pOther}
                />
              )}

              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => onNavigate?.("enrollment")}
                >
                  View enrollment <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 overflow-hidden">
            <CardHeader className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base font-extrabold">Enrollment Breakdown</CardTitle>
                  <CardDescription className="text-xs">Quick comparison of statuses</CardDescription>
                </div>

                <div
                  className="grid h-9 w-9 place-items-center rounded-xl border"
                  style={{ background: BRAND.goldSoft, borderColor: BRAND.goldBorderSoft }}
                  aria-hidden="true"
                >
                  <BarChart3 className="h-4 w-4" style={{ color: BRAND.gold }} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {statsQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : (
                <MiniBars total={viz.total} pending={viz.pending} enrolled={viz.enrolled} other={viz.other} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <div className="mb-3 space-y-0.5">
            <h2 className="text-base font-extrabold text-foreground">Quick actions</h2>
            <p className="text-xs text-muted-foreground">Shortcuts to common admin tasks</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickCard
              icon={<LayoutList className="h-4 w-4" />}
              label="Teacher Schedule"
              hint="View schedules"
              onClick={() => onNavigate?.("admin/teacher/schedule")}
            />
            <QuickCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Calendar Events"
              hint="School year schedule"
              onClick={() => onNavigate?.("calendar")}
            />
            <QuickCard
              icon={<Megaphone className="h-4 w-4" />}
              label="Announcements"
              hint="Post updates"
              onClick={() => onNavigate?.("announcements")}
            />
          </div>
        </div>

        <div className="my-6 h-px w-full bg-border" />

        {/* Lower Grid */}
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 min-w-0 overflow-hidden">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate?.("activity_logs")}
                  className="text-left outline-none"
                  title="Open full activity logs"
                >
                  <CardTitle className="text-base font-extrabold">Recent Activity</CardTitle>
                  <CardDescription className="text-xs">Latest actions (auto-refresh)</CardDescription>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate?.("activity_logs")}
                  className="rounded-full"
                >
                  Open logs <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-0 pb-2">
              <ActivityList activityQ={activityQ} onNavigate={onNavigate} />
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card className="lg:col-span-3 min-w-0 overflow-hidden">
            <CardHeader className="space-y-1">
              <button
                type="button"
                onClick={() => onNavigate?.("calendar")}
                className="text-left outline-none"
                title="Open calendar"
              >
                <CardTitle className="text-base font-extrabold">Calendar</CardTitle>
                <CardDescription className="text-xs">Read-only view of school events</CardDescription>
              </button>
            </CardHeader>

            <CardContent className="pt-0 overflow-hidden">
              <div className="relative isolate overflow-hidden rounded-xl border bg-card p-2">
                <CalendarWidget readOnly />
              </div>
            </CardContent>
          </Card>
        </div>

        {liveText ? <div className="mt-4 text-xs font-semibold text-muted-foreground">{liveText}</div> : null}
      </div>
    </div>
  );
}

/* =======================
   Enrollment Viz (Perfect Donut + stacked bar)
   - Removes Status mix text
   - Prevents donut distortion on wide screens
======================= */

function EnrollmentViz({ total, pending, enrolled, other, pPending, pEnrolled, pOther }) {
  const cEnrolled = BRAND.gold;
  const cPending = "rgba(17,24,39,0.28)";
  const cOther = "rgba(17,24,39,0.12)";

  // Angles from raw counts (prevents rounding slivers)
  const totalSafe = Math.max(0, total);
  const ang = (n) => (totalSafe > 0 ? (n / totalSafe) * 360 : 0);

  const a = ang(enrolled);
  const b = ang(pending);

  const donutBg =
    totalSafe === 0
      ? `conic-gradient(rgba(17,24,39,0.10) 0deg 360deg)`
      : `conic-gradient(
          ${cEnrolled} 0deg ${a}deg,
          ${cPending} ${a}deg ${a + b}deg,
          ${cOther} ${a + b}deg 360deg
        )`;

  const aria = `Enrollment distribution: ${pEnrolled}% enrolled (${enrolled}), ${pPending}% pending (${pending}), ${pOther}% other (${other}), total ${totalSafe}.`;

  return (
    <div className="space-y-4">
      {/* Donut + Legend */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Donut (never shrinks; stays perfectly round) */}
        <div
          className="relative aspect-square w-24 min-w-[96px] shrink-0 rounded-full"
          style={{ background: donutBg }}
          role="img"
          aria-label={aria}
        >
          {/* proportional cutout */}
          <div className="absolute inset-[14%] rounded-full bg-card shadow-sm" />

          {/* label */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-tight">
              <div className="text-lg font-extrabold text-foreground">{totalSafe}</div>
              <div className="text-[10px] font-semibold text-muted-foreground">Total</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full space-y-2 sm:max-w-[260px]">
          <LegendRow label="Enrolled" color={cEnrolled} value={`${enrolled} (${pEnrolled}%)`} />
          <LegendRow label="Pending" color={cPending} value={`${pending} (${pPending}%)`} />
          <LegendRow label="Other" color={cOther} value={`${other} (${pOther}%)`} />
        </div>
      </div>

      {/* Stacked bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-extrabold text-foreground">Distribution</div>
          <div className="text-[11px] font-semibold text-muted-foreground">Total: {totalSafe}</div>
        </div>

        <div
          className="h-3 w-full overflow-hidden rounded-full border bg-muted/30"
          style={{ borderColor: "hsl(var(--border))" }}
          aria-hidden="true"
        >
          <div className="flex h-full w-full">
            <div style={{ width: `${pEnrolled}%`, background: cEnrolled }} />
            <div style={{ width: `${pPending}%`, background: cPending }} />
            <div style={{ width: `${pOther}%`, background: cOther }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ label, color, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="text-xs font-extrabold text-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{value}</span>
    </div>
  );
}

function MiniBars({ total, pending, enrolled, other }) {
  const safePct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-3">
      <MetricBar label="Enrolled" value={enrolled} pct={safePct(enrolled)} accent />
      <MetricBar label="Pending" value={pending} pct={safePct(pending)} />
      <MetricBar label="Other" value={other} pct={safePct(other)} subtle />
    </div>
  );
}

function MetricBar({ label, value, pct, accent, subtle }) {
  const fill = accent ? BRAND.gold : subtle ? "rgba(17,24,39,0.18)" : "rgba(17,24,39,0.30)";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-extrabold text-foreground">{label}</div>
        <div className="text-xs font-semibold text-muted-foreground">
          {value} <span className="text-[11px]">({pct}%)</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
    </div>
  );
}

/* =======================
   Activity list (DIVIDERS)
======================= */

function ActivityList({ activityQ, onNavigate }) {
  if (activityQ.isLoading) {
    return (
      <div className="space-y-2 pb-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const items = activityQ.data || [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        No recent activity yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[290px]">
      <ul className="divide-y divide-border" role="list" aria-label="Recent activity">
        {items.map((a) => (
          <li key={a.id} className="first:pt-1">
            <button
              type="button"
              onClick={() => routeForActivity(a, onNavigate)}
              title="Open related page"
              className={cn(
                "group w-full px-1 py-3 text-left transition",
                "hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              )}
              style={{ outlineColor: BRAND.gold }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: "rgba(17,24,39,0.04)" }}
                >
                  {activityIcon(a.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-extrabold text-foreground"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {a.text}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-full border px-2 py-0.5 text-[11px] font-extrabold"
                      style={{
                        background: BRAND.goldSoft,
                        borderColor: BRAND.goldBorderSoft,
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      {labelForType(a.type)}
                    </Badge>

                    <span className="text-xs font-semibold text-muted-foreground">
                      {formatDistanceToNow(a.at, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 opacity-60 transition group-hover:opacity-100"
                  style={{ color: BRAND.gold }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

/* =======================
   HELPERS
======================= */

function routeForActivity(a, onNavigate) {
  const action = String(a.action || "");
  if (action.startsWith("teacher")) return onNavigate?.("teachers");
  if (action.startsWith("enrollment")) return onNavigate?.("enrollment");
  if (action.startsWith("announcement")) return onNavigate?.("announcements");
  if (action.startsWith("calendar")) return onNavigate?.("calendar");
  if (action.startsWith("section") || action.startsWith("student.section")) return onNavigate?.("students");
  return onNavigate?.("activity_logs");
}

function labelForType(type) {
  if (type === "teacher") return "Teacher";
  if (type === "student") return "Enrollment";
  if (type === "announcement") return "Announcement";
  if (type === "calendar") return "Calendar";
  if (type === "section") return "Section";
  return "System";
}

function activityIcon(type) {
  const common = { className: "h-4 w-4 text-foreground" };
  if (type === "teacher") return <UserCog {...common} />;
  if (type === "student") return <BookOpenCheck {...common} />;
  if (type === "announcement") return <Bell {...common} />;
  if (type === "calendar") return <CalendarDays {...common} />;
  if (type === "section") return <ShieldCheck {...common} />;
  return <Activity {...common} />;
}

/* =======================
   UI COMPONENTS
======================= */

function StatCard({ title, value, icon, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open ${title}`}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm transition",
        "hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      )}
      style={{ outlineColor: BRAND.gold }}
    >
      <div className="absolute right-0 top-0 h-full w-1.5 opacity-90" style={{ background: BRAND.gold }} />

      <div className="flex items-center gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl border"
          style={{ background: BRAND.goldSoft, borderColor: BRAND.goldBorder }}
        >
          <span className="text-foreground">{icon}</span>
        </div>

        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-none text-foreground">
            {loading ? "…" : value ?? 0}
          </div>
          <div className="mt-1 text-sm font-semibold text-muted-foreground">{title}</div>
        </div>
      </div>
    </button>
  );
}

function QuickCard({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition",
        "hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      )}
      style={{ outlineColor: BRAND.gold }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-2xl border"
          style={{ background: BRAND.goldSoft, borderColor: BRAND.goldBorder }}
        >
          <span className="text-foreground">{icon}</span>
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-foreground">{label}</div>
          <div className="truncate text-xs font-semibold text-muted-foreground">{hint}</div>
        </div>

        <div
          className="ml-auto grid h-9 w-9 place-items-center rounded-full border"
          style={{ borderColor: BRAND.goldBorderSoft, color: BRAND.gold }}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
