import React, { useState, useEffect } from 'react';
import { Lock, Mail, Eye, EyeOff, Heart, Shield, Database, UserPlus, LogIn, Sun, Moon, Sparkles, Check } from 'lucide-react';
import { UserProfile, AppTheme, Invitation } from '../../types';
import { ChatService } from '../../lib/chatService';
import { getStoredSupabaseConfig, saveCustomSupabaseConfig, resetSupabaseInstance } from '../../lib/supabaseClient';

interface AuthPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, theme = 'dark', onToggleTheme }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invitation state if invited via link
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Supabase Config Modal State
  const [showDbModal, setShowDbModal] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(() => getStoredSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getStoredSupabaseConfig().anonKey);
  const [dbSavedMsg, setDbSavedMsg] = useState<string | null>(null);

  const supabaseConfig = getStoredSupabaseConfig();

  // Detect invite code from URL parameters or hash
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rawCode: string | null = null;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('invite')) {
      rawCode = urlParams.get('invite');
    } else if (window.location.hash.includes('invite=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      rawCode = hashParams.get('invite');
    }

    const cleanCode = rawCode ? rawCode.trim() : null;
    if (cleanCode && cleanCode !== 'undefined' && cleanCode !== 'null' && cleanCode !== '') {
      setInviteCode(cleanCode);
      setLoadingInvite(true);
      ChatService.getInvitationByCode(cleanCode)
        .then((inv) => {
          setInvitation(inv);
        })
        .catch((err) => {
          console.error('Error fetching invitation:', err);
        })
        .finally(() => {
          setLoadingInvite(false);
        });
    } else {
      setInviteCode(null);
    }
  }, []);

  // Handle invitation join
  const handleJoinViaInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!inviteCode) return;

    setLoading(true);
    setError(null);

    try {
      const { user, error: joinErr } = await ChatService.joinViaInvitation(
        inviteCode,
        displayName.trim(),
        selectedAvatar
      );

      if (joinErr) {
        setError(joinErr);
      } else if (user) {
        // Clean URL parameter
        if (typeof window !== 'undefined' && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        onLoginSuccess(user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join chat.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle standard Auth Submit (Sign in or Sign up)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { user, error: signUpErr } = await ChatService.signUp(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0],
          selectedAvatar
        );
        if (signUpErr) {
          setError(signUpErr);
        } else if (user) {
          onLoginSuccess(user);
        }
      } else {
        const { user, error: signInErr } = await ChatService.signIn(email.trim(), password);
        if (signInErr) {
          setError(signInErr);
        } else if (user) {
          onLoginSuccess(user);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomSupabaseConfig(supabaseUrl, supabaseAnonKey);
    resetSupabaseInstance();
    setDbSavedMsg('Configuration saved successfully!');
    setTimeout(() => {
      setDbSavedMsg(null);
      setShowDbModal(false);
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-[#E4E4E6] relative overflow-x-hidden selection:bg-rose-500/30 transition-colors duration-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-rose-500/10 dark:bg-rose-950/20 rounded-full blur-3xl" />
      </div>

      {/* Top Bar Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md shrink-0">
            🧸
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-gray-900 dark:text-[#F2F2F2] flex items-center gap-1.5 truncate">
              <span>Chapiii</span>
              <span className="hidden xs:inline-block text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-rose-50 dark:bg-[#1C1C1E] text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                2-Person Channel
              </span>
            </h1>
          </div>
        </div>

        {/* Database Status Indicator & Theme Toggle */}
        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2] hover:bg-gray-200/60 dark:hover:bg-[#1C1C1E] transition"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-700" />}
            </button>
          )}

          {!inviteCode && (
            <button
              type="button"
              onClick={() => setShowDbModal(true)}
              className="min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#121214] hover:bg-gray-100 dark:hover:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-[#F2F2F2] transition shadow-xs"
              title="Database Configuration"
              aria-label="Database settings"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Supabase</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${supabaseConfig.isLiveConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
            </button>
          )}
        </div>
      </header>

      {/* Main Authentication / Invitation Card */}
      <main className="relative z-10 w-full max-w-[420px] mx-auto px-4 sm:px-6 py-6 sm:py-8 my-auto">
        <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#262629] rounded-2xl p-5 sm:p-8 backdrop-blur-xl shadow-xl">
          {/* INVITATION JOIN VIEW */}
          {inviteCode ? (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white mb-3.5 shadow-lg shadow-rose-900/30">
                  <Heart className="w-7 h-7 fill-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F2F2F2]">
                  Private Conversation
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] mt-2 max-w-xs mx-auto leading-relaxed">
                  {loadingInvite ? (
                    'Checking invitation...'
                  ) : invitation?.revoked_at ? (
                    <span className="text-amber-500 font-medium">
                      This invitation link has been revoked by the owner.
                    </span>
                  ) : invitation ? (
                    <>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {invitation.inviter_name || 'Your partner'}
                      </span>{' '}
                      has invited you to a private 2-person channel. No password or email needed!
                    </>
                  ) : (
                    'You have been invited to a private 2-person channel. Choose your nickname to join.'
                  )}
                </p>
              </div>

              {invitation?.revoked_at ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs sm:text-sm text-center space-y-2">
                  <p className="font-medium">Invitation Revoked</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                    The owner has generated a new invitation link. Please ask them to share the updated link with you.
                  </p>
                </div>
              ) : (
                <>
                  {error && (
                    <div
                      id="auth-error-alert"
                      role="alert"
                      className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="font-semibold text-rose-500 shrink-0">Error:</span>
                      <span className="break-words">{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleJoinViaInvite} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="invite-name-input" className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                        Your Name or Nickname
                      </label>
                      <input
                        id="invite-name-input"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Sam, Sweetheart, Alex"
                        required
                        autoFocus
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] placeholder-gray-400 dark:placeholder-[#48484A] text-base sm:text-sm focus:outline-none focus:border-rose-500 dark:focus:border-[#48484A] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-2">
                        Choose your avatar
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {AVATAR_PRESETS.map((avatarUrl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedAvatar(avatarUrl)}
                            className={`relative rounded-full overflow-hidden aspect-square border-2 transition ${
                              selectedAvatar === avatarUrl
                                ? 'border-rose-500 scale-105 shadow-md shadow-rose-900/30'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={avatarUrl} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                            {selectedAvatar === avatarUrl && (
                              <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white stroke-[3]" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      id="join-invite-btn"
                      type="submit"
                      disabled={loading || loadingInvite}
                      className="w-full min-h-[44px] mt-3 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 transition disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Heart className="w-4 h-4 fill-white" />
                          <span>Join Conversation</span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262629] text-center">
                <button
                  type="button"
                  onClick={() => setInviteCode(null)}
                  className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-rose-500 dark:hover:text-rose-400 transition"
                >
                  Are you the owner? Sign in here
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD AUTH FORM */
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 dark:bg-[#1C1C1E] border border-rose-100 dark:border-[#2C2C2E] text-rose-500 dark:text-rose-400 mb-3 shadow-inner">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F2F2F2]">
                  {isSignUp ? 'Create Private Account' : 'Welcome Back'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] mt-1 max-w-xs mx-auto leading-relaxed">
                  {isSignUp
                    ? 'Create your private credentials to start your 2-person channel'
                    : 'Sign in to access your secure private conversation'}
                </p>
              </div>

              {/* Error Message Box */}
              {error && (
                <div
                  id="auth-error-alert"
                  role="alert"
                  className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5"
                >
                  <span className="font-semibold text-rose-500 shrink-0">Error:</span>
                  <span className="break-words">{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4" noValidate>
                {isSignUp && (
                  <div>
                    <label htmlFor="display-name-input" className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                      Display Name
                    </label>
                    <input
                      id="display-name-input"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex"
                      required
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] placeholder-gray-400 dark:placeholder-[#48484A] text-base sm:text-sm focus:outline-none focus:border-rose-500 dark:focus:border-[#48484A] transition"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email-input" className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-[#8E8E93]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@private.chat"
                      required
                      autoComplete="email"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] placeholder-gray-400 dark:placeholder-[#48484A] text-base sm:text-sm focus:outline-none focus:border-rose-500 dark:focus:border-[#48484A] transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password-input" className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-[#8E8E93]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2] placeholder-gray-400 dark:placeholder-[#48484A] text-base sm:text-sm focus:outline-none focus:border-rose-500 dark:focus:border-[#48484A] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="min-h-[44px] min-w-[44px] absolute inset-y-0 right-0 pr-3 flex items-center justify-center text-gray-400 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-[#F2F2F2] transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] mt-2 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isSignUp ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Toggle between Sign In & Sign Up */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262629] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-rose-500 dark:hover:text-rose-400 transition py-1"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Security Badges */}
      <footer className="relative z-10 py-4 px-4 text-center text-xs text-gray-500 dark:text-[#8E8E93] flex flex-wrap items-center justify-center gap-2 sm:gap-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <span className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-gray-400 dark:text-[#8E8E93]" />
          End-to-End Private Channel
        </span>
        <span className="hidden sm:inline">•</span>
        <span>Real-time Supabase Sync</span>
        <span className="hidden sm:inline">•</span>
        <span>No 3rd Party Tracking</span>
      </footer>

      {/* Database Connection Config Modal */}
      {showDbModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="db-config-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDbModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#262629] rounded-2xl p-6 shadow-2xl space-y-4 text-gray-900 dark:text-[#E4E4E6] relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] flex items-center justify-center text-gray-700 dark:text-[#F2F2F2]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 id="db-config-title" className="text-base font-semibold text-gray-900 dark:text-[#F2F2F2]">
                  Supabase Configuration
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                  Connected PostgreSQL database
                </p>
              </div>
            </div>



            {dbSavedMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{dbSavedMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  required
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-xs text-gray-900 dark:text-[#F2F2F2] font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  required
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2C2C2E] text-xs text-gray-900 dark:text-[#F2F2F2] font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs shadow-md shadow-rose-900/20 transition"
                >
                  Save Configuration
                </button>
                <button
                  type="button"
                  onClick={() => setShowDbModal(false)}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#1C1C1E] hover:bg-gray-200 dark:hover:bg-[#262629] text-gray-700 dark:text-[#8E8E93] text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
