'use client';

import { Suspense } from 'react';

import FlashcardsClient from '@/components/study-tools/FlashcardsClient';
import PremiumStudyToolGate from '@/components/study-tools/PremiumStudyToolGate';

function FlashcardsPageContent() {
  return (
    <PremiumStudyToolGate
      title="Flashcards"
      subtitle="Turn notes into active-recall flashcards with citations."
    >
      <FlashcardsClient />
    </PremiumStudyToolGate>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-text-secondary">Loading…</div>}>
      <FlashcardsPageContent />
    </Suspense>
  );
}
