import 'server-only';

import { condenseChunksForStudyTool, splitStudyTextIntoChunks } from '@/lib/study-tools-chunking';
import {
  ABSOLUTE_MAX_CHARS,
  DIRECT_GENERATION_MAX_CHARS,
  estimateStudyInputTokens,
  isLargeStudySource,
  largeSourceUserNotice,
  STUDY_EXTRACT_CAP_CHARS,
} from '@/lib/study-tools-text-limits';
import { prepareStudySourceText } from '@/lib/study-tools-text-prep';
import { isStudyAiDev } from '@/lib/study-tools-ai-utils';

export type PreparedStudySource = {
  text: string;
  originalLength: number;
  preparedLength: number;
  wasChunked: boolean;
  chunkCount: number;
  wasTruncated: boolean;
  userNotice: string | null;
  estimatedInputTokens: number;
};

export async function prepareSourceForStudyAi(params: {
  rawText: string;
  fileType?: string;
  sourceName?: string;
}): Promise<PreparedStudySource> {
  const originalLength = params.rawText.length;
  let working = params.rawText.trim();

  if (originalLength > ABSOLUTE_MAX_CHARS) {
    throw new Error(
      'This file is too large to process at once. Please split it into smaller notes.',
    );
  }

  const truncatedAtExtract = originalLength >= STUDY_EXTRACT_CAP_CHARS;
  const nameHint = params.sourceName ?? '';
  const isMarkdown =
    params.fileType === 'md' ||
    /\.(md|markdown)$/i.test(nameHint) ||
    /\.(md|markdown)$/i.test(params.fileType ?? '');

  working = prepareStudySourceText(working, {
    fileType: params.fileType,
    isMarkdown,
  });

  let wasChunked = false;
  let chunkCount = 0;
  let wasTruncated = truncatedAtExtract;

  if (working.length > DIRECT_GENERATION_MAX_CHARS) {
    wasChunked = true;
    const chunks = splitStudyTextIntoChunks(working);
    chunkCount = chunks.length;
    working = await condenseChunksForStudyTool(chunks);
    if (working.length > DIRECT_GENERATION_MAX_CHARS) {
      working = `${working.slice(0, DIRECT_GENERATION_MAX_CHARS)}\n\n[Condensed source truncated for generation.]`;
      wasTruncated = true;
    }
  }

  const userNotice = largeSourceUserNotice(originalLength);
  const prepared: PreparedStudySource = {
    text: working,
    originalLength,
    preparedLength: working.length,
    wasChunked,
    chunkCount,
    wasTruncated,
    userNotice,
    estimatedInputTokens: estimateStudyInputTokens(working.length),
  };

  if (isStudyAiDev()) {
    console.info('[study-tools-pipeline] prepared', {
      originalLength: prepared.originalLength,
      preparedLength: prepared.preparedLength,
      estimatedInputTokens: prepared.estimatedInputTokens,
      wasChunked: prepared.wasChunked,
      chunkCount: prepared.chunkCount,
      wasTruncated: prepared.wasTruncated,
      isLarge: isLargeStudySource(originalLength),
    });
  }

  return prepared;
}
