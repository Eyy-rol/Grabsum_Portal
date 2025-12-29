import React, { useMemo, useState } from "react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-black/50">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Badge({ tone = "neutral", children }) {
  const cls = {
    success: "bg-[#e9f7ef] text-[#1e6b3a] border-[#c9ead6]",
    warning: "bg-[#fff3da] text-[#7a4b00] border-[#f3d7a3]",
    danger: "bg-[#fde8e8] text-[#8a1c1c] border-[#f5bcbc]",
    neutral: "bg-[#f5f5f5] text-black/60 border-black/10",
    info: "bg-[#eaf2ff] text-[#1d4ed8] border-[#c7dbff]",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className={cn(
        "relative h-8 w-14 rounded-full border transition",
        disabled ? "opacity-60" : "hover:opacity-95",
        on ? "bg-black border-black" : "bg-white border-black/10"
      )}
      aria-pressed={on}
    >
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition", on ? "left-7" : "left-1")} />
    </button>
  );
}

function FlagRow({ title, desc, on, onChange, badge }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {badge ? <div>{badge}</div> : null}
        </div>
        <div className="mt-1 text-xs text-black/50">{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function SystemConfiguration() {
  const [saving, setSaving] = useState(false);

  const [flags, setFlags] = useState({
    enrollment: true,
    schedule: true,
    attendance: true,
    gradebook: true,
    assignments: false,
    announcements: true,
    payments: false,
    parentPortal: false,
  });

  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: "System is under maintenance. Please try again later.",
    allowAdmins: true,
  });

  const enabledCount = useMemo(() => Object.values(flags).filter(Boolean).length, [flags]);

  async function onSave() {
    setSaving(true);
    setTimeout(() => setSaving(false), 700); // UI only
  }

  return (
    <div className="space-y-4">
      <Card
        title="System Configuration"
        subtitle="Feature flags, maintenance mode, and operational toggles. (UI only)"
        right={<Badge tone="info">{enabledCount} modules enabled</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Feature Flags */}
          <div className="space-y-3">
            <div className="rounded-[22px] border border-black/10 bg-white p-4">
              <div className="text-sm font-semibold">Feature Flags</div>
              <div className="mt-1 text-xs text-black/50">
                Enable/disable modules without redeploying (recommended for staged rollout).
              </div>
            </div>

            <FlagRow
              title="Enrollment"
              desc="Student enrollment workflow, approvals, and registrar tools."
              on={flags.enrollment}
              onChange={(v) => setFlags((f) => ({ ...f, enrollment: v }))}
              badge={<Badge tone="success">Core</Badge>}
            />
            <FlagRow
              title="Schedule"
              desc="Sections, class schedules, and calendar integrations."
              on={flags.schedule}
              onChange={(v) => setFlags((f) => ({ ...f, schedule: v }))}
              badge={<Badge tone="success">Core</Badge>}
            />
            <FlagRow
              title="Attendance"
              desc="Daily attendance tracking for teachers and admin reports."
              on={flags.attendance}
              onChange={(v) => setFlags((f) => ({ ...f, attendance: v }))}
              badge={<Badge tone="success">Core</Badge>}
            />
            <FlagRow
              title="Gradebook"
              desc="Grading periods, grade computation, exports."
              on={flags.gradebook}
              onChange={(v) => setFlags((f) => ({ ...f, gradebook: v }))}
              badge={<Badge tone="warning">Sensitive</Badge>}
            />
            <FlagRow
              title="Assignments"
              desc="Assignments, submissions, scoring (beta)."
              on={flags.assignments}
              onChange={(v) => setFlags((f) => ({ ...f, assignments: v }))}
              badge={<Badge tone="info">Beta</Badge>}
            />
            <FlagRow
              title="Announcements"
              desc="Admin announcements to classes and school-wide feed."
              on={flags.announcements}
              onChange={(v) => setFlags((f) => ({ ...f, announcements: v }))}
            />
            <FlagRow
              title="Payments"
              desc="Tuition/payment tracking (disabled by default)."
              on={flags.payments}
              onChange={(v) => setFlags((f) => ({ ...f, payments: v }))}
              badge={<Badge tone="danger">High Risk</Badge>}
            />
            <FlagRow
              title="Parent Portal"
              desc="Parent view of grades/attendance (private preview)."
              on={flags.parentPortal}
              onChange={(v) => setFlags((f) => ({ ...f, parentPortal: v }))}
              badge={<Badge tone="info">Preview</Badge>}
            />
          </div>

          {/* Maintenance Mode */}
          <div className="space-y-3">
            <div className="rounded-[22px] border border-black/10 bg-[#fff3da] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Maintenance Mode</div>
                  <div className="text-xs text-black/50">
                    Lock the app for users during updates. Use sparingly.
                  </div>
                </div>
                <Toggle
                  on={maintenance.enabled}
                  onChange={(v) => setMaintenance((m) => ({ ...m, enabled: v }))}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold text-black/60">Maintenance message</div>
              <textarea
                value={maintenance.message}
                onChange={(e) => setMaintenance((m) => ({ ...m, message: e.target.value }))}
                className="mt-2 h-28 w-full rounded-[22px] border border-black/10 bg-white p-4 text-sm outline-none"
              />
              <div className="mt-3 flex items-center justify-between rounded-[18px] border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Allow admins to bypass</div>
                  <div className="text-xs text-black/45">Admins can still access for verification.</div>
                </div>
                <Toggle
                  on={maintenance.allowAdmins}
                  onChange={(v) => setMaintenance((m) => ({ ...m, allowAdmins: v }))}
                  disabled={!maintenance.enabled}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-white p-4">
              <div className="text-sm font-semibold">Safety notes</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-black/55">
                <li>Enforce maintenance mode in backend (route guard + RLS if needed).</li>
                <li>Audit all flag changes and record “who changed what, when, why”.</li>
                <li>Keep payment features off unless security + compliance are ready.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
          <div className="text-xs text-black/60">
            Changes should be logged to <span className="font-semibold">Activity Logs</span> (role + config changes).
          </div>
          <div className="flex gap-2">
            <button className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
              Reset Defaults
            </button>
            <button
              onClick={onSave}
              className={cn(
                "rounded-2xl px-4 py-2 text-xs font-semibold",
                saving ? "bg-black/10 text-black/50" : "bg-[#e7aa2f] text-black hover:opacity-90"
              )}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
