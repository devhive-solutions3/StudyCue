/** StudyCue display ad unit (marketing pages). Override via NEXT_PUBLIC_* in Vercel if needed. */
export const ADSENSE_PUBLISHER_CLIENT = 'ca-pub-9703603099562509';
export const ADSENSE_DISPLAY_SLOT = '2828953288';

export function getAdsenseClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || ADSENSE_PUBLISHER_CLIENT;
}

export function getAdsenseDisplaySlot(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE?.trim() || ADSENSE_DISPLAY_SLOT;
}

const PRODUCTION_AD_HOSTS = new Set(['studycueplanner.com', 'www.studycueplanner.com']);

export function isProductionAdHost(hostname?: string): boolean {
  if (process.env.NEXT_PUBLIC_SHOW_ADS === '1') return true;
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .replace(/\.$/, '');
  return PRODUCTION_AD_HOSTS.has(host);
}
