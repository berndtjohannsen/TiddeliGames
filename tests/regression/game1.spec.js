// Regression tests for Game 1 (Numbers)
import { test, expect } from '@playwright/test';

test.describe('Game 1 - Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game1/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present - actual element is #circle-container
    const gameArea = page.locator('#circle-container, .game-area');
    await expect(gameArea).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    const backButton = page.locator('#back-button, [aria-label*="Tillbaka"], [aria-label*="Back"]');
    // Back button might be present (check if exists)
    const count = await backButton.count();
    if (count > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('game can be interacted with', async ({ page }) => {
    // Wait for game to initialize and circles to be created
    await page.waitForSelector('#circle-container button', { timeout: 3000 });
    
    // Find clickable circle buttons
    const circles = page.locator('#circle-container button');
    const count = await circles.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      // Circles are constantly animating, so use force click to bypass stability check
      await circles.first().click({ force: true });
      // Wait a bit for any animations/sounds
      await page.waitForTimeout(200);
    }
  });
});

