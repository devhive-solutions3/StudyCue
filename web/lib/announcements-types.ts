export type AnnouncementType =
  | 'update'
  | 'maintenance'
  | 'feature'
  | 'warning'
  | 'beta'
  | 'general';

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export type AnnouncementPriority = 'normal' | 'high';

export type AnnouncementTargetPlan = 'free' | 'beta' | 'premium' | 'all';

export type AnnouncementRecord = {
  announcementId: string;
  title: string;
  message: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  isActive: boolean;
  targetPlans: AnnouncementTargetPlan[];
  targetRoutes: string[] | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  priority: AnnouncementPriority;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
  createdByEmail: string | null;
};

export type AnnouncementPublic = Pick<
  AnnouncementRecord,
  | 'announcementId'
  | 'title'
  | 'message'
  | 'type'
  | 'ctaLabel'
  | 'ctaHref'
  | 'priority'
  | 'publishedAt'
  | 'expiresAt'
>;
