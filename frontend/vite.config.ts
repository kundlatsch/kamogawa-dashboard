import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

/** The app version shown to users comes from package.json, so bumping it there is enough. */
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://backend:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5173,
    // Bind mounts from Windows hosts do not emit file events inside containers.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/media": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
