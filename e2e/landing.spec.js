import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows business name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Amit General Store');
  });

  test('shows sign-in with Google button', async ({ page }) => {
    await page.goto('/');
    // The sign-in button or OAuth prompt should be present
    const signInArea = page.getByText(/sign in/i).first();
    await expect(signInArea).toBeVisible();
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Amit General Store/);
  });
});
