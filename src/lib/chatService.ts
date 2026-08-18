import { getSupabase } from './supabaseClient';
import { UserProfile, Conversation, Message, TypingEvent, PresenceState, MessageDeletion, ChatHistoryClear, Invitation } from '../types';

const STORAGE_ACTIVE_INVITE_KEY = 'two_chat_active_invite';

const activeSupabaseChannels = new Map<string, any>();
const activeLocalBroadcastChannels = new Map<string, any>();

function getLocalBroadcastChannel(conversationId: string): any {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!activeLocalBroadcastChannels.has(conversationId)) {
    try {
      const bc = new BroadcastChannel(`chat_local_${conversationId}`);
      activeLocalBroadcastChannels.set(conversationId, bc);
    } catch {
      return null;
    }
  }
  return activeLocalBroadcastChannels.get(conversationId) || null;
}

/**
 * Generate a cryptographically secure, high-entropy 64-character token
 */
export function generateSecureToken(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint8Array(32);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const buffer = new Uint8Array(32);
    globalThis.crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let token = '';
  while (token.length < 64) {
    token += Math.random().toString(36).substring(2);
  }
  return token.substring(0, 64);
}

export const DEFAULT_USER_1: UserProfile = {
  id: 'user-alex-1',
  email: 'alex@private.chat',
  display_name: 'Alex',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

export const DEFAULT_USER_2: UserProfile = {
  id: 'user-sam-2',
  email: 'sam@private.chat',
  display_name: 'Sam',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
};


async function saveProfileSafely(
  supabase: any,
  profile: { id: string; display_name: string; avatar_url?: string | null; last_seen?: string }
) {
  try {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', profile.id).maybeSingle();
    if (existing) {
      await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          avatar_url: profile.avatar_url || null,
          last_seen: profile.last_seen || new Date().toISOString(),
        })
        .eq('id', profile.id);
    } else {
      await supabase.from('profiles').insert({
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url || null,
        last_seen: profile.last_seen || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('saveProfileSafely error:', err);
  }
}

async function addMemberSafely(supabase: any, conversationId: string, userId: string) {
  try {
    const { data: existing } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('conversation_members').insert({
        conversation_id: conversationId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('addMemberSafely error:', err);
  }
}

export const ChatService = {
  // ---------------------------------------------------------------------------
  // AUTH: Get current authenticated user session & profile
  // ---------------------------------------------------------------------------
  async getCurrentUser(): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      // 1. Check if Supabase has an active session (including anonymous session)
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      // 2. Fetch profile record from public.profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        return {
          id: profile.id,
          email: user.email,
          display_name: profile.display_name || user.user_metadata?.display_name || 'User',
          avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null,
          last_seen: profile.last_seen || new Date().toISOString(),
          created_at: profile.created_at || user.created_at,
        };
      }

      // 3. Create initial profile if missing
      const defaultName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
      const defaultAvatar = user.user_metadata?.avatar_url || null;

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: defaultName,
        avatar_url: defaultAvatar,
        last_seen: new Date().toISOString(),
      });

      return {
        id: user.id,
        email: user.email,
        display_name: defaultName,
        avatar_url: defaultAvatar,
        last_seen: new Date().toISOString(),
        created_at: user.created_at,
      };
    } catch (err) {
      console.error('Error fetching current user:', err);
      return null;
    }
  },

  // ---------------------------------------------------------------------------
  // AUTH: Sign in with Email & Password (Owner)
  // ---------------------------------------------------------------------------
  async signIn(email: string, password?: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { user: null, error: 'Supabase database is not configured. Please check your project settings.' };
    }
    if (!password) {
      return { user: null, error: 'Password is required to sign in.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const profile = await this.getCurrentUser();
        return { user: profile, error: null };
      }
      return { user: null, error: 'Sign in failed.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      return { user: null, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // AUTH: Sign Up with Email & Password (Owner)
  // ---------------------------------------------------------------------------
  async signUp(email: string, password: string, displayName: string, avatarUrl?: string | null): Promise<{ user: UserProfile | null; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { user: null, error: 'Supabase database is not configured. Please check your project settings.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            avatar_url: avatarUrl || null,
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        // Upsert into profiles table
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim(),
          avatar_url: avatarUrl || null,
          last_seen: new Date().toISOString(),
        });

        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          display_name: displayName.trim(),
          avatar_url: avatarUrl || null,
          last_seen: new Date().toISOString(),
          created_at: data.user.created_at,
        };

        return { user: profile, error: null };
      }

      return { user: null, error: 'Could not create account.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      return { user: null, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // AUTH: Sign Out
  // ---------------------------------------------------------------------------
  async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_ACTIVE_INVITE_KEY);
    }
  },

  // ---------------------------------------------------------------------------
  // INVITATION SYSTEM: Lookup invitation by code
  // ---------------------------------------------------------------------------
  async getInvitationByCode(code: string): Promise<Invitation | null> {
    const cleanCode = code ? code.trim() : '';
    if (!cleanCode) return null;

    const supabase = getSupabase();
    if (!supabase) {
      if (typeof window !== 'undefined') {
        const storedSandboxInv = localStorage.getItem('two_chat_sandbox_invite_' + cleanCode);
        if (storedSandboxInv) {
          try {
            return JSON.parse(storedSandboxInv);
          } catch {
            // ignore
          }
        }
        try {
          const res = await fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_invite', code: cleanCode }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.invitation) return data.invitation;
          }
        } catch {
          // ignore
        }
      }
      return {
        id: 'inv-sandbox-' + cleanCode,
        conversation_id: 'conv-sandbox-shared',
        inviter_id: 'user-bee-simulated',
        code: cleanCode,
        is_used: false,
        used_by: null,
        participant_user_id: null,
        participant_name: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        expires_at: null,
        inviter_name: 'Bee',
      };
    }

    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', cleanCode)
        .single();

      if (error || !data) return null;

      // Lookup inviter display name
      let inviterName = 'Your Partner';
      if (data.inviter_id) {
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', data.inviter_id)
          .single();

        if (inviterProfile?.display_name) {
          inviterName = inviterProfile.display_name;
        }
      }

      return {
        id: data.id,
        conversation_id: data.conversation_id,
        inviter_id: data.inviter_id,
        code: data.code,
        is_used: data.is_used || false,
        used_by: data.used_by || null,
        participant_user_id: data.participant_user_id || null,
        participant_name: data.participant_name || null,
        revoked_at: data.revoked_at || null,
        created_at: data.created_at,
        expires_at: data.expires_at || null,
        inviter_name: inviterName,
      };
    } catch (err) {
      console.error('Error fetching invitation:', err);
      return null;
    }
  },

  // ---------------------------------------------------------------------------
  // HELPER: Ensure user profile and active conversation exist in Supabase
  // ---------------------------------------------------------------------------
  async ensureProfileAndConversation(currentUser?: UserProfile | null): Promise<{
    user: UserProfile | null;
    conversationId: string | null;
    error: { message: string; code?: string; details?: string; hint?: string } | null;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { user: null, conversationId: null, error: { message: 'Supabase database is not configured.' } };
    }

    try {
      // 1. Verify active Supabase auth session
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authUser) {
        return {
          user: null,
          conversationId: null,
          error: {
            message: 'Please sign in as the owner before generating an invitation.',
            code: authErr?.status ? String(authErr.status) : 'UNAUTHENTICATED',
            details: authErr?.message,
          },
        };
      }

      // 2. Ensure profile exists in public.profiles
      const displayName = currentUser?.display_name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Owner';
      const avatarUrl = currentUser?.avatar_url || authUser.user_metadata?.avatar_url || null;
      const now = new Date().toISOString();

      await saveProfileSafely(supabase, {
        id: authUser.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        last_seen: now,
      });

      const activeProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email,
        display_name: displayName,
        avatar_url: avatarUrl,
        last_seen: now,
        created_at: authUser.created_at,
      };

      // 3. Find existing conversation membership
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!memberErr && memberRows && memberRows.length > 0 && memberRows[0].conversation_id) {
        return { user: activeProfile, conversationId: memberRows[0].conversation_id, error: null };
      }

      // 4. If no conversation exists, create one
      const { data: newConv, error: createConvErr } = await supabase
        .from('conversations')
        .insert({
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createConvErr || !newConv) {
        console.error('Failed to create conversation:', createConvErr);
        return {
          user: activeProfile,
          conversationId: null,
          error: {
            message: createConvErr?.message || 'Failed to create conversation in database.',
            code: createConvErr?.code,
            details: createConvErr?.details,
            hint: createConvErr?.hint,
          },
        };
      }

      // 5. Add user to conversation_members
      await addMemberSafely(supabase, newConv.id, authUser.id);

      return { user: activeProfile, conversationId: newConv.id, error: null };
    } catch (err: any) {
      console.error('ensureProfileAndConversation error:', err);
      return {
        user: null,
        conversationId: null,
        error: { message: err?.message || 'Error initializing user conversation.' },
      };
    }
  },

  // ---------------------------------------------------------------------------
  // INVITATION SYSTEM: Create or retrieve active lifetime invitation
  // ---------------------------------------------------------------------------
  // Send realtime presence heartbeat to server & database
  async sendHeartbeat(userId: string, displayName?: string, avatarUrl?: string | null): Promise<void> {
    if (!userId) return;
    const now = new Date().toISOString();

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sandbox-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', userId, displayName, avatarUrl }),
        });
      } catch {
        // ignore
      }
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: now })
          .eq('id', userId);
      } catch {
        // ignore
      }
    }
  },

  async createOrGetInvitation(
    conversationId?: string | null,
    inviterId?: string | null
  ): Promise<{
    invitation: Invitation | null;
    error: { message: string; code?: string; details?: string; hint?: string } | null;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      const code = 'sandbox-invite-' + Math.random().toString(36).substring(2, 8);
      const convId = conversationId || 'conv-sandbox-shared';
      const inv: Invitation = {
        id: 'inv-' + code,
        conversation_id: convId,
        inviter_id: inviterId || 'user-bee-simulated',
        code,
        is_used: false,
        used_by: null,
        participant_user_id: null,
        participant_name: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        expires_at: null,
        inviter_name: 'Bee',
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('two_chat_sandbox_invite_' + code, JSON.stringify(inv));
        try {
          fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_invite', invitation: inv }),
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
      return { invitation: inv, error: null };
    }

    try {
      // 1. Ensure user session and conversation
      const { user: activeUser, conversationId: validConvId, error: setupErr } =
        await this.ensureProfileAndConversation(null);

      if (setupErr || !activeUser || !validConvId) {
        return {
          invitation: null,
          error: setupErr || { message: 'Conversation is not initialized.' },
        };
      }

      const effectiveConvId = (conversationId && !conversationId.startsWith('conv-')) ? conversationId : validConvId;
      const effectiveInviterId = activeUser.id;

      // 2. Check if an active, non-revoked invitation already exists
      const { data: existing, error: findErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('conversation_id', effectiveConvId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (findErr) {
        console.error('Error querying existing invitation:', {
          message: findErr.message,
          code: findErr.code,
          details: findErr.details,
          hint: findErr.hint,
        });
      }

      if (existing && existing.length > 0) {
        const inv = existing[0];
        return {
          invitation: {
            id: inv.id,
            conversation_id: inv.conversation_id,
            inviter_id: inv.inviter_id,
            code: inv.code,
            is_used: inv.is_used || false,
            used_by: inv.used_by || null,
            participant_user_id: inv.participant_user_id || null,
            participant_name: inv.participant_name || null,
            revoked_at: inv.revoked_at || null,
            created_at: inv.created_at,
            expires_at: inv.expires_at || null,
          },
          error: null,
        };
      }

      // 3. Generate new lifetime invitation
      return await this.generateNewInvitation(effectiveConvId, effectiveInviterId);
    } catch (err: any) {
      console.error('createOrGetInvitation error:', err);
      return {
        invitation: null,
        error: { message: err?.message || 'Error creating invitation.' },
      };
    }
  },

  // ---------------------------------------------------------------------------
  // INVITATION SYSTEM: Generate explicit new invitation token
  // ---------------------------------------------------------------------------
  async generateNewInvitation(
    conversationId: string,
    inviterId: string
  ): Promise<{
    invitation: Invitation | null;
    error: { message: string; code?: string; details?: string; hint?: string } | null;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { invitation: null, error: { message: 'Database not connected' } };
    }

    try {
      const now = new Date().toISOString();
      const secureToken = generateSecureToken();

      const { data: inserted, error: insertErr } = await supabase
        .from('invitations')
        .insert({
          conversation_id: conversationId,
          inviter_id: inviterId,
          code: secureToken,
          is_used: false,
          created_at: now,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        console.error('Error inserting invitation:', {
          message: insertErr?.message,
          code: insertErr?.code,
          details: insertErr?.details,
          hint: insertErr?.hint,
        });

        return {
          invitation: null,
          error: {
            message: insertErr?.message || 'Database error inserting new invitation.',
            code: insertErr?.code,
            details: insertErr?.details,
            hint: insertErr?.hint,
          },
        };
      }

      return {
        invitation: {
          id: inserted.id,
          conversation_id: inserted.conversation_id,
          inviter_id: inserted.inviter_id || inviterId,
          code: inserted.code || inserted.token || secureToken,
          is_used: false,
          used_by: null,
          participant_user_id: null,
          participant_name: null,
          revoked_at: null,
          created_at: inserted.created_at,
          expires_at: null,
        },
        error: null,
      };
    } catch (err: any) {
      console.error('Error generating new invitation:', err);
      return {
        invitation: null,
        error: {
          message: err?.message || 'Unexpected error generating invitation.',
        },
      };
    }
  },

  // ---------------------------------------------------------------------------
  // INVITATION SYSTEM: Revoke invitation
  // ---------------------------------------------------------------------------
  async revokeInvitation(invitationId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Database not connected' };

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('invitations')
        .update({ revoked_at: now })
        .eq('id', invitationId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revoke failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // INVITATION SYSTEM: Join private chat via Passwordless Invitation
  // Uses supabase.auth.signInAnonymously() — Zero email or password required!
  // ---------------------------------------------------------------------------
  async joinViaInvitation(
    inviteCode: string,
    displayName: string,
    avatarUrl?: string | null
  ): Promise<{ user: UserProfile | null; conversationId: string | null; error: string | null }> {
    const cleanCode = inviteCode.trim();
    const cleanName = displayName.trim() || 'Partner';
    const cleanAvatar = avatarUrl || null;

    const supabase = getSupabase();
    if (!supabase) {
      const invitation = await this.getInvitationByCode(cleanCode);
      const convId = invitation?.conversation_id || 'conv-sandbox-shared';
      const participantId = 'user-honey-' + Date.now();
      const participantProfile: UserProfile = {
        id: participantId,
        display_name: cleanName,
        avatar_url: cleanAvatar,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ACTIVE_INVITE_KEY, cleanCode);
        localStorage.setItem('two_chat_active_conversation_id', convId);
        localStorage.setItem('two_chat_sandbox_partner', JSON.stringify({
          id: invitation?.inviter_id || 'user-bee-simulated',
          display_name: invitation?.inviter_name || 'Bee',
          avatar_url: null,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }));
        try {
          fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set_partner',
              conversationId: convId,
              partner: participantProfile,
            }),
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
      return {
        user: participantProfile,
        conversationId: convId,
        error: null,
      };
    }

    try {
      // 1. Verify the invitation exists and is not revoked
      const invitation = await this.getInvitationByCode(cleanCode);
      if (!invitation) {
        return { user: null, conversationId: null, error: 'Invalid invitation link.' };
      }

      if (invitation.revoked_at) {
        return {
          user: null,
          conversationId: null,
          error: 'This invitation link has been revoked by the owner. Please ask for a new link.',
        };
      }

      // 2. Check if user already has an active session
      let { data: { user: currentUser } } = await supabase.auth.getUser();

      // 3. If no session exists, sign in anonymously
      if (!currentUser) {
        const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              display_name: cleanName,
              avatar_url: cleanAvatar,
            },
          },
        });

        if (anonErr || !anonData.user) {
          console.error('Anonymous sign-in error:', anonErr);
          return {
            user: null,
            conversationId: null,
            error:
              anonErr?.message ||
              'Could not authenticate as invited participant. Please check if Anonymous Sign-in is enabled in your Supabase Auth Providers.',
          };
        }

        currentUser = anonData.user;
      }

      const activeUserId = currentUser.id;
      const now = new Date().toISOString();

      // Try database claim RPC procedure if available
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('claim_or_restore_invitation', {
          p_code: cleanCode,
          p_display_name: cleanName,
          p_avatar_url: cleanAvatar,
        });

        if (!rpcErr && rpcRes && rpcRes.conversation_id) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_ACTIVE_INVITE_KEY, cleanCode);
            localStorage.setItem('two_chat_active_conversation_id', rpcRes.conversation_id);
          }
          return {
            user: {
              id: activeUserId,
              email: currentUser.email,
              display_name: cleanName,
              avatar_url: cleanAvatar,
              last_seen: now,
              created_at: currentUser.created_at,
            },
            conversationId: rpcRes.conversation_id,
            error: null,
          };
        }
      } catch (err) {
        console.warn('claim_or_restore_invitation RPC fallback:', err);
      }

      // 4. Save Participant Profile
      await saveProfileSafely(supabase, {
        id: activeUserId,
        display_name: cleanName,
        avatar_url: cleanAvatar,
        last_seen: now,
      });

      // 5. Add Participant to Conversation Members
      await addMemberSafely(supabase, invitation.conversation_id, activeUserId);

      // 6. Update Invitation status
      await supabase
        .from('invitations')
        .update({
          is_used: true,
          used_by: activeUserId,
          participant_user_id: activeUserId,
          participant_name: cleanName,
        })
        .eq('id', invitation.id);

      // 7. Store active invite token & conversation ID in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ACTIVE_INVITE_KEY, cleanCode);
        localStorage.setItem('two_chat_active_conversation_id', invitation.conversation_id);
      }

      const participantProfile: UserProfile = {
        id: activeUserId,
        email: currentUser.email,
        display_name: cleanName,
        avatar_url: cleanAvatar,
        last_seen: now,
        created_at: currentUser.created_at,
      };

      return {
        user: participantProfile,
        conversationId: invitation.conversation_id,
        error: null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join conversation';
      return { user: null, conversationId: null, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // CONVERSATION: Get or initialize private conversation & partner details
  // ---------------------------------------------------------------------------
  async getConversationDetails(currentUser: UserProfile): Promise<{
    conversation: Conversation;
    partner: UserProfile | null;
    invitation: Invitation | null;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      let partner: UserProfile | null = null;
      const convId = typeof window !== 'undefined'
        ? localStorage.getItem('two_chat_active_conversation_id') || 'conv-sandbox-shared'
        : 'conv-sandbox-shared';

      if (typeof window !== 'undefined') {
        const storedPartner = localStorage.getItem('two_chat_sandbox_partner');
        if (storedPartner) {
          try {
            partner = JSON.parse(storedPartner);
          } catch {
            // ignore
          }
        }

        try {
          const res = await fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register_user', user: currentUser, currentUserId: currentUser.id, conversationId: convId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.partner && data.partner.id !== currentUser.id) {
              partner = data.partner;
              localStorage.setItem('two_chat_sandbox_partner', JSON.stringify(partner));
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        conversation: { id: convId, created_at: new Date().toISOString() },
        partner,
        invitation: null,
      };
    }

    try {
      let convId: string | null = null;

      // 1. FIRST PRIORITY: Find any 2-person conversation where currentUser AND a second user are members!
      const { data: userMemberRows } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

      if (userMemberRows && userMemberRows.length > 0) {
        const userConvIds = userMemberRows.map((r: any) => r.conversation_id);
        const { data: sharedMemberRows } = await supabase
          .from('conversation_members')
          .select('conversation_id, created_at')
          .in('conversation_id', userConvIds)
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (sharedMemberRows && sharedMemberRows.length > 0) {
          convId = sharedMemberRows[0].conversation_id;
        }
      }

      // 2. SECOND PRIORITY: Check any active invitation created in the database
      if (!convId) {
        const { data: invRows } = await supabase
          .from('invitations')
          .select('conversation_id')
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (invRows && invRows.length > 0 && invRows[0].conversation_id) {
          convId = invRows[0].conversation_id;
          await addMemberSafely(supabase, convId, currentUser.id);
        }
      }

      // 3. THIRD PRIORITY: Active stored conversation ID in localStorage
      if (!convId) {
        const activeConvId = typeof window !== 'undefined' ? localStorage.getItem('two_chat_active_conversation_id') : null;
        if (activeConvId) {
          const { data: checkMember } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', activeConvId)
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (checkMember) {
            convId = activeConvId;
          }
        }
      }

      // 3. THIRD PRIORITY: Latest conversation member row for user
      if (!convId) {
        const { data: memberRows, error: memberErr } = await supabase
          .from('conversation_members')
          .select('conversation_id, created_at')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!memberErr && memberRows && memberRows.length > 0) {
          convId = memberRows[0].conversation_id;
        } else {
          // Create new conversation
          const { data: newConv, error: createConvErr } = await supabase
            .from('conversations')
            .insert({
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!createConvErr && newConv) {
            convId = newConv.id;
            await supabase.from('conversation_members').insert({
              conversation_id: convId,
              user_id: currentUser.id,
            });
          }
        }
      }

      if (convId && typeof window !== 'undefined') {
        localStorage.setItem('two_chat_active_conversation_id', convId);
      }

      if (!convId) {
        return {
          conversation: { id: 'conv-fallback', created_at: new Date().toISOString() },
          partner: null,
          invitation: null,
        };
      }

      // 3. Fetch conversation row
      const { data: convRow } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .single();

      // 4. Find the second member (partner)
      const { data: otherMembers } = await supabase
        .from('conversation_members')
        .select('user_id, profiles(*)')
        .eq('conversation_id', convId)
        .neq('user_id', currentUser.id)
        .limit(1);

      let partner: UserProfile | null = null;

      if (otherMembers && otherMembers.length > 0) {
        const row = otherMembers[0];
        const rawP = row.profiles;
        const p = Array.isArray(rawP) ? rawP[0] : rawP;
        if (p && p.id) {
          partner = {
            id: p.id,
            display_name: p.display_name || 'Partner',
            avatar_url: p.avatar_url || null,
            last_seen: p.last_seen || null,
            created_at: p.created_at || new Date().toISOString(),
          };
        } else if (row.user_id) {
          // Direct fallback query for profile
          const { data: pDirect } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', row.user_id)
            .single();

          if (pDirect) {
            partner = {
              id: pDirect.id,
              display_name: pDirect.display_name || 'Partner',
              avatar_url: pDirect.avatar_url || null,
              last_seen: pDirect.last_seen || null,
              created_at: pDirect.created_at || new Date().toISOString(),
            };
          }
        }
      }

      // Enforce permanent partner naming (Bee <-> Honey)
      const isBeeUser = (currentUser.display_name || '').toLowerCase().includes('bee');
      const expectedPartnerName = isBeeUser ? 'Honey' : 'Bee';
      const expectedPartnerId = isBeeUser ? 'user-honey-simulated' : 'user-bee-simulated';

      if (partner) {
        partner = {
          ...partner,
          display_name: expectedPartnerName,
          is_online: true,
          last_seen: new Date().toISOString(),
        };
      } else {
        partner = {
          id: expectedPartnerId,
          display_name: expectedPartnerName,
          avatar_url: null,
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      }

      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_partner', currentUserId: currentUser.id, displayName: currentUser.display_name, conversationId: convId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.partner && data.partner.id !== currentUser.id) {
              const sandboxOnline = Boolean(data.partner.is_online);
              partner = {
                ...(partner || data.partner),
                display_name: expectedPartnerName,
                is_online: Boolean(partner?.is_online || sandboxOnline || true),
                last_seen: new Date().toISOString(),
              };
            }
          }
        } catch {
          // ignore
        }
      }

      // 5. Create or retrieve active lifetime invitation link
      const { invitation } = await this.createOrGetInvitation(convId, currentUser.id);

      return {
        conversation: {
          id: convId,
          created_at: convRow?.created_at || new Date().toISOString(),
          updated_at: convRow?.updated_at,
          cleared_for_everyone_at: convRow?.cleared_for_everyone_at || null,
        },
        partner,
        invitation,
      };
    } catch (err) {
      console.error('Error fetching conversation details:', err);
      return {
        conversation: { id: 'conv-error', created_at: new Date().toISOString() },
        partner: null,
        invitation: null,
      };
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Fetch messages from Supabase PostgreSQL
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // MESSAGES: Fetch messages from Supabase PostgreSQL or Sandbox Cache
  // ---------------------------------------------------------------------------
  async getMessages(
    conversationId: string,
    currentUserId: string,
    limit: number = 50,
    beforeCreatedAt?: string
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const supabase = getSupabase();
    if (!supabase) {
      if (typeof window !== 'undefined') {
        const cacheKey = `two_chat_sandbox_msgs_${conversationId}`;
        const existing = localStorage.getItem(cacheKey);
        let msgs: Message[] = existing ? JSON.parse(existing) : [];

        try {
          const res = await fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_messages', conversationId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.messages && Array.isArray(data.messages)) {
              const map = new Map<string, Message>();
              msgs.forEach((m) => map.set(m.id, m));
              data.messages.forEach((m: Message) => map.set(m.id, m));
              msgs = Array.from(map.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              localStorage.setItem(cacheKey, JSON.stringify(msgs));
            }
          }
        } catch {
          // ignore
        }

        return { messages: msgs, hasMore: false };
      }
      return { messages: [], hasMore: false };
    }

    try {
      // 1. Fetch user's chat_history_clears record ("Clear history for me")
      const { data: clearRecord } = await supabase
        .from('chat_history_clears')
        .select('cleared_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .single();

      // 2. Fetch conversation's cleared_for_everyone_at ("Clear history for everyone")
      const { data: convRecord } = await supabase
        .from('conversations')
        .select('cleared_for_everyone_at')
        .eq('id', conversationId)
        .single();

      // 3. Fetch deleted message IDs for current user ("Delete for me")
      const { data: userDeletions } = await supabase
        .from('message_deletions')
        .select('message_id')
        .eq('user_id', currentUserId);

      const deletedIds = new Set((userDeletions || []).map((d: any) => d.message_id));

      // 4. Query messages
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (beforeCreatedAt) {
        query = query.lt('created_at', beforeCreatedAt);
      }

      if (clearRecord?.cleared_at) {
        query = query.gt('created_at', clearRecord.cleared_at);
      }

      if (convRecord?.cleared_for_everyone_at) {
        query = query.gt('created_at', convRecord.cleared_for_everyone_at);
      }

      const { data, error } = await query;
      let dbMsgs: Message[] = [];
      if (!error && data) {
        const visibleData = data.filter((m: any) => !deletedIds.has(m.id));
        const sliced = visibleData.length > limit ? visibleData.slice(0, limit) : visibleData;
        dbMsgs = sliced.reverse().map((m: any) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          content: m.is_deleted_for_everyone ? 'This message was deleted' : m.content,
          image_url: m.is_deleted_for_everyone ? null : m.image_url,
          created_at: m.created_at,
          updated_at: m.updated_at,
          is_read: m.is_read,
          read_at: m.read_at,
          is_edited: m.is_edited || false,
          is_deleted_for_everyone: m.is_deleted_for_everyone || false,
          deleted_for_everyone_at: m.deleted_for_everyone_at || null,
          status: m.is_read ? 'read' : 'sent',
        }));
      }

      // Merge with dev relay messages for local testing
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_messages', conversationId }),
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData.messages && Array.isArray(resData.messages)) {
              const map = new Map<string, Message>();
              dbMsgs.forEach((m) => map.set(m.id, m));
              resData.messages.forEach((m: Message) => map.set(m.id, m));
              dbMsgs = Array.from(map.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            }
          }
        } catch {
          // ignore
        }
      }

      return { messages: dbMsgs, hasMore: false };
    } catch (err) {
      console.error('Failed to get messages:', err);
      return { messages: [], hasMore: false };
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Send message with instant Realtime Broadcast & DB Persistence
  // ---------------------------------------------------------------------------
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    imageUrl?: string | null,
    messageId?: string,
    audioUrl?: string | null,
    audioDuration?: number | null
  ): Promise<Message> {
    const assignedId =
      messageId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    const now = new Date().toISOString();
    const newMessage: Message = {
      id: assignedId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim() || (audioUrl ? '🎙️ Voice Message' : ''),
      image_url: imageUrl || null,
      audio_url: audioUrl || null,
      audio_duration: audioDuration || null,
      created_at: now,
      is_read: false,
      is_edited: false,
      is_deleted_for_everyone: false,
      status: 'sent',
    };

    // 1. Broadcast via local BroadcastChannel (cross-tab / same device)
    const localBc = getLocalBroadcastChannel(conversationId);
    if (localBc) {
      try {
        localBc.postMessage({ type: 'new_message', message: newMessage });
      } catch (err) {
        console.warn('Local broadcast error:', err);
      }
    }

    // 2. Broadcast via active Supabase Realtime channel (sub-100ms instant delivery)
    const activeChan = activeSupabaseChannels.get(conversationId);
    if (activeChan) {
      try {
        activeChan.send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMessage,
        });
      } catch (err) {
        console.warn('Realtime channel broadcast error:', err);
      }
    }

    // Always post to local dev server relay for cross-browser / Incognito sync on localhost
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/sandbox-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_message', conversationId, message: newMessage }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }

    const supabase = getSupabase();
    if (!supabase) {
      if (typeof window !== 'undefined') {
        const cacheKey = `two_chat_sandbox_msgs_${conversationId}`;
        const existing = localStorage.getItem(cacheKey);
        const msgs: Message[] = existing ? JSON.parse(existing) : [];
        if (!msgs.some((m) => m.id === newMessage.id)) {
          msgs.push(newMessage);
          localStorage.setItem(cacheKey, JSON.stringify(msgs));
        }

        try {
          fetch('/api/sandbox-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_message', conversationId, message: newMessage }),
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
      return newMessage;
    }

    try {
      let finalSenderId = newMessage.sender_id;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id) {
        finalSenderId = authUser.id;
      }

      const insertPayload: any = {
        id: newMessage.id,
        conversation_id: newMessage.conversation_id,
        sender_id: finalSenderId,
        content: newMessage.content,
        image_url: newMessage.image_url,
        created_at: newMessage.created_at,
        is_read: false,
        is_edited: false,
        is_deleted_for_everyone: false,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Supabase error inserting message:', error);
        return newMessage;
      }

      const savedMessage: Message = {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        content: data.content,
        image_url: data.image_url,
        audio_url: data.audio_url || newMessage.audio_url,
        audio_duration: data.audio_duration || newMessage.audio_duration,
        created_at: data.created_at,
        is_read: data.is_read,
        is_edited: data.is_edited || false,
        is_deleted_for_everyone: data.is_deleted_for_everyone || false,
        status: 'sent',
      };

      if (activeChan) {
        try {
          activeChan.send({
            type: 'broadcast',
            event: 'new_message',
            payload: savedMessage,
          });
        } catch {
          // ignore
        }
      }

      return savedMessage;
    } catch (err) {
      console.error('Error in sendMessage:', err);
      return newMessage;
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Edit message (Sender only)
  // ---------------------------------------------------------------------------
  async editMessage(
    messageId: string,
    conversationId: string,
    senderId: string,
    newContent: string
  ): Promise<{ message: Message | null; error: string | null }> {
    const trimmed = newContent.trim();
    if (!trimmed) {
      return { message: null, error: 'Message content cannot be empty.' };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return { message: null, error: 'Database not connected.' };
    }

    const now = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          content: trimmed,
          is_edited: true,
          updated_at: now,
        })
        .eq('id', messageId)
        .eq('sender_id', senderId)
        .select()
        .single();

      if (error) {
        return { message: null, error: error.message };
      }

      if (data) {
        const updatedMsg: Message = {
          id: data.id,
          conversation_id: data.conversation_id,
          sender_id: data.sender_id,
          content: data.content,
          image_url: data.image_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
          is_read: data.is_read,
          read_at: data.read_at,
          is_edited: true,
          is_deleted_for_everyone: data.is_deleted_for_everyone || false,
          status: data.is_read ? 'read' : 'sent',
        };
        return { message: updatedMsg, error: null };
      }

      return { message: null, error: 'Could not update message.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Edit failed';
      return { message: null, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Delete for me
  // ---------------------------------------------------------------------------
  async deleteMessageForMe(
    messageId: string,
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: true, error: null };

    try {
      const { error } = await supabase
        .from('message_deletions')
        .insert({
          message_id: messageId,
          user_id: userId,
          deleted_at: new Date().toISOString(),
        });

      if (error && !error.message.includes('duplicate key')) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Undo Delete for me
  // ---------------------------------------------------------------------------
  async undoDeleteMessageForMe(
    messageId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: true, error: null };

    try {
      const { error } = await supabase
        .from('message_deletions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Undo failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // MESSAGES: Delete for everyone (Sender only)
  // ---------------------------------------------------------------------------
  async deleteMessageForEveryone(
    messageId: string,
    conversationId: string,
    senderId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: true, error: null };

    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: 'This message was deleted',
          image_url: null,
          is_deleted_for_everyone: true,
          deleted_for_everyone_at: now,
          updated_at: now,
        })
        .eq('id', messageId)
        .eq('sender_id', senderId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete for everyone failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // CHAT HISTORY: Clear for me
  // ---------------------------------------------------------------------------
  async clearChatHistoryForMe(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: true, error: null };

    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('chat_history_clears')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            cleared_at: now,
          },
          { onConflict: 'conversation_id,user_id' }
        );

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clear history failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // CHAT HISTORY: Clear for everyone (Both users)
  // ---------------------------------------------------------------------------
  async clearChatHistoryForEveryone(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) return { success: true, error: null };

    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          cleared_for_everyone_at: now,
          updated_at: now,
        })
        .eq('id', conversationId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clear for everyone failed';
      return { success: false, error: msg };
    }
  },

  // ---------------------------------------------------------------------------
  // READ RECEIPTS: Mark messages as read
  // ---------------------------------------------------------------------------
  async markMessagesAsRead(conversationId: string, recipientId: string): Promise<void> {
    const localBc = getLocalBroadcastChannel(conversationId);
    if (localBc) {
      try {
        localBc.postMessage({ type: 'messages_read', recipient_id: recipientId });
      } catch {
        // ignore
      }
    }

    const activeChan = activeSupabaseChannels.get(conversationId);
    if (activeChan) {
      try {
        activeChan.send({
          type: 'broadcast',
          event: 'messages_read',
          payload: { recipient_id: recipientId },
        });
      } catch {
        // ignore
      }
    }

    const supabase = getSupabase();
    if (!supabase) return;

    const now = new Date().toISOString();
    try {
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: now })
        .eq('conversation_id', conversationId)
        .neq('sender_id', recipientId)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // STORAGE: Upload Image Attachment
  // ---------------------------------------------------------------------------
  async readAndCompressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.8): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((e.target?.result as string) || '');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve((e.target?.result as string) || '');
        };
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => {
        resolve('');
      };
      reader.readAsDataURL(file);
    });
  },

  // ---------------------------------------------------------------------------
  // STORAGE: Upload Image Attachment
  // ---------------------------------------------------------------------------
  async uploadImage(file: File, userId: string): Promise<string> {
    const compressedBase64 = await this.readAndCompressImage(file);
    const supabase = getSupabase();
    if (supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('chat_attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage.from('chat_attachments').getPublicUrl(data.path);
          if (publicData?.publicUrl) {
            try {
              const testRes = await fetch(publicData.publicUrl, { method: 'HEAD' });
              if (testRes.ok) return publicData.publicUrl;
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.warn('Storage upload exception, using Base64 data:', err);
      }
    }

    return compressedBase64;
  },

  // ---------------------------------------------------------------------------
  // PROFILE: Update profile
  // ---------------------------------------------------------------------------
  async updateProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    const supabase = getSupabase();
    const updatedName = profile.display_name?.trim() || 'User';
    const updatedAvatar = profile.avatar_url || null;
    const now = new Date().toISOString();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            display_name: updatedName,
            avatar_url: updatedAvatar,
            last_seen: now,
          })
          .eq('id', profile.id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            last_seen: data.last_seen,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.error('Error updating profile in Supabase:', err);
      }
    }

    return {
      id: profile.id,
      display_name: updatedName,
      avatar_url: updatedAvatar,
      last_seen: now,
      created_at: profile.created_at || now,
    };
  },

  // ---------------------------------------------------------------------------
  // REALTIME: Broadcast Typing Indicator
  // ---------------------------------------------------------------------------
  broadcastTyping(userId: string, displayName: string, isTyping: boolean, conversationId: string) {
    const payload = { user_id: userId, display_name: displayName, is_typing: isTyping, timestamp: Date.now() };

    const localBc = getLocalBroadcastChannel(conversationId);
    if (localBc) {
      try {
        localBc.postMessage({ type: 'typing', payload });
      } catch {
        // ignore
      }
    }

    const activeChan = activeSupabaseChannels.get(conversationId);
    if (activeChan) {
      try {
        activeChan.send({
          type: 'broadcast',
          event: 'typing',
          payload,
        });
      } catch (err) {
        console.error('Broadcast typing error:', err);
      }
    }
  },

  // ---------------------------------------------------------------------------
  // REALTIME: Subscribe to Supabase Postgres Changes & Broadcasts
  // ---------------------------------------------------------------------------
  subscribeToConversation(
    conversationId: string,
    currentUserId: string,
    callbacks: {
      onNewMessage: (msg: Message) => void;
      onMessageUpdated: (msg: Message) => void;
      onMessageDeletedForMe: (messageId: string) => void;
      onMessageRestoredForMe: (messageId: string) => void;
      onHistoryCleared: () => void;
      onMessagesRead: (event: any) => void;
      onTyping: (event: TypingEvent) => void;
      onPresence: (state: PresenceState) => void;
      onMemberJoined?: () => void;
    }
  ) {
    // 1. Listen for local BroadcastChannel messages (cross-tab / same machine)
    const localBc = getLocalBroadcastChannel(conversationId);
    if (localBc) {
      localBc.onmessage = (event: any) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'new_message' && data.message) {
          callbacks.onNewMessage(data.message);
        } else if (data.type === 'message_updated' && data.message) {
          callbacks.onMessageUpdated(data.message);
        } else if (data.type === 'messages_read') {
          callbacks.onMessagesRead(data);
        } else if (data.type === 'typing' && data.payload) {
          if (data.payload.user_id !== currentUserId) {
            callbacks.onTyping(data.payload);
          }
        }
      };
    }

    const supabase = getSupabase();
    if (!supabase) return () => {};

    let supabaseChannel: any = null;

    try {
      supabaseChannel = supabase
        .channel(`chat:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload: any) => {
            const raw = payload.new;
            if (!raw) return;
            callbacks.onNewMessage({
              id: raw.id,
              conversation_id: raw.conversation_id,
              sender_id: raw.sender_id,
              content: raw.is_deleted_for_everyone ? 'This message was deleted' : raw.content,
              image_url: raw.is_deleted_for_everyone ? null : raw.image_url,
              created_at: raw.created_at,
              updated_at: raw.updated_at,
              is_read: raw.is_read,
              read_at: raw.read_at,
              is_edited: raw.is_edited || false,
              is_deleted_for_everyone: raw.is_deleted_for_everyone || false,
              deleted_for_everyone_at: raw.deleted_for_everyone_at || null,
              status: raw.is_read ? 'read' : 'sent',
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload: any) => {
            const raw = payload.new;
            if (!raw) return;
            callbacks.onMessageUpdated({
              id: raw.id,
              conversation_id: raw.conversation_id,
              sender_id: raw.sender_id,
              content: raw.is_deleted_for_everyone ? 'This message was deleted' : raw.content,
              image_url: raw.is_deleted_for_everyone ? null : raw.image_url,
              created_at: raw.created_at,
              updated_at: raw.updated_at,
              is_read: raw.is_read,
              read_at: raw.read_at,
              is_edited: raw.is_edited || false,
              is_deleted_for_everyone: raw.is_deleted_for_everyone || false,
              deleted_for_everyone_at: raw.deleted_for_everyone_at || null,
              status: raw.is_read ? 'read' : 'sent',
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'message_deletions', filter: `user_id=eq.${currentUserId}` },
          (payload: any) => {
            if (payload.new?.message_id) {
              callbacks.onMessageDeletedForMe(payload.new.message_id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
          () => {
            callbacks.onHistoryCleared();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_history_clears', filter: `conversation_id=eq.${conversationId}` },
          (payload: any) => {
            if (payload.new?.user_id === currentUserId) {
              callbacks.onHistoryCleared();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (callbacks.onMemberJoined) {
              callbacks.onMemberJoined();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'invitations', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (callbacks.onMemberJoined) {
              callbacks.onMemberJoined();
            }
          }
        )
        .on('broadcast', { event: 'new_message' }, (payload: any) => {
          if (payload.payload) {
            callbacks.onNewMessage(payload.payload);
          }
        })
        .on('broadcast', { event: 'message_updated' }, (payload: any) => {
          if (payload.payload) {
            callbacks.onMessageUpdated(payload.payload);
          }
        })
        .on('broadcast', { event: 'messages_read' }, (payload: any) => {
          callbacks.onMessagesRead(payload.payload);
        })
        .on('broadcast', { event: 'typing' }, (payload: any) => {
          if (payload.payload?.user_id !== currentUserId) {
            callbacks.onTyping(payload.payload);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const presenceState = supabaseChannel.presenceState();
          let partnerOnline = false;
          Object.values(presenceState).forEach((presences: any) => {
            presences.forEach((p: any) => {
              if (p.user_id && p.user_id !== currentUserId) {
                partnerOnline = true;
              }
            });
          });
          callbacks.onPresence({ user_id: 'partner', is_online: partnerOnline, online_at: new Date().toISOString() });
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await supabaseChannel.track({
              user_id: currentUserId,
              online_at: new Date().toISOString(),
            });
          }
        });

      activeSupabaseChannels.set(conversationId, supabaseChannel);
    } catch (err) {
      console.error('Subscription error:', err);
    }

    return () => {
      activeSupabaseChannels.delete(conversationId);
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  },
};
