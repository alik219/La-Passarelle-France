import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the Python backend runs on :8000; Vite forwards /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost", // only this computer can open the dev server
    port: 5173,
    strictPort: true,
    // Don't let other websites read dev-server responses (older Vite allowed any site).
    cors: false,
    fs: {
      strict: true,
      allow: ["."], // only files inside web/
      // Never serve secrets, even if a future bug bypasses the folder limit.
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.env", "**/.env.*"],
    },
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
