'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useReducer } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';
import { IconGlyph, type IconName } from '@/lib/icon-map';
import { getLocalProfilePhoto } from '@/lib/local-file-store';
import { useWebAuth } from '@/lib/firebase-client';

type Item = { href: string; label: string; icon: IconName };

const MAIN_ITEMS: Item[] = [
  { href: '/app', label: 'Dashboard', icon: 'dashboard' },
  { href: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/app/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/app/stats', label: 'Stats', icon: 'stats' },
];

const STUDY_ITEMS: Item[] = [
  { href: '/app/focus', label: 'Focus Timer', icon: 'timer' },
  { href: '/app/notes', label: 'Notes', icon: 'notes' },
];

const BOTTOM_ITEMS: Item[] = [
  { href: '/app/settings', label: 'Settings', icon: 'settings' },
];

function NavSection({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const { focusLocked, openFocusLockModal } = useDashboardUi();
  return (
    <div className="mt-4 first:mt-0">
      <p
        className="px-[10px] pb-2 text-[11px] font-extrabold uppercase tracking-[0.12em]"
        style={{ color: 'var(--sc-text-muted)' }}
      >
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href && (item.href !== '/app' || item.label === 'Dashboard');
          return (
            <Link
              key={`${title}-${item.label}`}
              href={item.href}
              onClick={(event) => {
                if (focusLocked && item.href !== '/app/focus') {
                  event.preventDefault();
                  openFocusLockModal();
                  return;
                }
                onNavigate();
              }}
              className="group flex min-h-[46px] items-center gap-3 rounded-[12px] px-[13px] text-[14px] font-bold transition"
              style={
                active
                  ? {
                      background: 'var(--sc-accent-soft)',
                      color: 'var(--sc-accent)',
                      fontWeight: 700,
                    }
                  : {
                      color: 'var(--sc-text-secondary)',
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--sc-surface-soft)';
                  e.currentTarget.style.color = 'var(--sc-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--sc-text-secondary)';
                }
              }}
            >
              <IconGlyph name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AppSidebar({
  open,
  onClose,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  brand: string;
}) {
  const pathname = usePathname();
  const { focusLocked, openFocusLockModal } = useDashboardUi();
  const { user } = useWebAuth();
  const [, bumpSidebarAvatar] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const onCustom = () => bumpSidebarAvatar();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('studycue.profilePhoto.')) bumpSidebarAvatar();
    };
    window.addEventListener('studycue-profile-photo-changed', onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('studycue-profile-photo-changed', onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const initials =
    brand
      .split(/\s+/)
      .map((x) => x[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'SC';

  const visibleAvatar =
    getLocalProfilePhoto(user?.uid) ?? user?.photoURL ?? null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[90] backdrop-blur-sm md:hidden ${open ? 'block' : 'hidden'}`}
        style={{ background: 'rgba(15, 14, 26, 0.45)' }}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed left-0 top-0 z-[100] flex h-full w-[252px] flex-col transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{
          background: 'color-mix(in srgb, var(--sc-surface) 82%, transparent)',
          borderRight: '1px solid var(--sc-border)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: 'var(--sc-shadow-sm)',
        }}
      >
        {/* Logo */}
        <div className="flex min-h-[86px] items-center overflow-visible px-5 py-[18px]" style={{ borderBottom: '1px solid var(--sc-border)' }}>
          <Link href="/" className="flex items-center gap-3 overflow-visible">
            <span
              className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-[16px]"
              style={{ background: 'var(--sc-accent-soft)', boxShadow: 'var(--sc-shadow-accent)' }}
            >
              <Image
                src="/cue-icon-light.png"
                alt="StudyCue"
                width={44}
                height={44}
                className="h-11 w-11 object-contain dark:hidden"
                priority
              />
              <Image
                src="/cue-icon-dark-cropped.png"
                alt="StudyCue"
                width={44}
                height={44}
                className="hidden h-11 w-11 object-contain dark:block"
                priority
              />
            </span>
            <span
              className="text-[23px] leading-none"
              style={{
                color: 'var(--sc-text-primary)',
                fontFamily: 'var(--font-dm-serif), Georgia, serif',
                letterSpacing: '-0.01em',
              }}
            >
              Study<span style={{ color: 'var(--sc-accent)' }}>Cue</span>
            </span>
          </Link>
        </div>

        {/* User strip */}
        <Link
          href="/app/settings"
          className="flex items-center gap-3 px-[18px] py-4 transition"
          style={{ borderBottom: '1px solid var(--sc-border)' }}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sc-surface-soft)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div className="relative h-9 w-9 shrink-0">
            {visibleAvatar ? (
              <Image
                src={visibleAvatar}
                alt={brand}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
                unoptimized={
                  typeof visibleAvatar === 'string' &&
                  visibleAvatar.startsWith('data:')
                }
              />
            ) : (
              <div
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--sc-accent), var(--sc-blue))' }}
              >
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
              {brand}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--sc-text-muted)' }}>
              Good luck today
            </p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-[18px]">
          <NavSection title="Main" items={MAIN_ITEMS} onNavigate={onClose} />
          <NavSection title="Study" items={STUDY_ITEMS} onNavigate={onClose} />
        </nav>

        {/* Bottom items */}
        <div className="p-3" style={{ borderTop: '1px solid var(--sc-border)' }}>
          <div className="space-y-1">
            {BOTTOM_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(event) => {
                    if (focusLocked && item.href !== '/app/focus') {
                      event.preventDefault();
                      openFocusLockModal();
                      return;
                    }
                    onClose();
                  }}
                  className="flex min-h-[46px] items-center gap-3 rounded-[12px] px-[13px] text-[14px] font-bold transition"
                  style={
                    active
                      ? {
                          background: 'var(--sc-accent-soft)',
                          color: 'var(--sc-accent)',
                          fontWeight: 700,
                        }
                      : {
                          color: 'var(--sc-text-secondary)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--sc-surface-soft)';
                      e.currentTarget.style.color = 'var(--sc-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--sc-text-secondary)';
                    }
                  }}
                >
                  <IconGlyph name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
