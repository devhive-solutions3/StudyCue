'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import GlowBackground from '@/components/layout/GlowBackground';
import { TransitionCard } from '@/components/layout/AppTransitionOverlay';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { DashboardUiProvider } from '@/context/dashboard-ui';
import { FocusTimerProvider } from '@/context/focus-timer';
import { MirrorProvider, useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';

function MirrorGate({ children }: { children: React.ReactNode }) {
  const m = useMirror();
  if (m.loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-4">
        <div className="w-full max-w-[560px] rounded-[24px] border border-border bg-surface px-6 py-6 shadow-[var(--sc-shadow-sm)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-text-muted">Workspace</p>
          <h2 className="mt-2 font-serif text-2xl text-text-primary">Syncing your planner</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Your dashboard shell is ready. StudyCue is loading your cloud snapshot and recent activity now.
          </p>
          <div className="mt-5 grid gap-3">
            <div className="h-14 animate-pulse rounded-[18px] bg-surface-2" />
            <div className="h-24 animate-pulse rounded-[18px] bg-surface-2" />
            <div className="h-24 animate-pulse rounded-[18px] bg-surface-2" />
          </div>
        </div>
      </div>
    );
  }
  if (m.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        <p className="font-semibold">Cloud sync error</p>
        <p className="mt-2">
          {m.error}
        </p>
        <p className="mt-2 text-xs text-rose-600">
          You are signed in, but StudyCue cannot read your Firestore mirror yet. Check Firestore rules/auth for this user.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AppWorkspaceProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authLoading, user } = useWebAuth();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!ready || authLoading || user || redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace(`/login?next=${encodeURIComponent(pathname || '/app')}`);
  }, [ready, authLoading, user, pathname, router]);

  if (!ready) {
    return (
      <FullscreenStatus
        title="Opening your dashboard"
        detail="Checking your session and restoring your planner shell."
      />
    );
  }

  if (!user) {
    return (
      <FullscreenStatus
        title="Opening your dashboard"
        detail="Checking your account and sending you to the correct sign-in route."
      />
    );
  }

  return (
    <MirrorProvider uid={user.uid}>
      <FocusTimerProvider>
        <DashboardUiProvider>
          <DashboardShell>
            <MirrorGate>{children}</MirrorGate>
          </DashboardShell>
        </DashboardUiProvider>
      </FocusTimerProvider>
    </MirrorProvider>
  );
}

function FullscreenStatus({
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <GlowBackground>
      <div className="flex min-h-[100vh] items-center justify-center px-6">
        <div className="w-full max-w-[420px]">
          <TransitionCard title={title} detail={detail} />
          {actionHref && actionLabel ? (
            <div className="mt-4 flex justify-center">
              <a
                href={actionHref}
                className="rounded-[14px] border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-2"
              >
                {actionLabel}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </GlowBackground>
  );
}
