import { Navigate, Outlet } from "react-router-dom";
import { authStore, type Role } from "../../store/authStore";

export default function RoleGate({ allow }: { allow: Role[] }) {
  const user = authStore((s) => s.user);
  const token = authStore((s) => s.accessToken);
  const hydrated = authStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Checking access…
      </div>
    );
  }

  // Optional: if you already have Protected wrapper, you can remove token check
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
