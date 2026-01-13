// src/admin/AdminHome.jsx
// Admin Home (wired to Supabase) — Stats + Quick shortcuts + Activity Logs + Calendar
// Changes (per request):
// ✅ “Recent Activity” card smaller to make room for calendar
// ✅ Removed “View all” from Calendar
// ✅ Removed Shortcuts card (chips) at the bottom
// ✅ Everything is routable/clickable (cards + activity rows)
// ✅ Teachers count is fetched (kept + improved; supports fallback column)
// ✅ Recent activity logs modernized (card-like rows + hover + icon + pill time)

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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CalendarWidget from "../../components/CalendarWidget";

/* =======================
   TOKENS (light + gold)
======================= */

const TOKENS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  gold: "#DAA520",
  goldSoft: "rgba(218,165,32,0.14)",
};

/* =======================
   DATA FETCHERS
======================= */

async function fetchEnrollmentStats() {
  const totalRes = await supabase
    .from("enrollment")
    .select("id", { count: "exact", head: true });
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
  // Handles both `id` or `user_id` column setups gracefully.
  const r1 = await supabase.from("teachers").select("id", { count: "exact", head: true });
  if (!r1.error) return r1.count ?? 0;

  const r2 = await supabase.from("teachers").select("user_id", { count: "exact", head: true });
  if (!r2.error) return r2.count ?? 0;

  // If both fail, surface the original error to React Query (so you can see it).
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

    // classify type
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

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>Admin Home</h1>
          <p style={styles.pageSub}>Overview of enrollment and school activity</p>
        </div>

        <div style={styles.headerBadge}>
          <Activity size={16} color={TOKENS.gold} />
          <span style={{ fontWeight: 900, color: TOKENS.text }}>Live</span>
          <span style={{ color: TOKENS.muted }}>updates</span>
        </div>
      </div>

      {anyError ? (
        <div style={styles.errorBox}>
          <strong>Dashboard data error:</strong> {String(anyError?.message || anyError)}
        </div>
      ) : null}

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard
          title="Total Applications"
          value={statsQ.data?.total}
          icon={<Users size={18} />}
          loading={statsQ.isLoading}
          onClick={() => onNavigate?.("enrollment")}
        />
        <StatCard
          title="Pending Applications"
          value={statsQ.data?.pending}
          icon={<Clock size={18} />}
          loading={statsQ.isLoading}
          onClick={() => onNavigate?.("enrollment")}
        />
        <StatCard
          title="Total Enrolled"
          value={statsQ.data?.enrolled}
          icon={<GraduationCap size={18} />}
          loading={statsQ.isLoading}
          onClick={() => onNavigate?.("students")}
        />
        <StatCard
          title="Total Teachers"
          value={teachersQ.data}
          icon={<Users size={18} />}
          loading={teachersQ.isLoading}
          onClick={() => onNavigate?.("teachers")}
        />
      </div>

      {/* Quick Actions (routable) */}
      <div style={styles.quickGrid}>
        <QuickCard
          icon={<LayoutList size={18} />}
          label="Teacher Schedule"
          hint="View schedules"
          onClick={() => onNavigate?.("admin/teacher/schedule")}
        />
        <QuickCard
          icon={<CalendarDays size={18} />}
          label="Calendar Events"
          hint="School year schedule"
          onClick={() => onNavigate?.("calendar")}
        />
        <QuickCard
          icon={<Megaphone size={18} />}
          label="Announcements"
          hint="Post updates"
          onClick={() => onNavigate?.("announcements")}
        />
      </div>

      {/* Lower Grid */}
      <div style={styles.lowerGrid}>
        {/* Recent Activity — smaller + modern list */}
        <Card
          title="Recent Activity"
          subtitle="Latest actions (auto-refresh)"
          onClickHeader={() => onNavigate?.("activity_logs")}
          headerHint="Open full activity logs"
          rightAction={
            <button
              type="button"
              onClick={() => onNavigate?.("activity_logs")}
              style={styles.headerLinkBtn}
              title="Open full activity logs"
            >
              Open logs <ArrowRight size={16} />
            </button>
          }
          compact
        >
          {activityQ.isLoading ? (
            <div style={{ color: TOKENS.muted }}>Loading activity…</div>
          ) : (
            <div style={styles.activityListCompact}>
              {(activityQ.data || []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  style={styles.activityRowBtn}
                  onClick={() => routeForActivity(a, onNavigate)}
                  title="Open related page"
                >
                  <div style={styles.activityIconWrap}>{activityIcon(a.type)}</div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.activityTextModern}>{a.text}</div>
                    <div style={styles.activityMetaRow}>
                      <span style={styles.activityPill}>{labelForType(a.type)}</span>
                      <span style={styles.activityTime}>
                        {formatDistanceToNow(a.at, { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <ArrowRight size={16} style={{ color: TOKENS.gold }} />
                </button>
              ))}

              {(activityQ.data || []).length === 0 ? (
                <div style={{ color: TOKENS.muted }}>No recent activity yet.</div>
              ) : null}
            </div>
          )}
        </Card>

        {/* Calendar — removed View All + clickable header */}
        <Card
          title="Calendar"
          subtitle="Read-only view of school events"
          onClickHeader={() => onNavigate?.("calendar")}
          headerHint="Open calendar"
        >
          <CalendarWidget readOnly />
        </Card>
      </div>

      {liveText ? (
        <div style={{ marginTop: 12, color: TOKENS.muted, fontSize: 12 }}>{liveText}</div>
      ) : null}
    </div>
  );
}

