import React, { useState, useEffect } from 'react';
import { UserProfile, AppTheme } from './types';
import { ChatService } from './lib/chatService';
import { AuthPage } from './components/auth/AuthPage';
import { ChatContainer } from './components/chat/ChatContainer';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('two_chat_theme') as AppTheme;
      if (stored) return stored;
    }
    return 'dark';
  });

  // Apply Theme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
    localStorage.setItem('two_chat_theme', theme);
  }, [theme]);

  // Check current session & process URL invitation link
  useEffect(() => {
    async function checkAuth() {
      try {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const hasInvite = urlParams.has('invite') || (typeof window !== 'undefined' && window.location.hash.includes('invite='));
        const inviteCode = hasInvite ? (urlParams.get('invite') || '').trim() : null;
        const storedRole = typeof window !== 'undefined' ? localStorage.getItem('two_chat_role') : null;
        const isGuest = Boolean((inviteCode && inviteCode !== 'null' && inviteCode !== 'undefined' && inviteCode !== '') || storedRole === 'guest');

        if (typeof window !== 'undefined') {
          if (isGuest) {
            localStorage.setItem('two_chat_role', 'guest');
          } else if (!storedRole) {
            localStorage.setItem('two_chat_role', 'host');
          }
        }

        const myPermanentName = isGuest ? 'Honey' : 'Bee';
        const myPermanentId = isGuest ? 'user-honey-simulated' : 'user-bee-simulated';

        let user = await ChatService.getCurrentUser();
        if (!user) {
          user = {
            id: myPermanentId,
            display_name: myPermanentName,
            avatar_url: null,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
        } else {
          user = {
            ...user,
            display_name: myPermanentName,
          };
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('two_chat_active_user', JSON.stringify(user));
        }

        if (user && inviteCode && inviteCode !== 'null' && inviteCode !== 'undefined' && inviteCode !== '') {
          const { user: joinedUser, error: joinErr } = await ChatService.joinViaInvitation(
            inviteCode,
            'Honey',
            user.avatar_url
          );
          if (!joinErr && joinedUser) {
            if (typeof window !== 'undefined' && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setCurrentUser({ ...joinedUser, display_name: 'Honey' });
            return;
          }
        }

        setCurrentUser(user);
      } catch (err) {
        console.error('Session load error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = async () => {
    await ChatService.signOut();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-stone-900 text-stone-100 select-none">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 animate-pulse">
          <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-xs text-stone-400 font-mono tracking-wider">
          Connecting to private channel...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <ChatContainer
      currentUser={currentUser}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={handleToggleTheme}
    />
  );
}
