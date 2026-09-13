import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE_PATH lets this app be served under a path prefix (e.g. "/seahawks/")
// when reverse-proxied from a parent domain via a Vercel multi-zone rewrite,
// without changing anything for local dev (defaults to "/").
// Vite exposes whatever this is set to as `import.meta.env.BASE_URL` at
// runtime, which src/lib/db.js uses to prefix its /api/* fetch calls to match.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
});
