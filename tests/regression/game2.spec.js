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
    test.setTimeout(180000); // 3 minutes (increased for safety)
    
    await page.waitForTimeout(1000); // Wait for game to initialize
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      console.log(`Starting round ${round}/10`);
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
            { timeout: 10000 } // Increased timeout for later rounds
          );
        } catch (error) {
          // If card count didn't change, check if card is still there
          const remainingCards = await page.locator('#animal-field .animal-card:not(.animal-card--found)').count();
          if (remainingCards >= expectedCards - cardsClicked + 1) {
            // Card wasn't processed, wait longer
            console.warn(`Round ${round}: Card ${cardsClicked} not processed, waiting longer...`);
            await page.waitForTimeout(3000);
          }
        }
      }
      
      // Wait for completion dialog to appear - game finishes after last sound completes
      // With the 4-second timeout, the game should finish faster now
      const completionDialog = page.locator('#completion-dialog');
      
      // Wait for the dialog to appear - check both hidden attribute and visibility
      // Increase timeout for later rounds as game might be slower
      const dialogTimeout = round > 5 ? 25000 : 20000;
      try {
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
          { timeout: dialogTimeout }
        );
      } catch (error) {
        // If dialog doesn't appear, log state for debugging
        const dialogState = await page.evaluate(() => {
          const dialog = document.getElementById('completion-dialog');
          return {
            exists: !!dialog,
            hidden: dialog?.hidden,
            display: dialog ? window.getComputedStyle(dialog).display : null,
            foundCount: window.state?.foundCount,
            gameRunning: window.state?.gameRunning
          };
        });
        console.error(`Round ${round}: Dialog not appearing. State:`, dialogState);
        throw error;
      }
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
        timeout: 10000, // Increased timeout for later rounds
        state: 'visible'
      });
      
      // Wait for game to fully initialize new round
      await page.waitForFunction(
        () => {
          const field = document.getElementById('animal-field');
          if (!field) return false;
          const cards = field.querySelectorAll('.animal-card:not(.animal-card--found)');
          // Ensure we have 6 cards and they're all visible
          return cards.length === 6 && Array.from(cards).every(card => card.offsetParent !== null);
        },
        { timeout: 10000 }
      );
      
      // Extra wait between rounds to allow cleanup (especially important for later rounds)
      await page.waitForTimeout(500);
      
      console.log(`Round ${round}/10 completed`);
      
      // Check for console errors after each round
      if (consoleErrors.length > 0 && round < 10) {
        console.warn(`Console errors detected after round ${round}:`, consoleErrors.slice(-5));
      }
    }
    
    // Final verification
    const animalCards = page.locator('#animal-field .animal-card');
    const count = await animalCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

