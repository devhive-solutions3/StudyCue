export type QuizOptionVisualState = {
  isAnswered: boolean;
  isSelected: boolean;
  isCorrect: boolean;
  isWrongSelected: boolean;
};

export function getQuizOptionVisualState(params: {
  option: string;
  selectedAnswer: string | null;
  correctAnswer: string;
}): QuizOptionVisualState {
  const isAnswered = params.selectedAnswer != null;
  const isSelected = params.selectedAnswer === params.option;
  const isCorrect = params.option.trim() === params.correctAnswer.trim();
  const isWrongSelected = isAnswered && isSelected && !isCorrect;

  return { isAnswered, isSelected, isCorrect, isWrongSelected };
}

export function quizOptionButtonClassName(state: QuizOptionVisualState): string {
  const base = 'w-full rounded-[12px] border px-4 py-3 text-left text-sm transition-colors';

  if (state.isAnswered && state.isCorrect) {
    return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
  }
  if (state.isWrongSelected) {
    return `${base} border-rose-500 bg-rose-50 text-rose-900`;
  }
  return `${base} border-border bg-surface-2 hover:bg-surface`;
}
