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

function subscribeToSystemTheme(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const mediaHandler = () => onChange();
  const windowHandler = () => onChange();
  const visibilityHandler = () => {
    if (!document.hidden) onChange();
  };

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', mediaHandler);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(mediaHandler);
  }

  window.addEventListener('focus', windowHandler);
  window.addEventListener('pageshow', windowHandler);
  document.addEventListener('visibilitychange', visibilityHandler);

  return () => {
    if (typeof mq.removeEventListener === 'function') {
      mq.removeEventListener('change', mediaHandler);
    } else if (typeof mq.removeListener === 'function') {
      mq.removeListener(mediaHandler);
    }
    window.removeEventListener('focus', windowHandler);
    window.removeEventListener('pageshow', windowHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);
  };
}

function readInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      return subscribeToSystemTheme(() => applyTheme('system'));
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
