import { authStore } from "../../store/authStore";

export default function SettingsPage() {
  const user = authStore((s) => s.user);
  return (
    <div className="p-6">
      <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Account info.</p>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 max-w-xl">
        <div className="text-sm font-semibold">Role</div>
        <div className="text-sm text-slate-700 capitalize">{user?.role}</div>

        <div className="mt-4 text-sm font-semibold">User</div>
        <div className="text-sm text-slate-700">{user?.name || user?.email || user?.phoneNumber}</div>
      </div>
    </div>
  );
}
