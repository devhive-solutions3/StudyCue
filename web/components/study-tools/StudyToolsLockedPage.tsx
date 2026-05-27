'use client';

import { STUDY_TOOLS_PLAN_DENIED_MESSAGE } from '@/lib/study-tools-request';

const COPY = {
  quiz: {
    title: 'Quiz Generator is available for Beta and StudyCue Plus users',
    message:
      'Turn notes into multiple-choice questions with citations. This feature is currently available to Beta testers and StudyCue Plus users.',
  },
  flashcards: {
    title: 'Flashcards are available for Beta and StudyCue Plus users',
    message:
      'Turn notes into active-recall cards with citations. This feature is currently available to Beta testers and StudyCue Plus users.',
  },
} as const;

export default function StudyToolsLockedPage({
  variant,
  planLabel = 'Free',
}: {
  variant: 'quiz' | 'flashcards';
  planLabel?: string;
}) {
  const content = COPY[variant];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study tools</p>
        <h1 className="mt-1 text-3xl font-semibold text-text-primary">{content.title}</h1>
        <p className="mt-2 text-sm text-text-secondary">{content.message}</p>
      </div>
      <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-text-primary">{STUDY_TOOLS_PLAN_DENIED_MESSAGE}</p>
        <p className="mt-2 text-xs text-text-muted">
          Your current plan: <span className="font-semibold text-text-primary">{planLabel}</span>
        </p>
        <button
          type="button"
          disabled
          className="sc-btn-secondary mt-5 cursor-not-allowed opacity-70"
          aria-disabled="true"
        >
          Coming Soon for Free
        </button>
      </div>
    </div>
  );
}
