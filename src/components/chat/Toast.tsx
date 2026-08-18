import React, { useEffect } from 'react';
import { Undo2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  undoAction?: () => void;
  undoLabel?: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  undoAction,
  undoLabel = 'Undo',
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up select-none pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-900/95 dark:bg-[#1C1C1E]/95 text-white border border-gray-700/50 dark:border-[#3A3A3C] shadow-2xl backdrop-blur-md text-xs">
        <span className="text-gray-200">{message}</span>
        {undoAction && (
          <button
            type="button"
            onClick={undoAction}
            className="flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300 hover:underline px-1 py-0.5 transition"
          >
            <Undo2 className="w-3 h-3" />
            <span>{undoLabel}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 p-0.5 rounded-md hover:bg-white/10 transition"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
