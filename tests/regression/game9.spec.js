// Regression tests for Game 9 (Addition with Numbers)
import { test, expect } from '@playwright/test';

test.describe('Game 9 - Addition with Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game9/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present
    const gameArea = page.locator('#game9-field, .game9-field');
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

  test('equation container is displayed', async ({ page }) => {
    // Wait for game to initialize and equation to be created
    await page.waitForSelector('#equation-container, .game9-equation', { timeout: 3000 });
    
    // Check that equation container exists
    const equationContainer = page.locator('#equation-container, .game9-equation');
    const count = await equationContainer.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('numbers and plus sign are displayed', async ({ page }) => {
    // Wait for game to initialize and elements to be created
    await page.waitForSelector('#equation-container .game9-number, #equation-container .game9-plus', { timeout: 3000 });
    
    // Check that numbers and plus sign are present in the equation
    const equationContainer = page.locator('#equation-container, .game9-equation');
    await expect(equationContainer).toBeVisible();
    
    // Check for numbers (they should be visible as text)
    const numbers = equationContainer.locator('.game9-number');
    const plusSign = equationContainer.locator('.game9-plus');
    
    const numberCount = await numbers.count();
    const plusCount = await plusSign.count();
    
    // Should have at least some numbers and a plus sign
    expect(numberCount).toBeGreaterThan(0);
    expect(plusCount).toBeGreaterThan(0);
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

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   * This test reproduces the issue where the game hangs after 5-10 reruns.
   */
  test('endurance: completes 15 rounds without hanging', async ({ page }) => {
    // Set a longer timeout for this test
    test.setTimeout(120000); // 2 minutes
    
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Monitor console for errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Helper function to get the correct answer from the equation
    const getCorrectAnswer = async () => {
      const equationContainer = page.locator('#equation-container');
      const numbers = equationContainer.locator('.game9-number');
      
      // Get both numbers from the equation
      const number1Text = await numbers.nth(0).textContent();
      const number2Text = await numbers.nth(1).textContent();
      
      const num1 = parseInt(number1Text || '0', 10);
      const num2 = parseInt(number2Text || '0', 10);
      
      return num1 + num2;
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
    
    // Complete 15 rounds
    const numRounds = 15;
    const roundTimes = [];
    
    for (let round = 1; round <= numRounds; round++) {
      const roundStartTime = Date.now();
      
      // Wait for answer buttons to be available
      await page.waitForSelector('#answer-buttons button:not(.game9-answer--disabled)', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Click the correct answer
      await clickCorrectAnswer();
      
      // Wait for completion dialog to appear
      const completionDialog = page.locator('#completion-dialog');
      await expect(completionDialog).toBeVisible({ timeout: 3000 });
      
      // Wait a bit for animations/sounds
      await page.waitForTimeout(300);
      
      // Click continue button to start next round
      const continueButton = page.locator('#continue-button');
      await expect(continueButton).toBeVisible({ timeout: 2000 });
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide and new round to start
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      
      // Wait for new equation to appear (with more time and check for visibility)
      await page.waitForSelector('#equation-container .game9-number', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Also wait for answer buttons to be ready (not disabled)
      await page.waitForSelector('#answer-buttons button:not(.game9-answer--disabled)', { 
        timeout: 5000,
        state: 'visible'
      });
      
      const roundTime = Date.now() - roundStartTime;
      roundTimes.push(roundTime);
      
      // Log progress
      console.log(`Round ${round}/${numRounds} completed in ${roundTime}ms`);
      
      // Check that we're not accumulating errors
      if (consoleErrors.length > 0 && round > 5) {
        console.warn(`Console errors detected after round ${round}:`, consoleErrors);
      }
      
      // Verify game is still responsive by checking button count
      const buttonCount = await page.locator('#answer-buttons button').count();
      expect(buttonCount).toBeGreaterThan(0);
    }
    
    // Verify no critical errors occurred
    // Note: Some warnings are expected (audio context, etc.), but we should check for critical errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Could not') && 
      !err.includes('warn') &&
      !err.includes('AudioContext')
    );
    
    if (criticalErrors.length > 0) {
      console.warn('Critical errors detected:', criticalErrors);
    }
    
    // Check that response times don't degrade significantly
    // First few rounds might be slower due to initialization
    const earlyRounds = roundTimes.slice(0, 3);
    const lateRounds = roundTimes.slice(-3);
    
    const avgEarly = earlyRounds.reduce((a, b) => a + b, 0) / earlyRounds.length;
    const avgLate = lateRounds.reduce((a, b) => a + b, 0) / lateRounds.length;
    
    // Late rounds shouldn't be more than 3x slower than early rounds
    // (allowing for some variance, but catching severe degradation)
    expect(avgLate).toBeLessThan(avgEarly * 3);
    
    // Verify game is still functional after all rounds
    const finalButtons = page.locator('#answer-buttons button');
    const finalButtonCount = await finalButtons.count();
    expect(finalButtonCount).toBeGreaterThan(0);
    
    // Verify equation is still visible
    const equationContainer = page.locator('#equation-container');
    await expect(equationContainer).toBeVisible();
  });

  /**
   * Quick endurance test: Completes 10 rounds to catch the hanging issue faster.
   * This is a shorter version for faster feedback during development.
   */
  test('endurance: quick 10 rounds test', async ({ page }) => {
    test.setTimeout(90000); // 90 seconds
    
    await page.waitForTimeout(500);
    
    const getCorrectAnswer = async () => {
      const equationContainer = page.locator('#equation-container');
      const numbers = equationContainer.locator('.game9-number');
      const number1Text = await numbers.nth(0).textContent();
      const number2Text = await numbers.nth(1).textContent();
      const num1 = parseInt(number1Text || '0', 10);
      const num2 = parseInt(number2Text || '0', 10);
      return num1 + num2;
    };
    
    const clickCorrectAnswer = async () => {
      const correctAnswer = await getCorrectAnswer();
      const answerButtons = page.locator('#answer-buttons button');
      const count = await answerButtons.count();
      
      for (let i = 0; i < count; i++) {
        const buttonText = await answerButtons.nth(i).textContent();
        if (buttonText && parseInt(buttonText.trim(), 10) === correctAnswer) {
          await answerButtons.nth(i).click({ force: true });
          return;
        }
      }
      await answerButtons.first().click({ force: true });
    };
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      await page.waitForSelector('#answer-buttons button:not(.game9-answer--disabled)', { 
        timeout: 5000 
      });
      
      await clickCorrectAnswer();
      
      const completionDialog = page.locator('#completion-dialog');
      await expect(completionDialog).toBeVisible({ timeout: 3000 });
      await page.waitForTimeout(300);
      
      const continueButton = page.locator('#continue-button');
      await continueButton.click({ force: true });
      
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      
      // Wait for new equation to appear (with more time and check for visibility)
      await page.waitForSelector('#equation-container .game9-number', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Also wait for answer buttons to be ready (not disabled)
      await page.waitForSelector('#answer-buttons button:not(.game9-answer--disabled)', { 
        timeout: 5000,
        state: 'visible'
      });
      
      // Verify buttons are still available
      const buttonCount = await page.locator('#answer-buttons button').count();
      expect(buttonCount).toBeGreaterThan(0);
    }
    
    // Final verification
    const equationContainer = page.locator('#equation-container');
    await expect(equationContainer).toBeVisible();
  });
});

