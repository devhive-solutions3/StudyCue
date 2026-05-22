'use client';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { DashboardUiProvider } from '@/context/dashboard-ui';
import { MirrorProvider, useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';

function MirrorGate({ children }: { children: React.ReactNode }) {
  const m = useMirror();
  if (m.loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center text-sm text-text-secondary">
        Loading your synced planner…
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
  const { ready, user } = useWebAuth();

  if (!ready) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-slate-950 text-white/70">
        Preparing your session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100vh] flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
        <p>You need an active session to open `/app`. Your secure cookie may have expired.</p>
        <a href="/login" className="rounded-xl bg-white/10 px-5 py-2 text-white hover:bg-white/20">
          Log in again
        </a>
      </div>
    );
  }

  return (
    <MirrorProvider uid={user.uid}>
      <DashboardUiProvider>
        <DashboardShell>
          <MirrorGate>{children}</MirrorGate>
        </DashboardShell>
      </DashboardUiProvider>
    </MirrorProvider>
  );
}
