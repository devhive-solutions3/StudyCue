'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { featureFromAppPathname, routeFromAppPathname } from '@/lib/analytics-route-map';
import { useWebAuth } from '@/lib/firebase-client';

const DEBOUNCE_MS = 1200;

export default function AppAnalyticsTracker() {
  const pathname = usePathname();
  const { user } = useWebAuth();
  const lastTrackedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !pathname?.startsWith('/app')) return;
    if (pathname.startsWith('/admin')) return;

    const feature = featureFromAppPathname(pathname);
    if (!feature) return;

    const route = routeFromAppPathname(pathname) ?? pathname;
    const trackingKey = `${route}:${feature}`;
    if (lastTrackedRef.current === trackingKey) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastTrackedRef.current = trackingKey;
      void fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          eventType: 'page_view',
          feature,
          route,
        }),
      }).catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, user]);

  return null;
}
