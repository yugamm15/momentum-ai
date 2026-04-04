import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (configuredApiBase) {
    return `${configuredApiBase}${normalizedPath}`;
  }

  if (import.meta.env.DEV) {
    return `https://momentum-ai-meet.vercel.app${normalizedPath}`;
  }

  return normalizedPath;
}

export async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  const accessToken = await getAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
  });
}

async function getAccessToken() {
  if (!isSupabaseConfigured) {
    return '';
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return '';
    }

    return String(data?.session?.access_token || '').trim();
  } catch {
    return '';
  }
}
