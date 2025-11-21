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
    
    // Check that all 6 games are present
    const gameCards = page.locator('[data-game-id]');
    await expect(gameCards).toHaveCount(6);
    
    // Verify specific games exist
    await expect(page.locator('[data-game-id="game1"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game2"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game3"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game4"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game5"]')).toBeVisible();
    await expect(page.locator('[data-game-id="game6"]')).toBeVisible();
  });

  test('game cards display game numbers', async ({ page }) => {
    const game1 = page.locator('[data-game-id="game1"]');
    await expect(game1.locator('text=1')).toBeVisible();
    
    const game6 = page.locator('[data-game-id="game6"]');
    await expect(game6.locator('text=6')).toBeVisible();
  });

  test('help button is visible and clickable', async ({ page }) => {
    const helpBtn = page.locator('#help-btn');
    await expect(helpBtn).toBeVisible();
    await expect(helpBtn).toContainText('?');
    
    // Click help button
    await helpBtn.click();
    
    // Verify help dialog appears
    const helpDialog = page.locator('#help-dialog');
    await expect(helpDialog).toBeVisible();
    await expect(helpDialog.locator('h2')).toContainText('Hjälp');
  });

  test('help dialog can be closed', async ({ page }) => {
    // Open help dialog
    await page.locator('#help-btn').click();
    await expect(page.locator('#help-dialog')).toBeVisible();
    
    // Close via close button
    await page.locator('#help-close-btn').click();
    await expect(page.locator('#help-dialog')).toBeHidden();
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

