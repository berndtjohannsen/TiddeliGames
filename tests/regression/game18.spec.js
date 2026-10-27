// Regression tests for Game 18 (Hitta kaninen?)
import { test, expect } from '@playwright/test';

test.describe('Game 18 - Hitta kaninen?', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/games/game18/index.html');
    });

    test('game field and furniture items load', async ({ page }) => {
        await page.waitForSelector('#game18-field', { timeout: 5000 });
        await expect(page.locator('#game18-field')).toBeVisible();
        const items = page.locator('.game18-item');
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(3);
        expect(count).toBeLessThanOrEqual(5);
    });

    test('listen control is present', async ({ page }) => {
        await expect(page.locator('#listen-button')).toBeVisible();
    });

    test('back link returns to hub', async ({ page }) => {
        const back = page.locator('a.back-button');
        await expect(back).toBeVisible();
        await back.click();
        await expect(page).toHaveURL(/index\.html/);
    });
});
