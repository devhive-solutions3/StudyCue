'use client';

import { useEffect } from 'react';

/** Plausible; no consent needed for basic EU guidance when cookieless stats — still pair with banner for ads providers. */
export default function PrivacyAnalyticsScripts() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const url =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim() || 'https://plausible.io/js/script.tagged-events.js';

  useEffect(() => {
    if (!domain) return;
    if (document.getElementById('studycue-plausible-script')) return;

    const script = document.createElement('script');
    script.id = 'studycue-plausible-script';
    script.defer = true;
    script.dataset.domain = domain;
    script.src = url;
    document.head.appendChild(script);
  }, [domain, url]);

  return null;
}
