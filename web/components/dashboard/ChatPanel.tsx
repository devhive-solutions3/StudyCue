'use client';

import Image from 'next/image';
import Link from 'next/link';

/** Mini Cue preview on homepage; collapsed mode only links onward. */
export default function ChatPanel({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <div
          className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: 'var(--sc-accent-soft)' }}
        >
          <Image
            src="/cue-icon-light.png"
            alt="Cue"
            width={58}
            height={58}
            className="h-[58px] w-[58px] object-contain dark:hidden"
          />
          <Image
            src="/cue-icon-dark-cropped.png"
            alt="Cue"
            width={58}
            height={58}
            className="hidden h-[58px] w-[58px] object-contain dark:block"
          />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">Study assistant</p>
          <p className="font-serif text-lg leading-none text-text-primary">Cue</p>
        </div>
      </div>
      <p className="text-text-secondary">
        Cue summarizes your mirror (classes + open tasks), chats through the same Gemini/Groq proxy as mobile, and can
        read schedule screenshots to add classes to your calendar.
      </p>
      {!collapsed ? null : (
        <Link
          href="/app/chat"
          className="inline-flex rounded-[12px] px-4 py-2 text-xs font-semibold transition"
          style={{
            background: 'var(--sc-surface)',
            border: '1px solid var(--sc-border)',
            color: 'var(--sc-text-primary)',
          }}
        >
          Open full chat overlay
        </Link>
      )}
    </div>
  );
}
