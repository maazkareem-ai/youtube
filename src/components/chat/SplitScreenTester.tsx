import React from 'react';
import { Smartphone, Laptop, X, Heart } from 'lucide-react';
import { AppTheme } from '../../types';
import { SingleChatPane } from './SingleChatPane';
import { DEFAULT_USER_1, DEFAULT_USER_2 } from '../../lib/chatService';

interface SplitScreenTesterProps {
  onClose: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
}

export const SplitScreenTester: React.FC<SplitScreenTesterProps> = ({
  onClose,
  theme,
  onToggleTheme,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col transition-colors duration-200">
      {/* Top Dual View Control Bar */}
      <div className="h-12 px-4 bg-white dark:bg-[#121214] border-b border-gray-200 dark:border-[#262629] flex items-center justify-between text-gray-900 dark:text-[#E4E4E6] select-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 fill-rose-500 dark:fill-rose-400" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-gray-900 dark:text-[#F2F2F2]">
            Realtime 2-Person Synchronized Testing Lab
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500 dark:text-[#8E8E93] hidden sm:inline">
            Type on either side to watch real-time messaging, typing indicators, and read receipts sync live!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-gray-100 dark:bg-[#1C1C1E] hover:bg-gray-200 dark:hover:bg-[#262629] border border-gray-200 dark:border-[#262629] text-gray-900 dark:text-[#F2F2F2] transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Dual View</span>
          </button>
        </div>
      </div>

      {/* Main Dual Frame Canvas */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-3 sm:p-4 max-w-7xl mx-auto w-full">
        {/* Left Side: iPhone Safari Simulator for User 1 (Alex) */}
        <div className="flex flex-col h-full bg-white dark:bg-[#121214] rounded-3xl border border-gray-200 dark:border-[#262629] overflow-hidden shadow-2xl">
          <div className="px-4 py-2 bg-gray-50 dark:bg-[#121214] border-b border-gray-200 dark:border-[#262629] flex items-center justify-between text-xs text-gray-900 dark:text-[#E4E4E6]">
            <div className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
              <Smartphone className="w-4 h-4" />
              <span>iPhone Safari — User 1 (Alex)</span>
            </div>
            <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-mono">
              iOS Simulator
            </span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <SingleChatPane
              forcedUser={DEFAULT_USER_1}
              theme={theme}
              onToggleTheme={onToggleTheme}
              isEmbedded
            />
          </div>
        </div>

        {/* Right Side: Laptop Chrome Simulator for User 2 (Sam) */}
        <div className="flex flex-col h-full bg-white dark:bg-[#121214] rounded-3xl border border-gray-200 dark:border-[#262629] overflow-hidden shadow-2xl">
          <div className="px-4 py-2 bg-gray-50 dark:bg-[#121214] border-b border-gray-200 dark:border-[#262629] flex items-center justify-between text-xs text-gray-900 dark:text-[#E4E4E6]">
            <div className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
              <Laptop className="w-4 h-4" />
              <span>Laptop Chrome — User 2 (Sam)</span>
            </div>
            <span className="text-[10px] bg-gray-100 dark:bg-[#1C1C1E] text-gray-600 dark:text-[#8E8E93] border border-gray-200 dark:border-[#262629] px-2 py-0.5 rounded-full font-mono">
              Desktop Simulator
            </span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <SingleChatPane
              forcedUser={DEFAULT_USER_2}
              theme={theme}
              onToggleTheme={onToggleTheme}
              isEmbedded
            />
          </div>
        </div>
      </div>
    </div>
  );
};

