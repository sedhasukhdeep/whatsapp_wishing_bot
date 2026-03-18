import { expect, test } from '@playwright/test';
import { API, cleanupTarget } from './helpers';

const ts = () => Date.now();

test.describe('WhatsApp Targets page', () => {
  test('shows bridge status card', async ({ page }) => {
    await page.goto('/targets');
    await expect(page.getByText(/WhatsApp:/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('Refresh button re-fetches bridge status', async ({ page }) => {
    await page.goto('/targets');
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/targets/bridge-status')),
      page.getByRole('button', { name: 'Refresh' }).click(),
    ]);
    expect(res.status()).toBe(200);
  });

  test('shows Send Targets section and Add button', async ({ page }) => {
    await page.goto('/targets');
    await expect(page.getByRole('heading', { name: 'Send Targets' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Target' })).toBeVisible();
  });
});

test.describe('Target CRUD', () => {
  let createdTargetId = 0;

  test.afterEach(async ({ request }) => {
    if (createdTargetId) await cleanupTarget(request, createdTargetId);
  });

  test('adds a target via API and sees it in the table', async ({ page, request }) => {
    const name = `E2E Target ${ts()}`;
    const res = await request.post(`${API}/api/targets`, {
      data: { name, chat_id: '1234567890@c.us', target_type: 'individual', description: null },
    });
    expect(res.ok()).toBeTruthy();
    const target = await res.json() as { id: number };
    createdTargetId = target.id;

    await page.goto('/targets');
    await expect(page.getByRole('cell', { name }).first()).toBeVisible();
  });

  test('edits a target label', async ({ page, request }) => {
    const name = `E2E Edit Target ${ts()}`;
    const res = await request.post(`${API}/api/targets`, {
      data: { name, chat_id: '9876543210@c.us', target_type: 'individual', description: null },
    });
    const target = await res.json() as { id: number };
    createdTargetId = target.id;

    await page.goto('/targets');
    const row = page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Edit' }).click();

    const labelInput = page.getByPlaceholder('e.g. Family Group, Wifey');
    await labelInput.clear();
    const updatedName = `${name} Updated`;
    await labelInput.fill(updatedName);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/targets/') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);

    await expect(page.getByRole('cell', { name: updatedName }).first()).toBeVisible();
  });

  test('deletes a target via confirm dialog', async ({ page, request }) => {
    const name = `E2E Delete Target ${ts()}`;
    const res = await request.post(`${API}/api/targets`, {
      data: { name, chat_id: '1111111111@c.us', target_type: 'individual', description: null },
    });
    const target = await res.json() as { id: number };
    createdTargetId = target.id;

    await page.goto('/targets');
    const row = page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(`Delete target "${name}"?`)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.locator('tr').filter({ hasText: name })).toHaveCount(0);

    const check = await request.get(`${API}/api/targets`);
    const targets = await check.json() as { id: number }[];
    expect(targets.find((t) => t.id === createdTargetId)).toBeUndefined();
    createdTargetId = 0;
  });

  test('cancel on delete dialog keeps the target', async ({ page, request }) => {
    const name = `E2E Cancel Delete ${ts()}`;
    const res = await request.post(`${API}/api/targets`, {
      data: { name, chat_id: '2222222222@c.us', target_type: 'individual', description: null },
    });
    const target = await res.json() as { id: number };
    createdTargetId = target.id;

    await page.goto('/targets');
    const row = page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('tr').filter({ hasText: name })).toBeVisible();
  });
});
