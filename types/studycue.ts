/** Shared StudyCue entities — usable by Expo app and Next.js web. */

export type ClassItem = {
  id: number;
  title: string | null;
  weekday: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  recurrence: string | null;
  eventType: string | null;
  specificDate: string | null;
  parentEventId?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TaskItem = {
  id: number;
  categoryId: number | null;
  title: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  status: string | null;
  createdAt: string | null;
};

export type TaskCategory = {
  id: number;
  name: string;
  slug: string;
};

export type NoteFolder = {
  id: number;
  name: string;
  slug: string;
  createdAt: string | null;
};

export type NoteFile = {
  id: number;
  folderId: number;
  name: string;
  extension: string | null;
  sizeBytes: number;
  storagePath: string;
  downloadUrl: string;
  compressed: number | null;
  mimeType: string | null;
  createdAt: string | null;
};

export type StudySessionItem = {
  id: number;
  subjectId?: number | null;
  taskId?: number | null;
  title?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  focusMinutes: number | null;
  completed: number | null;
  createdAt: string | null;
};

export type UserPreferencesMirror = {
  preferredFocusMinutes: number;
  preferredBreakMinutes: number;
  dailyGoalMinutes: number;
  energyMode: string;
};

export type AppSnapshot = {
  localUserId: number | null;
  displayName: string | null;
  email: string | null;
  taskCategories: TaskCategory[];
  classes: ClassItem[];
  tasks: TaskItem[];
  sessions: StudySessionItem[];
};

export type CloudMirrorV1 = {
  schemaVersion: 1;
  taskCategories: TaskCategory[];
  classes: ClassItem[];
  tasks: TaskItem[];
  sessions: StudySessionItem[];
  noteFolders?: NoteFolder[];
  noteFiles?: NoteFile[];
  preferences: UserPreferencesMirror | null;
};
