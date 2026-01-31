import { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../../../lib/api";

type Role = "admin" | "opsteam" | "b2bclient";

type AnyUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  role?: Role | string;
  createdAt?: string;
};

const pickId = (u: AnyUser) => String(u._id || u.id || "");

function normalizeUsers(payload: any): AnyUser[] {
  // supports: {users:[]}, {data:[]}, [] etc
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/**
 * ✅ Set your backend endpoints here (NO backend change).
 * Change these two strings once and everything works.
 */
const ENDPOINTS = {
  list: "/user/auth/admin/users",          // <-- adjust if your backend uses a different path
  del: (id: string) => `/user/auth/admin/users/${id}`, // <-- adjust
};

export default function ManageUsersPage() {
  const [rows, setRows] = useState<AnyUser[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get(ENDPOINTS.list);
      setRows(normalizeUsers(res.data));
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(u: AnyUser) {
    const id = pickId(u);
    if (!id) {
      setErr("User id not found in response. Backend payload mismatch.");
      return;
    }
    const ok = confirm(`Delete user?\n\n${u?.name || ""}\n${u?.email || ""}`);
    if (!ok) return;

    setErr("");
    try {
      await api.delete(ENDPOINTS.del(id));
      setRows((p) => p.filter((x) => pickId(x) !== id));
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Delete failed"));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((u) => {
      const matchesRole = role === "all" ? true : String(u.role || "").toLowerCase() === role;
      const hay =
        `${u.name || ""} ${u.email || ""} ${u.phoneNumber || ""} ${u.role || ""}`.toLowerCase();
      const matchesQ = !term ? true : hay.includes(term);
      return matchesRole && matchesQ;
    });
  }, [rows, q, role]);

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              Manage Users
            </div>
            <div className="mt-1 text-sm text-slate-600">
              View all users created by admin and delete if needed.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / email / phone…"
              className="h-11 w-full sm:w-[420px] rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
            />

            <div className="flex gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                <option value="all">All roles</option>
                <option value="opsteam">Ops Team</option>
                <option value="b2bclient">B2B Client</option>
                <option value="admin">Admin</option>
              </select>

              <div className="text-sm text-slate-600 flex items-center px-3">
                {loading ? "Loading…" : `${filtered.length} users`}
              </div>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
              <div className="mt-2 text-xs text-red-700/80">
                Check endpoints: <span className="font-semibold">{ENDPOINTS.list}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b border-slate-200">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 pr-0 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={pickId(u) || `${u.email}-${u.phoneNumber}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{u.name || "-"}</td>
                    <td className="py-3 pr-4 text-slate-700">{u.email || "-"}</td>
                    <td className="py-3 pr-4 text-slate-700">{u.phoneNumber || "-"}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {String(u.role || "-")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 pr-0 text-right">
                      <button
                        onClick={() => onDelete(u)}
                        className="h-9 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            If API path differs, update only <span className="font-semibold">ENDPOINTS</span> in this file.
          </div>
        </div>
      </div>
    </div>
  );
}
