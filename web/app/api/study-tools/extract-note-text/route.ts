import { NextResponse } from 'next/server';

import { assertPremiumStudyToolsAccess } from '@/lib/study-tools-access';
import { extractTextFromExistingNoteFile } from '@/lib/note-study-text-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { readStudyToolsUsage } from '@/lib/study-tools-usage-limits';
import { studyToolsRateLimitMessage } from '@/lib/study-tools-time';

export const runtime = 'nodejs';

const IS_DEV = process.env.NODE_ENV !== 'production';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const access = await assertPremiumStudyToolsAccess(viewer.uid);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const folderId = typeof body.folderId === 'number' ? body.folderId : Number(body.folderId);
  const fileId = typeof body.fileId === 'number' ? body.fileId : Number(body.fileId);
  const checkGenerationLimit = body.checkGenerationLimit === true;

  if (!Number.isFinite(folderId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: 'folderId and fileId are required.' }, { status: 400 });
  }

  if (checkGenerationLimit) {
    const usage = await readStudyToolsUsage(viewer.uid);
    if (usage.limit > 0 && usage.used >= usage.limit) {
      return NextResponse.json(
        {
          error: studyToolsRateLimitMessage(usage.resetAt),
          limit: usage.limit,
          used: usage.used,
          resetAt: usage.resetAt,
        },
        { status: 429 },
      );
    }
  }

  try {
    const result = await extractTextFromExistingNoteFile({
      uid: viewer.uid,
      folderId: Math.round(folderId),
      fileId: Math.round(fileId),
      folderName: typeof body.folderName === 'string' ? body.folderName : null,
    });

    if (IS_DEV) {
      console.info('[extract-note-text] ok', {
        uidExists: true,
        folderId: result.folderId,
        fileId: result.fileId,
        characterCount: result.characterCount,
        extractionMethod: result.extractionMethod,
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not read text from this note file.';
    if (IS_DEV) {
      console.warn('[extract-note-text] failed', {
        folderId,
        fileId,
        message,
      });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
