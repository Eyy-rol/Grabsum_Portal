// src/components/ClassModal.jsx
import React from "react";
import { Copy, X } from "lucide-react";

export default function ClassModal({ open, onClose, data, title = "Student Login + Class" }) {
  if (!open) return null;

  const studentNumber = data?.student_number || data?.username || "";
  const tempPassword = data?.temp_password || null;

  const cls = data?.class_info || {
    grade_level: "11",
    section: "St. Luke (Mock)",
    adviser: "Ms. Dela Cruz (Mock)",
    schedule: "Mon-Fri 7:30AM–4:00PM (Mock)",
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-black/10">
          <div className="flex items-start justify-between p-4 border-b border-black/10">
            <div>
              <div className="text-base font-extrabold">{title}</div>
              <div className="text-xs text-black/60">
                Show this once. Student must change password at first login.
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-black/60" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="rounded-2xl border border-black/10 bg-[#fbf6ef] p-3">
              <div className="text-xs font-semibold text-black/60">Username / Student Number</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="font-mono font-extrabold text-black">{studentNumber || "-"}</div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold hover:bg-black/[0.02]"
                  onClick={() => studentNumber && navigator.clipboard.writeText(studentNumber)}
                  disabled={!studentNumber}
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#fbf6ef] p-3">
              <div className="text-xs font-semibold text-black/60">Temporary Password</div>
              {tempPassword ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="font-mono font-extrabold text-black">{tempPassword}</div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold hover:bg-black/[0.02]"
                    onClick={() => navigator.clipboard.writeText(tempPassword)}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </div>
              ) : (
                <div className="mt-1 text-xs text-black/60">
                  No password shown (user already existed). Use <b>Reset</b> if needed.
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-black/70">
                <input type="checkbox" checked readOnly />
                <span>Student must go to <b>Change Password</b> after first login.</span>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-3">
              <div className="text-sm font-extrabold">Class (Mock)</div>
              <div className="mt-2 text-sm text-black/70 space-y-1">
                <div>Grade: <b>{cls.grade_level}</b></div>
                <div>Section: <b>{cls.section}</b></div>
                <div>Adviser: <b>{cls.adviser}</b></div>
                <div>Schedule: <b>{cls.schedule}</b></div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-black text-white px-5 py-2 text-sm font-extrabold hover:opacity-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
