  // Subjects.jsx (refactored to match Sections/Enrollment-style: react-query, white+gold UI, clean cards/tables/modals)
  import React, { useMemo, useState } from "react";
  import { supabase } from "../../lib/supabaseClient";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { Plus, Search, Pencil, Archive, RotateCcw, X, Save, Download, ArchiveRestore } from "lucide-react";

  // PDF export (install): npm i jspdf jspdf-autotable
  import jsPDF from "jspdf";
  import autoTable from "jspdf-autotable";

  // ====== UI THEME (White + Gold, minimal brown) ======
  const UI = {
    pageBg: "bg-white",
    panel: "bg-white",
    border: "border-black/10",
    text: "text-[#1F1A14]",
    muted: "text-black/55",
    gold: "text-[#C9A227]",
    goldBg: "bg-[#C9A227]",
    goldSoft: "bg-[#C9A227]/10",
    brown: "text-[#6B4E2E]",
  };

  const SUBJECT_TYPES = ["Core", "Applied", "Specialized"];

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function uid() {
    return globalThis?.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);
  }

  function prettyDate(raw) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
  }

  function sbErrMsg(err) {
    return String(err?.message || err || "Unknown error");
  }

  function TypePill({ value }) {
    const v = norm(value);
    const cls =
      v === "core"
        ? "bg-[#C9A227]/10 text-[#C9A227]"
        : v === "applied"
        ? "bg-[#6B4E2E]/10 text-[#6B4E2E]"
        : v === "specialized"
        ? "bg-emerald-500/10 text-emerald-700"
        : "bg-black/5 text-black/70";

    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{value || "—"}</span>;
  }

  export default function Subjects() {
    const qc = useQueryClient();

    // Filters
    const [q, setQ] = useState("");
    const [tab, setTab] = useState("Active"); // Active | Archived
    const [fType, setFType] = useState("All");
    const [fGrade, setFGrade] = useState("All");
    const [fTrack, setFTrack] = useState("All");
    const [fStrand, setFStrand] = useState("All");

    // Bulk selection
    const [selected, setSelected] = useState({}); // { [subject_id]: boolean }

    // Modal
    const [modal, setModal] = useState({ open: false, mode: "create", row: null });

    // ===== Role (admin vs super_admin) =====
    const roleQ = useQuery({
      queryKey: ["my_role"],
      queryFn: async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return "anonymous";
        const { data, error } = await supabase.from("profiles").select("role").eq("user_id", uid).single();
        if (error) throw error;
        return data?.role || "anonymous";
      },
    });

    const myRole = roleQ.data || "anonymous";
    const canWrite = myRole === "super_admin";

    function requireSuperAdmin() {
      if (!canWrite) throw new Error("Not allowed. Super Admin only.");
    }

    // Lookups
    const gradesQ = useQuery({
      queryKey: ["grade_levels"],
      queryFn: async () => {
        const { data, error } = await supabase.from("grade_levels").select("grade_id, grade_level").order("grade_level", { ascending: true });
        if (error) throw error;
        return (data ?? []).map((g) => ({ id: g.grade_id, label: String(g.grade_level) }));
      },
    });

    const tracksQ = useQuery({
      queryKey: ["tracks"],
      queryFn: async () => {
        const { data, error } = await supabase.from("tracks").select("track_id, track_code").order("track_code", { ascending: true });
        if (error) throw error;
        return (data ?? []).map((t) => ({ id: t.track_id, label: t.track_code ?? "(Unnamed)" }));
      },
    });

    const strandsQ = useQuery({
      queryKey: ["strands", tracksQ.data?.length],
      enabled: true,
      queryFn: async () => {
        const { data, error } = await supabase.from("strands").select("strand_id, strand_code, track_id").order("strand_code", { ascending: true });
        if (error) throw error;
        return data ?? [];
      },
    });

    const strands = useMemo(() => {
      const tracks = tracksQ.data ?? [];
      const trackMap = new Map(tracks.map((t) => [t.id, t.label]));
      return (strandsQ.data ?? []).map((s) => ({
        id: s.strand_id,
        track_id: s.track_id,
        label: `${trackMap.get(s.track_id) || ""}${trackMap.get(s.track_id) ? " - " : ""}${s.strand_code ?? "(Unnamed)"}`.trim(),
        _strand_code: s.strand_code ?? "",
      }));
    }, [strandsQ.data, tracksQ.data]);

    // Subjects list
    const subjectsQ = useQuery({
      queryKey: ["subjects"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("subjects")
          .select("subject_id, subject_code, subject_title, subject_type, units, grade_id, strand_id, is_archived, created_at, updated_at, archived_at")
          .order("subject_code", { ascending: true });
        if (error) throw error;
        return data ?? [];
      },
    });

    const rows = subjectsQ.data ?? [];
    const grades = gradesQ.data ?? [];
    const tracks = tracksQ.data ?? [];

    const activeRows = useMemo(() => rows.filter((r) => !r.is_archived), [rows]);
    const archivedRows = useMemo(() => rows.filter((r) => !!r.is_archived), [rows]);
    const data = tab === "Archived" ? archivedRows : activeRows;

    // Maps (fast lookups)
    const gradeMap = useMemo(() => new Map(grades.map((g) => [g.id, g.label])), [grades]);
    const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t.label])), [tracks]);
    const strandMap = useMemo(() => new Map(strands.map((s) => [s.id, s])), [strands]);

    const filtered = useMemo(() => {
      const needle = q.trim().toLowerCase();

      return data
        .filter((r) => (needle ? `${r.subject_code || ""} ${r.subject_title || ""}`.toLowerCase().includes(needle) : true))
        .filter((r) => (fType === "All" ? true : norm(r.subject_type) === norm(fType)))
        .filter((r) => (fGrade === "All" ? true : (r.grade_id || "") === fGrade))
        .filter((r) => {
          if (fTrack === "All") return true;
          const st = strandMap.get(r.strand_id);
          return st ? st.track_id === fTrack : false;
        })
        .filter((r) => (fStrand === "All" ? true : (r.strand_id || "") === fStrand));
    }, [data, q, fType, fGrade, fTrack, fStrand, strandMap]);

    const selectedIds = useMemo(
      () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
      [selected]
    );

    const allVisibleSelected = filtered.length > 0 && filtered.every((r) => Boolean(selected[r.subject_id]));

    function clearSelection() {
      setSelected({});
    }

    function toggleSelectAll(checked) {
      if (!canWrite) return;
      setSelected((prev) => {
        const next = { ...prev };
        for (const r of filtered) next[r.subject_id] = checked;
        return next;
      });
    }

    function openCreate() {
      if (!canWrite) return alert("Super Admin only.");
      setModal({
        open: true,
        mode: "create",
        row: {
          subject_id: uid(),
          subject_code: "",
          subject_title: "",
          subject_type: "Core",
          units: 0,
          grade_id: "",
          strand_id: "",
          created_at: null,
          updated_at: null,
        },
      });
    }

    function openEdit(row) {
      if (!canWrite) return alert("Super Admin only.");
      setModal({ open: true, mode: "edit", row });
    }

    // Mutations
    const createM = useMutation({
      mutationFn: async (values) => {
        requireSuperAdmin();
        const payload = {
          subject_id: values.subject_id || uid(),
          subject_code: String(values.subject_code || "").trim(),
          subject_title: String(values.subject_title || "").trim(),
          subject_type: values.subject_type,
          units: Number(values.units || 0),
          grade_id: values.grade_id ? values.grade_id : null,
          strand_id: values.strand_id ? values.strand_id : null,
          is_archived: false,
          archived_at: null,
        };
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw error;
      },
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    const updateM = useMutation({
      mutationFn: async ({ id, values }) => {
        requireSuperAdmin();
        const patch = {
          subject_code: String(values.subject_code || "").trim(),
          subject_title: String(values.subject_title || "").trim(),
          subject_type: values.subject_type,
          units: Number(values.units || 0),
          grade_id: values.grade_id ? values.grade_id : null,
          strand_id: values.strand_id ? values.strand_id : null,
        };
        const { error } = await supabase.from("subjects").update(patch).eq("subject_id", id);
        if (error) throw error;
      },
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    const archiveOneM = useMutation({
      mutationFn: async (row) => {
        requireSuperAdmin();
        const ok = window.confirm(`Archive ${row.subject_code || "this subject"}?`);
        if (!ok) return { cancelled: true };
        const { error } = await supabase
          .from("subjects")
          .update({ is_archived: true, archived_at: new Date().toISOString() })
          .eq("subject_id", row.subject_id);
        if (error) throw error;
        return { ok: true };
      },
      onSuccess: async (res) => {
        if (res?.cancelled) return;
        clearSelection();
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    const restoreOneM = useMutation({
      mutationFn: async (row) => {
        requireSuperAdmin();
        const { error } = await supabase.from("subjects").update({ is_archived: false, archived_at: null }).eq("subject_id", row.subject_id);
        if (error) throw error;
        return { ok: true };
      },
      onSuccess: async () => {
        clearSelection();
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    const bulkArchiveM = useMutation({
      mutationFn: async () => {
        requireSuperAdmin();
        const ok = window.confirm(`Archive ${selectedIds.length} subject(s)?`);
        if (!ok) return { cancelled: true };
        const { error } = await supabase
          .from("subjects")
          .update({ is_archived: true, archived_at: new Date().toISOString() })
          .in("subject_id", selectedIds);
        if (error) throw error;
        return { ok: true };
      },
      onSuccess: async (res) => {
        if (res?.cancelled) return;
        clearSelection();
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    const bulkRestoreM = useMutation({
      mutationFn: async () => {
        requireSuperAdmin();
        const { error } = await supabase.from("subjects").update({ is_archived: false, archived_at: null }).in("subject_id", selectedIds);
        if (error) throw error;
        return { ok: true };
      },
      onSuccess: async () => {
        clearSelection();
        await qc.invalidateQueries({ queryKey: ["subjects"] });
      },
    });

    // PDF Export (all active or all archived)
    function exportSubjectsPdf(which) {
      const list = which === "archived" ? archivedRows : activeRows;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const title = which === "archived" ? "Archived Subjects" : "Active Subjects";
      const generatedAt = new Date().toLocaleString();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, 40, 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${generatedAt}`, 40, 60);
      doc.text(`Total: ${list.length}`, 40, 74);

      const body = list.map((r) => {
        const grade = gradeMap.get(r.grade_id) ?? "All";
        const strandObj = strandMap.get(r.strand_id);
        const track = strandObj ? trackMap.get(strandObj.track_id) ?? "All" : "All";
        const strand = strandObj ? strandObj.label : "All";

        return [
          r.subject_code ?? "",
          r.subject_title ?? "",
          r.subject_type ?? "",
          grade,
          track,
          strand,
          String(r.units ?? 0),
          prettyDate(r.updated_at),
        ];
      });

      autoTable(doc, {
        startY: 90,
        head: [["Code", "Title", "Type", "Grade", "Track", "Strand", "Units", "Updated"]],
        body,
        styles: { font: "nunito", fontSize: 9, cellPadding: 6 },
        headStyles: { fontStyle: "bold" }, // keep minimal style (like Enrollment/Sections)
        margin: { left: 40, right: 40 },
        theme: "grid",
      });

      const filename = `subjects_${which}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    }

    const typeTabs = ["All", ...SUBJECT_TYPES];

    const loading = subjectsQ.isLoading || gradesQ.isLoading || tracksQ.isLoading || strandsQ.isLoading;
    const err = subjectsQ.error || gradesQ.error || tracksQ.error || strandsQ.error;

    return (
      <div className={`${UI.pageBg} ${UI.text} space-y-4`}>
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-extrabold">Subjects</div>
            <div className="mt-1 text-xs text-black/60">
              Role: <span className="font-extrabold text-black">{myRole || "—"}</span>
            </div>

            {!canWrite ? (
              <div className="mt-2 rounded-xl border border-black/10 bg-[#C9A227]/5 px-3 py-2 text-xs text-black/70">
                You are in <span className="font-extrabold">Admin/Teacher view</span>. Add/Edit/Archive/Restore are disabled.
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportSubjectsPdf("active")}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                title="Download Active Subjects (PDF)"
              >
                <Download className="h-4 w-4 text-black/70" />
                Export Active PDF
              </button>
              <button
                type="button"
                onClick={() => exportSubjectsPdf("archived")}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.02] disabled:opacity-60"
                title="Download Archived Subjects (PDF)"
              >
                <Download className="h-4 w-4 text-black/70" />
                Export Archived PDF
              </button>
            </div>

            {canWrite ? (
              <button
                onClick={openCreate}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95`}
              >
                <Plus className="h-4 w-4" />
                Add Subject
              </button>
            ) : null}
          </div>
        </div>

        {/* Type Tabs */}
        <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-3`}>
          <div className="flex flex-wrap gap-2">
            {typeTabs.map((t) => {
              const active = norm(fType) === norm(t);
              return (
                <button
                  key={t}
                  onClick={() => setFType(t)}
                  className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                    active ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white border-black/10 hover:bg-black/[0.02]"
                  }`}
                >
                  <span className={active ? "text-[#1F1A14]" : "text-black/70"}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className={`rounded-2xl border ${UI.border} ${UI.panel} p-4`}>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Search (code/title)">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search subject code or title…"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5"
                    title="Clear"
                  >
                    <X className="h-4 w-4 text-black/60" />
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="List">
              <select
                value={tab}
                onChange={(e) => {
                  setTab(e.target.value);
                  clearSelection();
                }}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </Field>

            <Field label="Grade (11/12)">
              <select
                value={fGrade}
                onChange={(e) => setFGrade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="All">All</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Track (optional)">
              <select
                value={fTrack}
                onChange={(e) => {
                  setFTrack(e.target.value);
                  setFStrand("All");
                }}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="All">All</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Strand (optional)">
              <select
                value={fStrand}
                onChange={(e) => setFStrand(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="All">All</option>
                {strands
                  .filter((s) => (fTrack === "All" ? true : s.track_id === fTrack))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className={`text-xs ${UI.muted}`}>
              Showing <span className="font-extrabold text-black">{filtered.length}</span> of{" "}
              <span className="font-extrabold text-black">{rows.length}</span>
            </div>

            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs font-semibold text-black/70">
                  {selectedIds.length} selected
                </span>

                {canWrite ? (
                  tab === "Active" ? (
                    <button
                      onClick={() => bulkArchiveM.mutate()}
                      disabled={bulkArchiveM.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-rose-500/10 px-4 py-2 text-sm font-extrabold text-rose-700 hover:bg-rose-500/15 disabled:opacity-60"
                    >
                      <Archive className="h-4 w-4" />
                      Archive Selected
                    </button>
                  ) : (
                    <button
                      onClick={() => bulkRestoreM.mutate()}
                      disabled={bulkRestoreM.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-[#C9A227]/10 px-4 py-2 text-sm font-extrabold text-[#C9A227] hover:opacity-90 disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore Selected
                    </button>
                  )
                ) : null}

                <button
                  onClick={clearSelection}
                  className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setQ("");
                  setFType("All");
                  setTab("Active");
                  setFGrade("All");
                  setFTrack("All");
                  setFStrand("All");
                  clearSelection();
                }}
                className="ml-auto rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Errors */}
        {err ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Error: {sbErrMsg(err)}
            <div className="mt-3">
              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["subjects"] });
                  qc.invalidateQueries({ queryKey: ["grade_levels"] });
                  qc.invalidateQueries({ queryKey: ["tracks"] });
                  qc.invalidateQueries({ queryKey: ["strands"] });
                }}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {/* Table */}
        <div className={`overflow-hidden rounded-2xl border ${UI.border} ${UI.panel}`}>
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <div className="text-sm font-extrabold">{tab === "Active" ? "Active Subjects" : "Archived Subjects"}</div>
            <div className={`text-xs ${UI.muted}`}>{loading ? "Loading…" : "Ready"}</div>
          </div>

          {loading ? (
            <div className={`p-6 text-sm ${UI.muted}`}>Loading…</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs text-black/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border border-black/20 disabled:opacity-60"
                      title={canWrite ? "Select all" : "Super Admin only"}
                      disabled={!canWrite}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Grade</th>
                  <th className="px-4 py-3 font-semibold">Track</th>
                  <th className="px-4 py-3 font-semibold">Strand</th>
                  <th className="px-4 py-3 font-semibold">Units</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const g = gradeMap.get(r.grade_id) ?? "All";
                  const strandObj = strandMap.get(r.strand_id);
                  const s = strandObj?.label ?? "All";
                  const t = strandObj ? trackMap.get(strandObj.track_id) ?? "All" : "All";

                  return (
                    <tr key={r.subject_id} className="border-t border-black/10 hover:bg-black/[0.01]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[r.subject_id])}
                          disabled={!canWrite}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [r.subject_id]: e.target.checked }))}
                          className="h-4 w-4 rounded border border-black/20 disabled:opacity-60"
                          title={canWrite ? "Select" : "Super Admin only"}
                        />
                      </td>

                      <td className="px-4 py-3 font-semibold">{r.subject_code || "—"}</td>
                      <td className="px-4 py-3">{r.subject_title || "—"}</td>
                      <td className="px-4 py-3">
                        <TypePill value={r.subject_type} />
                      </td>
                      <td className="px-4 py-3 text-black/70">{g}</td>
                      <td className="px-4 py-3 text-black/70">{t}</td>
                      <td className="px-4 py-3 text-black/70">{s}</td>
                      <td className="px-4 py-3 text-black/70">{String(r.units ?? 0)}</td>
                      <td className="px-4 py-3 text-black/70">{prettyDate(r.updated_at)}</td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {tab === "Active" ? (
                            <>
                              <IconBtn title={canWrite ? "Edit" : "Super Admin only"} onClick={() => openEdit(r)} tone="gold" disabled={!canWrite}>
                                <Pencil className="h-5 w-5" />
                              </IconBtn>
                              <IconBtn
                                title={canWrite ? "Archive" : "Super Admin only"}
                                onClick={() => archiveOneM.mutate(r)}
                                tone="danger"
                                disabled={!canWrite || archiveOneM.isPending}
                              >
                                <Archive className="h-5 w-5" />
                              </IconBtn>
                            </>
                          ) : (
                            <IconBtn
                              title={canWrite ? "Restore" : "Super Admin only"}
                              onClick={() => restoreOneM.mutate(r)}
                              tone="gold"
                              disabled={!canWrite || restoreOneM.isPending}
                            >
                              <ArchiveRestore className="h-5 w-5" />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={`px-4 py-10 text-center text-sm ${UI.muted}`}>
                      No records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal */}
        {modal.open ? (
          <SubjectModal
            mode={modal.mode}
            row={modal.row}
            grades={grades}
            strands={strands}
            canWrite={canWrite}
            busy={createM.isPending || updateM.isPending}
            onClose={() => setModal({ open: false, mode: "create", row: null })}
            onCreate={(values) => createM.mutateAsync(values)}
            onUpdate={(id, values) => updateM.mutateAsync({ id, values })}
          />
        ) : null}
      </div>
    );
  }

  /* ================= Modal (CENTER + BACKDROP BLUR) ================= */

  function SubjectModal({ mode, row, grades, strands, canWrite, busy, onClose, onCreate, onUpdate }) {
    const isEdit = mode === "edit";

    const lastUpdatedAt = useMemo(() => {
      if (!row) return null;
      const raw = row.updated_at || row.created_at || null;
      return prettyDate(raw);
    }, [row]);

    const [values, setValues] = useState(() => ({
      subject_id: row?.subject_id || uid(),
      subject_code: row?.subject_code || "",
      subject_title: row?.subject_title || "",
      subject_type: row?.subject_type || "Core",
      units: row?.units ?? 0,
      grade_id: row?.grade_id || "",
      strand_id: row?.strand_id || "",
    }));

    const [errors, setErrors] = useState({});

    function validate(v) {
      const e = {};
      if (!String(v.subject_code || "").trim()) e.subject_code = "Subject code is required.";
      if (!String(v.subject_title || "").trim()) e.subject_title = "Subject title is required.";
      if (!String(v.subject_type || "").trim()) e.subject_type = "Subject type is required.";

      const u = Number(v.units);
      if (Number.isNaN(u)) e.units = "Units must be a number.";
      if (u < 0) e.units = "Units must be 0 or greater.";

      if (String(v.subject_code || "").length > 30) e.subject_code = "Max 30 characters.";
      if (String(v.subject_title || "").length > 150) e.subject_title = "Max 150 characters.";

      return e;
    }

    async function submit(e) {
      e.preventDefault();
      if (!canWrite) return alert("Super Admin only.");

      const vErr = validate(values);
      setErrors(vErr);
      if (Object.keys(vErr).length) return;

      try {
        if (isEdit) await onUpdate(row.subject_id, values);
        else await onCreate(values);
        onClose();
      } catch (err) {
        alert(sbErrMsg(err));
      }
    }

    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-2xl border ${UI.border} bg-white shadow-xl`}>
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4">
              <div>
                <div className="text-base font-extrabold">{isEdit ? "Edit Subject" : "Add Subject"}</div>
                <div className={`text-xs ${UI.muted}`}>Clean white + gold form. Subject code + title required.</div>
              </div>

              <div className="text-right">
                {isEdit ? (
                  <div className="rounded-xl border border-black/10 bg-[#C9A227]/5 px-3 py-2">
                    <div className="text-[11px] font-semibold text-black/60">Last updated at:</div>
                    <div className="text-xs font-extrabold text-black">{lastUpdatedAt || "—"}</div>
                  </div>
                ) : null}

                <button onClick={onClose} className="mt-2 grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 ml-auto" title="Close">
                  <X className="h-5 w-5 text-black/60" />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="p-4 space-y-4 max-h-[75vh] overflow-auto">
              {!canWrite ? (
                <div className="rounded-xl border border-black/10 bg-[#C9A227]/5 px-3 py-2 text-xs text-black/70">
                  Super Admin only. You can view this form but cannot save.
                </div>
              ) : null}

              <Section title="Subject Details">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    label="Subject Code *"
                    value={values.subject_code}
                    onChange={(e) => setValues((p) => ({ ...p, subject_code: e.target.value }))}
                    error={errors.subject_code}
                    disabled={!canWrite}
                  />

                  <Select
                    label="Subject Type *"
                    value={values.subject_type}
                    onChange={(e) => setValues((p) => ({ ...p, subject_type: e.target.value }))}
                    error={errors.subject_type}
                    disabled={!canWrite}
                  >
                    {SUBJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Units"
                    type="number"
                    value={values.units}
                    onChange={(e) => setValues((p) => ({ ...p, units: e.target.value }))}
                    error={errors.units}
                    disabled={!canWrite}
                  />
                </div>

                <div className="mt-3">
                  <Input
                    label="Subject Title *"
                    value={values.subject_title}
                    onChange={(e) => setValues((p) => ({ ...p, subject_title: e.target.value }))}
                    error={errors.subject_title}
                    disabled={!canWrite}
                  />
                </div>
              </Section>

              <Section title="Scope (optional)">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select label="Grade" value={values.grade_id} onChange={(e) => setValues((p) => ({ ...p, grade_id: e.target.value }))} disabled={!canWrite}>
                    <option value="">All</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Strand"
                    value={values.strand_id}
                    onChange={(e) => setValues((p) => ({ ...p, strand_id: e.target.value }))}
                    disabled={!canWrite}
                  >
                    <option value="">All</option>
                    {strands.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={`mt-3 rounded-xl border ${UI.border} ${UI.goldSoft} p-3`}>
                  <div className="text-xs font-semibold text-black/60">Tip</div>
                  <div className="mt-1 text-sm font-extrabold text-black">
                    Use Strand for Specialized subjects. Leave Grade/Strand as “All” for shared subjects.
                  </div>
                </div>
              </Section>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]"
                >
                  Cancel
                </button>

                {canWrite ? (
                  <button
                    disabled={busy}
                    type="submit"
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${UI.goldBg} text-black hover:opacity-95 disabled:opacity-60`}
                  >
                    <Save className="h-4 w-4" />
                    {isEdit ? "Save Changes" : "Create"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  /* ================= Small Components ================= */

  function Field({ label, children }) {
    return (
      <label className="block">
        <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
        {children}
      </label>
    );
  }

  function Section({ title, children }) {
    return (
      <div className={`rounded-2xl border ${UI.border} bg-white p-4`}>
        <div className={`text-sm font-extrabold ${UI.brown}`}>{title}</div>
        <div className="mt-3">{children}</div>
      </div>
    );
  }

  function Input({ label, error, type = "text", disabled, ...rest }) {
    return (
      <label className="block">
        <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
        <input
          type={type}
          disabled={disabled}
          {...rest}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:opacity-60"
        />
        {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
      </label>
    );
  }

  function Select({ label, error, children, disabled, ...rest }) {
    return (
      <label className="block">
        <span className={`text-xs font-semibold ${UI.muted}`}>{label}</span>
        <select
          disabled={disabled}
          {...rest}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:opacity-60"
        >
          {children}
        </select>
        {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
      </label>
    );
  }

  function IconBtn({ title, onClick, tone, disabled, children }) {
    const cls =
      tone === "danger"
        ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15"
        : "bg-[#C9A227]/10 text-[#C9A227] hover:opacity-90";

    return (
      <button
        title={title}
        onClick={onClick}
        disabled={disabled}
        className={`grid h-9 w-9 place-items-center rounded-xl border border-black/10 ${cls} disabled:opacity-60`}
        type="button"
      >
        {children}
      </button>
    );
  }
