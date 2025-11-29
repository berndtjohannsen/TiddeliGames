# Regression Tests

This directory contains Playwright regression tests for TiddeliGames.

## Setup

1. Install dependencies (already done):
   ```bash
   npm install
   ```

2. Install Playwright browsers (already done):
   ```bash
   npx playwright install
   ```

## Running Tests

### Prerequisites
**Important**: Start Live Server on port 5500 before running tests!

1. Start Live Server (or any local server on port 5500)
2. Run tests:
   ```bash
   npm test
   ```

### Test Commands

- `npm test` - Run all tests in headless mode
- `npm run test:ui` - Run tests with Playwright UI (interactive)
- `npm run test:headed` - Run tests with visible browser
- `npm run test:debug` - Run tests in debug mode
- `npm run test:report` - View test report after running tests

## Test Structure

- `regression/` - Main regression tests
  - `main-page.spec.js` - Tests for the main game selection page
  - `game1.spec.js` - Tests for Game 1 (Numbers)
  - `game2.spec.js` - Tests for Game 2 (Animal Sounds)
  - `game3.spec.js` - Tests for Game 3 (Count Fruits)
  - `game7.spec.js` - Tests for Game 7 (Subtraction)
  - `game8.spec.js` - Tests for Game 8 (Uppercase/Lowercase Matching)
  - `game9.spec.js` - Tests for Game 9 (Addition with Numbers)
  - `all-games-navigation.spec.js` - Tests navigation to all games

- `pwa/` - PWA-specific tests
  - `service-worker.spec.js` - Service worker and PWA features

## Configuration

Tests are configured in `playwright.config.js`. The base URL is set to `http://localhost:5500` (Live Server default port).

To change the port, update `baseURL` in `playwright.config.js`.

## Adding New Tests

1. Create a new `.spec.js` file in the appropriate directory
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Write tests using Playwright's API
4. Run tests to verify they work

## Example Test

```javascript
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#my-element')).toBeVisible();
});
```

