// Regression tests for Game 6 (Spelling - Click Characters in Order)
import { test, expect } from '@playwright/test';

test.describe('Game 6 - Spelling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game6/index.html');
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const gameArea = page.locator('#game6-field, .game6-field');
    await expect(gameArea).toBeVisible();
  });

  test('back button is visible', async ({ page }) => {
    const backButton = page.locator('#back-button, [aria-label*="Tillbaka"], [aria-label*="Back"]');
    const count = await backButton.count();
    if (count > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('emoji and character containers are displayed', async ({ page }) => {
    await page.waitForSelector('#emoji-container, #characters-container', { timeout: 3000 });
    
    const emojiContainer = page.locator('#emoji-container');
    const charactersContainer = page.locator('#characters-container');
    
    const emojiCount = await emojiContainer.count();
    const charsCount = await charactersContainer.count();
    
    expect(emojiCount).toBeGreaterThan(0);
    expect(charsCount).toBeGreaterThan(0);
  });

  test('character buttons are displayed', async ({ page }) => {
    await page.waitForSelector('#characters-container button', { timeout: 3000 });
    
    const charButtons = page.locator('#characters-container button');
    const count = await charButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can interact with character buttons', async ({ page }) => {
    await page.waitForSelector('#characters-container button', { timeout: 3000 });
    
    const charButtons = page.locator('#characters-container button');
    const count = await charButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      await charButtons.first().click({ force: true });
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
    
    // Helper function to get the word characters from answer slots
    const getWordChars = async () => {
      const answerSlots = page.locator('#answer-container [class*="slot"]');
      const count = await answerSlots.count();
      const chars = [];
      
      for (let i = 0; i < count; i++) {
        const slot = answerSlots.nth(i);
        const text = await slot.textContent();
        if (text && text.trim()) {
          chars.push(text.trim());
        }
      }
      
      return chars;
    };
    
    // Helper function to click characters in order
    const spellWord = async () => {
      const wordChars = await getWordChars();
      if (wordChars.length === 0) return;
      
      const charButtons = page.locator('#characters-container button');
      const buttonCount = await charButtons.count();
      
      // Click each character in order
      for (const char of wordChars) {
        // Find button with matching character
        for (let i = 0; i < buttonCount; i++) {
          const buttonText = await charButtons.nth(i).textContent();
          if (buttonText && buttonText.trim() === char) {
            await charButtons.nth(i).click({ force: true });
            await page.waitForTimeout(200);
            break;
          }
        }
      }
      
      // Wait for completion dialog
      const completionDialog = page.locator('#completion-dialog');
      await expect(completionDialog).toBeVisible({ timeout: 5000 });
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
      // Wait for character buttons to be available
      await page.waitForSelector('#characters-container button:not([disabled])', { 
        timeout: 5000,
        state: 'visible'
      });
      
      await spellWord();
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const charButtons = page.locator('#characters-container button');
    const count = await charButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

