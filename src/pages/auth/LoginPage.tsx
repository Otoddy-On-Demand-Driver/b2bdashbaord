import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { adminLogin, loginUser } from "../../lib/authApi";
import { apiErrorMessage } from "../../lib/api";
import { authStore } from "../../store/authStore";

export default function LoginPage() {
  const nav = useNavigate();
  const setAuth = authStore((s) => s.setAuth);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return identifier.trim().length > 0 && password.length > 0 && !loading;
  }, [identifier, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!canSubmit) return;

    setLoading(true);
    try {
      // 1) try normal user login (ops/b2b/opr/admin-db if ever)
      try {
        const data = await loginUser({ identifier: identifier.trim(), password });
        setAuth(data.accessToken, data.user);
        nav("/", { replace: true });
        return;
      } catch (ex: any) {
        // If user login fails, fall through to admin env login attempt
        // (so user ko UI me "admin mode" dikhana nahi padega)
      }

      // 2) try env-based admin login silently
      const data = await adminLogin({ identifier: identifier.trim(), password });
      setAuth(data.accessToken, { id: data.admin.id, role: "admin" });
      nav("/", { replace: true });
    } catch (ex: any) {
      setErr(apiErrorMessage(ex, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">OTOddy Dashboard</div>
          <div className="mt-1 text-sm text-slate-600">Sign in to continue.</div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <form onSubmit={onSubmit} className="px-6 py-6">
            <label className="block text-sm font-semibold text-slate-800">
              Email / Phone / Identifier
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="email or phone"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
            />

            <label className="mt-4 block text-sm font-semibold text-slate-800">Password</label>
            <div className="mt-2 relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                placeholder="••••••••"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-4 pr-12 text-sm outline-none focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {err ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <button
              disabled={!canSubmit}
              className="mt-5 h-12 w-full rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
