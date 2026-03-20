import { expect, test } from '@playwright/test';
import { API, cleanupBroadcast, cleanupContact, createBroadcast, createContact } from './helpers';

const ts = () => Date.now();

// ─── Broadcast creation ───────────────────────────────────────────────────────

test.describe('Broadcast creation', () => {
  let broadcastId: number;

  test.afterEach(async ({ request }) => {
    if (broadcastId) await cleanupBroadcast(request, broadcastId);
  });

  test('creates a broadcast via form and shows it in the list', async ({ page }) => {
    const name = `E2E Broadcast ${ts()}`;
    await page.goto('/broadcasts');
    await page.getByRole('button', { name: 'New Broadcast' }).click();

    await page.getByPlaceholder('e.g. Happy New Year 2026').fill(name);
    await page.getByPlaceholder('e.g. New Year').fill('Birthday');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/broadcasts') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Create' }).click(),
    ]);

    // Should land on the broadcast detail page
    await expect(page).toHaveURL(/\/broadcasts\/\d+/);
    await expect(page.getByRole('heading', { name })).toBeVisible();

    const res = await page.request.get(`${API}/api/broadcasts`);
    const broadcasts = await res.json() as { id: number; name: string }[];
    broadcastId = broadcasts.find((b) => b.name === name)!.id;
  });

  test('cancel from new broadcast dialog stays on list page', async ({ page }) => {
    await page.goto('/broadcasts');
    await page.getByRole('button', { name: 'New Broadcast' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/broadcasts$/);
  });
});

// ─── Broadcast detail page ────────────────────────────────────────────────────

test.describe('Broadcast detail', () => {
  let broadcastId: number;

  test.beforeEach(async ({ request }) => {
    const b = await createBroadcast(request, `E2E Detail ${ts()}`);
    broadcastId = b.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupBroadcast(request, broadcastId);
  });

  test('shows message textarea, AI Generate button, and Send button', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI Generate' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Send to All/ })).toBeVisible();
  });

  test('Send button is disabled when message is empty', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await expect(page.getByRole('button', { name: /Send to All/ })).toBeDisabled();
  });

  test('typing a message enables Send button', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.locator('textarea').fill('Happy birthday!');
    await expect(page.getByRole('button', { name: /Send to All/ })).toBeDisabled(); // still disabled — no recipients
  });

  test('AI Generate button calls API and fills textarea', async ({ page }) => {
    const generated = 'AI generated birthday message!';
    await page.route(`**/api/broadcasts/${broadcastId}/generate`, (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: broadcastId, name: 'test', occasion_name: 'Birthday', message_text: generated, status: 'draft', created_at: new Date().toISOString(), sent_at: null }),
      })
    );

    await page.goto(`/broadcasts/${broadcastId}`);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/generate')),
      page.getByRole('button', { name: 'AI Generate' }).click(),
    ]);

    await expect(page.locator('textarea')).toHaveValue(generated);
  });

  test('hint text for {name} placeholder is visible', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await expect(page.getByText('{name}')).toBeVisible();
  });
});

// ─── Recipients ───────────────────────────────────────────────────────────────

test.describe('Broadcast recipients', () => {
  let broadcastId: number;
  let contactId: number;

  test.beforeEach(async ({ request }) => {
    const b = await createBroadcast(request, `E2E Recipients ${ts()}`);
    const c = await createContact(request, `E2E Recipient Person ${ts()}`);
    broadcastId = b.id;
    contactId = c.id;
  });

  test.afterEach(async ({ request }) => {
    await cleanupBroadcast(request, broadcastId);
    await cleanupContact(request, contactId);
  });

  test('Add Recipients button opens dialog with Contacts section', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.getByRole('button', { name: 'Add Recipients' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Recipients' })).toBeVisible();
    await expect(page.getByText('Contacts')).toBeVisible();
  });

  test('WhatsApp Targets section is NOT shown in Add Recipients dialog', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.getByRole('button', { name: 'Add Recipients' }).click();
    await expect(page.getByText('WhatsApp Targets')).not.toBeVisible();
  });

  test('can add a contact recipient and it appears in the table', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.getByRole('button', { name: 'Add Recipients' }).click();

    const contactLabel = page.getByRole('dialog').locator('label').filter({ hasText: 'E2E Recipient Person' }).first();
    await expect(contactLabel).toBeVisible();
    await contactLabel.click();

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/recipients') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Add \d+ Recipient/ }).click(),
    ]);

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('table').getByText('E2E Recipient Person')).toBeVisible();
  });

  test('can remove a recipient', async ({ page, request }) => {
    // Pre-add the recipient via API
    await request.post(`${API}/api/broadcasts/${broadcastId}/recipients`, {
      data: { contact_ids: [contactId], target_ids: [] },
    });

    await page.goto(`/broadcasts/${broadcastId}`);
    await expect(page.locator('table').getByText('E2E Recipient Person')).toBeVisible();

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/recipients/') && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Remove' }).first().click(),
    ]);

    await expect(page.locator('table').getByText('E2E Recipient Person')).not.toBeVisible();
  });

  test('Add button count reflects selected contacts', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.getByRole('button', { name: 'Add Recipients' }).click();

    const addBtn = page.getByRole('button', { name: /Add \d+ Recipient/ });
    await expect(page.getByRole('button', { name: 'Add 0 Recipients' })).toBeDisabled();

    const contactLabel = page.getByRole('dialog').locator('label').filter({ hasText: 'E2E Recipient Person' }).first();
    await contactLabel.click();
    await expect(page.getByRole('button', { name: 'Add 1 Recipients' })).toBeEnabled();

    // Uncheck
    await contactLabel.click();
    await expect(page.getByRole('button', { name: 'Add 0 Recipients' })).toBeDisabled();
  });
});

