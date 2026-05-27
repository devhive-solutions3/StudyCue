'use client';

import { useEffect, useState } from 'react';

import type { AnnouncementPublic } from '@/lib/announcements-types';

export default function InAppAnnouncementModal() {
  const [announcement, setAnnouncement] = useState<AnnouncementPublic | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/announcements/unseen', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcement?: AnnouncementPublic | null } | null) => {
        if (!cancelled && data?.announcement) setAnnouncement(data.announcement);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss(actionClicked = false) {
    if (!announcement || dismissing) return;
    setDismissing(true);
    try {
      await fetch('/api/announcements/seen', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcementId: announcement.announcementId,
          actionClicked,
        }),
      });
    } catch {
      // still hide locally
    }
    setAnnouncement(null);
    setDismissing(false);
  }

  if (!announcement) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-lg)]"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
            {announcement.type}
          </span>
          <button
            type="button"
            onClick={() => void dismiss(false)}
            className="text-sm text-text-muted hover:text-text-primary"
            aria-label="Close announcement"
          >
            ×
          </button>
        </div>
        <h2 id="announcement-title" className="mt-4 font-serif text-2xl text-text-primary">
          {announcement.title}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{announcement.message}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {announcement.ctaLabel && announcement.ctaHref ? (
            <a
              href={announcement.ctaHref}
              onClick={() => void dismiss(true)}
              className="rounded-[14px] bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              {announcement.ctaLabel}
            </a>
          ) : null}
          <button
            type="button"
            disabled={dismissing}
            onClick={() => void dismiss(false)}
            className="rounded-[14px] border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text-primary"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
