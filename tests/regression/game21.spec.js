// Regression tests for Game 21 (Fåglarna flyger hem)
import { test, expect } from '@playwright/test';

test.describe('Game 21 - Fåglarna flyger hem', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('loads bird, nests and listen in debug mode', async ({ page }) => {
        await page.goto('/games/game21/index.html?colors=red,blue&rounds=2');
        await page.waitForSelector('#game21-field', { timeout: 5000 });
        await page.locator('#game21-field').click();
        await expect(page.locator('#listen-button')).toBeVisible();
        await page.waitForSelector('.game21-nest', { timeout: 20000 });
        await expect(page.locator('.game21-nest')).toHaveCount(2);
        await page.waitForFunction(
            () => {
                const s = window.__faglarna && window.__faglarna.getState();
                return s && s.phase === 'waiting' && s.bird;
            },
            { timeout: 25000 }
        );
    });

    test('correct and wrong nests with two-round completion', async ({ page }) => {
        await page.goto('/games/game21/index.html?colors=red,blue&rounds=2');
        await page.waitForSelector('#game21-field', { timeout: 5000 });
        await page.locator('#game21-field').click();
        await page.waitForFunction(
            () => window.__faglarna && window.__faglarna.getState().phase === 'waiting',
            { timeout: 25000 }
        );

        const bird = await page.evaluate(() => window.__faglarna.getState().bird);
        const wrongNest = page.locator(`.game21-nest[data-color]:not([data-color="${bird}"])`).first();
        await wrongNest.click();
        await page.waitForFunction(
            () => {
                const s = window.__faglarna.getState();
                return s.wrongTries >= 1 && s.roundsWon === 0;
            },
            { timeout: 10000 }
        );

        await page.locator(`.game21-nest[data-color="${bird}"]`).click();
        await page.waitForFunction(
            () => window.__faglarna.getState().roundsWon >= 1,
            { timeout: 35000 }
        );

        await page.waitForFunction(
            () => window.__faglarna.getState().phase === 'waiting',
            { timeout: 35000 }
        );
        const bird2 = await page.evaluate(() => window.__faglarna.getState().bird);
        await page.locator(`.game21-nest[data-color="${bird2}"]`).click();

        const dialog = page.locator('#completion-dialog:not([hidden])');
        await expect(dialog).toBeVisible({ timeout: 45000 });
        await expect(page.locator('#completion-title')).toContainText('Bra jobbat!');
        await expect(page.locator('#continue-button')).toContainText('Igen');
    });

    test('back link returns to hub', async ({ page }) => {
        await page.goto('/games/game21/index.html');
        const back = page.locator('a.back-button');
        await expect(back).toBeVisible();
        await back.click();
        await expect(page).toHaveURL(/index\.html/);
    });
});