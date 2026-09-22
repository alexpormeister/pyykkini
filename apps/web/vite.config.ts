import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: [
      // Keep the web app on one React instance even when another workspace
      // (such as the mobile app) uses a different React major version.
      { find: /^react$/, replacement: path.resolve(__dirname, "../../node_modules/react") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "../../node_modules/react-dom") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@shared", replacement: path.resolve(__dirname, "../shared") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "@tanstack/react-query"],
    force: true,
  },
}));