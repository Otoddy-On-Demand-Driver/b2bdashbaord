import { create } from "zustand";

export type Role = "admin" | "opsteam" | "opr" | "b2bclient";

export type AuthedUser = {
  id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  role: Role;
  profilePicture?: string;
};

type AuthState = {
  accessToken: string | null;
  user: AuthedUser | null;
  hydrated: boolean;          // ✅ required
  hydrate: () => void;
  setAuth: (token: string, user: AuthedUser) => void;
  logout: () => void;
};

const LS_TOKEN = "otoddy_access_token";
const LS_USER = "otoddy_user";

export const authStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,            // ✅ MUST be initialized

  hydrate: () => {
    const token = localStorage.getItem(LS_TOKEN);
    const rawUser = localStorage.getItem(LS_USER);

    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser) as AuthedUser;
        set({
          accessToken: token,
          user,
          hydrated: true,     // ✅ IMPORTANT
        });
        return;
      } catch {
        // fallthrough
      }
    }

    // cleanup if invalid / missing
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    set({
      accessToken: null,
      user: null,
      hydrated: true,         // ✅ ALWAYS mark hydrated
    });
  },

  setAuth: (token, user) => {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    set({ accessToken: token, user });
  },

  logout: () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    set({ accessToken: null, user: null });
  },
}));
