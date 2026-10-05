import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright dev server sets its own build directory so it gets its own dev lock and runs beside `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
