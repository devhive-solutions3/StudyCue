import 'server-only';

import { normalizeStudyExtractedText } from '@/lib/study-file-text-normalize';

const MAX_CODE_BLOCK_CHARS = 2_000;

export type PrepareStudySourceOptions = {
  fileType?: string;
  isMarkdown?: boolean;
};

function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).trimStart();
}

function capCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (block) => {
    if (block.length <= MAX_CODE_BLOCK_CHARS) return block;
    return `${block.slice(0, MAX_CODE_BLOCK_CHARS)}\n…[code truncated for study tools]…`;
  });
}

function collapseTocNoise(lines: string[]): string[] {
  const out: string[] = [];
  let tocRun = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const isTocLine =
      /^[-*]\s+\[[^\]]+\]\([^)]+\)\s*$/.test(trimmed) ||
      (/^\d+\.\s+/.test(trimmed) && trimmed.length < 80);
    if (isTocLine) {
      tocRun += 1;
      if (tocRun <= 3) out.push(line);
      continue;
    }
    tocRun = 0;
    out.push(line);
  }
  return out;
}

/** Clean markdown/plain study source before chunking or AI generation. */
export function prepareStudySourceText(text: string, options?: PrepareStudySourceOptions): string {
  const isMarkdown =
    options?.isMarkdown === true ||
    options?.fileType === 'md' ||
    /\.md$/i.test(options?.fileType ?? '');

  let prepared = text.replace(/\r\n/g, '\n').replace(/\u0000/g, '');
  prepared = stripFrontmatter(prepared);
  prepared = prepared.replace(/<!--[\s\S]*?-->/g, '');
  prepared = prepared.replace(/\n{4,}/g, '\n\n\n');

  if (isMarkdown) {
    prepared = capCodeBlocks(prepared);
    const lines = collapseTocNoise(prepared.split('\n'));
    prepared = lines.join('\n');
  }

  prepared = prepared.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ');
  return normalizeStudyExtractedText(prepared);
}
