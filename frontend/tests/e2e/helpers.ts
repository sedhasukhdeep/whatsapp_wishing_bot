import type { APIRequestContext } from '@playwright/test';

export const API = 'http://localhost:8000';

export async function createContact(
  request: APIRequestContext,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await request.post(`${API}/api/contacts`, {
    data: {
      name,
      phone: `+91${Date.now().toString().slice(-10)}`,
      relationship: 'friend',
      notes: null,
      tone_preference: 'warm',
      language: 'en',
      message_length: 'medium',
      custom_instructions: null,
      whatsapp_chat_id: null,
      whatsapp_chat_name: null,
      ...overrides,
    },
  });
  if (!res.ok()) throw new Error(`createContact failed: ${await res.text()}`);
  return res.json() as Promise<{ id: number; name: string }>;
}

export async function createOccasion(
  request: APIRequestContext,
  contactId: number,
  month: number,
  day: number,
  overrides: Record<string, unknown> = {},
) {
  const res = await request.post(`${API}/api/occasions`, {
    data: {
      contact_id: contactId,
      type: 'birthday',
      label: null,
      month,
      day,
      year: 1993,
      active: true,
      tone_override: null,
      language_override: null,
      length_override: null,
      custom_instructions_override: null,
      ...overrides,
    },
  });
  if (!res.ok()) throw new Error(`createOccasion failed: ${await res.text()}`);
  return res.json() as Promise<{ id: number }>;
}

export async function cleanupContact(request: APIRequestContext, id: number) {
  await request.delete(`${API}/api/contacts/${id}`).catch(() => {});
}

export async function cleanupTarget(request: APIRequestContext, id: number) {
  await request.delete(`${API}/api/targets/${id}`).catch(() => {});
}
