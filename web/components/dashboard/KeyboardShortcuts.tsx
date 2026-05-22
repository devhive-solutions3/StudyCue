'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';

/** Desktop shortcuts: N (new task pulse), / (open Cue chat), ⌘K (palette). */
export default function KeyboardShortcuts() {
  const router = useRouter();
  const { signalNewTask, setCommandOpen } = useDashboardUi();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (target?.isContentEditable ?? false);
      const metaOrCtrl = e.metaKey || e.ctrlKey;

      if (metaOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (!typing && e.key === 'n') {
        e.preventDefault();
        signalNewTask();
        return;
      }

      if (!typing && e.key === '/') {
        e.preventDefault();
        router.push('/app/chat');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, setCommandOpen, signalNewTask]);

  return null;
}
