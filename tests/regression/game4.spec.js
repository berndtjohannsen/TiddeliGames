// Regression tests for Game 4 (Word-Image Matching)
import { test, expect } from '@playwright/test';

// Run tests serially to avoid parallel execution issues with game state
test.describe('Game 4 - Word-Image Matching', () => {
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

  test('images and words containers are displayed', async ({ page }) => {
    await page.waitForSelector('#images-container, #words-container', { timeout: 3000 });
    
    const imagesContainer = page.locator('#images-container');
    const wordsContainer = page.locator('#words-container');
    
    const imagesCount = await imagesContainer.count();
    const wordsCount = await wordsContainer.count();
    
    expect(imagesCount).toBeGreaterThan(0);
    expect(wordsCount).toBeGreaterThan(0);
  });

  test('can interact with image and word buttons', async ({ page }) => {
    await page.waitForSelector('#images-container button, #words-container button', { timeout: 3000 });
    
    const imageButtons = page.locator('#images-container button');
    const wordButtons = page.locator('#words-container button');
    
    const imageCount = await imageButtons.count();
    const wordCount = await wordButtons.count();
    
    expect(imageCount).toBeGreaterThan(0);
    expect(wordCount).toBeGreaterThan(0);
    
    if (imageCount > 0) {
      await imageButtons.first().click({ force: true });
      await page.waitForTimeout(200);
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
    
    // Helper function to match all pairs in a round
    const matchAllPairs = async () => {
      // Wait for buttons to be available
      await page.waitForSelector('#images-container button:not(.game4-image--matched), #words-container button:not(.game4-word--matched)', { timeout: 5000 });
      
      // Match all 4 pairs
      for (let pair = 0; pair < 4; pair++) {
        // Get all unmatched image buttons
        const imageButtons = page.locator('#images-container button:not(.game4-image--matched)');
        const imageCount = await imageButtons.count();
        
        if (imageCount === 0) {
          break; // All pairs matched
        }
        
        // Click the first unmatched image
        const firstImage = imageButtons.first();
        await expect(firstImage).toBeVisible({ timeout: 3000 });
        const imageWord = await firstImage.getAttribute('data-word');
        await firstImage.click({ force: true });
        await page.waitForTimeout(200);
        
        // Find and click the matching word button
        const matchingWord = page.locator(`#words-container button[data-word="${imageWord}"]:not(.game4-word--matched)`);
        await expect(matchingWord).toBeVisible({ timeout: 3000 });
        await matchingWord.click({ force: true });
        await page.waitForTimeout(500); // Wait for match animation and sound
      }
      
      // Wait for completion dialog - it appears after a 500ms delay
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
      
      // Wait for dialog to hide
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      await page.waitForTimeout(500);
    };
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      await matchAllPairs();
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const imageButtons = page.locator('#images-container button');
    const count = await imageButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

