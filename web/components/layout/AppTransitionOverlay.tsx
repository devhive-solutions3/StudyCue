'use client';

import { useEffect, useState } from 'react';

import GlowBackground from '@/components/layout/GlowBackground';
import {
  APP_TRANSITION_START_EVENT,
  APP_TRANSITION_STOP_EVENT,
} from '@/lib/app-transition';

export function TransitionCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      className="w-full max-w-[420px] rounded-[28px] border px-7 py-8 shadow-[var(--sc-shadow-md)]"
      style={{
        background: 'color-mix(in srgb, var(--sc-surface) 92%, transparent)',
        borderColor: 'var(--sc-border)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[16px]"
          style={{ background: 'var(--sc-accent-soft)', color: 'var(--sc-accent)' }}
        >
          <span className="text-lg">•</span>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-text-muted">StudyCue</p>
          <h2 className="mt-1 font-serif text-2xl leading-none text-text-primary">{title}</h2>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-text-secondary">{detail}</p>
      <div className="mt-5 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 animate-pulse rounded-full"
          style={{ background: 'var(--sc-accent)', animationDelay: '0ms' }}
        />
        <span
          className="h-2.5 w-2.5 animate-pulse rounded-full"
          style={{ background: 'var(--sc-blue)', animationDelay: '120ms' }}
        />
        <span
          className="h-2.5 w-2.5 animate-pulse rounded-full"
          style={{ background: 'var(--sc-teal)', animationDelay: '240ms' }}
        />
      </div>
    </div>
  );
}

export default function AppTransitionOverlay() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onStart = (event: Event) => {
      const next = event as CustomEvent<{ message?: string }>;
      setMessage(next.detail?.message || 'Preparing your workspace...');
    };
    const onStop = () => setMessage(null);

    window.addEventListener(APP_TRANSITION_START_EVENT, onStart as EventListener);
    window.addEventListener(APP_TRANSITION_STOP_EVENT, onStop);
    return () => {
      window.removeEventListener(APP_TRANSITION_START_EVENT, onStart as EventListener);
      window.removeEventListener(APP_TRANSITION_STOP_EVENT, onStop);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: 'color-mix(in srgb, var(--sc-bg) 74%, transparent)' }}
    >
      <GlowBackground>
        <TransitionCard
          title="One second..."
          detail={message}
        />
      </GlowBackground>
    </div>
  );
}
