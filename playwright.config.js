// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for TiddeliGames regression tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: 'html',
  
  // Shared settings for all projects
  use: {
    // Base URL for tests (adjust if using different port)
    baseURL: 'http://localhost:5500',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Uncomment to test on mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'echo "Please start Live Server on port 5500 before running tests"',
    port: 5500,
    reuseExistingServer: !process.env.CI,
  },
});

