import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development, API calls to /api are forwarded to the FastAPI backend on port 8000.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
