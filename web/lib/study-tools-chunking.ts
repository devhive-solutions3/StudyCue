import 'server-only';

import { handleCueGeminiProxy, handleGroqProxy } from '@/lib/ai-proxy-server';
import { getStudyGroqModel, hasGeminiApiKey, hasGroqApiKey } from '@/lib/study-tools-ai-utils';
import { STUDY_CHUNK_TARGET_CHARS, STUDY_MAX_CONDENSE_CHUNKS } from '@/lib/study-tools-text-limits';

export type StudyChunkCondense = {
  keyFacts: string[];
  definitions: string[];
  importantNames: string[];
  eventsOrConcepts: string[];
  citations: string[];
};

const CONDENSE_SYSTEM = `You are a study assistant. Extract only facts present in the source chunk.
Return strict JSON only (no markdown fences):
{
  "keyFacts": ["..."],
  "definitions": ["term: definition"],
  "importantNames": ["..."],
  "eventsOrConcepts": ["..."],
  "citations": ["quote with [Section N] if provided"]
}
Keep each array concise. Do not invent content.`;

export function splitStudyTextIntoChunks(text: string, maxCharsPerChunk = STUDY_CHUNK_TARGET_CHARS): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= maxCharsPerChunk) return [normalized];

  const headingParts = normalized.split(/(?=^#{1,3}\s)/m).filter((part) => part.trim());
  const parts = headingParts.length > 1 ? headingParts : normalized.split(/\n\n+/);

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;

    if (piece.length > maxCharsPerChunk) {
      pushCurrent();
      const sentences = piece.split(/(?<=[.!?])\s+/);
      let buffer = '';
      for (const sentence of sentences) {
        const candidate = buffer ? `${buffer} ${sentence}` : sentence;
        if (candidate.length > maxCharsPerChunk && buffer) {
          chunks.push(buffer.trim());
          buffer = sentence;
        } else {
          buffer = candidate;
        }
      }
      if (buffer.trim()) chunks.push(buffer.trim());
      continue;
    }

    const candidate = current ? `${current}\n\n${piece}` : piece;
    if (candidate.length > maxCharsPerChunk) {
      pushCurrent();
      current = piece;
    } else {
      current = candidate;
    }
  }
  pushCurrent();

  if (chunks.length === 0) return [normalized.slice(0, maxCharsPerChunk)];
  return chunks;
}

function mergeCondensedChunks(results: StudyChunkCondense[]): string {
  const lines: string[] = ['CONDENSED STUDY NOTES'];
  for (const [index, row] of results.entries()) {
    const section = index + 1;
    lines.push(`\n[Section ${section}]`);
    if (row.keyFacts.length) {
      lines.push('Key facts:');
      row.keyFacts.forEach((fact) => lines.push(`- ${fact}`));
    }
    if (row.definitions.length) {
      lines.push('Definitions:');
      row.definitions.forEach((def) => lines.push(`- ${def}`));
    }
    if (row.importantNames.length) {
      lines.push('Names:');
      row.importantNames.forEach((name) => lines.push(`- ${name}`));
    }
    if (row.eventsOrConcepts.length) {
      lines.push('Concepts:');
      row.eventsOrConcepts.forEach((item) => lines.push(`- ${item}`));
    }
    if (row.citations.length) {
      lines.push('Citations:');
      row.citations.forEach((cite) => lines.push(`- ${cite}`));
    }
  }
  return lines.join('\n');
}

async function readProxyText(response: Response): Promise<string> {
  const json = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `AI request failed (${response.status}).`);
  }
  const text = json?.text?.trim();
  if (!text) throw new Error('AI returned an empty response.');
  return text;
}

async function callInternalLlm(systemPrompt: string, userContent: string): Promise<string> {
  if (hasGroqApiKey()) {
    try {
      const response = await handleGroqProxy({
        model: getStudyGroqModel(),
        temperature: 0.1,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
      return await readProxyText(response);
    } catch {
      /* try gemini */
    }
  }

  if (!hasGeminiApiKey()) {
    throw new Error('AI provider is not configured.');
  }

  const response = await handleCueGeminiProxy({
    systemInstruction: systemPrompt,
    history: [],
    latestUserMessage: { role: 'user', parts: [{ text: userContent }] },
    maxOutputTokens: 2048,
  });
  return await readProxyText(response);
}

function parseCondenseJson(raw: string, sectionIndex: number): StudyChunkCondense {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    const parsed = JSON.parse(candidate) as StudyChunkCondense;
    return {
      keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts.map(String).slice(0, 12) : [],
      definitions: Array.isArray(parsed.definitions) ? parsed.definitions.map(String).slice(0, 12) : [],
      importantNames: Array.isArray(parsed.importantNames)
        ? parsed.importantNames.map(String).slice(0, 12)
        : [],
      eventsOrConcepts: Array.isArray(parsed.eventsOrConcepts)
        ? parsed.eventsOrConcepts.map(String).slice(0, 12)
        : [],
      citations: Array.isArray(parsed.citations)
        ? parsed.citations.map(String).slice(0, 8)
        : [`[Section ${sectionIndex}]`],
    };
  } catch {
    return {
      keyFacts: [raw.slice(0, 500)],
      definitions: [],
      importantNames: [],
      eventsOrConcepts: [],
      citations: [`[Section ${sectionIndex}]`],
    };
  }
}

export async function condenseChunksForStudyTool(chunks: string[]): Promise<string> {
  const limited =
    chunks.length > STUDY_MAX_CONDENSE_CHUNKS
      ? mergeOversizedChunks(chunks, STUDY_MAX_CONDENSE_CHUNKS)
      : chunks;

  const condensed: StudyChunkCondense[] = [];
  for (let index = 0; index < limited.length; index += 1) {
    const chunk = limited[index]!;
    const userContent = `[Section ${index + 1}]\n${chunk}`;
    const raw = await callInternalLlm(CONDENSE_SYSTEM, userContent);
    condensed.push(parseCondenseJson(raw, index + 1));
  }
  return mergeCondensedChunks(condensed);
}

function mergeOversizedChunks(chunks: string[], maxChunks: number): string[] {
  if (chunks.length <= maxChunks) return chunks;
  const out: string[] = [];
  const groupSize = Math.ceil(chunks.length / maxChunks);
  for (let index = 0; index < chunks.length; index += groupSize) {
    out.push(chunks.slice(index, index + groupSize).join('\n\n'));
  }
  return out;
}
