// src/pages/student/StudentAnnouncements.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient"; // adjust path if needed

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

function formatPrettyDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function categoryFromPriority(priority) {
  // Your student UI uses: Important / Event / General
  // Your DB has: High / Medium / Low
  if (priority === "High") return "Important";
  if (priority === "Medium") return "General";
  return "General";
}

export default function StudentAnnouncements() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const announcementsQ = useQuery({
    queryKey: ["student-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, priority, posted_at, posted_by, target_audience, status, is_archived")
        .eq("target_audience", "All Students")
        .eq("status", "Published")
        .eq("is_archived", false)
        .order("posted_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const data = useMemo(() => {
    const rows = announcementsQ.data ?? [];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.content,
      category: categoryFromPriority(r.priority),
      by: "Admin", // optional: replace with profile lookup later
      date: formatPrettyDate(r.posted_at),
      _priority: r.priority,
    }));
  }, [announcementsQ.data]);

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const okQ =
        !q.trim() ||
        (a.title + " " + a.body).toLowerCase().includes(q.trim().toLowerCase());
      const okCat = cat === "All" || a.category === cat;
      return okQ && okCat;
    });
  }, [data, q, cat]);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
              Announcements
            </div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              School-wide updates and class notices
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: BRAND.muted }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search announcements…"
                className="w-full rounded-2xl border bg-white/70 py-2 pl-10 pr-3 text-sm outline-none transition focus:bg-white"
                style={{ borderColor: BRAND.stroke }}
              />
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2"
              style={{ borderColor: BRAND.stroke }}
            >
              <Filter className="h-4 w-4" style={{ color: BRAND.muted }} />
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none"
                style={{ color: BRAND.brown }}
              >
                <option>All</option>
                <option>Important</option>
                <option>Event</option>
                <option>General</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* States */}
      {announcementsQ.isLoading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm font-semibold"
             style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow, color: BRAND.muted }}>
          Loading announcements…
        </div>
      ) : announcementsQ.isError ? (
        <div className="rounded-3xl border bg-white p-5 text-sm font-semibold"
             style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow, color: "#b91c1c" }}>
          Error: {String(announcementsQ.error?.message || announcementsQ.error)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border bg-white p-5 text-sm font-semibold"
             style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow, color: BRAND.muted }}>
          No announcements found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-3xl border bg-white p-5"
              style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-extrabold" style={{ color: BRAND.brown }}>
                  {a.title}
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-extrabold"
                  style={{ background: BRAND.softGoldBg, color: BRAND.brown }}
                >
                  {a.category}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                Posted by {a.by} • {a.date}
              </div>
              <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
                {a.body}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
