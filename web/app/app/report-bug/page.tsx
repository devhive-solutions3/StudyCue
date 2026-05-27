'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import BugReportsHub from '@/components/feedback/BugReportsHub';

export default function ReportBugPage() {
  const searchParams = useSearchParams();
  const fromPath = searchParams.get('from')?.trim() || '';

  const initialPageUrl = useMemo(() => {
    if (!fromPath.startsWith('/')) return '';
    return fromPath;
  }, [fromPath]);

  const openNew = searchParams.get('new') === '1';

  return <BugReportsHub initialPageUrl={initialPageUrl} autoOpenForm={openNew} />;
}
