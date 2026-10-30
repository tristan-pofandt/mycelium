import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = process.env.API_URL || "http://127.0.0.1:8100"; // the Flask server in ../server

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", include: ["src/**/*.test.{js,jsx}"], setupFiles: ["src/test-setup.js"] },
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", proxy: { "/api": API, "/healthz": API } },
});
