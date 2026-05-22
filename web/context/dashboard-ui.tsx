'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ui = {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  newTaskSignal: number;
  signalNewTask: () => void;
  focusLocked: boolean;
  setFocusLocked: (locked: boolean) => void;
};

const UiCtx = createContext<Ui | null>(null);

export function DashboardUiProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [newTaskSignal, setSignal] = useState(0);
  const [focusLocked, setFocusLocked] = useState(false);
  const signalNewTask = useCallback(() => setSignal((x) => x + 1), []);

  const value = useMemo(
    () =>
      ({
        commandOpen,
        setCommandOpen,
        newTaskSignal,
        signalNewTask,
        focusLocked,
        setFocusLocked,
      }) satisfies Ui,
    [commandOpen, newTaskSignal, signalNewTask, focusLocked],
  );

  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function useDashboardUi(): Ui {
  const c = useContext(UiCtx);
  if (!c) throw new Error('useDashboardUi must be inside DashboardUiProvider');
  return c;
}
