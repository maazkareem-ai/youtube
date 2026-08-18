import React, { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, X, ShieldCheck, Heart, Sparkles, Share2, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';
import { Invitation } from '../../types';
import { ChatService } from '../../lib/chatService';

interface InvitePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitation: Invitation | null;
  conversationId: string;
  currentUserId?: string;
  onInvitationUpdated?: (newInvitation: Invitation) => void;
}

interface DetailedError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export const InvitePartnerModal: React.FC<InvitePartnerModalProps> = ({
  isOpen,
  onClose,
  invitation,
  conversationId,
  currentUserId,
  onInvitationUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [currentInv, setCurrentInv] = useState<Invitation | null>(invitation);
  const [errorDetails, setErrorDetails] = useState<DetailedError | null>(null);

  // Sync state when prop changes
  useEffect(() => {
    setCurrentInv(invitation);
  }, [invitation]);

  // Auto-generate or fetch invitation if missing when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    if (!currentInv?.code || currentInv.code === 'undefined' || currentInv.code === 'null') {
      setIsGenerating(true);
      setErrorDetails(null);
      (async () => {
        try {
          const activeUser = currentUserId || (await ChatService.getCurrentUser())?.id;
          const { invitation: inv, error: fetchErr } = await ChatService.createOrGetInvitation(
            conversationId,
            activeUser
          );

          if (inv && inv.code) {
            setCurrentInv(inv);
            if (onInvitationUpdated) onInvitationUpdated(inv);
          } else if (fetchErr) {
            setErrorDetails(fetchErr);
          } else {
            setErrorDetails({ message: 'Unable to generate invitation link. Please check your connection and try again.' });
          }
        } catch (err: any) {
          console.error('Failed to load invitation:', err);
          setErrorDetails({ message: err?.message || 'Unable to generate invitation link. Please try again.' });
        } finally {
          setIsGenerating(false);
        }
      })();
    }
  }, [isOpen, conversationId, currentUserId, currentInv?.code, onInvitationUpdated]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteToken = currentInv?.code?.trim() || '';
  const isValidToken = Boolean(
    inviteToken &&
    inviteToken !== 'undefined' &&
    inviteToken !== 'null' &&
    inviteToken.length >= 8
  );

  // Strictly build valid URL with non-empty high-entropy token
  const inviteUrl = isValidToken ? `${origin}/?invite=${encodeURIComponent(inviteToken)}` : '';

  const handleCopy = async () => {
    setErrorDetails(null);
    if (!isValidToken || !inviteToken || !inviteUrl) {
      setErrorDetails({ message: 'Unable to generate invitation link. Please try again.' });
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err: any) {
      console.error('Failed to copy invite URL:', err);
      setErrorDetails({ message: 'Failed to copy link to clipboard.' });
    }
  };

  const handleShare = async () => {
    setErrorDetails(null);
    if (!isValidToken || !inviteToken || !inviteUrl) {
      setErrorDetails({ message: 'Unable to generate invitation link. Please try again.' });
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Chapiii ❤️',
          text: 'Join my private, secure 2-person chat channel:',
          url: inviteUrl,
        });
      } catch (err) {
        // Fallback to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleRevokeAndRegenerate = async () => {
    setIsRevoking(true);
    setErrorDetails(null);
    try {
      const activeUser = currentUserId || (await ChatService.getCurrentUser())?.id;
      const { invitation: newInv, error: genErr } = await ChatService.generateNewInvitation(
        conversationId,
        activeUser
      );

      if (newInv && newInv.code) {
        setCurrentInv(newInv);
        if (onInvitationUpdated) {
          onInvitationUpdated(newInv);
        }
        setShowRevokeConfirm(false);
      } else if (genErr) {
        setErrorDetails(genErr);
      } else {
        setErrorDetails({ message: 'Unable to generate invitation link. Please try again.' });
      }
    } catch (err: any) {
      console.error('Error generating new invitation:', err);
      setErrorDetails({ message: err?.message || 'Unable to generate invitation link. Please try again.' });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleManualGenerate = async () => {
    setIsGenerating(true);
    setErrorDetails(null);
    try {
      const activeUser = currentUserId || (await ChatService.getCurrentUser())?.id;
      const { invitation: inv, error: genErr } = await ChatService.generateNewInvitation(
        conversationId,
        activeUser
      );

      if (inv && inv.code) {
        setCurrentInv(inv);
        if (onInvitationUpdated) onInvitationUpdated(inv);
      } else if (genErr) {
        setErrorDetails(genErr);
      } else {
        setErrorDetails({ message: 'Unable to generate invitation link. Please try again.' });
      }
    } catch (err: any) {
      console.error('Error generating invitation:', err);
      setErrorDetails({ message: err?.message || 'Unable to generate invitation link. Please try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#262629] rounded-2xl p-6 shadow-2xl space-y-4 text-gray-900 dark:text-[#E4E4E6] relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] absolute top-3.5 right-3.5 flex items-center justify-center rounded-xl text-gray-400 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1C1C1E] transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 id="invite-modal-title" className="text-base font-bold text-gray-900 dark:text-[#F2F2F2]">
              Private Lifetime Invitation
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
              Permanent link • Passwordless access
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-xs text-gray-600 dark:text-[#A1A1A6] leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-[#F2F2F2]">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
            <span>How it works:</span>
          </div>
          <p>
            Send this link to your partner. They will not need an email or password — they just choose their nickname and immediately join this private channel with you.
          </p>
        </div>

        {/* Diagnostic Error Alert */}
        {errorDetails && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{errorDetails.message}</p>
                {(errorDetails.code || errorDetails.details || errorDetails.hint) && (
                  <div className="p-2 rounded bg-rose-950/20 border border-rose-500/20 font-mono text-[11px] space-y-0.5">
                    {errorDetails.code && <div><span className="text-gray-400">Code:</span> {errorDetails.code}</div>}
                    {errorDetails.details && <div><span className="text-gray-400">Details:</span> {errorDetails.details}</div>}
                    {errorDetails.hint && <div><span className="text-gray-400">Hint:</span> {errorDetails.hint}</div>}
                  </div>
                )}
                {errorDetails.code === '42P01' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    The table "invitations" is missing. Please run the SQL migration script in your Supabase SQL Editor.
                  </p>
                )}
                {errorDetails.code === '42501' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Row-level security policy restriction. Ensure you are signed in and members are linked to this conversation.
                  </p>
                )}
              </div>
            </div>
            {!isValidToken && (
              <div className="pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={handleManualGenerate}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-300 underline hover:no-underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Generating Invitation Link</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Invite Link Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-[#8E8E93] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              Secret Link
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              Active Lifetime
            </span>
          </label>
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <div className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-xs font-mono text-gray-500 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Generating secure invitation link...</span>
              </div>
            ) : isValidToken ? (
              <div className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-xs font-mono text-gray-900 dark:text-[#F2F2F2] truncate flex items-center select-all">
                {inviteUrl}
              </div>
            ) : (
              <div className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-xs text-gray-500 flex items-center justify-between">
                <span>No link generated yet.</span>
                <button
                  type="button"
                  onClick={handleManualGenerate}
                  className="text-xs font-medium text-rose-500 hover:underline"
                >
                  Generate
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={!isValidToken || isGenerating}
              onClick={handleCopy}
              className={`min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium transition shadow-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-rose-900/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prominent Security Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-700 dark:text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-tight">
            <span className="font-semibold">Security Notice:</span> Keep this invitation link private. Anyone with the link may be able to access this conversation.
          </p>
        </div>

        {/* Revoke and Regenerate Link Section */}
        {showRevokeConfirm ? (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
              Revoke current link and create a new one?
            </p>
            <p className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
              Anyone trying to use the old link will no longer be able to join.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isRevoking}
                onClick={handleRevokeAndRegenerate}
                className="flex-1 min-h-[38px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {isRevoking ? 'Generating...' : 'Confirm Revoke & New Link'}
              </button>
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                className="min-h-[38px] px-3 rounded-lg bg-gray-200 dark:bg-[#2C2C2E] text-gray-800 dark:text-gray-200 text-xs font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowRevokeConfirm(true)}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 py-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Revoke & Generate New Link</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-[#262629]">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#1C1C1E] hover:bg-gray-200 dark:hover:bg-[#262629] text-gray-900 dark:text-[#F2F2F2] border border-gray-200 dark:border-[#262629] text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <Share2 className="w-4 h-4 text-rose-500" />
            <span>Share Link</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-[#121214] hover:bg-gray-100 dark:hover:bg-[#1C1C1E] text-gray-600 dark:text-[#8E8E93] text-xs font-medium transition"
          >
            Done
          </button>
        </div>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-[#8E8E93]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Strictly 2 members allowed per private channel</span>
        </div>
      </div>
    </div>
  );
};
