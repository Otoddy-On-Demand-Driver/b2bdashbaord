import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authStore } from "../store/authStore";
import { NAV_ITEMS } from "../lib/nav";
import { Bell, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useMemo, useState } from "react";

const linkBase =
  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
const linkInactive = "text-slate-300 hover:bg-slate-800 hover:text-white";
const linkActive = "bg-emerald-500 text-white shadow-lg shadow-emerald-950/20";

export default function AppShell() {
  const user = authStore((s) => s.user);
  const logout = authStore((s) => s.logout);
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const role = user?.role;
    if (!role) return [];
    return NAV_ITEMS.filter((i) => i.roles.includes(role));
  }, [user?.role]);

  const currentItem = useMemo(
    () => items.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)),
    [items, location.pathname]
  );

  function doLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        {/* Mobile Top Bar */}
        <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <button
            onClick={() => setOpen((s) => !s)}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="text-sm font-black tracking-tight text-slate-950">OTODDY <span className="font-medium text-slate-400">/ Ops</span></div>

          <button
            onClick={doLogout}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 p-4 text-white transition-transform duration-300 md:static md:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex min-h-full flex-col">
            {/* Brand */}
            <div className="flex items-start justify-between px-2 py-2">
              <div>
                <div className="text-2xl font-black tracking-tight text-emerald-400">OTODDY</div>
                <div className="mt-0.5 text-xs font-medium text-slate-400">Operations control</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
                aria-label="Close navigation"
              >
                <X size={19} />
              </button>
            </div>

            {/* User Card */}
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950">
                  {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Signed in as</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-white">
                {user?.name || user?.email || user?.phoneNumber || "User"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold capitalize text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {user?.role}
              </div>
            </div>

            {/* Navigation */}
            <nav className="mt-7 flex-1 space-y-1 overflow-y-auto pr-1">
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
                    <span className="flex-1">{it.label}</span>
                    <ChevronRight size={15} className={`opacity-0 transition-opacity group-hover:opacity-60 ${location.pathname === it.to ? "opacity-80" : ""}`} />
                  </NavLink>
                );
              })}
            </nav>

            {/* Logout */}
            <button
              onClick={doLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {/* Desktop Header */}
          <div className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white px-6 md:flex lg:px-8">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{currentItem?.label || "Overview"}</span>
              <ChevronRight size={15} />
              <span>Operations</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
                <Bell size={18} />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </button>
              <span className="text-xs font-semibold capitalize text-slate-500">{user?.role}</span>
            </div>
          </div>

          <div className="min-h-screen pt-16 md:pt-0">
            <Outlet />
          </div>
        </main>

        {/* Mobile Backdrop */}
        {open && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
