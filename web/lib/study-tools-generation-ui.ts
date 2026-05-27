import { isLargeStudySource } from '@/lib/study-tools-text-limits';

export function studyGenerationFinalLabel(tool: 'quiz' | 'flashcards'): string {
  return tool === 'quiz' ? 'Generating quiz…' : 'Generating flashcards…';
}

/** Updates button label during long-running generation (condense happens server-side). */
export function beginStudyGenerationLoadingLabel(
  charCount: number,
  tool: 'quiz' | 'flashcards',
  onLabelChange: (label: string) => void,
): () => void {
  const finalLabel = studyGenerationFinalLabel(tool);
  if (!isLargeStudySource(charCount)) {
    onLabelChange(finalLabel);
    return () => {};
  }
  onLabelChange('Condensing your notes…');
  const timer = window.setTimeout(() => onLabelChange(finalLabel), 5000);
  return () => window.clearTimeout(timer);
}
