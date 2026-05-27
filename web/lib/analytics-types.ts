export const ANALYTICS_EVENT_TYPES = [
  'signup',
  'login',
  'page_view',
  'feature_open',
  'cue_message',
  'note_upload',
  'bug_report_submit',
  'storage_update',
  'study_tool_generation',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_FEATURES = [
  'dashboard',
  'calendar',
  'tasks',
  'focus',
  'cue_ai',
  'notes',
  'stats',
  'settings',
  'quiz_generator',
  'flashcards',
  'file_study',
  'bug_reports',
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export type AnalyticsUserPlan = 'free' | 'beta' | 'premium';

export type AnalyticsDailyDoc = {
  dateKey: string;
  signups: number;
  logins: number;
  activeUsers: number;
  cueMessages: number;
  notesUploaded: number;
  bugReportsSubmitted: number;
  totalStorageUsedBytes: number;
  featureUsage: Record<AnalyticsFeature, number>;
  planBreakdown: {
    free: number;
    beta: number;
    premium: number;
  };
  updatedAt: string;
};

export type UserAnalyticsDailyDoc = {
  dateKey: string;
  active: boolean;
  pageViews: number;
  cueMessages: number;
  notesUploaded: number;
  bugReportsSubmitted: number;
  storageUsedBytes: number | null;
  featuresUsed: string[];
  loggedInToday: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
};

export type AnalyticsEventDoc = {
  eventId: string;
  uid: string;
  userPlan: AnalyticsUserPlan;
  eventType: AnalyticsEventType;
  feature: AnalyticsFeature;
  route: string | null;
  dateKey: string;
  weekKey: string;
  monthKey: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
};
