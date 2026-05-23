'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';

const LINKS = [
  { href: '/app', label: 'Home' },
  { href: '/app/calendar', label: 'Calendar' },
  { href: '/app/stats', label: 'Stats' },
  { href: '/app/settings', label: 'Settings' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { focusLocked, openFocusLockModal } = useDashboardUi();

  function guardNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (focusLocked && href !== '/app/focus') {
      event.preventDefault();
      openFocusLockModal();
    }
  }
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[80] px-2 pb-3 pt-2 md:hidden"
      style={{
        background: 'color-mix(in srgb, var(--sc-surface) 88%, transparent)',
        borderTop: '1px solid var(--sc-border)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      }}
    >
      <div className="grid grid-cols-5 items-end">
        {LINKS.slice(0, 2).map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={(event) => guardNavigation(event, l.href)}
              className="flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium"
              style={{ color: active ? 'var(--sc-accent)' : 'var(--sc-text-muted)' }}
            >
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: active ? 'var(--sc-accent)' : 'transparent' }}
              />
              <span>{l.label}</span>
            </Link>
          );
        })}
        <Link
          href="/app/chat"
          onClick={(event) => guardNavigation(event, '/app/chat')}
          className="flex items-start justify-center"
        >
          <span
            className="relative -mt-5 inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, var(--sc-accent), var(--sc-blue))',
              boxShadow: 'var(--sc-shadow-accent)',
            }}
          >
            <Image
              src="/cue-icon-light.png"
              alt="Cue"
              width={54}
              height={54}
              className="h-[54px] w-[54px] object-contain drop-shadow dark:hidden"
            />
            <Image
              src="/cue-icon-dark-cropped.png"
              alt="Cue"
              width={54}
              height={54}
              className="hidden h-[54px] w-[54px] object-contain drop-shadow dark:block"
            />
          </span>
        </Link>
        {LINKS.slice(2).map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={(event) => guardNavigation(event, l.href)}
              className="flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium"
              style={{ color: active ? 'var(--sc-accent)' : 'var(--sc-text-muted)' }}
            >
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: active ? 'var(--sc-accent)' : 'transparent' }}
              />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
