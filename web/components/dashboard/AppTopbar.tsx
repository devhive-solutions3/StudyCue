'use client';

import { IconGlyph } from '@/lib/icon-map';

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AppTopbar({
  pageTitle,
  syncState,
  onSyncNow,
  syncBusy,
  onOpenSidebar,
}: {
  pageTitle: string;
  syncState: 'synced' | 'unsynced' | 'syncing';
  onSyncNow: () => void;
  syncBusy: boolean;
  onOpenSidebar: () => void;
}) {
  const statusLabel = syncState === 'syncing' ? 'Syncing...' : syncState === 'unsynced' ? 'Needs sync' : 'Synced';

  const statusStyle =
    syncState === 'unsynced'
      ? { background: 'var(--sc-yellow-soft)', color: 'var(--sc-yellow)' }
      : syncState === 'syncing'
        ? { background: 'var(--sc-blue-soft)', color: 'var(--sc-blue)' }
        : { background: 'var(--sc-teal-soft)', color: 'var(--sc-teal)' };

  return (
    <header
      className="sticky top-0 z-40 min-h-[76px]"
      style={{
        background: 'color-mix(in srgb, var(--sc-surface) 62%, transparent)',
        borderBottom: '1px solid var(--sc-border)',
        backdropFilter: 'blur(18px) saturate(135%)',
        WebkitBackdropFilter: 'blur(18px) saturate(135%)',
      }}
    >
      <div className="mx-auto flex min-h-[76px] max-w-[1520px] items-center gap-3 px-4 md:px-[38px]">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] transition md:hidden"
          style={{
            background: 'var(--sc-surface)',
            border: '1px solid var(--sc-border)',
            color: 'var(--sc-text-primary)',
          }}
          aria-label="Open sidebar"
        >
          <IconGlyph name="menu" />
        </button>
        <h1
          className="text-[22px] font-extrabold tracking-[-0.04em]"
          style={{ color: 'var(--sc-text-primary)' }}
        >
          {pageTitle}
        </h1>
        <p className="hidden text-[12.5px] md:block" style={{ color: 'var(--sc-text-muted)' }}>
          {todayLabel()}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="rounded-full px-[14px] py-[9px] text-[12px] font-extrabold"
            style={statusStyle}
          >
            {statusLabel}
          </span>
          {syncState === 'unsynced' ? (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={syncBusy}
              className="rounded-[12px] px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
              style={{
                background: 'var(--sc-surface)',
                color: 'var(--sc-text-primary)',
                border: '1px solid var(--sc-border)',
              }}
              onMouseEnter={(e) => {
                if (!syncBusy) e.currentTarget.style.background = 'var(--sc-surface-soft)';
              }}
              onMouseLeave={(e) => {
                if (!syncBusy) e.currentTarget.style.background = 'var(--sc-surface)';
              }}
            >
              {syncBusy ? 'Syncing...' : 'Sync now'}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
