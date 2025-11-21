// Regression tests for Game 3 (Count Fruits)
import { test, expect } from '@playwright/test';

test.describe('Game 3 - Count Fruits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game3/index.html');
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    // Actual element is #fruit-field
    const gameArea = page.locator('#fruit-field, .fruit-field');
    await expect(gameArea).toBeVisible();
  });

  test('fruit display is visible', async ({ page }) => {
    // Wait for fruits to be created
    await page.waitForSelector('#fruit-field [class*="fruit"]', { timeout: 3000 });
    
    const fruits = page.locator('#fruit-field [class*="fruit"]');
    const count = await fruits.count();
    expect(count).toBeGreaterThan(0);
  });

  test('number buttons are visible', async ({ page }) => {
    // Wait for number buttons to be created
    await page.waitForSelector('#number-buttons button', { timeout: 3000 });
    
    const numberButtons = page.locator('#number-buttons button');
    const count = await numberButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

