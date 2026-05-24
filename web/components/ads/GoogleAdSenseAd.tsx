'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { AD_CONSENT_KEY } from '@/components/consent/ConsentBar';
import {
  getAdsenseClient,
  getAdsenseDisplaySlot,
  isProductionAdHost,
} from '@/lib/adsense-config';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type GoogleAdSenseAdProps = {
  className?: string;
  label?: string;
};

function useAdConsentAllowed(): boolean {
  const skipConsent = process.env.NEXT_PUBLIC_SKIP_AD_CONSENT === '1';
  const [allowed, setAllowed] = useState(() => skipConsent);

  useEffect(() => {
    function read() {
      if (skipConsent) {
        setAllowed(true);
        return;
      }
      setAllowed(localStorage.getItem(AD_CONSENT_KEY) === 'granted');
    }
    read();
    window.addEventListener('studycue-consent-changed', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('studycue-consent-changed', read);
      window.removeEventListener('storage', read);
    };
  }, [skipConsent]);

  return allowed;
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function GoogleAdSenseAd({
  className,
  label = 'Advertisement',
}: GoogleAdSenseAdProps) {
  const allowed = useAdConsentAllowed();
  const isClient = useIsClient();
  const pushedRef = useRef(false);
  const showLiveAd = isClient && allowed && isProductionAdHost();

  const client = getAdsenseClient();
  const slot = getAdsenseDisplaySlot();

  useEffect(() => {
    if (!showLiveAd || pushedRef.current) return;
    pushedRef.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      /* AdSense blocked or not ready */
    }
  }, [showLiveAd]);

  if (!isClient) {
    return (
      <AdFrame label={label} className={className}>
        <div className="min-h-[90px]" aria-hidden="true" />
      </AdFrame>
    );
  }

  if (!allowed) return null;

  if (!isProductionAdHost()) {
    return (
      <AdFrame label={label} className={className}>
        <p
          className="flex min-h-[90px] items-center justify-center text-center text-sm"
          style={{ color: 'var(--sc-text-muted)' }}
        >
          Advertisement placeholder
        </p>
      </AdFrame>
    );
  }

  return (
    <AdFrame label={label} className={className}>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </AdFrame>
  );
}

function AdFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={clsx('mx-auto w-full max-w-3xl', className)} aria-label={label}>
      <p
        className="mb-2 text-center text-[11px] font-medium uppercase tracking-widest"
        style={{ color: 'var(--sc-text-muted)' }}
      >
        {label}
      </p>
      <div
        className="overflow-hidden rounded-2xl border px-3 py-3"
        style={{
          minHeight: 90,
          background: 'var(--sc-surface)',
          borderColor: 'var(--sc-border)',
          boxShadow: 'var(--sc-shadow-sm)',
        }}
      >
        {children}
      </div>
    </aside>
  );
}
