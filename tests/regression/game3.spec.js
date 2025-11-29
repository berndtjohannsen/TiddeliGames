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

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   */
  test('endurance: completes 10 rounds without hanging', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    await page.waitForTimeout(1000); // Wait for game to initialize
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Helper function to count fruits and click correct number
    const completeRound = async () => {
      // Wait for fruits to be visible
      await page.waitForSelector('#fruit-field [class*="fruit"]', { timeout: 5000 });
      
      // Count fruits
      const fruits = page.locator('#fruit-field [class*="fruit"]');
      const fruitCount = await fruits.count();
      
      // Click the correct number button
      const numberButtons = page.locator('#number-buttons button');
      const count = await numberButtons.count();
      
      // Find button with matching number
      for (let i = 0; i < count; i++) {
        const buttonText = await numberButtons.nth(i).textContent();
        if (buttonText && parseInt(buttonText.trim(), 10) === fruitCount) {
          await numberButtons.nth(i).click({ force: true });
          break;
        }
      }
      
      // Wait for completion dialog
      const completionDialog = page.locator('#completion-dialog');
      await expect(completionDialog).toBeVisible({ timeout: 3000 });
      await page.waitForTimeout(300);
      
      // Click continue button
      const continueButton = page.locator('#continue-button');
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      await page.waitForTimeout(500);
    };
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      await completeRound();
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const fruits = page.locator('#fruit-field [class*="fruit"]');
    const count = await fruits.count();
    expect(count).toBeGreaterThan(0);
  });
});

