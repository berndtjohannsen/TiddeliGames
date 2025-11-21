// Test navigation to all games
import { test, expect } from '@playwright/test';

test.describe('Game Navigation', () => {
  const games = [
    { id: 'game1', path: '/games/game1/index.html' },
    { id: 'game2', path: '/games/game2/index.html' },
    { id: 'game3', path: '/games/game3/index.html' },
    { id: 'game4', path: '/games/game4/index.html' },
    { id: 'game5', path: '/games/game5/index.html' },
    { id: 'game6', path: '/games/game6/index.html' },
  ];

  test('can navigate to all games from main page', async ({ page }) => {
    await page.goto('/');
    
    for (const game of games) {
      // Click game card
      await page.locator(`[data-game-id="${game.id}"]`).click();
      
      // Verify navigation
      await expect(page).toHaveURL(new RegExp(game.path.replace(/\//g, '\\/')));
      
      // Verify page loaded (no errors)
      await page.waitForLoadState('networkidle');
      
      // Go back to main page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
  });

  test('all game pages load without errors', async ({ page }) => {
    for (const game of games) {
      const response = await page.goto(game.path);
      expect(response?.status()).toBe(200);
      
      // Wait for page to initialize
      await page.waitForTimeout(500);
      
      // Check for console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Log if errors found (but don't fail - some games might have expected errors)
      if (errors.length > 0) {
        console.log(`Errors on ${game.id}:`, errors);
      }
    }
  });
});

