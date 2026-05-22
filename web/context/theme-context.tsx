'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type AppTheme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'studycue.theme';

type ThemeCtxValue = {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
};

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

function resolveEffective(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: AppTheme) {
  const effective = resolveEffective(theme);
  if (effective === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored);
      applyTheme(stored);
    } else {
      applyTheme('system');
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeCtxValue {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme must be used inside ThemeProvider');
  return c;
}
