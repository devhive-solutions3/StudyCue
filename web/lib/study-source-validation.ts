import type { StudySourceSelection } from '@/lib/study-tools-types';
import { hasReadyStudySource } from '@/lib/study-tools-types';

export function studyGenerateBlockedMessage(params: {
  source: StudySourceSelection | null | undefined;
  uploadPending: boolean;
}): string | null {
  if (hasReadyStudySource(params.source)) return null;
  if (params.uploadPending) {
    return 'Click "Use selected file" first.';
  }
  return 'Choose a source first.';
}
