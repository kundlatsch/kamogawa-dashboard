import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://backend:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Bind mounts from Windows hosts do not emit file events inside containers.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
