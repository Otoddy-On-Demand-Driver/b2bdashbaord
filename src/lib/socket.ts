import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_API_BASE_URL, {
  withCredentials: true,

  // ✅ enable polling + websocket (socket will upgrade to websocket when possible)
  transports: ["polling", "websocket"],
  upgrade: true,

  // ✅ polling options (optional but useful)
  rememberUpgrade: true,

  // ✅ retry / reconnect controls
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,

  // ✅ connection timeout
  timeout: 20000,
});
