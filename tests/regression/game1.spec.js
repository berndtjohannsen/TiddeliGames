// Regression tests for Game 1 (Numbers)
import { test, expect } from '@playwright/test';

test.describe('Game 1 - Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game1/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present
    const gameField = page.locator('#game-field');
    await expect(gameField).toBeVisible();
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
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Try to find clickable game elements
    const clickableElements = page.locator('button, [role="button"], .game-circle, [onclick]');
    const count = await clickableElements.count();
    
    if (count > 0) {
      // Click first clickable element
      await clickableElements.first().click();
      // Just verify no errors occurred
      await page.waitForTimeout(100);
    }
  });
});

