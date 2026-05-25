'use client';

import type { ReactNode } from 'react';

import BrowserSentry from '@/components/analytics/BrowserSentry';
import ConsentBar from '@/components/consent/ConsentBar';
import AppTransitionOverlay from '@/components/layout/AppTransitionOverlay';
import ThemeBootClient from '@/components/ThemeBootClient';
import { ThemeProvider } from '@/context/theme-context';
import { WebAuthProvider } from '@/lib/firebase-client';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WebAuthProvider>
        <ThemeBootClient />
        <BrowserSentry />
        <ConsentBar />
        <AppTransitionOverlay />
        {children}
      </WebAuthProvider>
    </ThemeProvider>
  );
}
