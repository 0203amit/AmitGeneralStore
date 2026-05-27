import { test, expect } from '@playwright/test';

test.describe('Navigation Guards', () => {
  test('redirects /dashboard to / when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });

  test('redirects /upload to / when not authenticated', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });

  test('redirects /history to / when not authenticated', async ({ page }) => {
    await page.goto('/history');
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });

  test('redirects /settings to / when not authenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });
});
