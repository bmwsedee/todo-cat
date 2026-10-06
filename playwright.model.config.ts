import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// `npm run test:e2e:model`: the chat against the real model (OpenRouter, OPENROUTER_API_KEY
// from .env). It costs tokens and depends on the network, so QA and CI never run it.
export default defineConfig({
  ...base,
  testDir: "./e2e-model",
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 60_000 },
});
