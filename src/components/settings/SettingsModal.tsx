import React, { useState } from 'react';
import { X, Sun, Moon, Bell, Smartphone, LogOut, CheckCircle2, Trash2, EyeOff, ShieldCheck, Database } from 'lucide-react';
import { UserProfile, AppTheme } from '../../types';
import { ChatService } from '../../lib/chatService';
import { getStoredSupabaseConfig, saveCustomSupabaseConfig, resetSupabaseInstance } from '../../lib/supabaseClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  theme: AppTheme;
  onSetTheme: (theme: AppTheme) => void;
  onLogout: () => void;
  onClearHistoryForMe?: () => void;
  onClearHistoryForEveryone?: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  theme,
  onSetTheme,
  onLogout,
  onClearHistoryForMe,
  onClearHistoryForEveryone,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'privacy' | 'database' | 'pwa'>('profile');
  const [displayName, setDisplayName] = useState(currentUser.display_name);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || PRESET_AVATARS[0]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Notifications
  const [notificationStatus, setNotificationStatus] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Supabase Config
  const [supabaseUrl, setSupabaseUrl] = useState(() => getStoredSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getStoredSupabaseConfig().anonKey);
  const supabaseConfig = getStoredSupabaseConfig();

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      const updated = await ChatService.updateProfile({
        id: currentUser.id,
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
      });
      onUpdateUser(updated);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationStatus(permission);
      } catch (err) {
        console.error('Notification error:', err);
      }
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomSupabaseConfig(supabaseUrl, supabaseAnonKey);
    resetSupabaseInstance();
    setSuccessMsg('Supabase credentials saved. Reconnect successful.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in transition-colors duration-200">
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#262629] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-gray-900 dark:text-[#E4E4E6]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-[#262629] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#F2F2F2]">
              Settings & Privacy
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-xl text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2] hover:bg-gray-100 dark:hover:bg-[#1C1C1E] flex items-center justify-center transition"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-[#262629] px-4 gap-2 bg-gray-50 dark:bg-[#0A0A0B] overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
            }`}
          >
            Appearance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
            }`}
          >
            Chat & Privacy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'database'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
            }`}
          >
            Supabase Backend
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'pwa'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
            }`}
          >
            iPhone Safari / PWA
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] text-sm focus:outline-none focus:border-gray-400 dark:focus:border-[#48484A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-2">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden transition ring-2 ${
                        avatarUrl === url
                          ? 'ring-rose-500 ring-offset-2 ring-offset-white dark:ring-offset-[#121214] scale-105'
                          : 'ring-transparent hover:opacity-80'
                      }`}
                    >
                      <img src={url} alt={`Avatar option ${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-rose-900/20 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {/* 2. Appearance & Alerts */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-2">
                  Theme Preference
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSetTheme('light')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition ${
                      theme === 'light'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-[#1C1C1E] text-rose-600 dark:text-rose-400'
                        : 'border-gray-200 dark:border-[#262629] bg-gray-50 dark:bg-[#1C1C1E]/50 text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span>Light Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetTheme('dark')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition ${
                      theme === 'dark'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-[#1C1C1E] text-rose-600 dark:text-rose-400'
                        : 'border-gray-200 dark:border-[#262629] bg-gray-50 dark:bg-[#1C1C1E]/50 text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                    <span>Dark Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetTheme('system')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition ${
                      theme === 'system'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-[#1C1C1E] text-rose-600 dark:text-rose-400'
                        : 'border-gray-200 dark:border-[#262629] bg-gray-50 dark:bg-[#1C1C1E]/50 text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2]'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-gray-600 dark:text-[#8E8E93]" />
                    <span>Auto (System)</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-[#262629]">
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                  Desktop Notifications
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629]">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-gray-500 dark:text-[#8E8E93]" />
                    <div>
                      <div className="text-xs font-medium text-gray-900 dark:text-[#F2F2F2]">
                        Browser Push Alerts
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
                        Status: <span className="capitalize font-medium text-gray-900 dark:text-[#F2F2F2]">{notificationStatus}</span>
                      </div>
                    </div>
                  </div>

                  {notificationStatus !== 'granted' && notificationStatus !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleRequestNotifications}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition shadow-xs"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. Chat & Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629]">
                <div className="font-semibold text-xs text-gray-900 dark:text-[#F2F2F2] mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Two-Person Private Channel
                </div>
                <p className="text-xs text-gray-600 dark:text-[#8E8E93] leading-relaxed">
                  All messages and image attachments are strictly confined to this private channel with Row Level Security enforcement.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-[#262629]">
                <div className="text-xs font-medium text-gray-700 dark:text-[#E4E4E6] mb-2">
                  Chat History Management
                </div>

                {onClearHistoryForMe && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onClearHistoryForMe();
                    }}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] border border-gray-200 dark:border-[#262629] text-left transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <EyeOff className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-[#F2F2F2]">Clear history for me</div>
                        <div className="text-[10px] text-gray-500 dark:text-[#8E8E93]">Hides previous messages from your view only</div>
                      </div>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Clear</span>
                  </button>
                )}

                {onClearHistoryForEveryone && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onClearHistoryForEveryone();
                    }}
                    className="w-full p-3 rounded-xl bg-rose-50/50 dark:bg-[#1C1C1E] hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-left transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <div>
                        <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Clear history for everyone</div>
                        <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70">Permanently clears previous messages for both users</div>
                      </div>
                    </div>
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Clear All</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveSupabase} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                    Supabase URL (<code className="text-gray-500 dark:text-[#8E8E93]">NEXT_PUBLIC_SUPABASE_URL</code>)
                  </label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-xs font-mono text-gray-900 dark:text-[#F2F2F2] focus:outline-none focus:border-gray-400 dark:focus:border-[#48484A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                    Supabase Anon Key (<code className="text-gray-500 dark:text-[#8E8E93]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)
                  </label>
                  <textarea
                    rows={2}
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-xs font-mono text-gray-900 dark:text-[#F2F2F2] resize-none focus:outline-none focus:border-gray-400 dark:focus:border-[#48484A]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
                    Migration: <code className="text-rose-600 dark:text-rose-400">20260817_message_management.sql</code>
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-medium shadow-md shadow-rose-900/20"
                  >
                    Save & Reconnect
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. PWA / iPhone Safari Tab */}
          {activeTab === 'pwa' && (
            <div className="space-y-3 text-xs text-gray-600 dark:text-[#8E8E93]">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-rose-200 dark:border-rose-500/30 text-gray-900 dark:text-[#F2F2F2]">
                <div className="font-semibold mb-1 flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <Smartphone className="w-4 h-4" />
                  Install on iPhone Safari
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-[#8E8E93]">
                  <li>Open this web app in <strong className="text-gray-900 dark:text-[#F2F2F2]">Safari</strong> on your iPhone.</li>
                  <li>Tap the <strong className="text-gray-900 dark:text-[#F2F2F2]">Share</strong> icon (the square with the upward arrow) at the bottom.</li>
                  <li>Scroll down and tap <strong className="text-gray-900 dark:text-[#F2F2F2]">"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong className="text-gray-900 dark:text-[#F2F2F2]">"Add"</strong> in the top-right corner to enjoy a full-screen private chat experience!</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-[11px] text-gray-600 dark:text-[#8E8E93]">
                <strong className="text-gray-900 dark:text-[#F2F2F2]">Privacy Note:</strong> This application has no public feeds or open user registries. Only you and your authorized partner can participate.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-200 dark:border-[#262629] bg-gray-50 dark:bg-[#0A0A0B] flex items-center justify-between">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-[#1C1C1E] transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] hover:bg-gray-100 dark:hover:bg-[#262629] border border-gray-200 dark:border-[#262629] text-gray-900 dark:text-[#F2F2F2] text-xs font-medium transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
