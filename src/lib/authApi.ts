import { api } from "./api";
import type { AuthedUser } from "../store/authStore";

export async function loginUser(payload: {
  identifier?: string;
  email?: string;
  phoneNumber?: string;
  password: string;
}) {
  const { data } = await api.post("/user/auth/login", payload);
  return data as {
    ok: boolean;
    accessToken: string;
    expiresIn: string;
    user: AuthedUser;
  };
}

export async function adminLogin(payload: { identifier: string; password: string }) {
  const { data } = await api.post("/user/auth/admin/login", payload);
  return data as {
    ok: boolean;
    accessToken: string;
    expiresIn: string;
    admin: { id: string; role: "admin" };
  };
}
