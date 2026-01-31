import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authStore } from "../store/authStore";
import { NAV_ITEMS } from "../lib/nav";
import { LogOut, Menu } from "lucide-react";
import { useMemo, useState } from "react";

const linkBase =
  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition";
const linkInactive = "text-slate-700 hover:bg-slate-100";
const linkActive = "bg-slate-900 text-white";

export default function AppShell() {
  const user = authStore((s) => s.user);
  const logout = authStore((s) => s.logout);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const role = user?.role;
    if (!role) return [];
    return NAV_ITEMS.filter((i) => i.roles.includes(role));
  }, [user?.role]);

  function doLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Mobile Top Bar */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <button
            onClick={() => setOpen((s) => !s)}
            className="rounded-xl p-2 hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          <div className="text-sm font-extrabold tracking-tight">OTOddy Ops</div>

          <button
            onClick={doLogout}
            className="rounded-xl p-2 hover:bg-slate-100"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Sidebar */}
        <aside
          className={`fixed md:static z-30 top-0 left-0 h-full w-72 bg-white border-r border-slate-200 transform transition ${
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="p-5 flex flex-col h-full">
            {/* Brand */}
            <div>
              <div className="text-lg font-extrabold tracking-tight text-slate-900">
                OTOddy
              </div>
              <div className="text-xs text-slate-500">Operations Dashboard</div>
            </div>

            {/* User Card */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] text-slate-500">Signed in as</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                {user?.name || user?.email || user?.phoneNumber || "User"}
              </div>
              <div className="mt-2 inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white capitalize">
                {user?.role}
              </div>
            </div>

            {/* Navigation */}
            <nav className="mt-6 space-y-1 flex-1">
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <NavLink
                    key={it.key}
                    to={it.to}
                    end={it.to === "/"}
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? linkActive : linkInactive}`
                    }
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} />
                    {it.label}
                  </NavLink>
                );
              })}
            </nav>

            {/* Logout */}
            <button
              onClick={doLogout}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {/* Desktop Header */}
          <div className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center px-5">
            <div className="text-sm text-slate-700">
              OTOddy Ops •{" "}
              <span className="font-semibold capitalize">{user?.role}</span>
            </div>
          </div>

          <div className="pt-14 md:pt-0">
            <Outlet />
          </div>
        </main>

        {/* Mobile Backdrop */}
        {open && (
          <button
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
