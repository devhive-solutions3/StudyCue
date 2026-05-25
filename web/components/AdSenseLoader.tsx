'use client';

import { useEffect, useState } from 'react';

import { AD_CONSENT_KEY } from '@/components/consent/ConsentBar';
import { getAdsenseClient } from '@/lib/adsense-config';

function readConsent(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(AD_CONSENT_KEY);
  if (value === 'granted' || value === 'denied') return value;
  return null;
}

export default function AdSenseLoader() {
  const skipConsent = process.env.NEXT_PUBLIC_SKIP_AD_CONSENT === '1';
  const client = getAdsenseClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      const consentGranted = skipConsent || readConsent() === 'granted';
      setReady(Boolean(client) && consentGranted);
    }

    sync();
    window.addEventListener('studycue-consent-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('studycue-consent-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [client, skipConsent]);

  useEffect(() => {
    if (!ready || !client) return;
    if (document.getElementById('studycue-adsense-script')) return;

    const script = document.createElement('script');
    script.id = 'studycue-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }, [client, ready]);

  return null;
}
