import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 35_000,
  workers: 1,
  webServer: {
    command: 'node tests/fixtures/server.mjs',
    url: 'http://127.0.0.1:4187/basic',
    reuseExistingServer: false,
  },
});
