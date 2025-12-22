// src/pages/teacher/TeacherAnnouncements.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, Paperclip, AlertCircle, Bookmark, CheckCircle2 } from "lucide-react";

const BRAND = {
  brown: "#2b1a12",
  muted: "rgba(43,26,18,0.55)",
  stroke: "rgba(43,26,18,0.16)",
  gold: "#d4a62f",
  goldHover: "#deb23c",
  softGoldBg: "rgba(212,166,47,0.14)",
  cardShadow: "0 14px 34px rgba(43,26,18,0.10)",
};

function Modal({ open, title, onClose, children, width = "max-w-3xl" }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative mx-auto mt-10 w-[92%] ${width}`}
          >
            <div className="rounded-3xl border bg-white p-5" style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>{title}</div>
                <button
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-black/5"
                  style={{ borderColor: BRAND.stroke }}
                >
                  <X className="h-5 w-5" style={{ color: BRAND.muted }} />
                </button>
              </div>
              <div className="mt-4">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function badgeColor(priority) {
  if (priority === "Urgent") return { bg: "rgba(239,68,68,0.12)", fg: "rgba(127,29,29,0.95)" };
  if (priority === "Important") return { bg: "rgba(249,115,22,0.12)", fg: "rgba(124,45,18,0.95)" };
  return { bg: "rgba(59,130,246,0.12)", fg: "rgba(30,64,175,0.95)" };
}

export default function TeacherAnnouncements() {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState(null);

  const data = useMemo(
    () => [
      {
        id: "A-001",
        title: "Schedule Adjustment for Friday",
        priority: "Important",
        postedBy: "Admin Office",
        role: "Admin",
        date: "2025-12-19 09:14",
        content:
          "Please note the updated class schedule for Friday due to the school event. Teachers are requested to coordinate with their advisers.",
        attachments: [{ name: "RevisedSchedule.pdf", size: "320 KB" }],
        unread: true,
      },
      {
        id: "A-002",
        title: "Urgent: System Maintenance Tonight",
        priority: "Urgent",
        postedBy: "IT Office",
        role: "Admin",
        date: "2025-12-18 16:02",
        content:
          "The portal will be unavailable from 10:00 PM to 12:00 AM for maintenance. Please save your work before the downtime.",
        attachments: [],
        unread: true,
      },
      {
        id: "A-003",
        title: "General Reminder: Quarterly Meeting",
        priority: "General",
        postedBy: "Principal",
        role: "Admin",
        date: "2025-12-15 08:00",
        content:
          "Quarterly faculty meeting will be held in the auditorium. Attendance is required. Please bring your updated lesson plan reports.",
        attachments: [{ name: "Agenda.docx", size: "180 KB" }],
        unread: false,
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const okQ = (a.title + " " + a.content).toLowerCase().includes(q.toLowerCase());
      const okP = priority === "All" ? true : a.priority === priority;
      const okU = unreadOnly ? a.unread : true;
      return okQ && okP && okU;
    });
  }, [data, q, priority, unreadOnly]);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
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
              School-wide and teacher updates
            </div>
          </div>
          <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
            {filtered.length} item(s)
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search announcements…"
              className="w-full rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: BRAND.muted }} />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full appearance-none rounded-2xl border bg-white/70 px-11 py-3 text-sm font-semibold outline-none transition focus:bg-white"
              style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            >
              {["All", "Urgent", "Important", "General"].map((x) => (
                <option key={x} value={x}>
                  Priority: {x}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setUnreadOnly((s) => !s)}
            className="rounded-2xl border bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
          >
            {unreadOnly ? "Showing: Unread Only" : "Filter: Unread Only"}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-3xl border bg-white p-5"
        style={{ borderColor: BRAND.stroke, boxShadow: BRAND.cardShadow }}
      >
        <div className="space-y-3">
          {filtered.map((a) => {
            const b = badgeColor(a.priority);
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="w-full rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-[1px]"
                style={{
                  borderColor: BRAND.stroke,
                  boxShadow: a.unread ? "inset 6px 0 0 rgba(212,166,47,0.75)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                      {a.title}
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: BRAND.muted }}>
                      Posted by {a.postedBy} • {a.date}
                    </div>
                  </div>

                  <span className="rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: b.bg, color: b.fg }}>
                    {a.priority}
                  </span>
                </div>

                <div className="mt-3 text-sm" style={{ color: BRAND.muted }}>
                  {a.content.length > 160 ? a.content.slice(0, 160) + "…" : a.content}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {a.unread ? (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
                          style={{ background: BRAND.softGoldBg, color: BRAND.brown }}>
                      <AlertCircle className="h-4 w-4" /> Unread
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
                          style={{ background: "rgba(34,197,94,0.14)", color: BRAND.brown }}>
                      <CheckCircle2 className="h-4 w-4" /> Read
                    </span>
                  )}

                  {a.attachments?.length ? (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold"
                          style={{ background: "rgba(43,26,18,0.06)", color: BRAND.brown }}>
                      <Paperclip className="h-4 w-4" style={{ color: BRAND.muted }} /> {a.attachments.length} attachment(s)
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      <Modal open={!!selected} title={selected ? selected.title : ""} onClose={() => setSelected(null)}>
        {selected ? <AnnouncementDetails a={selected} /> : null}
      </Modal>
    </div>
  );
}

function AnnouncementDetails({ a }) {
  const b = badgeColor(a.priority);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
              Posted by <span style={{ color: BRAND.brown }}>{a.postedBy}</span> • {a.date}
            </div>
            <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>
              {a.content}
            </div>
          </div>
          <span className="w-fit rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: b.bg, color: b.fg }}>
            {a.priority}
          </span>
        </div>
      </div>

      <div className="rounded-3xl border p-4" style={{ borderColor: BRAND.stroke }}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
            Attachments
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            style={{ borderColor: BRAND.stroke, color: BRAND.brown }}
            onClick={() => alert("Bookmark (wire later)")}
          >
            <Bookmark className="h-4 w-4" style={{ color: BRAND.muted }} />
            Bookmark
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {a.attachments?.length ? (
            a.attachments.map((f) => (
              <div key={f.name} className="rounded-2xl border bg-white/70 p-3" style={{ borderColor: BRAND.stroke }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold" style={{ color: BRAND.brown }}>
                      {f.name}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                      {f.size}
                    </div>
                  </div>
                  <button
                    className="rounded-2xl px-4 py-2 text-sm font-semibold transition"
                    style={{ background: BRAND.gold, color: BRAND.brown }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.goldHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.gold)}
                    onClick={() => alert("Download attachment (wire later)")}
                  >
                    Download
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm" style={{ color: BRAND.muted }}>
              No attachments
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
