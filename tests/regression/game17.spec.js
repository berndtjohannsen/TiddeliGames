// Regression tests for Game 17 (Kör mot ordet)
import { test, expect } from '@playwright/test';

test.describe('Game 17 - Kör mot ordet', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/games/game17/index.html');
    });

    test('game field and targets load', async ({ page }) => {
        await page.waitForSelector('#game17-field', { timeout: 5000 });
        await expect(page.locator('#game17-field')).toBeVisible();
        await expect(page.locator('.game17-target')).toHaveCount(4);
    });

    test('canvas and listen control are present', async ({ page }) => {
        await expect(page.locator('#drive-canvas')).toBeVisible();
        await expect(page.locator('#listen-button')).toBeVisible();
    });

    test('back link returns to hub', async ({ page }) => {
        const back = page.locator('a.back-button');
        await expect(back).toBeVisible();
        await back.click();
        await expect(page).toHaveURL(/index\.html/);
    });
});
