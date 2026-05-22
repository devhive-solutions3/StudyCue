'use client';

import { useEffect } from 'react';

import * as Sentry from '@sentry/react';

/** Browser-only Sentry; no-op if NEXT_PUBLIC_SENTRY_DSN unset. */
export default function BrowserSentry() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    if (!dsn) return;
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }, []);
  return null;
}
