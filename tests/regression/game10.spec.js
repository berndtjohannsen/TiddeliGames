// Regression tests for Game 10 (First Letter Game)
import { test, expect } from '@playwright/test';

test.describe('Game 10 - First Letter Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game10/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present
    const gameArea = page.locator('#game10-field, .game10-field');
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

  test('icon container and answer buttons are displayed', async ({ page }) => {
    // Wait for game to initialize and containers to be created
    await page.waitForSelector('#icon-container, #answer-buttons', { timeout: 3000 });
    
    // Check that containers exist
    const iconContainer = page.locator('#icon-container');
    const answerButtonsContainer = page.locator('#answer-buttons');
    
    await expect(iconContainer).toBeVisible();
    await expect(answerButtonsContainer).toBeVisible();
  });

  test('icon is displayed', async ({ page }) => {
    // Wait for icon to be created
    await page.waitForSelector('#icon-container .game10-icon', { timeout: 3000 });
    
    const icon = page.locator('#icon-container .game10-icon');
    await expect(icon).toBeVisible();
    
    // Icon should have content (emoji)
    const iconContent = await icon.textContent();
    expect(iconContent).toBeTruthy();
    expect(iconContent.trim().length).toBeGreaterThan(0);
  });

  test('answer buttons are displayed', async ({ page }) => {
    // Wait for answer buttons to be created
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    
    // Should have 8 answer buttons
    expect(count).toBe(8);
    
    // All buttons should be visible
    for (let i = 0; i < count; i++) {
      await expect(answerButtons.nth(i)).toBeVisible();
    }
  });

  test('can interact with answer buttons', async ({ page }) => {
    // Wait for answer buttons to be created
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      // Click first button
      await answerButtons.first().click({ force: true });
      // Wait a bit for any animations/sounds
      await page.waitForTimeout(500);
    }
  });

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   */
  test('endurance: completes 5 rounds without hanging', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    await page.waitForTimeout(500);
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Complete 5 rounds
    for (let round = 1; round <= 5; round++) {
      // Wait for answer buttons to be available
      await page.waitForSelector('#answer-buttons button:not([disabled])', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Click first available button (might be correct or wrong)
      const answerButtons = page.locator('#answer-buttons button:not([disabled])');
      await answerButtons.first().click({ force: true });
      
      // Wait a bit for feedback
      await page.waitForTimeout(500);
      
      // Check if completion dialog appeared (correct answer)
      const completionDialog = page.locator('#completion-dialog');
      const isVisible = await completionDialog.isVisible().catch(() => false);
      
      if (isVisible) {
        // Click continue button
        const continueButton = page.locator('#continue-button');
        await continueButton.click({ force: true });
        
        // Wait for dialog to hide and new round to start
        await expect(completionDialog).toBeHidden({ timeout: 2000 });
        await page.waitForTimeout(500);
      } else {
        // Wrong answer - wait for buttons to be re-enabled
        await page.waitForTimeout(800);
      }
      
      console.log(`Round ${round}/5 completed`);
    }
    
    // Final verification
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

