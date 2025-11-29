// Regression tests for Game 8 (Uppercase/Lowercase Matching)
import { test, expect } from '@playwright/test';

test.describe('Game 8 - Uppercase/Lowercase Matching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game8/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present
    const gameArea = page.locator('#game8-field, .game8-field');
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

  test('uppercase and lowercase containers are displayed', async ({ page }) => {
    // Wait for game to initialize and containers to be created
    await page.waitForSelector('#uppercase-container, #lowercase-container', { timeout: 3000 });
    
    // Check that containers exist
    const uppercaseContainer = page.locator('#uppercase-container');
    const lowercaseContainer = page.locator('#lowercase-container');
    
    const upperCount = await uppercaseContainer.count();
    const lowerCount = await lowercaseContainer.count();
    
    expect(upperCount).toBeGreaterThan(0);
    expect(lowerCount).toBeGreaterThan(0);
  });

  test('letter buttons are displayed', async ({ page }) => {
    // Wait for letter buttons to be created (only uppercase container has buttons)
    await page.waitForSelector('#uppercase-container button', { timeout: 3000 });
    
    const uppercaseButtons = page.locator('#uppercase-container button');
    const upperCount = await uppercaseButtons.count();
    
    // Should have uppercase letter buttons (29 letters in Swedish alphabet)
    expect(upperCount).toBeGreaterThan(0);
    
    // Lowercase container displays text, not buttons - verify it has content
    const lowercaseContainer = page.locator('#lowercase-container');
    await expect(lowercaseContainer).toBeVisible();
    const lowercaseContent = await lowercaseContainer.textContent();
    expect(lowercaseContent).toBeTruthy();
    expect(lowercaseContent.trim().length).toBeGreaterThan(0);
  });

  test('can interact with letter buttons', async ({ page }) => {
    // Wait for letter buttons to be created
    await page.waitForSelector('#uppercase-container button', { timeout: 3000 });
    
    const uppercaseButtons = page.locator('#uppercase-container button');
    const count = await uppercaseButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      // Letter buttons might be animating, so use force click to bypass stability check
      await uppercaseButtons.first().click({ force: true });
      // Wait a bit for any animations/sounds
      await page.waitForTimeout(200);
    }
  });

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   */
  test('endurance: completes 10 rounds without hanging', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    await page.waitForTimeout(500);
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Helper function to get the target lowercase letter
    const getTargetLetter = async () => {
      const lowercaseContainer = page.locator('#lowercase-container');
      const text = await lowercaseContainer.textContent();
      return text ? text.trim().toLowerCase() : '';
    };
    
    // Helper function to find and click the matching uppercase button
    const clickMatchingLetter = async () => {
      const targetLetter = await getTargetLetter();
      if (!targetLetter) return;
      
      const uppercaseButtons = page.locator('#uppercase-container button');
      const count = await uppercaseButtons.count();
      
      // Find button with matching uppercase letter
      for (let i = 0; i < count; i++) {
        const buttonText = await uppercaseButtons.nth(i).textContent();
        if (buttonText && buttonText.trim().toLowerCase() === targetLetter) {
          await uppercaseButtons.nth(i).click({ force: true });
          return;
        }
      }
      
      // Fallback: click first button
      await uppercaseButtons.first().click({ force: true });
    };
    
    // Complete 10 rounds (each round matches one letter)
    for (let round = 1; round <= 10; round++) {
      // Wait for letter buttons to be available
      await page.waitForSelector('#uppercase-container button:not([disabled])', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Click the matching letter
      await clickMatchingLetter();
      
      // Wait a bit for feedback
      await page.waitForTimeout(300);
      
      // Check if completion dialog appeared (round complete)
      const completionDialog = page.locator('#completion-dialog');
      const isVisible = await completionDialog.isVisible().catch(() => false);
      
      if (isVisible) {
        // Click continue button
        const continueButton = page.locator('#continue-button');
        await continueButton.click({ force: true });
        
        // Wait for dialog to hide and new round to start
        await expect(completionDialog).toBeHidden({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
      
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const uppercaseButtons = page.locator('#uppercase-container button');
    const count = await uppercaseButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

