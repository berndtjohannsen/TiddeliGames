// Regression tests for Game 2 (Animal Sounds)
import { test, expect } from '@playwright/test';

test.describe('Game 2 - Animal Sounds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/game2/index.html');
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
});

