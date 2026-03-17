export type RelationshipType = 'family' | 'friend' | 'colleague' | 'acquaintance' | 'other';
export type ToneType = 'warm' | 'funny' | 'formal';
export type LengthType = 'short' | 'medium' | 'long';
export type OccasionType = 'birthday' | 'anniversary' | 'custom';
export type DraftStatus = 'pending' | 'approved' | 'sent' | 'skipped';
export type TargetType = 'group' | 'individual';

export interface Contact {
  id: number;
  name: string;
  phone: string;
  relationship: RelationshipType;
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
