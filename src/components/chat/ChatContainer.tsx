import React, { useState, useEffect, useCallback } from 'react';
import { Heart, UserPlus, LogOut, Copy, Check, Clock, PanelLeftClose } from 'lucide-react';
import { UserProfile, AppTheme, Invitation } from '../../types';
import { ChatService } from '../../lib/chatService';
import { SingleChatPane } from './SingleChatPane';
import { InvitePartnerModal } from './InvitePartnerModal';

interface ChatContainerProps {
  currentUser: UserProfile;
  onLogout: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
}) => {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDetails() {
      const details = await ChatService.getConversationDetails(currentUser);
      if (!isMounted) return;
      setPartner(details.partner);
      setInvitation(details.invitation);
      setConversationId(details.conversation.id);
    }
    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handlePartnerChange = useCallback((newPartner: UserProfile | null) => {
    setPartner((prev) => {
      if (
        prev &&
        newPartner &&
        prev.id === newPartner.id &&
        prev.display_name === newPartner.display_name &&
        prev.avatar_url === newPartner.avatar_url &&
        Boolean(prev.is_online) === Boolean(newPartner.is_online) &&
        prev.last_seen === newPartner.last_seen
      ) {
        return prev;
      }
      return newPartner;
    });
  }, []);

  const handleCopyInvite = async () => {
    if (!invitation) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?invite=${invitation.code}`;
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
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-[#0A0A0B] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-white dark:bg-[#121214] border-r border-gray-200 dark:border-[#262629] flex flex-col h-full transition-all duration-300 z-20 ${
          isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden border-none pointer-events-none' : 'w-72 sm:w-80 opacity-100'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-[#262629] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center text-xl shadow-xs">
              🧸
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#F2F2F2]">Chapiii</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-[#8E8E93] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1C1C1E] transition active:scale-95"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Item */}
        <div className="p-3.5 flex-1 overflow-y-auto space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#8E8E93] px-3 py-1">
            Active Channel
          </div>

          {partner ? (
            <div className="p-3.5 bg-gray-50 dark:bg-[#1C1C1E] border-l-2 border-rose-500 rounded-r-2xl flex items-center gap-3.5 border-y border-r border-gray-200 dark:border-[#262629] text-gray-900 dark:text-[#F2F2F2] shadow-xs cursor-default">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 dark:border-[#3A3A3C] bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center shadow-xs">
                  {partner.avatar_url ? (
                    <img src={partner.avatar_url} alt={partner.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold text-rose-500 dark:text-rose-400">
                      {partner.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#1C1C1E] bg-emerald-500 transition-colors"
                  title="Online"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-[#F2F2F2] truncate">
                    {partner.display_name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-500">
                    ONLINE
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-[#1C1C1E] border border-dashed border-gray-200 dark:border-[#262629] rounded-2xl text-center">
              <Clock className="w-6 h-6 text-gray-400 dark:text-[#8E8E93] mx-auto mb-2 animate-pulse" />
              <p className="text-xs font-medium text-gray-600 dark:text-[#8E8E93]">Waiting for partner...</p>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Partner
              </button>
            </div>
          )}

          {/* Quick Invite Link Card - Render ONLY for Host (Bee) */}
          {(typeof window !== 'undefined'
            ? (localStorage.getItem('two_chat_role') !== 'guest' && (currentUser.display_name || '').toLowerCase() !== 'honey')
            : (currentUser.display_name || '').toLowerCase().includes('bee')) && (
            <div className="p-3 bg-rose-50/50 dark:bg-rose-500/10 border border-rose-200/50 dark:border-rose-500/20 rounded-2xl">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400">Invite Link & Settings</span>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Manage
                </button>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-[#8E8E93] mb-2">
                Manage 2-user connection
              </p>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] rounded-xl text-xs font-medium text-gray-700 dark:text-[#E4E4E6] transition active:scale-95 shadow-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-rose-500" />
                    <span>Copy Invite Link</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer - Current User Profile */}
        <div className="p-3 border-t border-gray-200 dark:border-[#262629] flex items-center justify-between bg-gray-50/50 dark:bg-[#0A0A0B]/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 dark:border-[#3A3A3C] bg-gray-100 dark:bg-[#2C2C2E] shrink-0 flex items-center justify-center">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.display_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold text-rose-500 text-xs">
                  {currentUser.display_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-900 dark:text-[#F2F2F2] truncate">
                {currentUser.display_name}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                You (Online)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-gray-500 hover:text-rose-600 dark:text-[#8E8E93] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition active:scale-95 shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Single Chat Pane */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <SingleChatPane
          forcedUser={currentUser}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
          onPartnerChange={handlePartnerChange}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </main>

      {/* Invite Partner Modal */}
      <InvitePartnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        invitation={invitation}
        conversationId={conversationId}
        currentUserId={currentUser.id}
        onInvitationUpdated={(newInv) => setInvitation(newInv)}
      />
    </div>
  );
};
