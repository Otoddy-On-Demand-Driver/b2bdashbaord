import {
  LayoutDashboard,
  CarTaxiFront,
  Users,
  MapPin,
  Receipt,
  Settings,
  UserPlus,
  ClipboardPlus, // ✅ add this
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
  { key: "home", label: "Overview", to: "/", icon: LayoutDashboard, roles: ["admin","opsteam","b2bclient"] },
  { key: "rides", label: "Rides", to: "/rides", icon: CarTaxiFront, roles: ["admin","opsteam","b2bclient"] },

  // ✅ NEW: Create Booking
  { key: "createRide", label: "Create Booking", to: "/rides/create", icon: ClipboardPlus, roles: ["b2bclient","admin","opsteam"] },

  { key: "drivers", label: "Drivers", to: "/drivers", icon: Users, roles: ["admin","opsteam"] },
  { key: "map", label: "Live Map", to: "/map", icon: MapPin, roles: ["admin","opsteam"] },
  { key: "payments", label: "Payments", to: "/payments", icon: Receipt, roles: ["admin","opsteam","b2bclient"] },

  { key: "manageUsers", label: "Manage Users", to: "/users/manage", icon: Users, roles: ["admin"] },
  { key: "createUser", label: "Create Users", to: "/users", icon: UserPlus, roles: ["admin"] },
  {
    key: "b2bRides",
    label: "My Rides",
    to: "/b2b/rides",
    icon: CarTaxiFront,
  roles: ["b2bclient", "admin", "opsteam"],
  },
  { key: "settings", label: "Settings", to: "/settings", icon: Settings, roles: ["admin","opsteam"] },
];
