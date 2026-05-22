'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';

import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';

import GlowBackground from '@/components/layout/GlowBackground';
import AddTaskFab from './AddTaskFab';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import MobileBottomNav from './MobileBottomNav';

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useWebAuth();
  const mirror = useMirror();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const brand = useMemo(() => user?.displayName ?? user?.email ?? 'Signed in', [user]);
  const syncState: 'synced' | 'unsynced' | 'syncing' = mirror.saving
    ? 'syncing'
    : mirror.error
      ? 'unsynced'
      : 'synced';
  const title =
    pathname === '/app'
      ? 'Dashboard'
      : pathname === '/app/calendar'
        ? 'Calendar'
        : pathname === '/app/tasks'
          ? 'Tasks'
          : pathname === '/app/focus'
            ? 'Focus Timer'
        : pathname === '/app/chat'
          ? 'Study Assistant'
          : pathname === '/app/notes'
            ? 'Notes'
          : pathname === '/app/stats'
            ? 'Stats'
        : pathname === '/app/settings'
          ? 'Settings'
            : pathname === '/app/profile'
              ? 'Profile'
              : 'Workspace';

  return (
    <GlowBackground>
      <div className="min-h-[100vh] text-text-primary">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} brand={brand} />
        <div className="md:ml-[var(--sidebar-w)]">
          <AppTopbar
            pageTitle={title}
            syncState={syncState}
            syncBusy={mirror.saving}
            onSyncNow={() => void mirror.persistNow()}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <main className="mx-auto w-full max-w-[1520px] px-4 py-6 pb-28 md:px-[38px] md:py-[34px] md:pb-[100px]">
            {children}
          </main>
        </div>
        <AddTaskFab />
        <MobileBottomNav />
      </div>
    </GlowBackground>
  );
}
