import { expect, test } from '@playwright/test';
import { cleanupContact, createContact } from './helpers';

const ts = () => Date.now();

test.describe('Occasions management', () => {
  let contactId: number;

  test.beforeEach(async ({ request }) => {
    const c = await createContact(request, `E2E Occasion ${ts()}`);
    contactId = c.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupContact(request, contactId);
  });

  test('adds a birthday occasion', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);
    await expect(page.getByText('No occasions yet.')).toBeVisible();

    await page.getByRole('button', { name: '+ Add Occasion' }).click();

    const modal = page.locator('[data-testid="occasion-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Add Occasion')).toBeVisible();

    // Type defaults to Birthday — set Month=June, Day=15
    await modal.locator('select').nth(1).selectOption('6');   // Month
    await modal.locator('select').nth(2).selectOption('15');  // Day

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/occasions') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Save' }).click(),
    ]);

    await expect(modal).not.toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'birthday' })).toBeVisible();
    await expect(page.locator('td').filter({ hasText: 'Jun 15' })).toBeVisible();
  });

  test('adds a custom occasion with label', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);
    await page.getByRole('button', { name: '+ Add Occasion' }).click();

    const modal = page.locator('[data-testid="occasion-modal"]');

    // Change type to Custom
    await modal.locator('select').nth(0).selectOption('custom');

    // Label field appears
    await expect(modal.getByPlaceholder('e.g. Work Promotion')).toBeVisible();
    await modal.getByPlaceholder('e.g. Work Promotion').fill('Graduation Day');

    await modal.locator('select').nth(1).selectOption('9');  // September
    await modal.locator('select').nth(2).selectOption('1');  // 1st

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/occasions') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Save' }).click(),
    ]);

    await expect(page.locator('tr').filter({ hasText: 'Graduation Day' })).toBeVisible();
  });

  test('edits an existing occasion', async ({ page }) => {
    // Open form and add a birthday first
    await page.goto(`/contacts/${contactId}/edit`);
    await page.getByRole('button', { name: '+ Add Occasion' }).click();
    const modal = page.locator('[data-testid="occasion-modal"]');
    await modal.locator('select').nth(1).selectOption('3');
    await modal.locator('select').nth(2).selectOption('10');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/occasions') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Save' }).click(),
    ]);
    await expect(modal).not.toBeVisible();

    // Now edit it
    const row = page.locator('tr').filter({ hasText: 'birthday' }).first();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(modal.getByText('Edit Occasion')).toBeVisible();

    // Change month from March to June
    await modal.locator('select').nth(1).selectOption('6');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/occasions') && r.request().method() === 'PUT'),
      modal.getByRole('button', { name: 'Save' }).click(),
    ]);

    await expect(page.locator('td').filter({ hasText: 'Jun 10' })).toBeVisible();
  });

  test('advanced overrides section toggles open and closed', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);
    await page.getByRole('button', { name: '+ Add Occasion' }).click();

    const modal = page.locator('[data-testid="occasion-modal"]');
    await expect(modal.getByText('Tone override')).not.toBeVisible();

    await modal.getByText(/Override message settings/).click();
    await expect(modal.getByText('Tone override')).toBeVisible();

    await modal.getByText(/Override message settings/).click();
    await expect(modal.getByText('Tone override')).not.toBeVisible();
  });

  test('cancel closes modal without saving', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);
    await page.getByRole('button', { name: '+ Add Occasion' }).click();

    const modal = page.locator('[data-testid="occasion-modal"]');
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('No occasions yet.')).toBeVisible();
  });
});
