import React from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import { TOKENS } from "../../styles/tokens";


export default function AdminHome() {
  const nav = useNavigate();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Enrolled Students" value="1,248" />
        <Stat label="Pending Applications" value="18" accent="gold" />
        <Stat label="Approved Students" value="1,120" accent="brown" />
        <Stat label="Teachers" value="54" />
        <Stat label="Upcoming Activities" value="6" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`lg:col-span-2 rounded-2xl border ${TOKENS.border} bg-white/60 p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold">Latest Calendar</div>
              <div className="text-xs text-black/55">Upcoming school activities</div>
            </div>
            <button
              onClick={() => nav("/admin/calendar")}
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              Open Calendar
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Item title="Club orientation" meta="Dec 19 • 9:00 AM" badge="Upcoming" />
            <Item title="Teacher meeting" meta="Dec 20 • 2:00 PM" badge="Upcoming" />
          </div>
        </div>

        <div className={`rounded-2xl border ${TOKENS.border} bg-white/60 p-4`}>
          <div className="text-sm font-extrabold">Navigation Panel</div>
          <div className="mt-3 grid gap-2">
            <NavCard title="Enrollment" desc="Review and manage applicants" to="/admin/students/enrollment" />
            <NavCard title="Manage Teacher" desc="Add/update teacher profiles" to="/admin/teacher/manage" />
            <NavCard title="Calendar" desc="Maintain school activities" to="/admin/calendar" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-extrabold">Latest Notices</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>Enrollment ongoing</Badge>
          <Badge>Grades encoded</Badge>
          <Badge>Faculty meeting</Badge>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  const pill =
    accent === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : accent === "brown"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : "bg-black/5 text-black/70";

  return (
    <div className={`rounded-2xl border ${TOKENS.border} bg-white/60 p-4`}>
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${pill}`}>Total</div>
    </div>
  );
}

function Item({ title, meta, badge }) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-black/10 bg-white/70 p-3">
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-black/55">{meta}</div>
      </div>
      <Badge>{badge}</Badge>
    </div>
  );
}

function NavCard({ title, desc, to }) {
  const nav = useNavigate();

  return (
    <button
      onClick={() => nav(to)}
      className="rounded-2xl border border-black/10 bg-white/70 p-3 text-left hover:bg-white"
    >
      <div className="text-sm font-extrabold">{title}</div>
      <div className="text-xs text-black/55">{desc}</div>
    </button>
  );
}