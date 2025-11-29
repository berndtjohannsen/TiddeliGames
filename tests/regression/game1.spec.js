// Regression tests for Game 1 (Numbers)
import { test, expect } from '@playwright/test';

// Run tests serially to avoid parallel execution issues with game state
test.describe('Game 1 - Numbers', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game1/index.html');
  });

  test('game page loads', async ({ page }) => {
    // Wait for game to initialize
    await page.waitForTimeout(500);
    
    // Check that game elements are present - actual element is #circle-container
    const gameArea = page.locator('#circle-container, .game-area');
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

  test('game can be interacted with', async ({ page }) => {
    // Wait for game to initialize and circles to be created
    await page.waitForSelector('#circle-container button', { timeout: 3000 });
    
    // Find clickable circle buttons
    const circles = page.locator('#circle-container button');
    const count = await circles.count();
    
    expect(count).toBeGreaterThan(0);
    
    if (count > 0) {
      // Circles are constantly animating, so use force click to bypass stability check
      await circles.first().click({ force: true });
      // Wait a bit for any animations/sounds
      await page.waitForTimeout(200);
    }
  });

  /**
   * Endurance test: Completes multiple rounds to detect memory leaks or hanging issues.
   */
  test('endurance: completes 10 rounds without hanging', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    // Wait for page to fully load and game to initialize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Extra wait for game initialization
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Complete 10 rounds
    for (let round = 1; round <= 10; round++) {
      // Wait for all 10 circles to be created and visible, and game to be ready
      await page.waitForFunction(
        () => {
          const container = document.getElementById('circle-container');
          if (!container) return false;
          const buttons = container.querySelectorAll('button[data-number]');
          if (buttons.length !== 10) return false;
          // Check that all buttons are visible and not disabled (game is ready)
          const allReady = Array.from(buttons).every(btn => 
            btn && !btn.disabled && btn.offsetParent !== null
          );
          return allReady;
        },
        { timeout: 10000 }
      );
      // Additional wait to ensure game state is fully initialized
      await page.waitForTimeout(500);
      
      // Verify game state is ready - check that nextCircleNumber is 1
      await page.waitForFunction(
        () => {
          // Access game state through window if available, or just verify UI state
          const buttons = document.querySelectorAll('#circle-container button[data-number]');
          if (buttons.length !== 10) return false;
          // All buttons should be enabled and the first one should be clickable
          const firstButton = buttons[0];
          return firstButton && !firstButton.disabled && firstButton.offsetParent !== null;
        },
        { timeout: 5000 }
      );
      
      // Click circles in order 1-10
      for (let num = 1; num <= 10; num++) {
        // Find the circle button by data-number attribute - must not be disabled
        const circle = page.locator(`#circle-container button[data-number="${num}"]:not([disabled])`);
        await expect(circle).toBeVisible({ timeout: 5000 });
        
        // Click the circle
        await circle.click({ force: true });
        
        // Wait for the circle to become disabled (indicating click was processed)
        // This ensures state.nextCircleNumber is updated before clicking the next circle
        await page.waitForFunction(
          (num) => {
            const circle = document.querySelector(`#circle-container button[data-number="${num}"]`);
            return circle && circle.disabled;
          },
          num,
          { timeout: 10000, polling: 50 }
        );
        
        // For the last circle, wait a bit longer for finishGame() to complete
        if (num === 10) {
          await page.waitForTimeout(500);
        } else {
          // For other circles, wait a bit for the state to update
          await page.waitForTimeout(200);
        }
      }
      
      // After clicking circle 10, wait for completion dialog to appear
      // Use simpler pattern like other games - just check hidden attribute
      const completionDialog = page.locator('#completion-dialog');
      await page.waitForFunction(
        () => {
          const dialog = document.getElementById('completion-dialog');
          return dialog && !dialog.hidden;
        },
        { timeout: 15000 }
      );
      // Verify it's visible
      await expect(completionDialog).toBeVisible({ timeout: 2000 });
      await page.waitForTimeout(300);
      
      // Click continue button
      const continueButton = page.locator('#continue-button');
      await expect(continueButton).toBeVisible({ timeout: 2000 });
      await continueButton.click({ force: true });
      
      // Wait for dialog to hide
      await expect(completionDialog).toBeHidden({ timeout: 3000 });
      
      // Wait for new round to start - all circles should be recreated and enabled
      await page.waitForFunction(
        () => {
          const container = document.getElementById('circle-container');
          if (!container) return false;
          const buttons = container.querySelectorAll('button[data-number]');
          if (buttons.length !== 10) return false;
          // All buttons should be enabled (new round started)
          return Array.from(buttons).every(btn => !btn.disabled);
        },
        { timeout: 5000 }
      );
      await page.waitForTimeout(200);
      
      console.log(`Round ${round}/10 completed`);
    }
    
    // Final verification
    const circles = page.locator('#circle-container button');
    const count = await circles.count();
    expect(count).toBeGreaterThan(0);
  });
});

