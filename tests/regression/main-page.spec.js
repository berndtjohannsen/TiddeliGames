// Regression tests for the main game selection page
import { test, expect } from '@playwright/test';

test.describe('Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads and displays title', async ({ page }) => {
    await expect(page.locator('#main-title')).toBeVisible();
    await expect(page.locator('#main-title')).toContainText('TiddeliGames');
  });

  test('displays all game cards', async ({ page }) => {
    const gameGrid = page.locator('#game-grid');
    await expect(gameGrid).toBeVisible();
    
    // Check that all 9 games are present
    const gameCards = page.locator('[data-game-id]');
    await expect(gameCards).toHaveCount(9);
    
    // Verify specific games exist
    await expect(page.locator('[data-game-id="game1"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game2"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game3"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game4"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game5"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game6"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game7"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game8"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game9"]')).toBeVisible();
  });

  test('game cards display game numbers', async ({ page }) => {
    // Wait for game cards to be rendered
    await page.waitForSelector('[data-game-id="game1"]', { timeout: 3000 });
    
    const game1 = page.locator('[data-game-id="game1"]');
    // Game number is in a div with absolute positioning
    await expect(game1.locator('text=/^1$/')).toBeVisible();
    
    const game6 = page.locator('[data-game-id="game6"]');
    await expect(game6.locator('text=/^6$/')).toBeVisible();
    
    const game9 = page.locator('[data-game-id="game9"]');
    await expect(game9.locator('text=/^9$/')).toBeVisible();
  });

  test('help button is visible and clickable', async ({ page }) => {
    // Wait for help button to be rendered
    const helpBtn = page.locator('#help-btn');
    await expect(helpBtn).toBeVisible({ timeout: 3000 });
    await expect(helpBtn).toContainText('?');
    
    // Click help button
    await helpBtn.click({ timeout: 5000 });
    
    // Wait for dialog to appear (it might have animation)
    const helpDialog = page.locator('#help-dialog');
    await expect(helpDialog).toBeVisible({ timeout: 2000 });
    
    // Wait a bit for content to render and animation to complete
    await page.waitForTimeout(200);
    
    // Verify dialog content - heading is "Lite Info" (see index.html)
    const heading = helpDialog.locator('h2');
    await expect(heading).toBeVisible({ timeout: 2000 });
    await expect(heading).toContainText('Lite Info', { timeout: 2000 });
  });

  test('help dialog can be closed', async ({ page }) => {
    // Open help dialog
    await page.locator('#help-btn').click();
    await expect(page.locator('#help-dialog')).toBeVisible({ timeout: 2000 });
    
    // Wait a bit for dialog animation
    await page.waitForTimeout(100);
    
    // Close via close button
    await page.locator('#help-close-btn').click();
    await expect(page.locator('#help-dialog')).toBeHidden({ timeout: 2000 });
  });

  test('version number is displayed', async ({ page }) => {
    const versionDisplay = page.locator('#version-display');
    await expect(versionDisplay).toBeVisible();
    await expect(versionDisplay).toContainText('Version');
  });

  test('volume control is visible', async ({ page }) => {
    const volumeSlider = page.locator('#volume-slider');
    await expect(volumeSlider).toBeVisible();
    
    const muteButton = page.locator('#mute-button');
    await expect(muteButton).toBeVisible();
  });

  test('can navigate to game1', async ({ page }) => {
    await page.locator('[data-game-id="game1"]').click();
    await expect(page).toHaveURL(/.*game1/);
  });

  test('can navigate to game2', async ({ page }) => {
    await page.locator('[data-game-id="game2"]').click();
    await expect(page).toHaveURL(/.*game2/);
  });
});

