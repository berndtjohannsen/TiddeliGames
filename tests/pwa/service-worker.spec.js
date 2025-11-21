// PWA and Service Worker tests
import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test('service worker is registered', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(swRegistered).toBeTruthy();
  });

  test('manifest.json is accessible', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
  });

  test('offline page works (if implemented)', async ({ page, context }) => {
    await page.goto('/');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto('/');
    
    // Service worker should handle offline
    // This test might need adjustment based on your offline strategy
    await context.setOffline(false);
  });
});

