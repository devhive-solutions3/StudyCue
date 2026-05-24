'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

import { AD_CONSENT_KEY } from '@/components/consent/ConsentBar';
import { getAdsenseClient } from '@/lib/adsense-config';

function readConsent(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(AD_CONSENT_KEY);
  if (v === 'granted' || v === 'denied') return v;
  return null;
}

/** Loads adsbygoogle.js once on marketing pages when consent is granted (or skip flag). */
export default function GoogleAdLoader() {
  const skip = process.env.NEXT_PUBLIC_SKIP_AD_CONSENT === '1';
  const client = getAdsenseClient();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      const c = skip || readConsent() === 'granted';
      setReady(!!client && c);
    }
    sync();
    window.addEventListener('studycue-consent-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('studycue-consent-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [client, skip]);

  if (!ready) return null;

  return (
    <Script
      id="adsense-loader"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
      async
    />
  );
}
