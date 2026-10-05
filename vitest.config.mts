import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next*/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    // Lets tests force a GC; libsql only releases a database file when its handles are collected.
    execArgv: ["--expose-gc"],
  },
});
