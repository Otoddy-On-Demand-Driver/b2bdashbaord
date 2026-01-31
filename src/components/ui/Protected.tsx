// src/components/ui/Protected.tsx
import { Navigate, Outlet } from "react-router-dom";
import { authStore } from "../../store/authStore";

export default function Protected() {
  const token = authStore((s) => s.accessToken);
  const user = authStore((s) => s.user);
  const hydrated = authStore((s) => s.hydrated);

  if (!hydrated) {
    return <div className="p-6 text-sm">Restoring session…</div>;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
