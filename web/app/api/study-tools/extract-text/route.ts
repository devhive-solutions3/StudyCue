import { NextResponse } from 'next/server';

import { isExtractableStudyFile } from '@/lib/study-file-extract';
import { STUDY_EXTRACT_MAX_BYTES } from '@/lib/study-file-extract';
import { extractStudyFileText } from '@/lib/study-file-extract-server';
import { assertPremiumStudyToolsAccess } from '@/lib/study-tools-access';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const access = await assertPremiumStudyToolsAccess(viewer.uid);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }

  if (!isExtractableStudyFile(file.name)) {
    return NextResponse.json(
      {
        error:
          'Unsupported file type. Upload PDF, PowerPoint (.pptx), Word (.docx), or text (.txt, .md).',
      },
      { status: 400 },
    );
  }

  if (file.size > STUDY_EXTRACT_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large (max ${Math.round(STUDY_EXTRACT_MAX_BYTES / (1024 * 1024))} MB).`,
      },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, fileType } = await extractStudyFileText({
      buffer,
      fileName: file.name,
    });

    if (text.length > STUDY_SOURCE_MAX_CHARS) {
      return NextResponse.json(
        {
          error: `Extracted text must be under ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters. Try a shorter document or paste a section.`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      text,
      fileType,
      sourceName: file.name,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not extract text from file.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
