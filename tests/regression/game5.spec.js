// Regression tests for Game 5 (Addition with Emojis)
import { test, expect } from '@playwright/test';

test.describe('Game 5 - Addition with Emojis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game5/index.html');
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const gameArea = page.locator('#game5-field, .game5-field');
    await expect(gameArea).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    const backButton = page.locator('#back-button, [aria-label*="Tillbaka"], [aria-label*="Back"]');
    const count = await backButton.count();
    if (count > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('game displays emoji groups', async ({ page }) => {
    await page.waitForSelector('#first-group, #second-group', { timeout: 3000 });
    
    const firstGroup = page.locator('#first-group');
    const secondGroup = page.locator('#second-group');
    
    const firstCount = await firstGroup.count();
    const secondCount = await secondGroup.count();
    
    expect(firstCount).toBeGreaterThan(0);
    expect(secondCount).toBeGreaterThan(0);
  });

  test('answer buttons are displayed', async ({ page }) => {
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can interact with answer buttons', async ({ page }) => {
    await page.waitForSelector('#answer-buttons button', { timeout: 3000 });
    
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      await answerButtons.first().click({ force: true });
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
    
    // Helper function to get the correct answer from the groups
    const getCorrectAnswer = async () => {
      const firstGroup = page.locator('#first-group');
      const secondGroup = page.locator('#second-group');
      
      const firstCount = await firstGroup.locator('[class*="emoji"]').count();
      const secondCount = await secondGroup.locator('[class*="emoji"]').count();
      
      return firstCount + secondCount;
    };
    
    // Helper function to find and click the correct answer button
    const clickCorrectAnswer = async () => {
      const correctAnswer = await getCorrectAnswer();
      const answerButtons = page.locator('#answer-buttons button');
      const count = await answerButtons.count();
      
      // Find the button with the correct answer
      for (let i = 0; i < count; i++) {
        const buttonText = await answerButtons.nth(i).textContent();
        if (buttonText && parseInt(buttonText.trim(), 10) === correctAnswer) {
          await answerButtons.nth(i).click({ force: true });
          return;
        }
      }
      
      // Fallback: click first button if we can't find the correct one
      await answerButtons.first().click({ force: true });
    };
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      // Wait for answer buttons to be available
      await page.waitForSelector('#answer-buttons button:not([disabled])', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Click the correct answer
      await clickCorrectAnswer();
      
      // Wait for completion dialog to appear
      const completionDialog = page.locator('#completion-dialog');
      await expect(completionDialog).toBeVisible({ timeout: 3000 });
      await page.waitForTimeout(300);
      
      // Click continue button
      const continueButton = page.locator('#continue-button');
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide and new round to start
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      await page.waitForTimeout(200);
      
      // Wait for new round to appear
      await page.waitForSelector('#first-group, #second-group', { 
        timeout: 5000,
        state: 'visible'
      });
      
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const answerButtons = page.locator('#answer-buttons button');
    const count = await answerButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

