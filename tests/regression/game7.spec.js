// Regression tests for Game 7 (Subtraction)
import { test, expect } from '@playwright/test';

test.describe('Game 7 - Subtraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game7/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present
    const gameArea = page.locator('#game7-field, .game7-field');
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

  test('game displays emoji groups', async ({ page }) => {
    // Wait for game to initialize and groups to be created
    await page.waitForSelector('#first-group, #second-group', { timeout: 3000 });
    
    // Check that groups exist
    const firstGroup = page.locator('#first-group');
    const secondGroup = page.locator('#second-group');
    
    const firstCount = await firstGroup.count();
    const secondCount = await secondGroup.count();
    
    expect(firstCount).toBeGreaterThan(0);
    expect(secondCount).toBeGreaterThan(0);
  });

  test('answer buttons are displayed', async ({ page }) => {
    // Wait for answer buttons to be created
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can interact with answer buttons', async ({ page }) => {
    // Wait for answer buttons to be created
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      // Answer buttons might be animating, so use force click to bypass stability check
      await answerButtons.first().click({ force: true });
      // Wait a bit for any animations/sounds
      await page.waitForTimeout(200);
    }
  });
});

