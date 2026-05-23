'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ui = {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  newTaskSignal: number;
  signalNewTask: () => void;
  focusLocked: boolean;
  setFocusLocked: (locked: boolean) => void;
  focusLockModalOpen: boolean;
  openFocusLockModal: () => void;
  closeFocusLockModal: () => void;
};

const UiCtx = createContext<Ui | null>(null);

export function DashboardUiProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [newTaskSignal, setSignal] = useState(0);
  const [focusLocked, setFocusLocked] = useState(false);
  const [focusLockModalOpen, setFocusLockModalOpen] = useState(false);
  const signalNewTask = useCallback(() => setSignal((x) => x + 1), []);
  const openFocusLockModal = useCallback(() => setFocusLockModalOpen(true), []);
  const closeFocusLockModal = useCallback(() => setFocusLockModalOpen(false), []);

  const value = useMemo(
    () =>
      ({
        commandOpen,
        setCommandOpen,
        newTaskSignal,
        signalNewTask,
        focusLocked,
        setFocusLocked,
        focusLockModalOpen,
        openFocusLockModal,
        closeFocusLockModal,
      }) satisfies Ui,
    [closeFocusLockModal, commandOpen, focusLockModalOpen, newTaskSignal, openFocusLockModal, signalNewTask, focusLocked],
  );

  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function useDashboardUi(): Ui {
  const c = useContext(UiCtx);
  if (!c) throw new Error('useDashboardUi must be inside DashboardUiProvider');
  return c;
}
