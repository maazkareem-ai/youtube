import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default environment variables (Vite or Next.js conventions)
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const envUrl = (metaEnv.VITE_SUPABASE_URL || metaEnv.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const STORAGE_KEY_URL = 'two_chat_supabase_url';
const STORAGE_KEY_ANON = 'two_chat_supabase_anon';

export function getStoredSupabaseConfig(): { url: string; anonKey: string; isLiveConfigured: boolean; keyError: string | null } {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ANON) || '' : '';

  const activeUrl = (localUrl || envUrl).trim();
  const activeKey = (localKey || envKey).trim();

  const isUrlValid = Boolean(
    activeUrl &&
    activeUrl.startsWith('http') &&
    activeUrl.includes('.') &&
    !activeUrl.includes('your-project')
  );

  const isKeyValid = Boolean(
    activeKey && (activeKey.startsWith('eyJ') || activeKey.startsWith('sb_publishable_') || activeKey.length >= 20)
  );

  const isLiveConfigured = Boolean(isUrlValid && isKeyValid);

  return {
    url: activeUrl,
    anonKey: activeKey,
    isLiveConfigured,
    keyError: null,
  };
}

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (anonKey) localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    else localStorage.removeItem(STORAGE_KEY_ANON);
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isLiveConfigured } = getStoredSupabaseConfig();
  if (!isLiveConfigured) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function resetSupabaseInstance() {
  supabaseInstance = null;
}
