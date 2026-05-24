'use client';

import { useEffect, useState } from 'react';

import { getAdsenseClient } from '@/lib/adsense-config';

/**
 * Lightweight consent banner before loading AdSense (see `docs/cookie-consent-klaro.md` for full Klaro option).
 *
 * NEXT_PUBLIC_SKIP_AD_CONSENT=1 bypasses prompting (still requires AdSense env to load creatives).
 */
export const AD_CONSENT_KEY = 'studycue.ads_consent';

export default function ConsentBar() {
  const skip = process.env.NEXT_PUBLIC_SKIP_AD_CONSENT === '1';
  const client = getAdsenseClient();

  const [open, setOpen] = useState(() => {
    if (skip || typeof window === 'undefined') return false;
    const v = localStorage.getItem(AD_CONSENT_KEY);
    return v !== 'granted' && v !== 'denied';
  });

  useEffect(() => {
    function onConsent() {
      const v = localStorage.getItem(AD_CONSENT_KEY);
      setOpen(!(v === 'granted' || v === 'denied'));
    }
    window.addEventListener('studycue-consent-changed', onConsent);
    return () => window.removeEventListener('studycue-consent-changed', onConsent);
  }, []);

  function accept() {
    localStorage.setItem(AD_CONSENT_KEY, 'granted');
    window.dispatchEvent(new Event('studycue-consent-changed'));
    setOpen(false);
  }

  function reject() {
    localStorage.setItem(AD_CONSENT_KEY, 'denied');
    window.dispatchEvent(new Event('studycue-consent-changed'));
    setOpen(false);
  }

  if (!open || !client) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999999] border-t border-white/10 bg-slate-950/95 px-4 py-4 text-sm text-white/85 shadow-[0_-8px_32px_rgba(0,0,0,.45)]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 text-center">
        <span>We load Google AdSense cookies only after you tap accept on marketing/content pages.</span>
        <button
          type="button"
          onClick={accept}
          className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500"
        >
          Accept personalized ads
        </button>
        <button type="button" onClick={reject} className="rounded-xl border border-white/25 px-4 py-2 text-white/85 hover:bg-white/10">
          Reject optional ads cookies
        </button>
        <a href="/cookies" className="text-blue-300 underline underline-offset-2 hover:text-blue-100">
          Cookie policy
        </a>
      </div>
    </div>
  );
}
