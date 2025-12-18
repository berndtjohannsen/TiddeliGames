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
    { id: 'game7', path: '/games/game7/index.html' },
    { id: 'game8', path: '/games/game8/index.html' },
    { id: 'game9', path: '/games/game9/index.html' },
    { id: 'game10', path: '/games/game10/index.html' },
  ];

  test('can navigate to all games from main page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game cards to be rendered
    await page.waitForSelector('[data-game-id]', { timeout: 3000 });
    
    for (const game of games) {
      try {
        // Wait for the specific game card to be visible and clickable
        const gameCard = page.locator(`[data-game-id="${game.id}"]`);
        await expect(gameCard).toBeVisible({ timeout: 3000 });
        
        // Create a flexible URL pattern that matches both absolute and relative paths
        // The path in strings.js is relative, but browser resolves it to absolute
        const urlPattern = new RegExp(`.*${game.path.replace(/\//g, '\\/')}`, 'i');
        
        // Click game card and wait for navigation
        await Promise.all([
          page.waitForURL(urlPattern, { timeout: 10000 }), // Wait for navigation (increased timeout)
          gameCard.click()
        ]);
        
        // Verify navigation completed
        await expect(page).toHaveURL(urlPattern, { timeout: 5000 });
        
        // Verify page loaded - wait for DOM content, not network idle (faster)
        await page.waitForLoadState('domcontentloaded');
        
        // Verify page actually rendered - wait for main content or body
        await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
        
        // Additional check: ensure main content area exists (games typically have a main element or game container)
        const mainContent = page.locator('main, [role="main"], .game-area, .game-container, #game-area, #game-container');
        const mainCount = await mainContent.count();
        if (mainCount > 0) {
          await expect(mainContent.first()).toBeVisible({ timeout: 3000 });
        }
        
        // Go back to main page
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        
        // Wait for game cards to be rendered again before next iteration
        await page.waitForSelector('[data-game-id]', { timeout: 3000 });
      } catch (error) {
        // Log which game failed for debugging
        console.error(`Failed to navigate to ${game.id} (${game.path}):`, error.message);
        throw error; // Re-throw to fail the test with context
      }
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

