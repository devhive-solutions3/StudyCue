'use client';

import { useLayoutEffect } from 'react';

const STORAGE_KEY = 'studycue.theme';

function applyResolvedTheme(resolved: 'light' | 'dark') {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function resolveStoredTheme(): 'light' | 'dark' {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return theme === 'dark' || (theme === 'system' && prefersDark) ? 'dark' : 'light';
}

export default function ThemeBootClient() {
  useLayoutEffect(() => {
    try {
      applyResolvedTheme(resolveStoredTheme());
    } catch {
      applyResolvedTheme('light');
    }
  }, []);

  return null;
}
