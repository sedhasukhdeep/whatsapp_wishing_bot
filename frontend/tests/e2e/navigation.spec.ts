import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test('/ redirects to /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('sidebar link: Contacts', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  });

  test('sidebar link: WhatsApp', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'WhatsApp' }).click();
    await expect(page).toHaveURL(/\/targets/);
    await expect(page.getByRole('heading', { name: 'WhatsApp Targets' })).toBeVisible();
  });

  test('sidebar link: Dashboard', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('quick link: Import Calendar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Import Calendar' }).click();
    await expect(page).toHaveURL(/\/contacts\/import/);
    await expect(page.getByRole('heading', { name: 'Import from Calendar' })).toBeVisible();
  });

  test('active link is highlighted on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const dashLink = page.getByRole('link', { name: 'Dashboard' });
    // Active link has blue color (#2563eb)
    await expect(dashLink).toHaveCSS('color', 'rgb(37, 99, 235)');
  });

  test('Back button in contact form returns to contacts', async ({ page }) => {
    await page.goto('/contacts/new');
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
  });
});
