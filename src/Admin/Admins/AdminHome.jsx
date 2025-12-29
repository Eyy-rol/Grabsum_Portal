// src/admin/AdminHome.jsx
// Admin Home (wired to Supabase) — Stats + Quick shortcuts + Activity Logs
// - Uses @tanstack/react-query for polling
// - Activity logs: supports teacher/student/enrollment/announcement actions
// - Quick navigation cards include an arrow shortcut (→)
// NOTE: Adjust table/column names if your schema differs.

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient"; // ✅ adjust path if needed
import {
  Users,
  Clock,
  GraduationCap,
  CalendarDays,
  Megaphone,
  LayoutList,
  Activity,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CalendarWidget from "../../components/CalendarWidget"; // ✅ adjust path if needed

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
  // NOTE: Your earlier code uses "enrollment" table and "st_application_status"
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
  // NOTE: Your schema might have "teachers" with either "id" or "user_id"
  // If "id" doesn't exist, change to: .select("user_id", { count: "exact", head: true })
  const res = await supabase
    .from("teachers")
    .select("id", { count: "exact", head: true });

  if (res.error) return 0;
  return res.count ?? 0;
}

function formatStudentName(e) {
  if (!e) return null;
  const mi = e.st_mi ? ` ${String(e.st_mi).replace(".", "")}.` : "";
  const ext = e.st_ext ? ` ${e.st_ext}` : "";
  return `${e.st_lname}, ${e.st_fname}${mi}${ext}`.trim();
}

