import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronDown, Heart, Loader2, MoreVertical, Ban, Play, Pause } from 'lucide-react';
import { Message, UserProfile, TypingEvent } from '../../types';
import { formatMessageTime, formatChatDateHeader } from '../../lib/utils';
import { MessageContextMenu } from './MessageContextMenu';

const VoiceMessagePlayer: React.FC<{ audioUrl: string; duration?: number | null; isSelf: boolean }> = ({
  audioUrl,
  duration,
  isSelf,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setMaxDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-1 min-w-[200px] sm:min-w-[240px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition ${
          isSelf
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 h-5 my-0.5">
          {[40, 70, 30, 90, 50, 80, 60, 100, 40, 70, 50, 90, 30, 60].map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-200 ${
                isSelf ? 'bg-white/60' : 'bg-rose-500/60 dark:bg-rose-400/60'
              } ${isPlaying ? 'animate-pulse' : ''}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className={`text-[10px] font-mono ${isSelf ? 'text-white/80' : 'text-gray-500 dark:text-[#8E8E93]'}`}>
          {formatTime(currentTime)} / {formatTime(maxDuration || 0)}
        </div>
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: Message[];
  currentUser: UserProfile;
  partner: UserProfile | null;
  typingState: TypingEvent | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onImageClick: (url: string) => void;
  onEditMessage: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  partner,
  typingState,
  hasMore,
  loadingMore,
  onLoadMore,
  onImageClick,
  onEditMessage,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);

  // Context Menu State
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    message: Message | null;
    position: { x: number; y: number } | null;
  }>({
    isOpen: false,
    message: null,
    position: null,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Check scroll position to display "Scroll to bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottomButton(!isNearBottom);
  };

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Scroll to bottom on initial load and when new messages arrive if already near bottom
  useEffect(() => {
    if (messages.length === 0) return;

    if (prevMessagesLengthRef.current === 0) {
      // First load: instant scroll
      scrollToBottom(false);
    } else if (messages.length > prevMessagesLengthRef.current) {
      // If user is at bottom or sent the message, scroll down
      const isLastMessageSelf = messages[messages.length - 1]?.sender_id === currentUser.id;
      if (!showScrollBottomButton || isLastMessageSelf) {
        scrollToBottom(true);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUser.id, showScrollBottomButton]);

  // Context menu trigger helpers
  const handleOpenContextMenu = (msg: Message, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuState({
      isOpen: true,
      message: msg,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleTouchStart = (msg: Message, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      // Trigger context menu for mobile long-press
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      setContextMenuState({
        isOpen: true,
        message: msg,
        position: { x: touch.clientX, y: touch.clientY },
      });
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      // User is scrolling, cancel long press
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Deduplicate messages by ID and group by date
  const uniqueMessages: Message[] = [];
  const seenIds = new Set<string>();
  messages.forEach((msg) => {
    if (msg.id && !seenIds.has(msg.id)) {
      seenIds.add(msg.id);
      uniqueMessages.push(msg);
    }
  });

  const groupedMessages: { dateHeader: string; items: Message[] }[] = [];
  uniqueMessages.forEach((msg) => {
    const dateHeader = formatChatDateHeader(msg.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.dateHeader === dateHeader) {
      lastGroup.items.push(msg);
    } else {
      groupedMessages.push({ dateHeader, items: [msg] });
    }
  });

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 relative scroll-smooth bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-[#E4E4E6] transition-colors duration-200"
    >
      <div className="max-w-4xl mx-auto w-full space-y-5 sm:space-y-6">
        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center pt-1 pb-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="px-3.5 py-1.5 rounded-full text-[11px] font-medium bg-white dark:bg-[#1C1C1E] hover:bg-gray-100 dark:hover:bg-[#262629] border border-gray-200 dark:border-[#262629] text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2] transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                  <span>Loading history...</span>
                </>
              ) : (
                <span>Load older messages</span>
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-[#1C1C1E] border border-rose-100 dark:border-[#262629] text-rose-500 dark:text-rose-400 flex items-center justify-center mb-3 shadow-inner">
              <Heart className="w-7 h-7 fill-rose-500/20 text-rose-500 animate-pulse" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[#F2F2F2]">
              Start your private conversation ❤️
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] mt-1 max-w-xs leading-relaxed">
              Messages are strictly end-to-end private between you and {partner?.display_name || 'your partner'}.
            </p>
          </div>
        )}

        {/* Message Groups */}
        {groupedMessages.map((group, groupIdx) => (
          <div key={`group-${groupIdx}-${group.dateHeader}`} className="space-y-3.5 sm:space-y-4">
            {/* Date Header Separator */}
            <div className="flex items-center justify-center my-2 sm:my-3">
              <span className="px-3 py-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] rounded-full text-[10px] text-gray-500 dark:text-[#8E8E93] uppercase tracking-widest select-none shadow-xs">
                {group.dateHeader}
              </span>
            </div>

            {/* Messages within this date */}
            {group.items.map((msg, msgIdx) => {
              const isSelf = msg.sender_id === currentUser.id;
              const isDeleted = msg.is_deleted_for_everyone;
              const prevMsg = group.items[msgIdx - 1];
              const isFirstInSequence = !prevMsg || prevMsg.sender_id !== msg.sender_id;

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`flex items-end gap-2 sm:gap-3 ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Partner Avatar for incoming messages */}
                  {!isSelf && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shrink-0 bg-gray-200 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#3A3A3C] mb-0.5 shadow-xs">
                      {isFirstInSequence ? (
                        partner?.avatar_url ? (
                          <img
                            src={partner.avatar_url}
                            alt={partner.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-semibold text-rose-500 dark:text-rose-400">
                            {(partner?.display_name || 'P').charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full opacity-0" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container with Action Triggers */}
                  <div
                    className={`group relative max-w-[85%] sm:max-w-[72%] md:max-w-[65%] flex flex-col ${
                      isSelf ? 'items-end' : 'items-start'
                    }`}
                    onContextMenu={(e) => handleOpenContextMenu(msg, e)}
                    onTouchStart={(e) => handleTouchStart(msg, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Hover Action Menu Trigger (Desktop) */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden sm:flex items-center ${
                        isSelf ? '-left-8' : '-right-8'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleOpenContextMenu(msg, e)}
                        className="w-7 h-7 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-sm flex items-center justify-center transition hover:scale-105"
                        title="Message options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Main Bubble */}
                    <div
                      className={`rounded-2xl p-3 sm:p-3.5 px-3.5 sm:px-4 transition text-sm leading-relaxed ${
                        isDeleted
                          ? 'bg-gray-100 dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93] border border-gray-200 dark:border-[#2C2C2E] italic shadow-xs'
                          : isSelf
                          ? 'bg-rose-500 text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] border border-gray-200/80 dark:border-[#3A3A3C] rounded-bl-xs shadow-xs'
                      }`}
                    >
                      {/* Deleted For Everyone State */}
                      {isDeleted ? (
                        <div className="flex items-center gap-1.5 py-0.5 text-xs select-none">
                          <Ban className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span>This message was deleted</span>
                        </div>
                      ) : (
                        <>
                          {/* Image Attachment (if any) */}
                          {msg.image_url && (
                            <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl bg-black/5 dark:bg-[#1C1C1E] border border-black/10 dark:border-[#3A3A3C] cursor-pointer">
                              <img
                                src={msg.image_url}
                                alt="Chat attachment"
                                onClick={() => onImageClick(msg.image_url!)}
                                onError={(e) => {
                                  // Prevent broken icon frame if loading error occurs
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) parent.style.display = 'none';
                                }}
                                className="w-full max-h-80 object-contain max-w-full hover:scale-[1.01] transition duration-200 rounded-xl bg-black/20"
                              />
                            </div>
                          )}

                          {/* Voice Message Attachment (if any) */}
                          {msg.audio_url && (
                            <div className="mb-1">
                              <VoiceMessagePlayer audioUrl={msg.audio_url} duration={msg.audio_duration} isSelf={isSelf} />
                            </div>
                          )}

                          {/* Message Content */}
                          {msg.content && msg.content !== '🎙️ Voice Message' && (
                            <p className="whitespace-pre-wrap break-words selection:bg-rose-300 dark:selection:bg-rose-500/30">
                              {msg.content}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Meta: Edited Flag, Timestamp & Read Status */}
                    <div
                      className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#8E8E93] mt-1 select-none ${
                        isSelf ? 'mr-1 justify-end' : 'ml-1 justify-start'
                      }`}
                    >
                      {/* Edited Indicator */}
                      {msg.is_edited && !isDeleted && (
                        <span className="text-[10px] font-medium text-gray-400 dark:text-[#8E8E93] italic mr-0.5">
                          Edited ·
                        </span>
                      )}

                      <span>{formatMessageTime(msg.created_at)}</span>

                      {/* Read Receipts for Self */}
                      {isSelf && !isDeleted && (
                        <span className="inline-flex items-center ml-0.5" title={msg.is_read ? 'Read' : 'Sent'}>
                          {msg.is_read ? (
                            <span className="text-rose-500 dark:text-rose-400 font-medium flex items-center">
                              <CheckCheck className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-[#8E8E93] flex items-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Realtime Partner Typing Indicator */}
        {typingState?.is_typing && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-[#8E8E93] text-xs px-2 italic animate-fade-in">
            <div className="w-1.5 h-1.5 bg-rose-500 dark:bg-rose-400 rounded-full animate-pulse" />
            <span>{typingState.display_name || partner?.display_name || 'Partner'} is typing...</span>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomButton && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-4 sm:right-8 z-30 min-w-[44px] min-h-[44px] rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2] shadow-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#262629] transition active:scale-95 animate-fade-in"
          aria-label="Scroll to newest messages"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Message Context Menu */}
      <MessageContextMenu
        isOpen={contextMenuState.isOpen}
        message={contextMenuState.message}
        currentUser={currentUser}
        position={contextMenuState.position}
        onClose={() => setContextMenuState({ isOpen: false, message: null, position: null })}
        onEdit={onEditMessage}
        onDeleteForMe={onDeleteForMe}
        onDeleteForEveryone={onDeleteForEveryone}
      />
    </div>
  );
};
