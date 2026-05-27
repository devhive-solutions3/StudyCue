'use client';

import type { ReactNode } from 'react';

import StudyToolsLockedPage from '@/components/study-tools/StudyToolsLockedPage';
import { usePremiumStudyTools } from '@/hooks/use-premium-study-tools';

export default function PremiumStudyToolGate({
  variant,
  children,
}: {
  variant: 'quiz' | 'flashcards';
  children: ReactNode;
}) {
  const { user, ready, loading, allowed, planLabel } = usePremiumStudyTools();

  if (!ready || loading) {
    return <div className="py-10 text-sm text-text-secondary">Loading…</div>;
  }

  if (!user) {
    const title =
      variant === 'quiz' ? 'Quiz Generator' : 'Flashcards';
    return (
      <div className="rounded-[16px] border border-border bg-surface-2 p-6">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign in to use study tools.</p>
      </div>
    );
  }

  if (!allowed) {
    return <StudyToolsLockedPage variant={variant} planLabel={planLabel} />;
  }

  return <>{children}</>;
}
