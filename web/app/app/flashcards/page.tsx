'use client';

import FlashcardsClient from '@/components/study-tools/FlashcardsClient';
import PremiumStudyToolGate from '@/components/study-tools/PremiumStudyToolGate';

export default function FlashcardsPage() {
  return (
    <PremiumStudyToolGate
      title="Flashcards"
      subtitle="Turn notes into active-recall flashcards with citations."
    >
      <FlashcardsClient />
    </PremiumStudyToolGate>
  );
}
