import React from "react";
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
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

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
  const res = await supabase
    .from("teachers")
    .select("id", { count: "exact", head: true });

  if (res.error) return 0;
  return res.count ?? 0;
}

async function fetchStudentsByStrand() {
  const { data, error } = await supabase
    .from("enrollment")
    .select("st_track")
    .eq("st_application_status", "Enrolled");

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    const key = row?.st_track || "No Strand";
    map[key] = (map[key] || 0) + 1;
  }

  const preferredOrder = ["STEM", "ABM", "HUMSS", "GAS", "TVL", "No Strand"];
  const entries = Object.entries(map).map(([name, value]) => ({ name, value }));
  entries.sort((a, b) => {
    const ai = preferredOrder.indexOf(a.name);
    const bi = preferredOrder.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return entries;
}

async function fetchStudentsByGrade() {
  const { data, error } = await supabase
    .from("enrollment")
    .select("st_grade_level")
    .eq("st_application_status", "Enrolled");

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    const g = row?.st_grade_level || "Unknown";
    map[g] = (map[g] || 0) + 1;
  }

  return Object.entries(map)
    .sort(([a], [b]) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    )
    .map(([grade, count]) => ({ grade: `Grade ${grade}`, count }));
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
      action,
      message,
      created_at,
      application_id,
      metadata,
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
    .limit(10);

  if (error) {
    return [
      { id: "mock-1", type: "student", text: "Student pre-enrolled: Juan Dela Cruz", at: new Date() },
      { id: "mock-2", type: "teacher", text: "New teacher added: Maria Santos", at: new Date(Date.now() - 60 * 60 * 1000) },
      { id: "mock-3", type: "announcement", text: "New announcement posted", at: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    ];
  }

  return (data || []).map((a) => {
    const e = a.enrollment;
    const studentName = formatStudentName(e);
    const appId = e?.application_id || a.application_id;

    let type = "system";
    if (String(a.action || "").startsWith("enrollment")) type = "student";
    if (String(a.action || "").startsWith("teacher")) type = "teacher";
    if (String(a.action || "").startsWith("announcement")) type = "announcement";

    let text = a.message || a.action;

    if (a.action === "enrollment.created" && studentName) {
      text = `New application submitted: ${studentName}${appId ? ` (App ID: ${appId})` : ""}`;
    }

    if (a.action === "enrollment.status_changed" && studentName) {
      const from = a.metadata?.from;
      const to = a.metadata?.to;
      text = `Status updated: ${studentName}${appId ? ` (App ID: ${appId})` : ""} — ${from ?? "?"} → ${to ?? "?"}`;
    }

    if (a.action === "teacher.created") {
      const tname = a.metadata?.name;
      text = tname ? `New teacher added: ${tname}` : (a.message || "New teacher added");
    }

    if (a.action === "enrollment.status_changed" && a.metadata?.to === "Enrolled" && studentName) {
      text = `Student enrolled: ${studentName}${appId ? ` (App ID: ${appId})` : ""}`;
    }

    return { id: a.id, type, text, at: new Date(a.created_at) };
  });
}

/* =======================
   COMPONENT
======================= */

export default function Dashboard({ onNavigate }) {
  const statsQ = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchEnrollmentStats,
    refetchInterval: 30000,
  });

  const teachersQ = useQuery({
    queryKey: ["dashboard", "teachersCount"],
    queryFn: fetchTeachersCount,
    refetchInterval: 30000,
  });

  const strandQ = useQuery({
    queryKey: ["dashboard", "byStrand"],
    queryFn: fetchStudentsByStrand,
    refetchInterval: 30000,
  });

  const gradeQ = useQuery({
    queryKey: ["dashboard", "byGrade"],
    queryFn: fetchStudentsByGrade,
    refetchInterval: 30000,
  });

  const activityQ = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: fetchActivities,
    refetchInterval: 30000,
  });

  const anyLoading =
    statsQ.isLoading ||
    teachersQ.isLoading ||
    strandQ.isLoading ||
    gradeQ.isLoading ||
    activityQ.isLoading;

  const anyError = statsQ.error || strandQ.error || gradeQ.error;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <p style={styles.pageSub}>Overview of enrollment and school activity</p>
        </div>

        <div style={styles.headerBadge}>
          <Activity size={16} color={TOKENS.gold} />
          <span style={{ fontWeight: 800 }}>Live</span>
          <span style={{ color: TOKENS.muted }}>updates every 30s</span>
        </div>
      </div>

      {anyError ? (
        <div style={styles.errorBox}>
          <strong>Dashboard data error:</strong>{" "}
          {String(anyError.message || anyError)}
        </div>
      ) : null}

      {/* ================= STATS ================= */}
      <div style={styles.statsGrid}>
        <StatCard title="Total Applications" value={statsQ.data?.total} icon={<Users size={18} />} loading={statsQ.isLoading} />
        <StatCard title="Pending Applications" value={statsQ.data?.pending} icon={<Clock size={18} />} loading={statsQ.isLoading} />
        <StatCard title="Total Enrolled" value={statsQ.data?.enrolled} icon={<GraduationCap size={18} />} loading={statsQ.isLoading} />
        <StatCard title="Total Teachers" value={teachersQ.data} icon={<Users size={18} />} loading={teachersQ.isLoading} />
      </div>

      {/* ================= QUICK ACTIONS ================= */}
      <div style={styles.quickGrid}>
        <QuickCard icon={<LayoutList size={18} />} label="View Schedule" hint="Teacher schedules" onClick={() => onNavigate?.("teacher_schedule")} />
        <QuickCard icon={<CalendarDays size={18} />} label="Calendar Events" hint="School activities" onClick={() => onNavigate?.("calendar")} />
        <QuickCard icon={<Megaphone size={18} />} label="Post Announcement" hint="Notify teachers/students" onClick={() => onNavigate?.("announcements")} />
      </div>

      {/* ================= LOWER GRID ================= */}
      <div style={styles.lowerGrid}>
        <Card title="Recent Activity" subtitle="Latest 10 actions">
          {activityQ.isLoading ? (
            <div style={{ color: TOKENS.muted }}>Loading activity…</div>
          ) : (
            <div style={styles.activityList}>
              {(activityQ.data || []).map((a) => (
                <div key={a.id} style={styles.activityItem}>
                  <div style={{ ...styles.activityDot, background: activityColor(a.type) }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.activityText}>{a.text}</div>
                    <small style={styles.time}>
                      {formatDistanceToNow(a.at, { addSuffix: true })}
                    </small>
                  </div>
                </div>
              ))}
              {(activityQ.data || []).length === 0 ? (
                <div style={{ color: TOKENS.muted }}>No recent activity yet.</div>
              ) : null}
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Students by Strand" subtitle="Enrolled students per track">
            {strandQ.isLoading ? (
              <div style={{ color: TOKENS.muted }}>Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={strandQ.data || []} dataKey="value" nameKey="name" outerRadius={92} stroke="#fff" strokeWidth={2} paddingAngle={2}>
                    {(strandQ.data || []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Students by Grade Level" subtitle="Enrolled students per grade">
            {gradeQ.isLoading ? (
              <div style={{ color: TOKENS.muted }}>Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={gradeQ.data || []}>
                  <XAxis dataKey="grade" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  {/* Gold bar (main accent) */}
                  <Bar dataKey="count" fill={TOKENS.gold} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>

      {anyLoading ? (
        <div style={{ marginTop: 12, color: TOKENS.muted, fontSize: 12 }}>
          Some widgets are still loading…
        </div>
      ) : null}
    </div>
  );
}

/* =======================
   COMPONENTS
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
      <div style={styles.quickChevron}>›</div>
    </button>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={styles.card}>
      <div>
        <h3 style={styles.cardTitle}>{title}</h3>
        {subtitle ? <div style={styles.cardSub}>{subtitle}</div> : null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function activityColor(type) {
  // Gold-first approach (gold is the standout). Other colors are muted.
  if (type === "teacher") return "#3B82F6";
  if (type === "student") return TOKENS.gold;
  if (type === "announcement") return "#F59E0B";
  return "#D1D5DB";
}

/* =======================
   TOKENS + STYLES
======================= */

const TOKENS = {
  bg: "#FFFFFF",           // white dominant
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  gold: "#DAA520",         // main accent
  goldSoft: "rgba(218,165,32,0.14)",
  // brown minimized (only tiny use)
  brownHint: "#8B6B4F",
};

const CHART_COLORS = [
  TOKENS.gold,
  "#FFD700",
  "#F59E0B",
  "#B45309",
  "#9CA3AF",
  "#D1D5DB",
];

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
    color: TOKENS.text,
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
    fontSize: 22,
    lineHeight: 1,
    color: TOKENS.gold,
    fontWeight: 900,
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

  cardTitle: { margin: 0, fontWeight: 900, color: TOKENS.text },
  cardSub: { marginTop: 4, color: TOKENS.muted, fontSize: 12 },

  activityList: {
    maxHeight: 320,
    overflowY: "auto",
    display: "grid",
    gap: 12,
    paddingRight: 6,
  },

  activityItem: { display: "flex", gap: 10 },

  activityDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: 6,
    flex: "0 0 auto",
  },

  activityText: {
    color: TOKENS.text,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 520,
  },

  time: { color: "#9CA3AF", fontSize: 12 },
};
