// Regression tests for Game 3 (Count Fruits)
import { test, expect } from '@playwright/test';

test.describe('Game 3 - Count Fruits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game3/index.html');
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const gameArea = page.locator('#game-area, .game3-field');
    await expect(gameArea).toBeVisible();
  });

  test('fruit display is visible', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const fruits = page.locator('.game3-fruit, [class*="fruit"]');
    const count = await fruits.count();
    expect(count).toBeGreaterThan(0);
  });

  test('number buttons are visible', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const numberButtons = page.locator('.game3-number, [class*="number"], button');
    const count = await numberButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

