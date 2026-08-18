import React, { useEffect, useRef } from 'react';
import { Pencil, Trash2, EyeOff, X, Copy, Check } from 'lucide-react';
import { Message, UserProfile } from '../../types';

interface MessageContextMenuProps {
  isOpen: boolean;
  message: Message | null;
  currentUser: UserProfile;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onEdit: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  message,
  currentUser,
  position,
  onClose,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const isSelf = message.sender_id === currentUser.id;
  const isDeleted = message.is_deleted_for_everyone;

  const handleCopy = () => {
    if (message.content && !message.is_deleted_for_everyone) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 700);
    }
  };

  // On mobile or when no explicit coordinates provided, show centered / bottom sheet
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  let menuStyle: React.CSSProperties = {};
  if (!isMobile && position) {
    // Keep menu within viewport
    const menuWidth = 220;
    const menuHeight = 200;
    const padding = 16;

    let posX = position.x;
    let posY = position.y;

    if (posX + menuWidth > window.innerWidth - padding) {
      posX = window.innerWidth - menuWidth - padding;
    }
    if (posY + menuHeight > window.innerHeight - padding) {
      posY = posY - menuHeight;
    }

    menuStyle = {
      position: 'fixed',
      top: `${Math.max(padding, posY)}px`,
      left: `${Math.max(padding, posX)}px`,
    };
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex sm:block items-end sm:items-stretch justify-center select-none animate-fade-in">
      <div
        ref={menuRef}
        style={!isMobile && position ? menuStyle : undefined}
        className={`w-full sm:w-56 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden p-2 text-gray-900 dark:text-[#F2F2F2] animate-scale-up ${
          isMobile ? 'max-w-md mx-auto mb-0 pb-[calc(1rem+env(safe-area-inset-bottom))]' : ''
        }`}
      >
        {/* Mobile Drag/Header Indicator */}
        {isMobile && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-[#2C2C2E] mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Message Actions</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-1">
          {/* Copy Text Option */}
          {message.content && !isDeleted && (
            <button
              type="button"
              onClick={handleCopy}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-gray-700 dark:text-[#E4E4E6] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition active:scale-98"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-500 dark:text-[#8E8E93]" />
                  <span>Copy text</span>
                </>
              )}
            </button>
          )}

          {/* Edit Message (Sender only & not deleted) */}
          {isSelf && !isDeleted && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(message);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-gray-700 dark:text-[#E4E4E6] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition active:scale-98"
            >
              <Pencil className="w-4 h-4 text-blue-500" />
              <span>Edit message</span>
            </button>
          )}

          {/* Delete for Me (Both sender and recipient) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onDeleteForMe(message);
            }}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-gray-700 dark:text-[#E4E4E6] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition active:scale-98"
          >
            <EyeOff className="w-4 h-4 text-amber-500" />
            <span>Delete for me</span>
          </button>

          {/* Delete for Everyone (Sender only & not already deleted for everyone) */}
          {isSelf && !isDeleted && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteForEveryone(message);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition active:scale-98"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete for everyone</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
