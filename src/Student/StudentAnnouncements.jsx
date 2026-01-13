import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, AlertTriangle, Clock, RefreshCcw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile, getActiveSy } from "../lib/portalCtx";

function tone(priority) {
  if (priority === "High") return "border-rose-200 bg-rose-50 text-rose-900";
  if (priority === "Low") return "border-slate-200 bg-slate-50 text-slate-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function teacherFullName(t) {
  if (!t) return "—";
  const ln = String(t.last_name || "").trim();
  const fn = String(t.first_name || "").trim();
  const full = `${ln}${ln && fn ? ", " : ""}${fn}`.trim();
  return full || "—";
}

function adminLabelFromProfile(p) {
  if (!p) return "Admin";
  const email = String(p.email || "").trim();
  if (!email) return "Admin";
  return email; // or email.split("@")[0]
}

export default function StudentAnnouncement() {
  const [adminItems, setAdminItems] = useState([]);
  const [adviserItems, setAdviserItems] = useState([]);
  const [subjectTeacherItems, setSubjectTeacherItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [tab, setTab] = useState("Admin"); // Admin | Adviser | Subject Teachers
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState("all");

  async function load() {
    setLoading(true);
    setErrMsg("");

    try {
      // 0) auth/profile checks
      const { user, profile } = await getMyProfile();
      if (norm(profile?.role) !== "student") throw new Error("Forbidden: student only");

      const sy = await getActiveSy();
      if (!sy?.sy_id) throw new Error("No active School Year found.");

      // 1) student row (to know section_id)
      const { data: student, error: stErr } = await supabase
        .from("students")
        .select("id, user_id, section_id, sy_id")
        .eq("user_id", user.id) // ✅ safer than profile.user_id
        .eq("sy_id", sy.sy_id)
        .maybeSingle();

      if (stErr) throw stErr;

      if (!student) {
        throw new Error("No student record found for this account in the active School Year.");
      }

      const sectionId = student?.section_id ?? null; // ✅ define it once

      // 2) adviser for this section in active SY
      let adviserId = null; // teachers.user_id
      if (sectionId) {
        const { data: adv, error: advErr } = await supabase
          .from("section_advisers")
          .select("adviser_id")
          .eq("sy_id", sy.sy_id)
          .eq("section_id", sectionId)
          .maybeSingle();

        if (advErr) throw advErr;
        adviserId = adv?.adviser_id || null;
      }

      // 3) subject teacher IDs for this section in active SY (teachers.user_id)
      let subjectTeacherIds = [];
      if (sectionId) {
        const { data: sched, error: schErr } = await supabase
          .from("section_schedules")
          .select("teacher_id")
          .eq("sy_id", sy.sy_id)
          .eq("section_id", sectionId)
          .not("teacher_id", "is", null);

        if (schErr) throw schErr;

        subjectTeacherIds = Array.from(new Set((sched || []).map((r) => r.teacher_id).filter(Boolean)));
      }

      // 4) fetch announcements for current SY (Published, not archived)
      const { data: ann, error: annErr } = await supabase
        .from("announcements")
        .select(`
          id,
          title,
          content,
          priority,
          target_audience,
          posted_at,
          posted_by,
          posted_by_role,
          posted_by_teacher_id,
          section_id,
          sy_id
        `)
        .eq("status", "Published")
        .eq("is_archived", false)
        .eq("sy_id", sy.sy_id)
        .order("posted_at", { ascending: false });

      if (annErr) throw annErr;

      const announcements = ann || [];

      // 5) visibility rules
      const myTeacherIds = new Set([adviserId, ...subjectTeacherIds].filter(Boolean));

      const visible = announcements.filter((a) => {
        const audience = a.target_audience;

        // fallback role if old data is missing posted_by_role
        const role = norm(a.posted_by_role) || (a.posted_by_teacher_id ? "teacher" : "super_admin");

        if (!["All Students", "Section Students", "My Students"].includes(audience)) return false;

        if (audience === "All Students") return true;

        if (audience === "Section Students") {
          return Boolean(sectionId) && a.section_id === sectionId;
        }

        if (audience === "My Students") {
          if (role !== "teacher") return false;
          const teacherId = a.posted_by_teacher_id;
          return Boolean(teacherId) && myTeacherIds.has(teacherId);
        }

        return false;
      });

      // 6) Fetch names for posters
      const teacherPosterIds = Array.from(
        new Set(
          visible
            .filter((a) => (norm(a.posted_by_role) || (a.posted_by_teacher_id ? "teacher" : "")) === "teacher")
            .map((a) => a.posted_by_teacher_id)
            .filter(Boolean)
        )
      );

      const adminPosterIds = Array.from(
        new Set(
          visible
            .filter((a) => (norm(a.posted_by_role) || (!a.posted_by_teacher_id ? "super_admin" : "")) === "super_admin")
            .map((a) => a.posted_by)
            .filter(Boolean)
        )
      );

      // teacher map
      let teacherMap = new Map();
      if (teacherPosterIds.length) {
        const { data: teacherRows, error: tErr } = await supabase
          .from("teachers")
          .select("user_id, first_name, last_name")
          .in("user_id", teacherPosterIds);

        if (tErr) throw tErr;
        teacherMap = new Map((teacherRows || []).map((t) => [t.user_id, t]));
      }

      // profiles map (admins)
      let profileMap = new Map();
      if (adminPosterIds.length) {
        const { data: profRows, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", adminPosterIds);

        // If blocked by RLS, just fallback to "Admin"
        if (!pErr) {
          profileMap = new Map((profRows || []).map((p) => [p.user_id, p]));
        }
      }

      const withPoster = visible.map((a) => {
        const role = norm(a.posted_by_role) || (a.posted_by_teacher_id ? "teacher" : "super_admin");

        if (role === "teacher") {
          const t = teacherMap.get(a.posted_by_teacher_id);
          return { ...a, poster_name: teacherFullName(t) };
        }

        if (role === "super_admin") {
          const p = profileMap.get(a.posted_by);
          return { ...a, poster_name: adminLabelFromProfile(p) };
        }

        return { ...a, poster_name: "—" };
      });

      // 7) categorize separately
      const admin = [];
      const adviser = [];
      const subjectT = [];

      const subjectSet = new Set(subjectTeacherIds);

      for (const a of withPoster) {
        const role = norm(a.posted_by_role) || (a.posted_by_teacher_id ? "teacher" : "super_admin");

        if (role === "super_admin") {
          admin.push(a);
          continue;
        }

        if (role === "teacher") {
          const teacherId = a.posted_by_teacher_id;
          if (!teacherId) continue;

          if (adviserId && teacherId === adviserId) {
            adviser.push(a);
            continue;
          }

          if (subjectSet.has(teacherId) && (!adviserId || teacherId !== adviserId)) {
            subjectT.push(a);
            continue;
          }
        }
      }

      setAdminItems(admin);
      setAdviserItems(adviser);
      setSubjectTeacherItems(subjectT);

      if (!sectionId) setTab("Admin");
    } catch (e) {
      setErrMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentBucket = useMemo(() => {
    if (tab === "Admin") return adminItems;
    if (tab === "Adviser") return adviserItems;
    return subjectTeacherItems;
  }, [tab, adminItems, adviserItems, subjectTeacherItems]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (currentBucket || [])
      .filter((x) => (prio === "all" ? true : x.priority === prio))
      .filter((x) => {
        if (!qq) return true;
        return (
          String(x.title || "").toLowerCase().includes(qq) ||
          String(x.content || "").toLowerCase().includes(qq)
        );
      });
  }, [currentBucket, q, prio]);

  const counts = useMemo(() => {
    return {
      Admin: adminItems.length,
      Adviser: adviserItems.length,
      "Subject Teachers": subjectTeacherItems.length,
    };
  }, [adminItems, adviserItems, subjectTeacherItems]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold text-[#2b1a12] flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-black/60" />
              Announcements
            </div>
            <div className="text-xs font-semibold text-black/50">
              Admin, your Adviser, and your Subject Teachers only.
            </div>
            {errMsg ? (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {errMsg}
              </div>
            ) : null}
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-xs font-semibold hover:bg-black/5"
            type="button"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {["Admin", "Adviser", "Subject Teachers"].map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-2xl border px-3 py-2 text-xs font-extrabold ${
                  active
                    ? "border-[#C9A227]/50 bg-[#C9A227]/10 text-[#2b1a12]"
                    : "border-black/10 bg-white text-black/60 hover:bg-black/[0.02]"
                }`}
                type="button"
              >
                {t}{" "}
                <span className="ml-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-extrabold text-black/50">
                  {counts[t] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search / Priority */}
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search in ${tab}…`}
            className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
          />
          <select
            value={prio}
            onChange={(e) => setPrio(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm outline-none"
          >
            <option value="all">All priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/60">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/40">
          No announcements found in <span className="font-extrabold">{tab}</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-black/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-[#2b1a12]">{a.title}</div>

                  <div className="mt-1 text-xs font-semibold text-black/50 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {a.posted_at ? new Date(a.posted_at).toLocaleString() : "—"}
                    </span>

                    <span className="text-black/40">•</span>

                    <span className="text-black/60">
                      Posted by:{" "}
                      <span className="font-extrabold text-black/70">{a.poster_name || "—"}</span>
                    </span>
                  </div>
                </div>

                <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${tone(a.priority)}`}>
                  {a.priority}
                  {a.priority === "High" ? <AlertTriangle className="ml-1 inline h-3.5 w-3.5" /> : null}
                </span>
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm text-black/70">{a.content}</div>

              <div className="mt-3 text-[11px] font-semibold text-black/40">Audience: {a.target_audience}</div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
