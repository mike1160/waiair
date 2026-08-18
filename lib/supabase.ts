import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const ANON = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

let client: SupabaseClient | null = null;

export function supabaseEnabled(): boolean {
  return !!URL && !!ANON;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled()) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
