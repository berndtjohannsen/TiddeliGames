// Regression tests for Game 20 (Mata fisken)
import { test, expect } from '@playwright/test';

test.describe('Game 20 - Mata fisken', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/games/game20/index.html');
    });

    test('stage, fish, plate and listen control load', async ({ page }) => {
        await page.waitForSelector('#game20-field', { timeout: 5000 });
        await expect(page.locator('#fish')).toBeVisible();
        await expect(page.locator('#listen-button')).toBeVisible();
        // Unlock audio and wait for first round plate (8 items)
        await page.locator('#game20-field').click();
        await page.waitForSelector('.game20-food', { timeout: 15000 });
        await expect(page.locator('.game20-food')).toHaveCount(8);
    });

    test('feeding after prompt increases eatenCount', async ({ page }) => {
        await page.waitForSelector('#game20-field', { timeout: 5000 });
        await page.locator('#game20-field').click();
        await page.waitForSelector('.game20-food', { timeout: 15000 });
        await page.waitForFunction(
            () => {
                const s = window.__mataFiskarna && window.__mataFiskarna.getState();
                return s && (s.phase === 'feeding' || s.phase === 'settle');
            },
            { timeout: 20000 }
        );
        const firstFood = page.locator('.game20-food').first();
        await firstFood.click();
        await page.waitForFunction(
            () => {
                const s = window.__mataFiskarna && window.__mataFiskarna.getState();
                return s && s.eatenCount >= 1;
            },
            { timeout: 10000 }
        );
        const eaten = await page.evaluate(() => window.__mataFiskarna.getState().eatenCount);
        expect(eaten).toBeGreaterThanOrEqual(1);
    });

    test('debug targets complete all rounds', async ({ page }) => {
        await page.goto('/games/game20/index.html?targets=1,1,1&foods=jordgubbar,jordgubbar,jordgubbar');
        await page.waitForSelector('#game20-field', { timeout: 5000 });
        await page.locator('#game20-field').click();
        await page.waitForSelector('.game20-food', { timeout: 15000 });

        for (let round = 0; round < 3; round += 1) {
            await page.waitForFunction(
                () => {
                    const s = window.__mataFiskarna && window.__mataFiskarna.getState();
                    return s && (s.phase === 'feeding' || s.phase === 'settle');
                },
                { timeout: 25000 }
            );
            await page.locator('.game20-food').first().click();
            if (round < 2) {
                await page.waitForFunction(
                    () => {
                        const s = window.__mataFiskarna && window.__mataFiskarna.getState();
                        return s && s.phase === 'prompt';
                    },
                    { timeout: 35000 }
                );
            }
        }

        const dialog = page.locator('#completion-dialog:not([hidden])');
        await expect(dialog).toBeVisible({ timeout: 45000 });
        await expect(page.locator('#completion-title')).toContainText('Bra jobbat!');
        await expect(page.locator('#continue-button')).toContainText('Igen');
    });

    test('back link returns to hub', async ({ page }) => {
        const back = page.locator('a.back-button');
        await expect(back).toBeVisible();
        await back.click();
        await expect(page).toHaveURL(/index\.html/);
    });
});