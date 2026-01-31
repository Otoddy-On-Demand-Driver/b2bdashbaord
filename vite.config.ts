import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/ops": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/driver": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/rides": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/user": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/test": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/uploads": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      "/healthz": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
