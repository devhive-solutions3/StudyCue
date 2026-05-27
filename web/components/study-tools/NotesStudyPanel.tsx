'use client';

import { useState } from 'react';

import {
  STUDY_TOOLS_DAILY_LIMIT_MESSAGE,
  studyToolsFetchHeaders,
} from '@/lib/study-tools-request';
import type { FileStudyResult } from '@/lib/study-tools-types';

type Props = {
  sourceName: string;
  text: string;
  onClose: () => void;
};

export default function NotesStudyPanel({ sourceName, text, onClose }: Props) {
  const [result, setResult] = useState<FileStudyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/study-tools/file-study', {
        method: 'POST',
        headers: studyToolsFetchHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          text,
          sourceName,
          sourceType: 'notes',
        }),
      });
      const payload = (await response.json().catch(() => null)) as FileStudyResult & {
        error?: string;
      };
      if (!response.ok) {
        const message =
          response.status === 429
            ? payload?.error ?? STUDY_TOOLS_DAILY_LIMIT_MESSAGE
            : payload?.error || `HTTP ${response.status}`;
        throw new Error(message);
      }
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate study summary.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[16px] border border-border bg-surface p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">File study</p>
            <h2 className="text-lg font-semibold text-text-primary">{sourceName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-text-muted">
            Close
          </button>
        </div>

        {!result ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => void generateSummary()}
              className="sc-btn-primary disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate study summary'}
            </button>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Summary</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{result.summary}</p>
            </div>
            {result.keyPoints.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Key points</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {result.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.keyTerms.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Key terms</h3>
                <dl className="mt-2 space-y-2">
                  {result.keyTerms.map((row) => (
                    <div key={row.term}>
                      <dt className="font-semibold text-text-primary">{row.term}</dt>
                      <dd className="text-sm text-text-secondary">{row.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {result.suggestedReviewQuestions.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Review questions</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {result.suggestedReviewQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
