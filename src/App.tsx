// src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { authStore } from "./store/authStore";

import Protected from "./components/ui/Protected";
import RoleGate from "./components/ui/RoleGate";

import LoginPage from "./pages/auth/LoginPage";
import Forbidden from "./pages/Forbidden";

import AppShell from "./layouts/AppShell";
import DashboardHome from "./pages/app/DashboardHome";
import RidesPage from "./pages/app/RidesPage";
import DriversPage from "./pages/app/DriversPage";
import MapPage from "./pages/app/MapPage";
import PaymentsPage from "./pages/app/PaymentsPage";
import SettingsPage from "./pages/app/SettingsPage";
import UsersPage from "./pages/app/users/UsersPage";
import ManageUsersPage from "./pages/app/admin/ManageUsersPage";

import CreateBooking from "./pages/CreateBooking";
import B2BRidesPage from "./pages/b2b/B2BRidesPage";

import InvoicesPage from "./pages/invoices/InvoicesPage";
import InvoiceView from "./pages/invoices/InvoiceView";

export default function App() {
  const hydrate = authStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<Forbidden />} />

        {/* Protected */}
        <Route element={<Protected />}>
          <Route path="/" element={<AppShell />}>
            <Route index element={<DashboardHome />} />

            {/* General (logged-in) */}
            <Route path="rides" element={<RidesPage />} />
            <Route path="rides/create" element={<CreateBooking />} />
            <Route path="payments" element={<PaymentsPage />} />

            {/* B2B (put behind auth; restrict role if you want) */}
            <Route element={<RoleGate allow={["admin", "opsteam", "b2bclient"]} />}>
              <Route path="b2b/rides" element={<B2BRidesPage />} />
            </Route>

            {/* Invoices (ops/admin only recommended) */}
            <Route element={<RoleGate allow={["admin", "opsteam","b2bclient"]} />}>
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/:invoiceId" element={<InvoiceView />} />
            </Route>

            {/* Role-based: admin + opsteam */}
            <Route element={<RoleGate allow={["admin", "opsteam"]} />}>
              <Route path="drivers" element={<DriversPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Role-based: admin only */}
            <Route element={<RoleGate allow={["admin"]} />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="users/manage" element={<ManageUsersPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
