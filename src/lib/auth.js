import { getSupabaseClient, isSupabaseConfigured } from './supabase';

function getBrowserOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data?.session ?? null;
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const supabase = getSupabaseClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });

  return () => subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Enter an email to receive a magic link.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase auth is not configured yet.');
  }

  const supabase = getSupabaseClient();
  const redirectTo = `${getBrowserOrigin()}/dashboard`;
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw error;
  }

  return {
    message: `Magic link sent to ${normalizedEmail}.`,
  };
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