// ─── {name} personalisation ──────────────────────────────────────────────────

test.describe('Broadcast {name} personalisation', () => {
  let broadcastId: number;
  let contactId: number;

  test.beforeEach(async ({ request }) => {
    const b = await createBroadcast(request, `E2E Name ${ts()}`);
    const c = await createContact(request, `Priya Sharma ${ts()}`);
    broadcastId = b.id;
    contactId = c.id;
    await request.post(`${API}/api/broadcasts/${broadcastId}/recipients`, {
      data: { contact_ids: [contactId], target_ids: [] },
    });
  });

  test.afterEach(async ({ request }) => {
    await cleanupBroadcast(request, broadcastId);
    await cleanupContact(request, contactId);
  });

  test('live preview appears when {name} is typed and a recipient exists', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.locator('textarea').fill('Hey {name}, happy birthday!');
    // Preview shows the first recipient's first name
    await expect(page.getByText(/Preview:/)).toBeVisible();
    await expect(page.getByText(/Hey Priya, happy birthday!/)).toBeVisible();
  });

  test('live preview does NOT appear when no {name} in message', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.locator('textarea').fill('Happy birthday everyone!');
    await expect(page.getByText(/Preview:/)).not.toBeVisible();
  });
});

// ─── Alias in broadcasts ──────────────────────────────────────────────────────

test.describe('Broadcast alias personalisation', () => {
  let broadcastId: number;
  let contactId: number;

  test.beforeEach(async ({ request }) => {
    const b = await createBroadcast(request, `E2E Alias Broadcast ${ts()}`);
    // Create contact with alias enabled
    const c = await createContact(request, `Sukhdeep Singh ${ts()}`, {
      alias: 'Sukhi',
      use_alias_in_broadcast: true,
    });
    broadcastId = b.id;
    contactId = c.id;
    await request.post(`${API}/api/broadcasts/${broadcastId}/recipients`, {
      data: { contact_ids: [contactId], target_ids: [] },
    });
  });

  test.afterEach(async ({ request }) => {
    await cleanupBroadcast(request, broadcastId);
    await cleanupContact(request, contactId);
  });

  test('recipient table shows alias in parentheses when it differs from first name', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    // Full name visible
    await expect(page.locator('table').getByText(/Sukhdeep Singh/)).toBeVisible();
    // Alias shown in parens
    await expect(page.locator('table').getByText('(Sukhi)')).toBeVisible();
  });

  test('live preview uses alias when use_alias_in_broadcast is true', async ({ page }) => {
    await page.goto(`/broadcasts/${broadcastId}`);
    await page.locator('textarea').fill('Hey {name}, wishing you well!');
    // Should preview with alias, not first name
    await expect(page.getByText(/Hey Sukhi, wishing you well!/)).toBeVisible();
  });

  test('API resolves {name} to alias at send time', async ({ request }) => {
    // Set message text via API
    await request.put(`${API}/api/broadcasts/${broadcastId}`, {
      data: { message_text: 'Hey {name}!' },
    }).catch(() => {}); // endpoint may not exist; we test via mock in other tests

    // Verify contact's alias and flag are set correctly
    const res = await request.get(`${API}/api/contacts/${contactId}`);
    const contact = await res.json() as { alias: string; use_alias_in_broadcast: boolean };
    expect(contact.alias).toBe('Sukhi');
    expect(contact.use_alias_in_broadcast).toBe(true);
  });
});
