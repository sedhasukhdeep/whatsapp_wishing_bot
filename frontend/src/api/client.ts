import axios from 'axios';
import type {
  AISettings,
  AISettingsUpdate,
  AIStatus,
  Broadcast,
  DetectedOccasion,
  DetectionConfirmRequest,
  GiphyResult,
  BroadcastWithRecipients,
  BridgeStatus,
  CalendarDay,
  CalendarImportConfirmItem,
  CalendarImportPreviewItem,
  CalendarImportResult,
  Contact,
  ContactWithOccasions,
  DashboardOccasionItem,
  DashboardUpcomingItem,
  DraftHistoryItem,
  MessageDraft,
  Occasion,
  WaSyncImportItem,
  WaSyncPreviewItem,
  WhatsAppTarget,
} from '../types';

const api = axios.create({
  // Dev: set VITE_API_URL=http://localhost:8000 in frontend/.env
  // Docker: leave unset — nginx proxies /api/* to backend container
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
});

// Normalize error messages from FastAPI validation errors and plain strings
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') {
      err.message = detail;
    } else if (Array.isArray(detail)) {
      // Pydantic validation errors: [{loc, msg, type}, ...]
      err.message = detail.map((d: { msg: string }) => d.msg).join('; ');
    }
    return Promise.reject(err);
  }
);

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

export const deleteAllContacts = () =>
  api.delete<{ deleted: number }>('/api/contacts').then((r) => r.data);

export const getWaSyncPreview = () =>
  api.get<WaSyncPreviewItem[]>('/api/contacts/wa-sync/preview').then((r) => r.data);

export const importWaContacts = (items: WaSyncImportItem[]) =>
  api.post<{ created: number; skipped: number }>('/api/contacts/wa-sync/import', { items }).then((r) => r.data);

// Occasions
export const listOccasions = (contactId: number) =>
  api.get<Occasion[]>('/api/occasions', { params: { contact_id: contactId } }).then((r) => r.data);

export const createOccasion = (data: Omit<Occasion, 'id' | 'created_at'>) =>
  api.post<Occasion>('/api/occasions', data).then((r) => r.data);

export const updateOccasion = (id: number, data: Omit<Occasion, 'id' | 'created_at'>) =>
  api.put<Occasion>(`/api/occasions/${id}`, data).then((r) => r.data);

export const deleteOccasion = (id: number) => api.delete(`/api/occasions/${id}`);

// Calendar occasions view (Phase 5)
export const getCalendarOccasions = (month: number, year: number) =>
  api.get<CalendarDay[]>('/api/occasions/calendar', { params: { month, year } }).then((r) => r.data);

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
  api.post<{ drafts_created: number }>('/api/dashboard/generate', null, { timeout: 300000 }).then((r) => r.data);

// Drafts
export const approveDraft = (id: number, edited_text?: string) =>
  api.patch<MessageDraft>(`/api/drafts/${id}/approve`, { edited_text }).then((r) => r.data);

export const skipDraft = (id: number) =>
  api.patch<MessageDraft>(`/api/drafts/${id}/skip`).then((r) => r.data);

export const regenerateDraft = (id: number, feedback?: string) =>
  api.post<MessageDraft>(`/api/drafts/${id}/regenerate`, feedback ? { feedback } : null, { timeout: 300000 }).then((r) => r.data);

export const scheduleDraft = (id: number, scheduled_for: string) =>
  api.patch<MessageDraft>(`/api/drafts/${id}/schedule`, { scheduled_for }).then((r) => r.data);

export const sendDraft = (id: number, target_id: number | null, gif_url?: string | null) =>
  api.post<MessageDraft>(`/api/drafts/${id}/send`, { target_id, gif_url }).then((r) => r.data);

// History (Phase 4)
export const getDraftHistory = () =>
  api.get<DraftHistoryItem[]>('/api/drafts/history').then((r) => r.data);

// Calendar Import
export const previewCalendarImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<CalendarImportPreviewItem[]>('/api/calendar/preview', form).then((r) => r.data);
};

export const confirmCalendarImport = (items: CalendarImportConfirmItem[]) =>
  api.post<CalendarImportResult>('/api/calendar/confirm', { items }).then((r) => r.data);

// Broadcasts (Phase 7)
export const listBroadcasts = () =>
  api.get<Broadcast[]>('/api/broadcasts').then((r) => r.data);

export const createBroadcast = (data: { name: string; occasion_name: string }) =>
  api.post<Broadcast>('/api/broadcasts', data).then((r) => r.data);

export const getBroadcast = (id: number) =>
  api.get<BroadcastWithRecipients>(`/api/broadcasts/${id}`).then((r) => r.data);

export const deleteBroadcast = (id: number) =>
  api.delete(`/api/broadcasts/${id}`);

export const generateBroadcastMessage = (id: number) =>
  api.post<Broadcast>(`/api/broadcasts/${id}/generate`).then((r) => r.data);

export const addBroadcastRecipients = (id: number, data: { contact_ids: number[]; target_ids: number[] }) =>
  api.post<BroadcastWithRecipients>(`/api/broadcasts/${id}/recipients`, data).then((r) => r.data);

export const removeBroadcastRecipient = (broadcastId: number, recipientId: number) =>
  api.delete(`/api/broadcasts/${broadcastId}/recipients/${recipientId}`);

export const sendBroadcast = (id: number) =>
  api.post(`/api/broadcasts/${id}/send`);

export const retryBroadcast = (id: number) =>
  api.post<{ status: string; count: number }>(`/api/broadcasts/${id}/retry`);

// Admin Settings
export const getAISettings = () =>
  api.get<AISettings>('/api/admin/settings').then((r) => r.data);

export const updateAISettings = (data: AISettingsUpdate) =>
  api.put<AISettings>('/api/admin/settings', data).then((r) => r.data);

export const getAIStatus = () =>
  api.get<AIStatus>('/api/admin/ai-status').then((r) => r.data);

// Giphy proxy
export const searchGifs = (q: string) =>
  api.get<{ data: GiphyResult[] }>('/api/giphy/search', { params: { q } }).then((r) => r.data);

// Occasion Detections
export const listDetections = () =>
  api.get<DetectedOccasion[]>('/api/detections').then((r) => r.data);

export const getDetectionsCount = () =>
  api.get<{ count: number }>('/api/detections/count').then((r) => r.data);

export const confirmDetection = (id: number, data: DetectionConfirmRequest) =>
  api.post<Occasion>(`/api/detections/${id}/confirm`, data).then((r) => r.data);

export const dismissDetection = (id: number) =>
  api.post(`/api/detections/${id}/dismiss`);
