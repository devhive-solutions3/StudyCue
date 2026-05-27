'use client';

const RETAKE_KEY = 'studycue_quiz_retake_v1';

export function setQuizRetakeSession(quizId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETAKE_KEY, quizId);
}

export function consumeQuizRetakeSession(): string | null {
  if (typeof window === 'undefined') return null;
  const quizId = sessionStorage.getItem(RETAKE_KEY);
  if (quizId) sessionStorage.removeItem(RETAKE_KEY);
  return quizId;
}
