import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const HOST_PORT = 3100;
const PATH_PORT = 3101;

// Some environments ship a Chromium whose build number predates this Playwright
// release. Use it when it is there rather than downloading a second copy.
const PREINSTALLED = '/opt/pw-browsers/chromium';
const launch = existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: [
    {
      command: `next start -p ${HOST_PORT}`,
      env: { TENANT_MODE: 'host', ROOT_DOMAIN: `localhost:${HOST_PORT}` },
      port: HOST_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `next start -p ${PATH_PORT}`,
      env: { TENANT_MODE: 'path' },
      port: PATH_PORT,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'host',
      testMatch: /host\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${HOST_PORT}`,
        launchOptions: launch,
      },
    },
    {
      name: 'path',
      testMatch: /path\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${PATH_PORT}`,
        launchOptions: launch,
      },
    },
  ],
});
