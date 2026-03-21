export type RelationshipType = 'family' | 'friend' | 'colleague' | 'acquaintance' | 'other';
export type ToneType = 'warm' | 'funny' | 'formal';
export type LengthType = 'short' | 'medium' | 'long';
export type OccasionType = 'birthday' | 'anniversary' | 'custom';
export type DraftStatus = 'pending' | 'approved' | 'sent' | 'skipped' | 'scheduled';
export type TargetType = 'group' | 'individual';
export type BroadcastStatus = 'draft' | 'sent';

export interface Contact {
  id: number;
  name: string;
  phone: string;
  relationship: RelationshipType;
  relationship_label: string | null;
  alias: string | null;
  use_alias_in_broadcast: boolean;
  use_alias: boolean;
  auto_send: boolean;
  notes: string | null;
  tone_preference: ToneType;
  language: string;
  message_length: LengthType;
  custom_instructions: string | null;
  whatsapp_chat_id: string | null;
  whatsapp_chat_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactWithOccasions extends Contact {
  occasions: Occasion[];
}

export interface Occasion {
  id: number;
  contact_id: number;
  type: OccasionType;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  active: boolean;
  tone_override: string | null;
  language_override: string | null;
  length_override: string | null;
  custom_instructions_override: string | null;
  created_at: string;
}

export interface WhatsAppTarget {
  id: number;
  name: string;
  chat_id: string;
  target_type: TargetType;
  description: string | null;
  created_at: string;
}

export interface MessageDraft {
  id: number;
  occasion_id: number;
  contact_id: number;
  whatsapp_target_id: number | null;
  occasion_date: string;
  generated_text: string;
  edited_text: string | null;
  final_text: string | null;
  gif_url: string | null;
  scheduled_for: string | null;
  status: DraftStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardOccasionItem {
  occasion: Occasion;
  contact: Contact;
  draft: MessageDraft | null;
  turning_age: number | null;
  years_together: number | null;
}

export interface DashboardUpcomingItem {
  occasion: Occasion;
  contact: Contact;
  days_away: number;
  turning_age: number | null;
  years_together: number | null;
}

export interface BridgeStatus {
  ready: boolean;
  qr_image: string | null;
  state?: 'starting' | 'qr' | 'ready' | 'disconnected' | 'error' | null;
}

export interface CalendarImportPreviewItem {
  raw_summary: string;
  name: string;
  occasion_type: OccasionType;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  existing_contact_id: number | null;
  existing_contact_name: string | null;
}

export interface CalendarImportConfirmItem {
  name: string;
  occasion_type: OccasionType;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  phone: string;
  relationship: RelationshipType;
  existing_contact_id: number | null;
}

export interface CalendarImportResult {
  contacts_created: number;
  occasions_created: number;
}

// Phase 4: History
export interface ContactSummary {
  id: number;
  name: string;
  relationship: RelationshipType;
  relationship_label: string | null;
}

export interface OccasionSummary {
  id: number;
  type: OccasionType;
  label: string | null;
}

export interface DraftHistoryItem {
  id: number;
  occasion_date: string;
  final_text: string | null;
  sent_at: string | null;
  gif_url: string | null;
  contact: ContactSummary;
  occasion: OccasionSummary;
}

// Phase 5: Calendar
export interface CalendarOccasionEntry {
  contact_id: number;
  contact_name: string;
  occasion_id: number;
  type: OccasionType;
  label: string | null;
}

export interface CalendarDay {
  day: number;
  occasions: CalendarOccasionEntry[];
}

// Admin Settings
export interface AISettings {
  ai_provider: string;
  anthropic_api_key_masked: string | null;
  claude_model: string;
  openai_api_key_masked: string | null;
  openai_model: string;
  gemini_api_key_masked: string | null;
  gemini_model: string;
  local_ai_url: string;
  local_ai_model: string;
  giphy_api_key_masked: string | null;
  admin_wa_chat_id: string | null;
  admin_wa_chat_name: string | null;
  admin_notifications_enabled: boolean;
}

export interface AISettingsUpdate {
  ai_provider: string;
  anthropic_api_key?: string | null;
  claude_model: string;
  openai_api_key?: string | null;
  openai_model?: string | null;
  gemini_api_key?: string | null;
  gemini_model?: string | null;
  local_ai_url?: string | null;
  local_ai_model?: string | null;
  giphy_api_key?: string | null;
  admin_wa_chat_id?: string | null;
  admin_wa_chat_name?: string | null;
  admin_notifications_enabled?: boolean | null;
}

export interface GiphyResult {
  id: string;
  title: string;
  images: {
    fixed_height_small: { url: string };
    original_mp4: { mp4: string };
  };
}

export interface AIStatus {
  provider_setting: string;
  local_available: boolean;
  local_model: string | null;
  local_url: string;
  claude_configured: boolean;
  claude_model: string;
  openai_configured: boolean;
  openai_model: string;
  gemini_configured: boolean;
  gemini_model: string;
  active_provider: string;
}

// Phase 7: Broadcasts
export interface Broadcast {
  id: number;
  name: string;
  occasion_name: string;
  message_text: string | null;
  status: BroadcastStatus;
  created_at: string;
  sent_at: string | null;
}

export interface BroadcastRecipient {
  id: number;
  broadcast_id: number;
  recipient_type: 'contact' | 'target';
  contact_id: number | null;
  target_id: number | null;
  contact_name: string | null;
  contact_display_name: string | null;
  target_name: string | null;
  sent_at: string | null;
  error: string | null;
}

export interface BroadcastWithRecipients extends Broadcast {
  recipients: BroadcastRecipient[];
}

// Occasion Detection
export type DetectionStatus = 'pending' | 'confirmed' | 'dismissed';
export type DetectionConfidence = 'low' | 'medium' | 'high';

export interface DetectedOccasion {
  id: number;
  message_id: string;
  source_chat_id: string;
  source_chat_name: string | null;
  raw_message: string;
  detected_name: string;
  occasion_type: OccasionType;
  occasion_label: string | null;
  detected_month: number | null;
  detected_day: number | null;
  detected_year: number | null;
  confidence: DetectionConfidence;
  matched_contact_id: number | null;
  matched_contact_name: string | null;
  match_score: number | null;
  sender_jid: string | null;
  sender_name: string | null;
  status: DetectionStatus;
  created_occasion_id: number | null;
  created_at: string;
  matched_contact: { id: number; name: string } | null;
}

export interface DetectionConfirmRequest {
  contact_id: number;
  occasion_type: OccasionType;
  month: number;
  day: number;
  year: number | null;
  label: string | null;
}

export interface OccasionKeyword {
  keyword: string;
  occasion_type: OccasionType;
  label: string | null;
}

export interface DetectionKeywords {
  ignore_keywords: string[];
  occasion_keywords: OccasionKeyword[];
}

// Profiles
export interface Profile {
  id: number;
  name: string;
  has_pin: boolean;
  wa_admin_chat_id: string | null;
  wa_admin_chat_name: string | null;
  notifications_enabled: boolean;
  created_at: string;
}

// WhatsApp Contact Sync
export interface WaSyncPreviewItem {
  phone: string;
  name: string;
  chat_id: string;
  already_exists: boolean;
  existing_contact_id: number | null;
}

export interface WaSyncImportItem {
  phone: string;
  name: string;
  chat_id: string;
  relationship: RelationshipType;
}
