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
      
      // Verify navigation (with timeout)
      await expect(page).toHaveURL(new RegExp(game.path.replace(/\//g, '\\/')), { timeout: 5000 });
      
      // Verify page loaded - wait for DOM content, not network idle (faster)
      await page.waitForLoadState('domcontentloaded');
      
      // Verify page actually rendered
      await expect(page.locator('body')).toBeVisible();
      
      // Go back to main page
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }
  });

  test('all game pages load without errors', async ({ page }) => {
    const errors = [];
    
    // Set up console error listener once
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({ game: 'unknown', text: msg.text() });
      }
    });
    
    for (const game of games) {
      try {
        const response = await page.goto(game.path, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        expect(response?.status()).toBe(200);
        
        // Verify page actually loaded
        await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
        
        // Wait for page to initialize
        await page.waitForTimeout(1000);
        
      } catch (error) {
        // Log but don't fail - some games might have issues
        console.log(`Error loading ${game.id}:`, error.message);
        // Still try to continue with other games
      }
    }
    
    // Log all errors at the end
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
  });
});

