import { expect, test } from '@playwright/test';
import { API, cleanupContact, createContact } from './helpers';

const ts = () => Date.now();

test.describe('Contact creation', () => {
  let createdId: number;

  test.afterEach(async ({ request }) => {
    if (createdId) await cleanupContact(request, createdId);
  });

  test('creates a contact via form and shows it in the list', async ({ page }) => {
    const name = `E2E Create ${ts()}`;
    await page.goto('/contacts/new');

    await page.getByPlaceholder('e.g. Priya Sharma').fill(name);
    await page.getByPlaceholder('+919876543210').fill('+919800000001');
    await page.getByRole('button', { name: 'Family' }).click();

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contacts') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Save Contact' }).click(),
    ]);

    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: name })).toBeVisible();

    const res = await page.request.get(`${API}/api/contacts`);
    const contacts = await res.json() as { id: number; name: string }[];
    createdId = contacts.find((c) => c.name === name)!.id;
  });

  test('shows validation — required fields prevent save', async ({ page }) => {
    await page.goto('/contacts/new');
    await page.getByRole('button', { name: 'Save Contact' }).click();
    await expect(page).toHaveURL(/\/contacts\/new/);
  });

  test('tone selection highlights the active card', async ({ page }) => {
    await page.goto('/contacts/new');
    await page.getByRole('button', { name: /Funny/ }).click();
    const funnyCard = page.getByRole('button', { name: /Funny/ });
    await expect(funnyCard).toHaveCSS('background-color', 'rgb(239, 246, 255)');
  });
});

test.describe('Contact editing', () => {
  let contactId: number;
  const baseName = `E2E Edit Base ${ts()}`;

  test.beforeEach(async ({ request }) => {
    const c = await createContact(request, baseName);
    contactId = c.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupContact(request, contactId);
  });

  test('edits contact name and saves', async ({ page }) => {
    const updatedName = `E2E Edit Updated ${ts()}`;
    await page.goto(`/contacts/${contactId}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit Contact' })).toBeVisible();

    const nameInput = page.getByPlaceholder('e.g. Priya Sharma');
    await nameInput.clear();
    await nameInput.fill(updatedName);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/contacts/${contactId}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Save Contact' }).click(),
    ]);

    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: updatedName })).toBeVisible();
  });

  test('advanced mode toggles extra fields', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);

    // Message Length only visible in Advanced mode
    await expect(page.getByText('Message Length')).not.toBeVisible();

    await page.getByRole('button', { name: 'Advanced' }).click();
    await expect(page.getByText('Message Length')).toBeVisible();

    await page.getByRole('button', { name: 'Simple' }).click();
    await expect(page.getByText('Message Length')).not.toBeVisible();
  });

  test('cancel returns to contacts list without saving', async ({ page }) => {
    await page.goto(`/contacts/${contactId}/edit`);
    await page.getByPlaceholder('e.g. Priya Sharma').fill('SHOULD NOT SAVE');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: baseName })).toBeVisible();
  });
});

test.describe('Contact search and filter', () => {
  let contactAId: number;
  let contactBId: number;
  const nameA = `E2E Search Alpha ${ts()}`;
  const nameB = `E2E Search Beta ${ts()}`;

  test.beforeAll(async ({ request }) => {
    const a = await createContact(request, nameA, { relationship: 'family' });
    const b = await createContact(request, nameB, { relationship: 'colleague' });
    contactAId = a.id;
    contactBId = b.id;
  });

  test.afterAll(async ({ request }) => {
    await cleanupContact(request, contactAId);
    await cleanupContact(request, contactBId);
  });

  test('search by name filters cards', async ({ page }) => {
    await page.goto('/contacts');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contacts') && r.url().includes('search=')),
      page.getByPlaceholder('Search by name or phone...').fill('Alpha'),
    ]);
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameA })).toBeVisible();
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameB })).toHaveCount(0);
  });

  test('filter by relationship chip', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('button', { name: 'family' }).click();
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameA })).toBeVisible();
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameB })).toHaveCount(0);
  });

  test('All chip clears filter', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('button', { name: 'family' }).click();
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameA })).toBeVisible();
    await expect(page.locator('[data-testid="contact-card"]').filter({ hasText: nameB })).toBeVisible();
  });
});
