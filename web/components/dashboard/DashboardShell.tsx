'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';

import GlowBackground from '@/components/layout/GlowBackground';
import AddTaskFab from './AddTaskFab';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import FocusLockModal from './FocusLockModal';
import MobileBottomNav from './MobileBottomNav';

const SIDEBAR_COLLAPSED_KEY = 'studycue_sidebar_collapsed';

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useWebAuth();
  const mirror = useMirror();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') {
      const frameId = window.requestAnimationFrame(() => {
        setSidebarCollapsed(true);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
          : pathname === '/app/focus' || pathname === '/app/focus-timer'
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
      <div className="min-h-[100vh] max-w-full overflow-x-clip text-text-primary">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          brand={brand}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
        <div
          className={[
            'min-w-0 max-w-full transition-[margin] duration-200 ease-out',
            sidebarCollapsed ? 'md:ml-[84px]' : 'md:ml-[252px]',
          ].join(' ')}
        >
          <AppTopbar
            pageTitle={title}
            syncState={syncState}
            syncBusy={mirror.saving}
            onSyncNow={() => void mirror.persistNow()}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <main
            className="mx-auto w-full min-w-0 max-w-full px-4 py-6 pb-28 md:px-8 md:py-[34px] md:pb-[100px] xl:max-w-[1520px]"
          >
            {children}
          </main>
        </div>
        <AddTaskFab />
        <MobileBottomNav />
        <FocusLockModal />
      </div>
    </GlowBackground>
  );
}
