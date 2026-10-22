import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { UserAccount } from './types';

// Environment variables provided by Vite (e.g. in .env or deployment environments)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Validates whether real, non-placeholder Supabase credentials have been configured.
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  const cleanUrl = supabaseUrl.trim().toLowerCase();
  const cleanKey = supabaseAnonKey.trim();

  // Guard against template / placeholder strings
  if (
    cleanUrl.includes('your-project') ||
    cleanUrl.includes('placeholder') ||
    cleanUrl.includes('example.com') ||
    !cleanUrl.startsWith('http')
  ) {
    return false;
  }
  if (cleanKey.includes('your-anon-key') || cleanKey.length < 20) {
    return false;
  }

  return true;
}

/**
 * The initialized Supabase client singleton, or null if credentials are not configured yet.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured()) {
    console.log('[Nabbit] ⚡ Supabase Auth is ACTIVE connected to:', supabaseUrl);
  } else {
    console.info('[Nabbit] ℹ️ Supabase keys pending in .env. Running in Local Mode.');
  }
}

/**
 * Maps a Supabase Auth User object into Nabbit's internal UserAccount model.
 */
export function mapSupabaseUser(user: SupabaseUser): UserAccount {
  const metadata = user.user_metadata || {};
  const phone = (metadata.phone_number || user.phone || '') as string;
  const countryCode = (metadata.phone_country_code || '+1') as string;

  return {
    id: user.id,
    email: user.email || '',
    phoneNumber: phone,
    phoneCountryCode: countryCode,
    emailVerified: Boolean(user.email_confirmed_at),
    phoneVerified: Boolean(user.phone_confirmed_at),
    createdAt: user.created_at ? new Date(user.created_at).getTime() : Date.now(),
    emailVerificationSentAt: user.confirmation_sent_at
      ? new Date(user.confirmation_sent_at).getTime()
      : undefined,
  };
}
