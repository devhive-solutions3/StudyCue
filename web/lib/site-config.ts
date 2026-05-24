import { siteTitle } from '@/lib/seo-config';

export { siteTitle };

const LOCAL_DEV_URL = 'http://localhost:3000';
const PRODUCTION_SITE_URL = 'https://studycueplanner.com';

/** Normalize env values; reject relative paths like `/api/cue`. */
function toAbsoluteSiteOrigin(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.startsWith('/')) return null;
  try {
    const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    return new URL(href).origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  const candidates = [
    process.env.EXPO_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const origin = toAbsoluteSiteOrigin(candidate);
    if (origin) return origin;
  }

  return '';
}

/** Always a valid absolute URL for metadataBase / sitemap / robots at build time. */
export function resolveSiteOrigin(): string {
  return getSiteUrl() || (process.env.VERCEL === '1' ? inferVercelOrigin() : LOCAL_DEV_URL);
}

function inferVercelOrigin(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (host) {
    const origin = toAbsoluteSiteOrigin(host);
    if (origin) return origin;
  }
  return PRODUCTION_SITE_URL;
}

export function canonical(path = ''): string {
  const base = resolveSiteOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p === '/' ? '' : p}`;
}
