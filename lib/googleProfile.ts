import { getSupabase, supabaseEnabled } from './supabase';
import type { GoogleAuthProfile } from './googleAuthSession';

/** Create or update the users row after Google sign-in. Failures are ignored. */
export async function upsertGoogleUserProfile(profile: GoogleAuthProfile): Promise<void> {
  const sb = getSupabase();
  if (!sb || !supabaseEnabled()) return;
  const { data, error } = await sb.auth.signInWithIdToken({
    provider: 'google',
    token: profile.idToken,
  });
  if (error || !data.user) return;
  const meta = (data.user.user_metadata || {}) as Record<string, string>;
  await sb.from('users').upsert({
    id: data.user.id,
    email: profile.email || data.user.email || meta.email || '',
    display_name: profile.name || meta.full_name || meta.name || '',
    avatar_url: profile.picture || meta.avatar_url || meta.picture || '',
  }, { onConflict: 'id' });
}
