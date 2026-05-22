'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';

const items = [
  { href: '/app', title: 'Today', hint: 'Home' },
  { href: '/app/calendar', title: 'Calendar', hint: 'Drag classes' },
  { href: '/app/chat', title: 'Cue chat', hint: 'AI planner' },
  { href: '/app/stats', title: 'Stats', hint: 'Focus charts' },
  { href: '/app/profile', title: 'Profile', hint: 'Account' },
];

export default function CommandPalette() {
  const { commandOpen, setCommandOpen } = useDashboardUi();

  useEffect(() => {
    if (!commandOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setCommandOpen(false);
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [commandOpen, setCommandOpen]);

  if (!commandOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]"
      style={{ background: 'rgba(15, 14, 26, 0.45)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal
      aria-label="Command palette"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={() => setCommandOpen(false)}
      />
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: 'var(--sc-surface)',
          border: '1px solid var(--sc-border)',
          borderRadius: 'var(--sc-radius-lg)',
          boxShadow: 'var(--sc-shadow-md)',
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--sc-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
            Go to…
          </p>
          <p className="text-xs" style={{ color: 'var(--sc-text-muted)' }}>
            ⌘K to toggle · Esc closes
          </p>
        </div>
        <ul className="py-2">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="flex items-center justify-between px-5 py-3 transition"
                style={{ color: 'var(--sc-text-primary)' }}
                onClick={() => setCommandOpen(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--sc-surface-soft)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span className="text-sm font-medium">{it.title}</span>
                <span className="text-xs" style={{ color: 'var(--sc-text-muted)' }}>
                  {it.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
