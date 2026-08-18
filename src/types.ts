export interface UserProfile {
  id: string;
  email?: string;
  display_name: string;
  avatar_url: string | null;
  last_seen: string | null;
  is_online?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at?: string;
  cleared_for_everyone_at?: string | null;
  members?: UserProfile[];
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_duration?: number | null;
  created_at: string;
  updated_at?: string | null;
  is_read: boolean;
  read_at?: string | null;
  is_edited?: boolean;
  is_deleted_for_everyone?: boolean;
  deleted_for_everyone_at?: string | null;
  status?: 'sending' | 'sent' | 'read' | 'failed';
}

export interface MessageDeletion {
  id: string;
  message_id: string;
  user_id: string;
  deleted_at: string;
}

export interface ChatHistoryClear {
  id: string;
  conversation_id: string;
  user_id: string;
  cleared_at: string;
}

export interface TypingEvent {
  user_id: string;
  display_name: string;
  is_typing: boolean;
  timestamp: number;
}

export interface PresenceState {
  user_id: string;
  online_at: string;
  is_online: boolean;
}

export type AppTheme = 'light' | 'dark' | 'system';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export interface Invitation {
  id: string;
  conversation_id: string;
  inviter_id: string;
  code: string;
  is_used: boolean;
  used_by?: string | null;
  participant_user_id?: string | null;
  participant_name?: string | null;
  revoked_at?: string | null;
  created_at: string;
  expires_at?: string | null;
  inviter_name?: string;
}

