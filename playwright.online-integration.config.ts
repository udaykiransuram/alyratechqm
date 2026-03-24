import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npx next dev --hostname 127.0.0.1 --port 3000",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "testsecret",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || baseURL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || baseURL,
        NODE_ENV: process.env.NODE_ENV || "development",
      },
    },
  ],
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
});
