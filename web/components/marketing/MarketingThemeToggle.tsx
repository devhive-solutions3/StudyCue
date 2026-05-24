'use client';

import { useCallback } from 'react';

import { useTheme } from '@/context/theme-context';

export default function MarketingThemeToggle() {
  const { setTheme } = useTheme();

  const toggle = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  }, [setTheme]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="sc-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[12px] border transition hover:bg-[var(--sc-surface-soft)]"
      style={{
        borderColor: 'var(--sc-border)',
        color: 'var(--sc-text-secondary)',
      }}
    >
      <span className="sr-only">Toggle dark or light mode</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="hidden dark:block"
      >
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5V5M12 19V21.5M4.22 4.22L6.04 6.04M17.96 17.96L19.78 19.78M2.5 12H5M19 12H21.5M4.22 19.78L6.04 17.96M17.96 6.04L19.78 4.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="dark:hidden"
      >
        <path
          d="M21 14.5A7.5 7.5 0 0 1 9.5 3 7.5 7.5 0 1 0 21 14.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
