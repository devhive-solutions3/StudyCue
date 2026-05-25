export type AdminSection = {
  title: string;
  href: string;
  description: string;
  metric: string;
};

export type AdminDataSourceStatus = {
  configured: boolean;
  message: string | null;
  source: 'service_account_json' | 'service_account_fields' | 'application_default' | null;
};

export type AdminOverviewStats = {
  totalUsers: number;
  betaUsers: number;
  freeUsers: number;
  premiumUsers: number;
  aiRequestsToday: number;
  publishedPosts: number;
  netThisMonthPhp: number;
  securityEventsToday: number;
};

export type AdminUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  accountType: string;
  plan: string;
  betaTester: boolean;
  premiumAccess: boolean;
  premiumAccessSource: string | null;
  emailVerified: boolean;
  disabled: boolean;
  providerIds: string[];
  hasProfileDoc: boolean;
  createdAt: string | null;
  lastLogin: string | null;
  storageUsedBytes: number | null;
};

export type AdminUsersResult = {
  users: AdminUserRow[];
  authUsersFetchedCount: number;
  firestoreProfilesFetchedCount: number;
  mergedUsersCount: number;
  warning: string | null;
};

export type AdminUsageLogRow = {
  id: string;
  uid: string;
  provider: string;
  model: string;
  status: 'success' | 'error' | 'rate_limited';
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  totalTokensEstimate: number;
  estimatedCostUsd: number;
  estimatedCostPhp: number;
  dateKey: string;
  createdAt: string;
  errorCode: string | null;
};

export type AiUsageDashboard = {
  today: {
    requests: number;
    tokens: number;
    costUsd: number;
    costPhp: number;
    errors: number;
    rateLimitHits: number;
  };
  month: {
    requests: number;
    tokens: number;
    costUsd: number;
    costPhp: number;
  };
  daily: Array<{
    dateKey: string;
    requests: number;
    tokens: number;
    costPhp: number;
    providers: { groq: number; gemini: number };
  }>;
  providerSplit: Array<{ provider: string; requests: number; tokens: number; costPhp: number }>;
  recentLogs: AdminUsageLogRow[];
};

export type RevenueMetric = {
  key: string;
  scope: 'daily' | 'monthly';
  adsRevenuePhp: number;
  premiumRevenuePhp: number;
  otherRevenuePhp: number;
  groqCostPhp: number;
  geminiCostPhp: number;
  firebaseCostPhp: number;
  vercelCostPhp: number;
  otherCostPhp: number;
  netPhp: number;
  notes: string;
  updatedAt: string | null;
};

export type RevenueDashboard = {
  totals: {
    revenuePhp: number;
    costPhp: number;
    netPhp: number;
  };
  daily: RevenueMetric[];
  monthly: RevenueMetric[];
};

export type SecurityEventRow = {
  id: string;
  time: string;
  severity: string;
  actor: string;
  action: string;
  target: string;
  details: string;
};

export function formatAdminDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatStorageBytes(value: number | null): string {
  if (!value || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function adminMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);
}
