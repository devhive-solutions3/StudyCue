'use client';

import { Suspense } from 'react';

import PremiumStudyToolGate from '@/components/study-tools/PremiumStudyToolGate';
import QuizGeneratorClient from '@/components/study-tools/QuizGeneratorClient';

function QuizPageContent() {
  return (
    <PremiumStudyToolGate
      title="Quiz Generator"
      subtitle="Generate multiple-choice quizzes from your notes with citations."
    >
      <QuizGeneratorClient />
    </PremiumStudyToolGate>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-text-secondary">Loading…</div>}>
      <QuizPageContent />
    </Suspense>
  );
}
