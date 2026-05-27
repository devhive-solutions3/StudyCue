import type { UserPlan } from '@/lib/user-plan';

export const BUG_REPORT_STATUSES = ['open', 'reviewing', 'fixed', 'closed'] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_PRIORITIES = ['unset', 'low', 'medium', 'high', 'critical'] as const;
export type BugReportPriority = (typeof BUG_REPORT_PRIORITIES)[number];

export const BUG_REPORT_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const BUG_REPORT_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export type BugReportFollowUp = {
  id: string;
  message: string;
  createdAt: string;
};

export type BugReportRecord = {
  reportId: string;
  uid: string;
  userEmail: string | null;
  userDisplayName: string | null;
  userPlan: UserPlan;
  title: string;
  description: string;
  pageUrl: string | null;
  browserInfo: string | null;
  deviceInfo: string | null;
  screenshotUrl: string | null;
  screenshotStoragePath: string | null;
  screenshotOriginalName: string | null;
  screenshotSizeBytes: number | null;
  status: BugReportStatus;
  priority: BugReportPriority;
  /** Admin resolution notes — visible to the user when status is fixed or closed. */
  adminNotes: string | null;
  followUps: BugReportFollowUp[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedByUid: string | null;
  resolvedByEmail: string | null;
};

/** User-facing summary (no internal admin-only fields). */
export type UserBugReportView = {
  reportId: string;
  title: string;
  description: string;
  pageUrl: string | null;
  screenshotUrl: string | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
  followUps: BugReportFollowUp[];
  resolution: string | null;
  isSolved: boolean;
};

export type BugReportListRow = Pick<
  BugReportRecord,
  | 'reportId'
  | 'uid'
  | 'userEmail'
  | 'userDisplayName'
  | 'userPlan'
  | 'title'
  | 'pageUrl'
  | 'status'
  | 'priority'
  | 'createdAt'
  | 'screenshotUrl'
>;

export type BugReportOverviewCounts = {
  open: number;
  reviewing: number;
  fixed: number;
  closed: number;
  highPriority: number;
  openReports: number;
  reportsToday: number;
};

export type CreateBugReportInput = {
  title: string;
  description: string;
  pageUrl?: string | null;
  browserInfo?: string | null;
  deviceInfo?: string | null;
};

export type AttachBugReportScreenshotInput = {
  screenshotUrl: string;
  screenshotStoragePath: string;
  screenshotOriginalName: string;
  screenshotSizeBytes: number;
};

export type AdminUpdateBugReportInput = {
  status?: BugReportStatus;
  priority?: BugReportPriority;
  /** Resolution comment for the reporter (stored as adminNotes). */
  adminNotes?: string | null;
};

export function isBugReportSolved(status: BugReportStatus): boolean {
  return status === 'fixed' || status === 'closed';
}

export function canUserFollowUp(status: BugReportStatus): boolean {
  return status === 'open' || status === 'reviewing';
}
