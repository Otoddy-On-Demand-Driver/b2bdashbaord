import { useState } from "react";
import { authStore } from "../../store/authStore";

/**
 * Settings UX Upgrade
 * - Profile summary
 * - Security section (password placeholder UI)
 * - Session info
 * - Approval / Access state (useful for OPS / Admin context)
 *
 * NOTE:
 * This is UI-first. Hook password + profile APIs later.
 */


function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          {desc ? <div className="mt-1 text-xs text-slate-500">{desc}</div> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value || "—"}
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "amber" | "blue" | "slate";
}) {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export default function SettingsPage() {
  const user = authStore((s) => s.user);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  async function changePasswordFake(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPwd(true);
    // Replace with real API later
    await new Promise((r) => setTimeout(r, 800));
    setSavingPwd(false);
    setPwdOpen(false);
  }

  
  const approvalTone =
    user?.isApproved === true ? "green" : user?.isApproved === false ? "amber" : "slate";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Account profile, access status, and security controls.
        </p>
      </div>

      {/* Profile + Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Profile" desc="Basic account information.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" value={user?.name as any} />
            <Field label="Email" value={user?.email as any} />
            <Field label="Phone" value={user?.phoneNumber as any} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-900 capitalize">
                  {user?.role || "—"}
                </div>
                {user?.role ? <Chip tone="blue">Access Role</Chip> : null}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Access Status"
          desc="Controls whether this account can access the app (useful for driver / ops workflows)."
        >
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Approval
              </div>
              <div className="mt-1">
                <Chip tone={approvalTone as any}>
                  {user?.isApproved === true
                    ? "Approved"
                    : user?.isApproved === false
                    ? "Pending Approval"
                    : "—"}
                </Chip>
              </div>
            </div>

            {"isVerified" in (user || {}) ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Verification
                </div>
                <div className="mt-1">
                  <Chip tone={user?.isVerified ? "green" : "amber"}>
                    {user?.isVerified ? "Verified" : "Not Verified"}
                  </Chip>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Only <b>approved</b> users should be able to login in production.  
            Enforce this in backend login response once driver approval flow is connected.
          </div>
        </Section>
      </div>

      {/* Security */}
      <Section
        title="Security"
        desc="Password and session controls."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Change your password to keep your account secure.
          </div>

          <button
            onClick={() => setPwdOpen(true)}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Change Password
          </button>
        </div>
      </Section>

      {/* Session Info */}
      <Section
        title="Session"
        desc="Current login session information."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="User ID" value={(user as any)?._id} />
          <Field label="Last Login" value={(user as any)?.lastLoginAt || "Current session"} />
          <Field label="Account Created" value={(user as any)?.createdAt} />
        </div>
      </Section>

      {/* Change Password Modal (UI only) */}
      {pwdOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPwdOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="p-5 border-b border-slate-200">
              <div className="text-sm font-extrabold text-slate-900">
                Change Password
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Update your account password.
              </div>
            </div>

            <form onSubmit={changePasswordFake} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={savingPwd}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingPwd ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
