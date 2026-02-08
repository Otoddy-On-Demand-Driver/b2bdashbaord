import {
  LayoutDashboard,
  CarTaxiFront,
  Users,
  MapPin,
  Receipt,
  Settings,
  UserPlus,
  ClipboardPlus,
  BarChart3,   // ✅ Analytics / Interview page
  FileText,    // ✅ Invoices
} from "lucide-react";

import type { Role } from "../store/authStore";

export type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: any;
  roles: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  // ================= DASHBOARD =================
  {
    key: "home",
    label: "Overview",
    to: "/",
    icon: LayoutDashboard,
    roles: ["admin", "opsteam", "b2bclient"],
  },

  // ================= RIDES =================
  {
    key: "rides",
    label: "Rides",
    to: "/rides",
    icon: CarTaxiFront,
    roles: ["admin", "opsteam"],
  },

  {
    key: "createRide",
    label: "Create Booking",
    to: "/rides/create",
    icon: ClipboardPlus,
    roles: ["b2bclient", "admin", "opsteam"],
  },

  {
    key: "b2bRides",
    label: "My Rides",
    to: "/b2b/rides",
    icon: CarTaxiFront,
    roles: ["b2bclient", "admin", "opsteam"],
  },

  // ================= DRIVERS =================
  {
    key: "drivers",
    label: "Drivers",
    to: "/drivers",
    icon: Users,
    roles: ["admin", "opsteam"],
  },

  // ================= MAP =================
  {
    key: "map",
    label: "Live Map",
    to: "/map",
    icon: MapPin,
    roles: ["admin", "opsteam"],
  },

  // ================= PAYMENTS =================
  {
    key: "payments",
    label: "Payments",
    to: "/payments",
    icon: Receipt,
    roles: ["admin", "opsteam", "b2bclient"],
  },

  // ================= INVOICES =================
  {
    key: "invoices",
    label: "Invoices",
    to: "/invoices",
    icon: FileText,
    roles: ["admin", "opsteam", "b2bclient"],
  },

  // ================= ANALYTICS / INTERVIEW PAGE =================
  {
    key: "analytics",
    label: "Analytics & Reports",
    to: "/analytics",   // ← You will create this page
    icon: BarChart3,
    roles: ["admin", "opsteam", "b2bclient"],
  },

  // ================= USERS =================
  {
    key: "manageUsers",
    label: "Manage Users",
    to: "/users/manage",
    icon: Users,
    roles: ["admin"],
  },

  {
    key: "createUser",
    label: "Create Users",
    to: "/users",
    icon: UserPlus,
    roles: ["admin"],
  },

  // ================= SETTINGS =================
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    roles: ["admin", "opsteam"],
  },
];