/* =======================
   HELPERS (routing + icons)
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
  const common = { size: 16 };
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
    <button type="button" onClick={onClick} style={styles.statCardBtn} title={`Open ${title}`}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={{ minWidth: 0, textAlign: "left" }}>
        <div style={styles.statValue}>{loading ? "…" : value ?? 0}</div>
        <div style={styles.statLabel}>{title}</div>
      </div>
      <div style={styles.goldEdge} />
    </button>
  );
}

function QuickCard({ icon, label, hint, onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.quickCard}>
      <div style={styles.quickIcon}>{icon}</div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontWeight: 900, color: TOKENS.text }}>{label}</div>
        <div style={{ fontSize: 12, color: TOKENS.muted }}>{hint}</div>
      </div>
      <div style={styles.quickChevron}>
        <ArrowRight size={18} />
      </div>
    </button>
  );
}

function Card({ title, subtitle, rightAction, children, onClickHeader, headerHint, compact }) {
  return (
    <div style={{ ...styles.card, ...(compact ? styles.cardCompact : null) }}>
      <div style={styles.cardHeaderRow}>
        <button
          type="button"
          onClick={onClickHeader}
          style={styles.cardHeaderBtn}
          title={headerHint || ""}
        >
          <div>
            <h3 style={styles.cardTitle}>{title}</h3>
            {subtitle ? <div style={styles.cardSub}>{subtitle}</div> : null}
          </div>
        </button>

        {rightAction ? <div>{rightAction}</div> : null}
      </div>

      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/* =======================
   STYLES
======================= */

const styles = {
  page: {
    background: TOKENS.bg,
    minHeight: "100%",
  },

  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },

  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 999,
    padding: "8px 12px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },

  pageTitle: { margin: 0, fontWeight: 900, color: TOKENS.text },
  pageSub: { color: TOKENS.muted, marginBottom: 10, marginTop: 6 },

  errorBox: {
    background: "#fff",
    border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: 12,
    padding: 12,
    color: "#991B1B",
    marginBottom: 16,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },

  statCardBtn: {
    position: "relative",
    background: TOKENS.card,
    borderRadius: 16,
    padding: 16,
    display: "flex",
    gap: 14,
    border: `1px solid ${TOKENS.border}`,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
  },

  goldEdge: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 6,
    height: "100%",
    background: TOKENS.gold,
    opacity: 0.9,
  },

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: TOKENS.goldSoft,
    border: `1px solid rgba(218,165,32,0.28)`,
    display: "grid",
    placeItems: "center",
    color: TOKENS.text,
    flex: "0 0 auto",
  },

  statValue: { fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: TOKENS.text },
  statLabel: { color: TOKENS.muted, marginTop: 4 },

  quickGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },

  quickCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    border: `1px solid ${TOKENS.border}`,
    boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
  },

  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: TOKENS.goldSoft,
    border: "1px solid rgba(218,165,32,0.28)",
    color: TOKENS.text,
    flex: "0 0 auto",
  },

  quickChevron: {
    marginLeft: "auto",
    color: TOKENS.gold,
    display: "grid",
    placeItems: "center",
  },

  // Make Recent Activity smaller so Calendar has space
  lowerGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1.15fr", // calendar slightly bigger
    gap: 14,
    alignItems: "start",
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: `1px solid ${TOKENS.border}`,
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
  },

  cardCompact: {
    padding: 14,
  },

  cardHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  cardHeaderBtn: {
    all: "unset",
    cursor: "pointer",
    display: "block",
    flex: 1,
  },

  cardTitle: { margin: 0, fontWeight: 900, color: TOKENS.text },
  cardSub: { marginTop: 4, color: TOKENS.muted, fontSize: 12 },

  headerLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${TOKENS.border}`,
    background: "#fff",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: TOKENS.text,
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },

  // Modern activity list (smaller height)
  activityListCompact: {
    maxHeight: 260,
    overflowY: "auto",
    display: "grid",
    gap: 10,
    paddingRight: 6,
  },

  activityRowBtn: {
    width: "100%",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: 14,
    border: `1px solid ${TOKENS.border}`,
    background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(0,0,0,0.01))",
    padding: 12,
    boxShadow: "0 10px 22px rgba(0,0,0,0.04)",
  },

  activityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "rgba(17,24,39,0.04)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    placeItems: "center",
    color: TOKENS.text,
    flex: "0 0 auto",
  },

  activityTextModern: {
    color: TOKENS.text,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },

  activityMetaRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  activityPill: {
    fontSize: 11,
    fontWeight: 900,
    color: TOKENS.text,
    background: TOKENS.goldSoft,
    border: "1px solid rgba(218,165,32,0.25)",
    padding: "4px 8px",
    borderRadius: 999,
  },

  activityTime: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: 700,
  },
};
