-- =========================================================================
-- MIGRATION: 20260817_invitations.sql
-- Adds Invitations Table for One-Click Invite Links (No email required for 2nd user)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false NOT NULL,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days') NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_conversation ON public.invitations(conversation_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow public read of active invitations by code for accepting
DROP POLICY IF EXISTS "Public can view valid invitation by code" ON public.invitations;
CREATE POLICY "Public can view valid invitation by code"
  ON public.invitations FOR SELECT
  USING (true);

-- Authenticated users can create invitations for their conversations
DROP POLICY IF EXISTS "Members can create invitations" ON public.invitations;
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

-- Users can update invitation upon accepting
DROP POLICY IF EXISTS "Users can update invitation upon accepting" ON public.invitations;
CREATE POLICY "Users can update invitation upon accepting"
  ON public.invitations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
