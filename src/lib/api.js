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
