export const siteTitle = 'StudyCue — Study planner + AI';

export function getSiteUrl(): string {
  const u = (process.env.EXPO_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (!u) return '';
  return u.replace(/\/$/, '');
}

export function canonical(path = ''): string {
  const base = getSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p || '/';
  return `${base}${p === '/' ? '' : p}`;
}
