// Regression tests for Game 2 (Animal Sounds)
import { test, expect } from '@playwright/test';

// Run tests serially to avoid parallel execution issues with game state
test.describe('Game 2 - Animal Sounds', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game2/index.html', { waitUntil: 'networkidle' });
  });

  test('game page loads', async ({ page }) => {
    await page.waitForTimeout(500);
    
    const animalField = page.locator('#animal-field, .animal-field');
    await expect(animalField).toBeVisible();
  });

  test('animal cards are displayed', async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for game to initialize
    
    const animalCards = page.locator('.animal-card, [data-animal-id]');
    const count = await animalCards.count();
    
    // Should have at least some animal cards (6 animals per game)
    expect(count).toBeGreaterThan(0);
  });

  test('can click on animal card', async ({ page }) => {
    // Wait for animal cards to be created
    await page.waitForSelector('#animal-field .animal-card', { timeout: 3000 });
    
    const animalCard = page.locator('#animal-field .animal-card').first();
    await expect(animalCard).toBeVisible();
    
    // Cards are constantly animating, so use force click to bypass stability check
    await animalCard.click({ force: true });
    await page.waitForTimeout(500); // Wait for sound/animation
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
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      // Wait for animal cards to be available
      await page.waitForSelector('#animal-field .animal-card', { timeout: 5000 });
      await page.waitForTimeout(200);
      
      // Wait for animal cards to be created (should be 6)
      await page.waitForFunction(
        () => {
          const field = document.getElementById('animal-field');
          if (!field) return false;
          const cards = field.querySelectorAll('.animal-card:not(.animal-card--found)');
          return cards.length >= 6; // Should have 6 cards
        },
        { timeout: 5000 }
      );
      await page.waitForTimeout(300);
      
      // Click all animal cards - need to click exactly 6 cards
      let cardsClicked = 0;
      const expectedCards = 6;
      
      while (cardsClicked < expectedCards) {
        // Wait for unfound cards to be available
        const animalCards = page.locator('#animal-field .animal-card:not(.animal-card--found)');
        const count = await animalCards.count();
        
        if (count === 0) {
          // All cards clicked
          break;
        }
        
        const card = animalCards.first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await card.click({ force: true });
        cardsClicked++;
        
        // Wait for the card count to decrease (card is being processed)
        // Use a more flexible approach - wait for count to change
        try {
          await page.waitForFunction(
            (expectedCount) => {
              const cards = document.querySelectorAll('#animal-field .animal-card:not(.animal-card--found)');
              return cards.length < expectedCount;
            },
            expectedCards - cardsClicked + 1, // +1 because we just clicked one
            { timeout: 8000 } // Wait up to 8 seconds for sound to finish
          );
        } catch (error) {
          // If card count didn't change, wait a bit and continue
          // The card might still be processing
          await page.waitForTimeout(2000);
        }
      }
      
      // Wait for completion dialog to appear - game finishes after last sound completes
      // With the 4-second timeout, the game should finish faster now
      const completionDialog = page.locator('#completion-dialog');
      
      // Wait for the dialog to appear - check both hidden attribute and visibility
      await page.waitForFunction(
        () => {
          const dialog = document.getElementById('completion-dialog');
          if (!dialog) return false;
          // Check both hidden attribute and computed visibility
          const isHidden = dialog.hidden;
          const style = window.getComputedStyle(dialog);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          return !isHidden && isVisible;
        },
        { timeout: 20000 } // Increased timeout to account for all sounds (6 * ~2-3s = 12-18s + buffer)
      );
      await expect(completionDialog).toBeVisible({ timeout: 2000 });
      await page.waitForTimeout(300);
      
      // Click continue button
      const continueButton = page.locator('#continue-button');
      await expect(continueButton).toBeVisible({ timeout: 2000 });
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide
      await expect(completionDialog).toBeHidden({ timeout: 2000 });
      
      // Wait for new round to start - wait for new cards to appear
      await page.waitForSelector('#animal-field .animal-card:not(.animal-card--found)', { 
        timeout: 5000,
        state: 'visible'
      });
      await page.waitForTimeout(200);
      
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const animalCards = page.locator('#animal-field .animal-card');
    const count = await animalCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

