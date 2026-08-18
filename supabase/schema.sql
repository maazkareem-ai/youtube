-- =========================================================================
-- PRIVATE TWO-PERSON REAL-TIME CHAT - SUPABASE DATABASE SCHEMA & RLS POLICIES
-- =========================================================================
-- This script creates all required PostgreSQL tables, indexes, Row Level
-- Security (RLS) policies, triggers, and storage bucket permissions for a
-- secure, private two-person real-time messaging application.
-- =========================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- -------------------------------------------------------------------------
-- 2. CONVERSATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  cleared_for_everyone_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- -------------------------------------------------------------------------
-- 3. CONVERSATION MEMBERS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation ON public.conversation_members(conversation_id);

-- -------------------------------------------------------------------------
-- 4. MESSAGES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_edited BOOLEAN DEFAULT false NOT NULL,
  is_deleted_for_everyone BOOLEAN DEFAULT false NOT NULL,
  deleted_for_everyone_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(is_read);

-- -------------------------------------------------------------------------
-- 5. MESSAGE DELETIONS TABLE ("Delete for me")
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_deletions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_user_message_deletion UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON public.message_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_deletions_message ON public.message_deletions(message_id);

-- -------------------------------------------------------------------------
-- 6. CHAT HISTORY CLEARS TABLE ("Clear history for me")
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_history_clears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_user_conversation_clear UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_history_clears_user ON public.chat_history_clears(conversation_id, user_id);

-- -------------------------------------------------------------------------
-- 7. AUTOMATIC PROFILE CREATION TRIGGER
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history_clears ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Conversations Policies
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Members can update conversation clear marker"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- Conversation Members Policies
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can add conversation members"
  ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update conversation members"
  ON public.conversation_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Messages Policies
CREATE POLICY "Members can read messages in their conversations"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert messages to their conversations"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can edit or delete for everyone own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Message Deletions Policies ("Delete for me")
CREATE POLICY "Users can view their own message deletions"
  ON public.message_deletions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own message deletions"
  ON public.message_deletions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message deletions (undo)"
  ON public.message_deletions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Chat History Clears Policies ("Clear history for me")
CREATE POLICY "Users can view their own chat history clears"
  ON public.chat_history_clears FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history clears"
  ON public.chat_history_clears FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat history clears"
  ON public.chat_history_clears FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 9. STORAGE BUCKET FOR ATTACHMENTS
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_attachments');

CREATE POLICY "Authenticated users can view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat_attachments');

-- -------------------------------------------------------------------------
-- 10. INVITATIONS TABLE (Lifetime One-Click Invite System)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false NOT NULL,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_name TEXT DEFAULT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_conversation ON public.invitations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code_revoked ON public.invitations(code, revoked_at);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow public read of active invitations by code for accepting
CREATE POLICY "Public can view valid invitation by code"
  ON public.invitations FOR SELECT
  USING (true);

-- Authenticated users can create invitations for their conversations
CREATE POLICY "Members can create invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = invitations.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- Authenticated users or invited users can update invitation status
CREATE POLICY "Users can update invitation upon accepting"
  ON public.invitations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 11. REALTIME PUBLICATION
-- -------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deletions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_history_clears;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;

-- -------------------------------------------------------------------------
-- 12. HELPER STORED PROCEDURE: GET OR CREATE TWO-PERSON CONVERSATION
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_private_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_members m1 ON c.id = m1.conversation_id AND m1.user_id = user_a
  JOIN public.conversation_members m2 ON c.id = m2.conversation_id AND m2.user_id = user_b
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES 
      (conv_id, user_a),
      (conv_id, user_b);
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 13. HELPER STORED PROCEDURE: CLAIM OR RESTORE INVITATION
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_or_restore_invitation(
  p_code TEXT,
  p_display_name TEXT,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_conv_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE code = TRIM(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has been revoked by the owner';
  END IF;

  v_conv_id := v_invitation.conversation_id;

  -- Upsert participant profile
  INSERT INTO public.profiles (id, display_name, avatar_url, last_seen)
  VALUES (
    v_user_id,
    COALESCE(TRIM(p_display_name), 'Partner'),
    p_avatar_url,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    last_seen = NOW();

  -- Add to conversation members
  INSERT INTO public.conversation_members (conversation_id, user_id, created_at)
  VALUES (v_conv_id, v_user_id, NOW())
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Update invitation with participant metadata
  UPDATE public.invitations
  SET
    is_used = true,
    used_by = v_user_id,
    participant_user_id = v_user_id,
    participant_name = COALESCE(TRIM(p_display_name), participant_name)
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', v_conv_id,
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
