// Regression tests for Game 4 (Word Recognition - simplified)
import { test, expect } from '@playwright/test';

// Run tests serially to avoid parallel execution issues with game state
test.describe('Game 4 - Word Recognition', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game4/index.html');
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const gameArea = page.locator('#game4-field, .game4-field');
    await expect(gameArea).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    const backButton = page.locator('#back-button, [aria-label*="Tillbaka"], [aria-label*="Back"]');
    const count = await backButton.count();
    if (count > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('emoji and word containers are displayed', async ({ page }) => {
    await page.waitForSelector('#images-container, #words-container', { timeout: 3000 });
    
    const emojiContainer = page.locator('#images-container');
    const wordsContainer = page.locator('#words-container');
    
    await expect(emojiContainer).toBeVisible();
    await expect(wordsContainer).toBeVisible();
    
    // Check that emoji is displayed (single emoji, not buttons)
    const emoji = page.locator('#images-container .game4-emoji');
    await expect(emoji).toBeVisible({ timeout: 3000 });
    
    // Check that 4 word buttons are displayed
    const wordButtons = page.locator('#words-container button.game4-word');
    const wordCount = await wordButtons.count();
    expect(wordCount).toBe(4);
  });

  test('can interact with word buttons', async ({ page }) => {
    await page.waitForSelector('#words-container button.game4-word', { timeout: 3000 });
    
    const wordButtons = page.locator('#words-container button.game4-word');
    const wordCount = await wordButtons.count();
    
    expect(wordCount).toBe(4);
    
    // Click first word button
    if (wordCount > 0) {
      await wordButtons.first().click({ force: true });
      await page.waitForTimeout(500); // Wait for feedback
    }
  });

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   */
  test('endurance: completes 10 rounds without hanging', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    await page.waitForTimeout(1000);
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Helper function to complete one round by selecting correct answer
    const completeRound = async () => {
      // Wait for emoji and word buttons to be available
      await page.waitForSelector('#images-container .game4-emoji, #words-container button.game4-word', { timeout: 5000 });
      
      // Get the emoji text to find the correct word
      const emojiElement = page.locator('#images-container .game4-emoji');
      await expect(emojiElement).toBeVisible({ timeout: 3000 });
      
      // Get all word buttons
      const wordButtons = page.locator('#words-container button.game4-word');
      const wordCount = await wordButtons.count();
      expect(wordCount).toBe(4);
      
      // Find the correct answer button (has data-correct="true")
      const correctButton = page.locator('#words-container button[data-correct="true"]');
      await expect(correctButton).toBeVisible({ timeout: 3000 });
      
      // Click the correct answer
      await correctButton.click({ force: true });
      await page.waitForTimeout(500); // Wait for feedback animation
      
      // Wait for completion dialog
      const completionDialog = page.locator('#completion-dialog');
      await page.waitForFunction(
        () => {
          const dialog = document.getElementById('completion-dialog');
          return dialog && !dialog.hidden;
        },
        { timeout: 10000 }
      );
      await expect(completionDialog).toBeVisible({ timeout: 2000 });
      await page.waitForTimeout(300);
      
      // Click continue button
      const continueButton = page.locator('#continue-button');
      await expect(continueButton).toBeVisible({ timeout: 2000 });
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide and new round to start
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      await page.waitForTimeout(500);
    };
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      await completeRound();
      console.log(`Round ${round}/10 completed`);
      
      // Check for console errors after each round
      if (consoleErrors.length > 0 && round < 10) {
        console.warn(`Console errors detected after round ${round}:`, consoleErrors.slice(-5));
      }
    }
    
    // Final verification - check that game is still functional
    const emoji = page.locator('#images-container .game4-emoji');
    await expect(emoji).toBeVisible({ timeout: 3000 });
    
    const wordButtons = page.locator('#words-container button.game4-word');
    const count = await wordButtons.count();
    expect(count).toBe(4);
  });
});
