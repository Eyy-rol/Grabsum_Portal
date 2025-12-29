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
      <span
        className={cn(
          "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
          on ? "left-7" : "left-1"
        )}
      />
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-black/60">{label}</div>
      {hint ? <div className="text-xs text-black/45">{hint}</div> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function SecuritySettings() {
  const [saving, setSaving] = useState(false);

  // UI-only state
  const [password, setPassword] = useState({
    minLength: 10,
    requireUpper: true,
    requireNumber: true,
    requireSymbol: true,
    maxAgeDays: 0, // 0 = no rotation
  });

  const [login, setLogin] = useState({
    maxFailed: 5,
    lockoutMinutes: 15,
    allowRememberMe: true,
    require2FAForAdmins: false,
  });

  const [sessions, setSessions] = useState({
    revokeAllOnPasswordChange: true,
    idleTimeoutMinutes: 60,
    allowMultipleSessions: true,
  });

  const [alerts, setAlerts] = useState({
    notifyOnRoleChange: true,
    notifyOnMultipleFailedLogins: true,
    failedLoginThreshold: 10,
  });

  const riskLabel = useMemo(() => {
    const weak =
      password.minLength < 8 ||
      (!password.requireUpper && !password.requireNumber && !password.requireSymbol) ||
      login.maxFailed > 10 ||
      sessions.idleTimeoutMinutes > 240;

    if (weak) return { tone: "danger", text: "Risk: High (weak settings)" };
    if (!login.require2FAForAdmins) return { tone: "warning", text: "Risk: Medium (consider 2FA for admins)" };
    return { tone: "success", text: "Risk: Low" };
  }, [password, login, sessions]);

  async function onSave() {
    // UI only
    setSaving(true);
    setTimeout(() => setSaving(false), 700);
  }

  return (
    <div className="space-y-4">
      <Card
        title="Security Settings"
        subtitle="Configure authentication, password rules, sessions, and alerts. (UI only)"
        right={<Badge tone={riskLabel.tone}>{riskLabel.text}</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Password Policy */}
          <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
            <div className="text-sm font-semibold">Password Policy</div>
            <div className="mt-3 space-y-4">
              <Field label="Minimum length">
                <input
                  type="number"
                  value={password.minLength}
                  min={6}
                  max={64}
                  onChange={(e) => setPassword((p) => ({ ...p, minLength: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <div className="grid gap-2">
                {[
                  ["Require uppercase", "requireUpper"],
                  ["Require number", "requireNumber"],
                  ["Require symbol", "requireSymbol"],
                ].map(([label, key]) => (
                  <label key={key} className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="text-sm font-medium">{label}</div>
                    <Toggle
                      on={password[key]}
                      onChange={(v) => setPassword((p) => ({ ...p, [key]: v }))}
                    />
                  </label>
                ))}
              </div>

              <Field
                label="Password rotation (days)"
                hint="0 = disabled. Enable only if required by policy."
              >
                <input
                  type="number"
                  value={password.maxAgeDays}
                  min={0}
                  max={365}
                  onChange={(e) => setPassword((p) => ({ ...p, maxAgeDays: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>
            </div>
          </div>

          {/* Login Controls */}
          <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
            <div className="text-sm font-semibold">Login Controls</div>
            <div className="mt-3 space-y-4">
              <Field label="Max failed attempts" hint="Too high increases brute-force risk.">
                <input
                  type="number"
                  value={login.maxFailed}
                  min={3}
                  max={20}
                  onChange={(e) => setLogin((s) => ({ ...s, maxFailed: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Lockout duration (minutes)">
                <input
                  type="number"
                  value={login.lockoutMinutes}
                  min={1}
                  max={240}
                  onChange={(e) => setLogin((s) => ({ ...s, lockoutMinutes: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Remember me</div>
                  <div className="text-xs text-black/45">Allow persistent sessions on devices.</div>
                </div>
                <Toggle on={login.allowRememberMe} onChange={(v) => setLogin((s) => ({ ...s, allowRememberMe: v }))} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Require 2FA for Admins</div>
                  <div className="text-xs text-black/45">Recommended for privileged accounts.</div>
                </div>
                <Toggle
                  on={login.require2FAForAdmins}
                  onChange={(v) => setLogin((s) => ({ ...s, require2FAForAdmins: v }))}
                />
              </label>
            </div>
          </div>

          {/* Session & Tokens */}
          <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
            <div className="text-sm font-semibold">Sessions & Tokens</div>
            <div className="mt-3 space-y-4">
              <Field label="Idle timeout (minutes)" hint="Shorter is safer; too short hurts UX.">
                <input
                  type="number"
                  value={sessions.idleTimeoutMinutes}
                  min={5}
                  max={720}
                  onChange={(e) => setSessions((s) => ({ ...s, idleTimeoutMinutes: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Allow multiple sessions</div>
                  <div className="text-xs text-black/45">Let users log in on multiple devices.</div>
                </div>
                <Toggle
                  on={sessions.allowMultipleSessions}
                  onChange={(v) => setSessions((s) => ({ ...s, allowMultipleSessions: v }))}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Revoke sessions on password change</div>
                  <div className="text-xs text-black/45">Force re-login after password updates.</div>
                </div>
                <Toggle
                  on={sessions.revokeAllOnPasswordChange}
                  onChange={(v) => setSessions((s) => ({ ...s, revokeAllOnPasswordChange: v }))}
                />
              </label>
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-[22px] border border-black/10 bg-[#fafafa] p-4">
            <div className="text-sm font-semibold">Security Alerts</div>
            <div className="mt-3 space-y-4">
              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Notify on role changes</div>
                  <div className="text-xs text-black/45">Log + notify Super Admin.</div>
                </div>
                <Toggle
                  on={alerts.notifyOnRoleChange}
                  onChange={(v) => setAlerts((a) => ({ ...a, notifyOnRoleChange: v }))}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium">Notify on repeated failed logins</div>
                  <div className="text-xs text-black/45">Detect possible attacks.</div>
                </div>
                <Toggle
                  on={alerts.notifyOnMultipleFailedLogins}
                  onChange={(v) => setAlerts((a) => ({ ...a, notifyOnMultipleFailedLogins: v }))}
                />
              </label>

              <Field label="Failed login threshold" hint="Trigger alert when failures exceed this count (per hour).">
                <input
                  type="number"
                  value={alerts.failedLoginThreshold}
                  min={3}
                  max={100}
                  onChange={(e) => setAlerts((a) => ({ ...a, failedLoginThreshold: Number(e.target.value || 0) }))}
                  className="w-32 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-[22px] border border-black/10 bg-[#fff3da] p-4">
          <div className="text-xs text-black/60">
            <span className="font-semibold">Reminder:</span> enforce these rules in the backend (RLS / server checks). UI alone
            is not enough.
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
