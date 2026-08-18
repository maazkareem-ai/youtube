-- =========================================================================
-- MIGRATION: 20260817_message_management.sql
-- Adds Message Editing, "Delete for me", "Delete for everyone",
-- and Chat History Clearing ("Clear for me" & "Clear for everyone")
-- with PostgreSQL Row Level Security (RLS) enforcement.
-- =========================================================================

-- 1. Extend messages table with edit & delete for everyone flags
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Extend conversations table with cleared_for_everyone_at flag
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS cleared_for_everyone_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Create message_deletions table ("Delete for me")
CREATE TABLE IF NOT EXISTS public.message_deletions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_user_message_deletion UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON public.message_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_deletions_message ON public.message_deletions(message_id);

-- 4. Create chat_history_clears table ("Clear history for me")
CREATE TABLE IF NOT EXISTS public.chat_history_clears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_user_conversation_clear UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_history_clears_user ON public.chat_history_clears(conversation_id, user_id);

-- 5. Enable RLS on newly created tables
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history_clears ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for message_deletions
CREATE POLICY "Users can view their own message deletions"
  ON public.message_deletions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own message deletions"
  ON public.message_deletions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message deletions (undo)"
  ON public.message_deletions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. RLS Policies for chat_history_clears
CREATE POLICY "Users can view their own chat history clears"
  ON public.chat_history_clears
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history clears"
  ON public.chat_history_clears
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat history clears"
  ON public.chat_history_clears
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Enhanced RLS Policies for messages table
-- Drop older broad update policy to replace with granular sender/recipient policies
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Senders can edit or delete for everyone own messages" ON public.messages;

-- Policy A: Senders can update their own messages (edit text, delete for everyone)
CREATE POLICY "Senders can edit or delete for everyone own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Policy B: Conversation members can update read status
CREATE POLICY "Recipients can mark messages as read"
  ON public.messages
  FOR UPDATE
  TO authenticated
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

-- 9. RLS Policy for updating conversation cleared_for_everyone_at
DROP POLICY IF EXISTS "Members can update conversation clear marker" ON public.conversations;
CREATE POLICY "Members can update conversation clear marker"
  ON public.conversations
  FOR UPDATE
  TO authenticated
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

-- 10. Add newly created tables to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deletions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_history_clears;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
