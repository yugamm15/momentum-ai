import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (configuredApiBase) {
    return `${configuredApiBase}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  const accessToken = await getAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
  });

  if (import.meta.env.DEV && !configuredApiBase && response.status === 404) {
    throw new Error(
      'Local API routes were not found. Set VITE_API_BASE_URL for development or run the app from an environment that serves /api routes.'
    );
  }

  return response;
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
