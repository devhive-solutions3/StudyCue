'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useReducer, useState } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';
import AnimatedStudyCueLogo from '@/components/AnimatedStudyCueLogo';
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
  { href: '/app/focus-timer', label: 'Focus Timer', icon: 'timer' },
  { href: '/app/notes', label: 'Notes', icon: 'notes' },
];

const BOTTOM_ITEMS: Item[] = [
  { href: '/app/report-bug', label: 'Bug reports', icon: 'bug' },
  { href: '/app/settings', label: 'Settings', icon: 'settings' },
];

const ALLOWED_REMOTE_AVATAR_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
]);

function sanitizeAvatarSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('data:image/')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!ALLOWED_REMOTE_AVATAR_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isItemActive(pathname: string, item: Item) {
  return (
    (pathname === item.href || (item.href === '/app/focus-timer' && pathname === '/app/focus')) &&
    (item.href !== '/app' || item.label === 'Dashboard')
  );
}

function SidebarNavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { focusLocked, openFocusLockModal, setPendingNavHref } = useDashboardUi();

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      onClick={(event) => {
        if (focusLocked && item.href !== '/app/focus' && item.href !== '/app/focus-timer') {
          event.preventDefault();
          setPendingNavHref(item.href);
          openFocusLockModal();
          return;
        }
        onNavigate();
      }}
      className={[
        'group flex min-h-[46px] items-center rounded-[14px] text-[14px] font-bold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        collapsed ? 'justify-center px-0' : 'gap-3 px-[13px]',
      ].join(' ')}
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
      {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
    </Link>
  );
}

function NavSection({
  title,
  items,
  onNavigate,
  collapsed,
}: {
  title: string;
  items: Item[];
  onNavigate: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  return (
    <div className="mt-4 first:mt-0">
      {!collapsed ? (
        <p
          className="px-[10px] pb-2 text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: 'var(--sc-text-muted)' }}
        >
          {title}
        </p>
      ) : null}
      <div className="space-y-1">
        {items.map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <SidebarNavLink
              key={`${title}-${item.label}`}
              item={item}
              active={active}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
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
  collapsed,
  onToggleCollapsed,
}: {
  open: boolean;
  onClose: () => void;
  brand: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { user } = useWebAuth();
  const [, bumpSidebarAvatar] = useReducer((x: number) => x + 1, 0);
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);

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

  const visibleAvatar = useMemo(
    () => sanitizeAvatarSrc(getLocalProfilePhoto(user?.uid) ?? user?.photoURL ?? null),
    [user?.photoURL, user?.uid],
  );
  const showAvatar = !!visibleAvatar && failedAvatarSrc !== visibleAvatar;

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
          'fixed left-0 top-0 z-[100] flex h-full w-[252px] flex-col transition-[width,transform] duration-200 ease-out md:w-auto',
          collapsed ? 'md:w-[84px]' : 'md:w-[264px]',
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
        <div
          className={[
            'flex min-h-[86px] items-center overflow-visible py-[18px]',
            collapsed ? 'justify-center px-3' : 'justify-between gap-3 px-5',
          ].join(' ')}
          style={{ borderBottom: '1px solid var(--sc-border)' }}
        >
          <Link
            href="/"
            className={[
              'flex items-center overflow-visible',
              collapsed ? 'justify-center' : 'min-w-0 flex-1 gap-3',
            ].join(' ')}
            title="StudyCue home"
          >
            <span
              className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-[16px]"
              style={{ background: 'var(--sc-accent-soft)', boxShadow: 'var(--sc-shadow-accent)' }}
            >
              <AnimatedStudyCueLogo
                size={44}
                ariaLabel="StudyCue mascot"
                className="h-11 w-11 rounded-[12px]"
              />
            </span>
            {!collapsed ? (
              <span
                className="truncate whitespace-nowrap pr-1 text-[22px] leading-none"
                style={{
                  color: 'var(--sc-text-primary)',
                  fontFamily: 'var(--font-serif)',
                  letterSpacing: '-0.01em',
                }}
              >
                Study<span style={{ color: 'var(--sc-accent)' }}>Cue</span>
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapsed}
            className="hidden shrink-0 rounded-full border border-border bg-surface-2 p-2 text-text-secondary transition hover:bg-surface md:ml-3 md:inline-flex"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span aria-hidden="true" className="text-sm leading-none">
              {collapsed ? '›' : '‹'}
            </span>
          </button>
        </div>

        <Link
          href="/app/settings"
          title="Settings"
          className={[
            'flex items-center py-4 transition',
            collapsed ? 'justify-center px-3' : 'gap-3 px-[18px]',
          ].join(' ')}
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
            {showAvatar ? (
              <Image
                src={visibleAvatar}
                alt={brand}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
                onError={() => setFailedAvatarSrc(visibleAvatar)}
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
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
                {brand}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--sc-text-muted)' }}>
                Good luck today
              </p>
            </div>
          ) : <span className="sr-only">{brand}</span>}
        </Link>

        <nav className={`flex-1 overflow-y-auto py-[18px] ${collapsed ? 'px-3' : 'px-3'}`}>
          <NavSection title="Main" items={MAIN_ITEMS} onNavigate={onClose} collapsed={collapsed} />
          <NavSection title="Study" items={STUDY_ITEMS} onNavigate={onClose} collapsed={collapsed} />
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--sc-border)' }}>
          <div className="space-y-1">
            {BOTTOM_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <SidebarNavLink
                  key={item.label}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={onClose}
                />
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
