-- =========================================================================
-- MIGRATION: 20260817_lifetime_invitations.sql
-- Upgrades Invitation System to Lifetime Revocable Tokens with Anonymous Support
-- =========================================================================

-- 1. Ensure invitations table has lifetime & revocation columns
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS participant_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ALTER COLUMN expires_at DROP NOT NULL;

-- Set expires_at to NULL for all invitations (lifetime until revoked)
UPDATE public.invitations SET expires_at = NULL WHERE expires_at IS NOT NULL;

-- 2. Indexes for fast code lookup & active state
CREATE INDEX IF NOT EXISTS idx_invitations_code_revoked ON public.invitations(code, revoked_at);
CREATE INDEX IF NOT EXISTS idx_invitations_conversation_active ON public.invitations(conversation_id, revoked_at);

-- 3. Row Level Security Policies for Invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view valid invitation by code" ON public.invitations;
CREATE POLICY "Public can view valid invitation by code"
  ON public.invitations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Members can create invitations" ON public.invitations;
CREATE POLICY "Members can create invitations"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = invitations.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invitation upon accepting or revoking" ON public.invitations;
CREATE POLICY "Users can update invitation upon accepting or revoking"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Secure RPC function to Claim or Restore Invitation
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
  v_existing_member_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find the active invitation
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

  -- 2. Upsert profile for current participant
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

  -- 3. Add user to conversation_members (if not already member)
  INSERT INTO public.conversation_members (conversation_id, user_id, created_at)
  VALUES (v_conv_id, v_user_id, NOW())
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- 4. Mark invitation as claimed with participant details
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
