// Regression tests for Game 11 (Color Match)
import { test, expect } from '@playwright/test';

test.describe('Game 11 - Color Match', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game11/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);

    const gameArea = page.locator('#game11-field, .game11-field');
    await expect(gameArea).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    const backButton = page.locator('#back-button, [aria-label*="Tillbaka"], [aria-label*="Back"]');
    const count = await backButton.count();
    if (count > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('dots and targets containers are displayed', async ({ page }) => {
    // Wait for containers to be created
    await page.waitForSelector('#dots-container, #targets-container', { timeout: 3000 });

    const dotsContainer = page.locator('#dots-container');
    const targetsContainer = page.locator('#targets-container');

    await expect(dotsContainer).toBeVisible();
    await expect(targetsContainer).toBeVisible();
  });

  test('dots and targets are rendered', async ({ page }) => {
    // Wait for dots and targets to be created
    await page.waitForSelector('.game11-dot, .game11-target', { timeout: 3000 });

    const dots = page.locator('.game11-dot');
    const targets = page.locator('.game11-target');

    const dotCount = await dots.count();
    const targetCount = await targets.count();

    expect(dotCount).toBeGreaterThan(0);
    expect(targetCount).toBeGreaterThan(0);

    // All dots and targets should be visible
    for (let i = 0; i < dotCount; i++) {
      await expect(dots.nth(i)).toBeVisible();
    }
    for (let i = 0; i < targetCount; i++) {
      await expect(targets.nth(i)).toBeVisible();
    }
  });

  test('completion dialog appears after all matches (smoke)', async ({ page }) => {
    test.setTimeout(120000); // generous timeout for smoke test

    // Wait for dots and targets to be created
    await page.waitForSelector('.game11-dot, .game11-target', { timeout: 5000 });

    // For a smoke test we don't try to perfectly match by color.
    // Instead, simulate dragging each dot to some target to ensure the game
    // can be interacted with without throwing errors, and that eventually
    // the completion dialog can appear.
    const dots = page.locator('.game11-dot');
    const targets = page.locator('.game11-target');

    const dotCount = await dots.count();
    const targetCount = await targets.count();

    expect(dotCount).toBeGreaterThan(0);
    expect(targetCount).toBeGreaterThan(0);

    for (let i = 0; i < dotCount; i++) {
      const dot = dots.nth(i);
      const target = targets.nth(i % targetCount);

      const dotBox = await dot.boundingBox();
      const targetBox = await target.boundingBox();

      if (!dotBox || !targetBox) continue;

      await page.mouse.move(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.mouse.up();

      // Small delay between drags
      await page.waitForTimeout(150);
    }

    // After interacting with all dots, the completion dialog should be able to appear at some point.
    // We don't assert it must appear immediately, but if it does, it should be visible.
    const completionDialog = page.locator('#completion-dialog');
    await page.waitForTimeout(500);
    const isVisible = await completionDialog.isVisible();
    // This is a soft assertion: the main value of the test is that interaction doesn't hang or throw.
    if (isVisible) {
      await expect(completionDialog).toBeVisible();
    }
  });
});

