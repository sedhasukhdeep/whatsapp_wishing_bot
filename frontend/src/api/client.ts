import axios from 'axios';
import type {
  BridgeStatus,
  CalendarImportConfirmItem,
  CalendarImportPreviewItem,
  CalendarImportResult,
  Contact,
  ContactWithOccasions,
  DashboardOccasionItem,
  DashboardUpcomingItem,
  MessageDraft,
  Occasion,
  WhatsAppTarget,
} from '../types';

const api = axios.create({ baseURL: 'http://localhost:8000' });

// Contacts
export const listContacts = (search = '', relationship = '') =>
  api.get<Contact[]>('/api/contacts', { params: { search, relationship } }).then((r) => r.data);

export const getContact = (id: number) =>
  api.get<ContactWithOccasions>(`/api/contacts/${id}`).then((r) => r.data);

export const createContact = (data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) =>
  api.post<Contact>('/api/contacts', data).then((r) => r.data);

export const updateContact = (id: number, data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) =>
  api.put<Contact>(`/api/contacts/${id}`, data).then((r) => r.data);

export const deleteContact = (id: number) => api.delete(`/api/contacts/${id}`);

// Occasions
export const listOccasions = (contactId: number) =>
  api.get<Occasion[]>('/api/occasions', { params: { contact_id: contactId } }).then((r) => r.data);

export const createOccasion = (data: Omit<Occasion, 'id' | 'created_at'>) =>
  api.post<Occasion>('/api/occasions', data).then((r) => r.data);

export const updateOccasion = (id: number, data: Omit<Occasion, 'id' | 'created_at'>) =>
  api.put<Occasion>(`/api/occasions/${id}`, data).then((r) => r.data);

export const deleteOccasion = (id: number) => api.delete(`/api/occasions/${id}`);

// WhatsApp Targets
export const listTargets = () =>
  api.get<WhatsAppTarget[]>('/api/targets').then((r) => r.data);

export const createTarget = (data: Omit<WhatsAppTarget, 'id' | 'created_at'>) =>
  api.post<WhatsAppTarget>('/api/targets', data).then((r) => r.data);

export const updateTarget = (id: number, data: Omit<WhatsAppTarget, 'id' | 'created_at'>) =>
  api.put<WhatsAppTarget>(`/api/targets/${id}`, data).then((r) => r.data);

export const deleteTarget = (id: number) => api.delete(`/api/targets/${id}`);

export const getBridgeStatus = () =>
  api.get<BridgeStatus>('/api/targets/bridge-status').then((r) => r.data);

export interface WaChat { id: string; name: string; type: 'individual' | 'group' }
export const getWaChats = () =>
  api.get<WaChat[]>('/api/targets/chats').then((r) => r.data);

// Dashboard
export const getDashboardToday = () =>
  api.get<DashboardOccasionItem[]>('/api/dashboard/today').then((r) => r.data);

export const getDashboardUpcoming = () =>
  api.get<DashboardUpcomingItem[]>('/api/dashboard/upcoming').then((r) => r.data);

export const triggerGenerate = () =>
  api.post<{ drafts_created: number }>('/api/dashboard/generate').then((r) => r.data);

// Drafts
export const approveDraft = (id: number, edited_text?: string) =>
  api.patch<MessageDraft>(`/api/drafts/${id}/approve`, { edited_text }).then((r) => r.data);

export const skipDraft = (id: number) =>
  api.patch<MessageDraft>(`/api/drafts/${id}/skip`).then((r) => r.data);

export const regenerateDraft = (id: number) =>
  api.post<MessageDraft>(`/api/drafts/${id}/regenerate`).then((r) => r.data);

export const sendDraft = (id: number, target_id: number | null) =>
  api.post<MessageDraft>(`/api/drafts/${id}/send`, { target_id }).then((r) => r.data);

// Calendar Import
export const previewCalendarImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<CalendarImportPreviewItem[]>('/api/calendar/preview', form).then((r) => r.data);
};

export const confirmCalendarImport = (items: CalendarImportConfirmItem[]) =>
  api.post<CalendarImportResult>('/api/calendar/confirm', { items }).then((r) => r.data);
