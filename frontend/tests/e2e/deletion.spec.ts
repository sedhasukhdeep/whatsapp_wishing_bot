import { expect, test } from '@playwright/test';
import { API, cleanupContact, createContact, createOccasion } from './helpers';

// ─── Contact Deletion ─────────────────────────────────────────────────────────

test.describe('Contact deletion', () => {
  let contactId: number;
  const contactName = `E2E Delete Test ${Date.now()}`;

  test.beforeEach(async ({ request }) => {
    const c = await createContact(request, contactName);
    contactId = c.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupContact(request, contactId);
  });

  test('shows confirm dialog and removes contact on confirm', async ({ page }) => {
    await page.goto('/contacts');

    const card = page.locator('[data-testid="contact-card"]').filter({ hasText: contactName });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(`Delete ${contactName}?`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();

    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: contactName })).toHaveCount(0);

    const res = await page.request.get(`${API}/api/contacts`);
    const contacts = await res.json() as { id: number }[];
    expect(contacts.find((c) => c.id === contactId)).toBeUndefined();
  });

  test('keeps contact when cancel is clicked', async ({ page }) => {
    await page.goto('/contacts');

    const card = page.locator('[data-testid="contact-card"]').filter({ hasText: contactName });
    await card.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(`Delete ${contactName}?`)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText(`Delete ${contactName}?`)).not.toBeVisible();
    await expect(card).toBeVisible();

    const res = await page.request.get(`${API}/api/contacts`);
    const contacts = await res.json() as { id: number }[];
    expect(contacts.find((c) => c.id === contactId)).toBeDefined();
  });
});

// ─── Occasion Deletion ────────────────────────────────────────────────────────

test.describe('Occasion deletion', () => {
  let contactId: number;
  let occasionId: number;
  const contactName = `E2E Occasion Test ${Date.now()}`;

  test.beforeEach(async ({ request }) => {
    const c = await createContact(request, contactName);
    contactId = c.id;
    const o = await createOccasion(request, contactId, 6, 15);
    occasionId = o.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupContact(request, contactId);
  });

  test('removes occasion row on Del click', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);

    const occasionRow = page.locator('tr').filter({ hasText: 'birthday' }).first();
    await expect(occasionRow).toBeVisible();
    await occasionRow.getByRole('button', { name: 'Del' }).click();

    await expect(page.locator('tr').filter({ hasText: 'birthday' })).toHaveCount(0);
    await expect(page.getByText('No occasions yet.')).toBeVisible();

    const res = await page.request.get(`${API}/api/occasions?contact_id=${contactId}`);
    const occasions = await res.json() as { id: number }[];
    expect(occasions.find((o) => o.id === occasionId)).toBeUndefined();
  });
});
