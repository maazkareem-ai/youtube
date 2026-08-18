import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, Sun, Moon, Heart, WifiOff, MoreVertical, Trash2, EyeOff, UserPlus, Clock, Phone, Video, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { UserProfile, TypingEvent, AppTheme } from '../../types';
import { formatLastSeen } from '../../lib/utils';

interface ChatHeaderProps {
  currentUser: UserProfile;
  partner: UserProfile | null;
  isPartnerOnline: boolean;
  typingState: TypingEvent | null;
  theme: AppTheme;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenInviteModal?: () => void;
  onStartAudioCall?: () => void;
  onStartVideoCall?: () => void;
  onLogout: () => void;
  isOnline: boolean;
  onClearHistoryForMe: () => void;
  onClearHistoryForEveryone: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentUser,
  partner,
  isPartnerOnline,
  typingState,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenInviteModal,
  onStartAudioCall,
  onStartVideoCall,
  onLogout,
  isOnline,
  onClearHistoryForMe,
  onClearHistoryForEveryone,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <header className="shrink-0 min-h-[60px] sm:min-h-[68px] px-3.5 sm:px-6 bg-white/90 dark:bg-[#121214]/85 backdrop-blur-md border-b border-gray-200 dark:border-[#262629] flex items-center justify-between z-20 select-none pt-[calc(0.25rem+env(safe-area-inset-top))] transition-colors duration-200">
      {/* Partner Info Section */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {onToggleSidebar && isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Show sidebar"
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-[#8E8E93] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1C1C1E] transition active:scale-95 shrink-0"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        {partner ? (
          <>
            {/* Avatar with Status Ring */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gray-200 dark:border-[#3A3A3C] bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center shadow-xs">
                {partner.avatar_url ? (
                  <img src={partner.avatar_url} alt={partner.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-semibold text-rose-500 text-sm">
                    {partner.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#121214] bg-emerald-500 transition-colors"
                title="Online"
              />
            </div>

            {/* Display Name & Subtext */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-[#F2F2F2] truncate">
                  {partner.display_name}
                </h2>
              </div>

              <div className="text-[11px] sm:text-xs text-gray-500 dark:text-[#8E8E93] truncate flex items-center gap-1">
                {typingState?.is_typing ? (
                  <span className="text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1">
                    <span>typing</span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="w-1 h-1 bg-rose-500 dark:bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1 h-1 bg-rose-500 dark:bg-rose-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1 h-1 bg-rose-500 dark:bg-rose-400 rounded-full animate-bounce" />
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    Online
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Waiting for Partner State */
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-dashed border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-[#F2F2F2]">
                Waiting for Partner...
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-[#8E8E93]">
                Share your invite link to connect
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 relative">
        {/* Network status icon (if offline) */}
        {!isOnline && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium"
            title="Internet disconnected"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}



        {/* Call Action Buttons (Audio & Video) */}
        {partner && (
          <div className="flex items-center gap-1.5 mr-1">
            {onStartAudioCall && (
              <button
                type="button"
                onClick={onStartAudioCall}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition shadow-md shadow-rose-900/20"
                aria-label="Start Voice Call"
                title="Start Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}

            {onStartVideoCall && (
              <button
                type="button"
                onClick={onStartVideoCall}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition shadow-md shadow-rose-900/20"
                aria-label="Start Video Call"
                title="Start HD Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Chat History & More Actions Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className={`min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] rounded-xl flex items-center justify-center transition ${
              showMenu
                ? 'bg-gray-200 dark:bg-[#2C2C2E] text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1C1C1E]'
            }`}
            aria-label="More chat actions"
            title="Chat options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] rounded-2xl shadow-xl p-1.5 z-50 text-gray-900 dark:text-[#F2F2F2] animate-scale-up">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-[#8E8E93] uppercase tracking-wider">
                Chat History
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onClearHistoryForMe();
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-gray-700 dark:text-[#E4E4E6] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition text-left"
              >
                <EyeOff className="w-4 h-4 text-amber-500" />
                <span>Clear history for me</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onClearHistoryForEveryone();
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition text-left"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Clear history for everyone</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
