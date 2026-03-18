import { expect, test } from '@playwright/test';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DRAFT = {
  id: 9001,
  occasion_id: 9001,
  contact_id: 9001,
  whatsapp_target_id: null,
  occasion_date: '2026-03-18',
  generated_text: 'Happy Birthday, mock friend! Hope your day is amazing.',
  edited_text: null,
  final_text: null,
  status: 'pending',
  generation_prompt: null,
  sent_at: null,
  created_at: '2026-03-18T00:00:00',
  updated_at: '2026-03-18T00:00:00',
};

const MOCK_TODAY = [
  {
    occasion: {
      id: 9001, contact_id: 9001, type: 'birthday', label: null,
      month: 3, day: 18, year: 1993, active: true,
      tone_override: null, language_override: null, length_override: null,
      custom_instructions_override: null, created_at: '2026-03-18T00:00:00',
    },
    contact: {
      id: 9001, name: 'Mock Birthday Person', phone: '+919000000001',
      relationship: 'friend', notes: null, tone_preference: 'warm',
      language: 'en', message_length: 'medium', custom_instructions: null,
      whatsapp_chat_id: null, whatsapp_chat_name: null,
      created_at: '2026-03-18T00:00:00', updated_at: '2026-03-18T00:00:00',
    },
    draft: MOCK_DRAFT,
    turning_age: 33,
    years_together: null,
  },
];

// ─── Dashboard layout ──────────────────────────────────────────────────────────

test.describe('Dashboard layout', () => {
  test('loads with both sections visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's Occasions" })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upcoming (next 7 days)' })).toBeVisible();
  });

  test('Generate button is visible and enabled', async ({ page }) => {
    await page.goto('/dashboard');
    const btn = page.getByRole('button', { name: "Generate Today's Messages" });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('Generate button shows loading state during request', async ({ page }) => {
    await page.goto('/dashboard');
    await page.route('**/api/dashboard/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, body: JSON.stringify({ drafts_created: 0 }) });
    });
    await page.route('**/api/dashboard/today', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/dashboard/upcoming', (route) => route.fulfill({ status: 200, body: '[]' }));

    const btn = page.getByRole('button', { name: "Generate Today's Messages" });
    await btn.click();
    await expect(page.getByRole('button', { name: 'Generating...' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Generate Today's Messages" })).toBeVisible();
  });

  test('shows green success message after generation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.route('**/api/dashboard/generate', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ drafts_created: 2 }) })
    );
    await page.route('**/api/dashboard/today', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/dashboard/upcoming', (route) => route.fulfill({ status: 200, body: '[]' }));

    await page.getByRole('button', { name: "Generate Today's Messages" }).click();
    await expect(page.getByText('2 drafts generated.')).toBeVisible();
  });

  test('shows red error message on generation failure', async ({ page }) => {
    await page.goto('/dashboard');
    await page.route('**/api/dashboard/generate', (route) =>
      route.fulfill({ status: 502, body: JSON.stringify({ detail: 'API key missing' }) })
    );

    await page.getByRole('button', { name: "Generate Today's Messages" }).click();
    await expect(page.getByText('API key missing')).toBeVisible();
  });

  test('shows "no occasions today" when list is empty', async ({ page }) => {
    await page.route('**/api/dashboard/today', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.goto('/dashboard');
    await expect(page.getByText('No occasions today.')).toBeVisible();
  });
});

// ─── TodayCard with a draft (fully mocked) ────────────────────────────────────

test.describe('TodayCard draft interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/dashboard/today', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_TODAY) })
    );
    await page.route('**/api/dashboard/upcoming', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/targets', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/contacts', (route) => route.fulfill({ status: 200, body: '[{"id":1}]' }));
  });

  test('renders card with contact name and message editor', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Mock Birthday Person')).toBeVisible();
    await expect(page.getByText('Birthday (turning 33)')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue(MOCK_DRAFT.generated_text);
  });

  test('status badge shows PENDING', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('PENDING')).toBeVisible();
  });

  test('character counter is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/\d+ \/ 4096 chars/)).toBeVisible();
  });

  test('approve draft calls API and shows APPROVED badge', async ({ page }) => {
    await page.route('**/api/drafts/9001/approve', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ...MOCK_DRAFT, status: 'approved' }) })
    );
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Approve' }).click();
    // Badge span shows "Approved" (CSS text-transform: uppercase makes it look "APPROVED")
    await expect(page.locator('span').filter({ hasText: 'Approved' }).first()).toBeVisible();
    await expect(page.getByText('Approved!')).toBeVisible();
  });

  test('skip draft calls API and shows SKIPPED badge', async ({ page }) => {
    await page.route('**/api/drafts/9001/skip', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ...MOCK_DRAFT, status: 'skipped' }) })
    );
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('SKIPPED')).toBeVisible();
  });

  test('Regenerate with edits shows confirm dialog', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('textarea').fill('Edited text that differs from original');
    await page.getByRole('button', { name: 'Regenerate' }).click();

    await expect(page.getByText('Your edits will be lost. Regenerate the message anyway?')).toBeVisible();

    // Cancel keeps edits
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('textarea')).toHaveValue('Edited text that differs from original');
  });

  test('Regenerate without edits calls API directly (no dialog)', async ({ page }) => {
    const regenText = 'Fresh regenerated message!';
    await page.route('**/api/drafts/9001/regenerate', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ...MOCK_DRAFT, generated_text: regenText }) })
    );

    await page.goto('/dashboard');
    // No edits — click Regenerate directly
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/regenerate')),
      page.getByRole('button', { name: 'Regenerate' }).click(),
    ]);

    await expect(page.locator('textarea')).toHaveValue(regenText);
  });
});

// ─── MessageEditor character limits ───────────────────────────────────────────

test.describe('MessageEditor character limits', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/dashboard/today', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(MOCK_TODAY) })
    );
    await page.route('**/api/dashboard/upcoming', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/targets', (route) => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/contacts', (route) => route.fulfill({ status: 200, body: '[{"id":1}]' }));
  });

  test('counter turns orange near 3800 chars', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('textarea').fill('a'.repeat(3850));
    await expect(page.getByText(/approaching WhatsApp limit/)).toBeVisible();
    await expect(page.getByText(/3850 \/ 4096 chars/)).toHaveCSS('color', 'rgb(217, 119, 6)');
  });

  test('counter turns red and shows error over 4096 chars', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('textarea').fill('a'.repeat(4100));
    await expect(page.getByText(/message exceeds WhatsApp limit/)).toBeVisible();
    await expect(page.getByText(/4100 \/ 4096 chars/)).toHaveCSS('color', 'rgb(220, 38, 38)');
  });

  test('textarea gets red border when over limit', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('textarea').fill('a'.repeat(4100));
    await expect(page.locator('textarea')).toHaveCSS('border-color', 'rgb(252, 165, 165)');
  });
});
