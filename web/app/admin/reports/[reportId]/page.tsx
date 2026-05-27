import { notFound } from 'next/navigation';

import AdminBugReportDetailClient from '@/components/admin/AdminBugReportDetailClient';
import { readBugReportById } from '@/lib/bug-report-server';

export default async function AdminBugReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await readBugReportById(reportId.trim()).catch(() => null);
  if (!report) notFound();

  return <AdminBugReportDetailClient report={report} />;
}