/**
 * Activity logs wiring:
 * - Reads activity_logs + joins to enrollment by application_id (based on your FK)
 * - Falls back to metadata content if join is missing
 *
 * IMPORTANT:
 * Your table definition shows:
 *   activity_logs.application_id varchar(50) FK -> enrollment(application_id)
 * So we join using:
 *   enrollment:enrollment!activity_logs_application_id_fkey (...)
 */
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

    // classify type for colored dot
    let type = "system";
    const action = String(a.action || "");
    if (action.startsWith("enrollment")) type = "student";
    if (action.startsWith("teacher")) type = "teacher";
    if (action.startsWith("announcement")) type = "announcement";
    if (action.startsWith("calendar")) type = "calendar";
    if (action.startsWith("section")) type = "section";

    // Build a nice text message
    let text = a.message || a.action || "Activity";

    // Special: enrollment created
    if (a.action === "enrollment.created" && studentName) {
      text = `New application submitted: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""}`;
    }

    // Special: status changed
    if (a.action === "enrollment.status_changed") {
      const from = a.metadata?.from ?? a.metadata?.old ?? a.metadata?.prev;
      const to = a.metadata?.to ?? a.metadata?.new ?? a.metadata?.next;
      if (studentName) {
        text = `Status updated: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""} — ${from ?? "?"} → ${to ?? "?"}`;
      } else {
        text = `Enrollment status updated — ${from ?? "?"} → ${to ?? "?"}`;
      }
    }

    // Special: enrolled
    if (a.action === "enrollment.status_changed" && a.metadata?.to === "Enrolled") {
      if (studentName) {
        text = `Student enrolled: ${studentName}${e?.application_id ? ` (App ID: ${e.application_id})` : ""}`;
      } else {
        text = `Student enrolled`;
      }
    }

    // Teacher created
    if (a.action === "teacher.created") {
      const tname = a.metadata?.name || a.metadata?.teacher_name;
      text = tname ? `New teacher added: ${tname}` : (a.message || "New teacher added");
    }

    // Teacher deleted
    if (a.action === "teacher.deleted") {
      const tname = a.metadata?.name || a.metadata?.teacher_name;
      text = tname ? `Teacher deleted: ${tname}` : (a.message || "Teacher deleted");
    }

    // Calendar event created/updated/deleted (if you implement later)
    if (a.action === "calendar.created") {
      const title = a.metadata?.title;
      text = title ? `Calendar event added: ${title}` : (a.message || "Calendar event added");
    }
    if (a.action === "calendar.deleted") {
      const title = a.metadata?.title;
      text = title ? `Calendar event deleted: ${title}` : (a.message || "Calendar event deleted");
    }

    // Section assignment (student.section_assigned)
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
  // Stats
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

  // Activity logs
  const activityQ = useQuery({
    queryKey: ["adminhome", "activity"],
    queryFn: fetchActivities,
    refetchInterval: 15000, // more responsive for logs
  });

  const anyError = statsQ.error || teachersQ.error || activityQ.error;

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
          <strong>Dashboard data error:</strong>{" "}
          {String(anyError?.message || anyError)}
        </div>
      ) : null}

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard
          title="Total Applications"
          value={statsQ.data?.total}
          icon={<Users size={18} />}
          loading={statsQ.isLoading}
        />
        <StatCard
          title="Pending Applications"
          value={statsQ.data?.pending}
          icon={<Clock size={18} />}
          loading={statsQ.isLoading}
        />
        <StatCard
          title="Total Enrolled"
          value={statsQ.data?.enrolled}
          icon={<GraduationCap size={18} />}
          loading={statsQ.isLoading}
        />
        <StatCard
          title="Total Teachers"
          value={teachersQ.data}
          icon={<Users size={18} />}
          loading={teachersQ.isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div style={styles.quickGrid}>
        <QuickCard
          icon={<LayoutList size={18} />}
          label="Teacher Schedule"
          hint="View schedules"
          onClick={() => onNavigate?.("teacher_schedule")}
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

      {/* Activity Logs */}
      <div style={styles.lowerGrid}>
        <Card
          title="Recent Activity"
          subtitle="Latest 12 actions (auto-refresh)"
          rightAction={
            <button
              type="button"
              onClick={() => onNavigate?.("activity_logs")}
              style={styles.viewAllBtn}
              title="Open full activity logs"
            >
              View all <ArrowRight size={16} />
            </button>
          }
        >
          {activityQ.isLoading ? (
            <div style={{ color: TOKENS.muted }}>Loading activity…</div>
          ) : (
            <div style={styles.activityList}>
              {(activityQ.data || []).map((a) => (
                <div key={a.id} style={styles.activityItem}>
                  <div style={{ ...styles.activityDot, background: activityColor(a.type) }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.activityText} title={a.text}>
                      {a.text}
                    </div>
                    <small style={styles.time}>
                      {formatDistanceToNow(a.at, { addSuffix: true })}
                    </small>
                  </div>

                  {/* Optional: click-through shortcut based on action */}
                  <button
                    type="button"
                    style={styles.rowArrowBtn}
                    title="Open related page"
                    onClick={() => {
                      // Simple routing map (adjust keys to your app routes)
                      const action = String(a.action || "");
                      if (action.startsWith("teacher")) return onNavigate?.("teachers");
                      if (action.startsWith("enrollment")) return onNavigate?.("enrollment");
                      if (action.startsWith("announcement")) return onNavigate?.("announcements");
                      if (action.startsWith("calendar")) return onNavigate?.("calendar");
                      return onNavigate?.("activity_logs");
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}

              {(activityQ.data || []).length === 0 ? (
                <div style={{ color: TOKENS.muted }}>No recent activity yet.</div>
              ) : null}
            </div>
          )}
        </Card>

<Card
  title="Calendar"
  subtitle="Read-only view of school events"
  rightAction={
    <button
      type="button"
      onClick={() => onNavigate?.("calendar")}
      style={styles.viewAllBtn}
      title="Open full calendar"
    >
      View <ArrowRight size={16} />
    </button>
  }
>
  <CalendarWidget readOnly />
</Card>


  <Card title="Shortcuts" subtitle="Fast access">
    <div style={styles.shortcutGrid}>
      <ShortcutChip label="Enrollment" onClick={() => onNavigate?.("enrollment")} />
      <ShortcutChip label="Students" onClick={() => onNavigate?.("students")} />
      <ShortcutChip label="Teachers" onClick={() => onNavigate?.("teachers")} />
      <ShortcutChip label="Calendar" onClick={() => onNavigate?.("calendar")} />
    </div>
  </Card>
</div>
      

      {(statsQ.isFetching || teachersQ.isFetching || activityQ.isFetching) ? (
        <div style={{ marginTop: 12, color: TOKENS.muted, fontSize: 12 }}>
          Refreshing data…
        </div>
      ) : null}
    </div>
  );
}

/* =======================
   UI COMPONENTS
======================= */

function StatCard({ title, value, icon, loading }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={styles.statValue}>{loading ? "…" : value ?? 0}</div>
        <div style={styles.statLabel}>{title}</div>
      </div>
      <div style={styles.goldEdge} />
    </div>
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

function Card({ title, subtitle, rightAction, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderRow}>
        <div>
          <h3 style={styles.cardTitle}>{title}</h3>
          {subtitle ? <div style={styles.cardSub}>{subtitle}</div> : null}
        </div>
        {rightAction ? <div>{rightAction}</div> : null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function ShortcutChip({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.chip}>
      <span style={{ fontWeight: 900 }}>{label}</span>
      <ArrowRight size={16} />
    </button>
  );
}

function activityColor(type) {
  if (type === "teacher") return "#3B82F6";
  if (type === "student") return TOKENS.gold;
  if (type === "announcement") return "#F59E0B";
  if (type === "calendar") return "#10B981";
  if (type === "section") return "#8B5CF6";
  return "#D1D5DB";
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

  statCard: {
    position: "relative",
    background: TOKENS.card,
    borderRadius: 16,
    padding: 16,
    display: "flex",
    gap: 14,
    border: `1px solid ${TOKENS.border}`,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    overflow: "hidden",
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
  },

  quickChevron: {
    marginLeft: "auto",
    color: TOKENS.gold,
    display: "grid",
    placeItems: "center",
  },

  lowerGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: 14,
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: `1px solid ${TOKENS.border}`,
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
  },

  cardHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  cardTitle: { margin: 0, fontWeight: 900, color: TOKENS.text },
  cardSub: { marginTop: 4, color: TOKENS.muted, fontSize: 12 },

  viewAllBtn: {
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

  activityList: {
    maxHeight: 340,
    overflowY: "auto",
    display: "grid",
    gap: 12,
    paddingRight: 6,
  },

  activityItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },

  activityDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: 6,
    flex: "0 0 auto",
  },

  activityText: {
    color: TOKENS.text,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 560,
  },

  time: { color: "#9CA3AF", fontSize: 12 },

  rowArrowBtn: {
    marginLeft: "auto",
    border: `1px solid ${TOKENS.border}`,
    background: "#fff",
    borderRadius: 12,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: TOKENS.gold,
    boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
  },

  tipList: {
    margin: 0,
    paddingLeft: 18,
    color: TOKENS.text,
    display: "grid",
    gap: 10,
  },

  tipItem: {
    color: TOKENS.text,
    fontWeight: 600,
  },

  shortcutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.goldSoft,
    cursor: "pointer",
    color: TOKENS.text,
    boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
  },
};
