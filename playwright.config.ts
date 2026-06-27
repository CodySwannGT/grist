import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * Playwright config for the verification (UAT) suite. Builds the game and serves
 * the production preview, then drives it through the in-game `window.__VERIFY__`
 * bridge (enabled via the `?uat=1` query). This is the "an agent actually played
 * it" layer that backs the Lisa verification gate.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run build && bun run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
