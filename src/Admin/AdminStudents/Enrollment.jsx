import React, { useMemo, useState } from "react";
import { Eye, Filter, Plus, Search, Trash2, X, Save } from "lucide-react";
import { TOKENS } from "../../styles/tokens.js";

const MOCK = [
  {
    id: "2025-0001",
    studentNo: "25-001",
    last: "Dela Cruz",
    first: "Alyssa",
    ext: "",
    mi: "S",
    grade: "Grade 11",
    track: "STEM",
    status: "Pending",
    section: "11-STEM A",
    guardian: "Maria D.",
    contact: "0917-123-4567",
    address: "Lucena City",
  },
  {
    id: "2025-0002",
    studentNo: "25-002",
    last: "Perez",
    first: "John",
    ext: "Jr.",
    mi: "A",
    grade: "Grade 12",
    track: "ABM",
    status: "Approval",
    section: "12-ABM B",
    guardian: "Lorna P.",
    contact: "0998-222-1010",
    address: "Tayabas",
  },
];

export default function Enrollment() {
  const [rows, setRows] = useState(MOCK);

  const [qName, setQName] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fTrack, setFTrack] = useState("All");
  const [fGrade, setFGrade] = useState("All");

  const [tab, setTab] = useState("All Applicants");
  const [selected, setSelected] = useState(null);

  const counts = useMemo(() => {
    const all = rows.length;
    const pending = rows.filter((r) => norm(r.status) === "pending").length;
    const approval = rows.filter((r) => norm(r.status) === "approval").length;
    return { all, pending, approval };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = qName.trim().toLowerCase();

    return rows
      .filter((r) => (needle ? formatName(r).toLowerCase().includes(needle) : true))
      .filter((r) => (fStatus === "All" ? true : norm(r.status) === norm(fStatus)))
      .filter((r) => (fTrack === "All" ? true : r.track === fTrack))
      .filter((r) => (fGrade === "All" ? true : r.grade === fGrade))
      .filter((r) => {
        const st = norm(r.status);
        if (tab === "All Applicants") return true;
        if (tab === "Pending") return st === "pending";
        if (tab === "Approval") return st === "approval";
        return true;
      });
  }, [rows, qName, fStatus, fTrack, fGrade, tab]);

  function onDelete(id) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const ok = window.confirm(`Delete applicant ${formatName(row)}?`);
    if (!ok) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function onSave(updated) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected(updated);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-extrabold">Enrollment</div>
          <div className="text-xs text-black/55">Filter applicants, review details, update status, and manage records.</div>
        </div>
        <button
          onClick={() => alert("Wire this to Add Student form later")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/60 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Student name">
            <input
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              placeholder="Last name, first name…"
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            />
          </Field>

          <Field label="Status">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", "Pending", "Approval", "Approved", "Enrolled", "Denied"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Track">
            <select
              value={fTrack}
              onChange={(e) => setFTrack(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", "STEM", "HUMSS", "GAS", "ABM", "TVL"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grade">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white"
            >
              {["All", "Grade 11", "Grade 12"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabBtn active={tab === "All Applicants"} onClick={() => setTab("All Applicants")} label="All Applicants" count={counts.all} />
            <TabBtn active={tab === "Pending"} onClick={() => setTab("Pending")} label="Pending" count={counts.pending} accent="gold" />
            <TabBtn active={tab === "Approval"} onClick={() => setTab("Approval")} label="Approval" count={counts.approval} accent="brown" />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert("Optional advanced filters")}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              <Filter className="h-4 w-4 text-black/60" />
              Advanced
            </button>
            <button
              onClick={() => {
                setQName("");
                setFStatus("All");
                setFTrack("All");
                setFGrade("All");
                setTab("All Applicants");
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              <Search className="h-4 w-4 text-black/60" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="text-sm font-extrabold">List of Students</div>
          <div className="text-xs text-black/55">Showing {filtered.length} of {rows.length}</div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs text-black/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Student Number</th>
              <th className="px-4 py-3 font-semibold">Student Name</th>
              <th className="px-4 py-3 font-semibold">Grade</th>
              <th className="px-4 py-3 font-semibold">Track</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-black/10">
                <td className="px-4 py-3 text-black/60">{r.studentNo}</td>
                <td className="px-4 py-3 font-semibold">{formatName(r)}</td>
                <td className="px-4 py-3 text-black/70">{r.grade}</td>
                <td className="px-4 py-3 text-black/70">{r.track}</td>
                <td className="px-4 py-3">
                  <StatusPill value={r.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <IconBtn title="View / Update" onClick={() => setSelected(r)} tone="gold">
                      <Eye className="h-5 w-5" />
                    </IconBtn>
                    <IconBtn title="Delete" onClick={() => onDelete(r.id)} tone="danger">
                      <Trash2 className="h-5 w-5" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-black/55">
                  No applicants found. Try adjusting your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? <Drawer title="Student Information" value={selected} onClose={() => setSelected(null)} onSave={onSave} /> : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ active, label, count, onClick, accent }) {
  const activeCls =
    accent === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : accent === "brown"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : "bg-black/5 text-black/70";

  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-sm font-semibold transition " +
        (active ? activeCls : "bg-white/70 hover:bg-white")
      }
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-extrabold text-black/60">{count}</span>
    </button>
  );
}

function StatusPill({ value }) {
  const v = norm(value);
  const cls =
    v === "pending"
      ? "bg-[#C9A227]/10 text-[#C9A227]"
      : v === "approval"
      ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
      : v === "approved" || v === "enrolled"
      ? "bg-emerald-500/10 text-emerald-700"
      : v === "denied"
      ? "bg-rose-500/10 text-rose-700"
      : "bg-black/5 text-black/70";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

function IconBtn({ title, onClick, tone, children }) {
  const cls =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
      : tone === "gold"
      ? "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90"
      : "bg-white/70 text-black/65 hover:bg-white";

  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-2xl border border-black/10 ${cls}`}
    >
      {children}
    </button>
  );
}

function Drawer({ title, value, onClose, onSave }) {
  const [draft, setDraft] = useState(value);

  function update(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div
        className={`fixed right-4 top-4 bottom-4 z-50 w-[92vw] max-w-md rounded-2xl border ${TOKENS.border} ${TOKENS.panel} shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <div>
            <div className="text-sm font-extrabold">{title}</div>
            <div className="text-xs text-black/55">View and update student information</div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl hover:bg-black/5">
            <X className="h-5 w-5 text-black/60" />
          </button>
        </div>

        <div className="h-[calc(100%-64px)] overflow-auto p-4">
          <div className="space-y-4">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
              <div className="text-xs font-semibold text-black/55">Student Number</div>
              <div className="text-sm font-extrabold">{draft.studentNo}</div>
              <div className="mt-1 text-xs text-black/55">Record ID: {draft.id}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Last name">
                <input value={draft.last} onChange={(e) => update("last", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
              </Field>
              <Field label="First name">
                <input value={draft.first} onChange={(e) => update("first", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
              </Field>
              <Field label="Extension">
                <input value={draft.ext} onChange={(e) => update("ext", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
              </Field>
              <Field label="Middle initial">
                <input value={draft.mi} onChange={(e) => update("mi", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Grade">
                <select value={draft.grade} onChange={(e) => update("grade", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white">
                  {["Grade 11", "Grade 12"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Track">
                <select value={draft.track} onChange={(e) => update("track", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white">
                  {["STEM", "HUMSS", "GAS", "ABM", "TVL"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => update("status", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white">
                  {["Pending", "Approval", "Approved", "Enrolled", "Denied"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section">
                <input value={draft.section} onChange={(e) => update("section", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
              </Field>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
              <div className={`text-sm font-extrabold ${TOKENS.brown}`}>Other information</div>
              <div className="mt-3 grid gap-3">
                <Field label="Guardian">
                  <input value={draft.guardian} onChange={(e) => update("guardian", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
                </Field>
                <Field label="Contact">
                  <input value={draft.contact} onChange={(e) => update("contact", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
                </Field>
                <Field label="Address">
                  <input value={draft.address} onChange={(e) => update("address", e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white">
                Cancel
              </button>
              <button
                onClick={() => onSave(draft)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatName(r) {
  const ext = r.ext?.trim() ? ` ${r.ext.trim()}` : "";
  const mi = r.mi?.trim() ? ` ${r.mi.trim()}.` : "";
  return `${r.last}, ${r.first}${ext}${mi}`;
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}