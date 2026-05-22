import type { CloudMirrorV1, ClassItem, TaskCategory, TaskItem } from '@studycue/types';

import type { CueCommand } from '@/lib/cue-chat-response';
import { nextNumericId } from '@/lib/mirror-bootstrap';

const ALLOWED_CALENDAR_EVENT_TYPES = new Set([
  'class',
  'quiz',
  'exam',
  'deadline',
  'study',
  'review',
  'test',
]);

const ONE_TIME_EVENT_TYPES = new Set(['quiz', 'exam', 'deadline', 'study', 'review', 'test']);

function normalizeCalendarEventType(raw: string | undefined | null): string {
  const t = (raw ?? '').trim().toLowerCase();
  if (ALLOWED_CALENDAR_EVENT_TYPES.has(t)) return t;
  return 'class';
}

function normalizeCategoryName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : 'General';
}

function slugifyCategoryName(raw: string): string {
  const normalized = normalizeCategoryName(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'general';
}

function ensureCategory(
  categories: TaskCategory[],
  categoryCache: Map<string, TaskCategory>,
  name: string,
): { categories: TaskCategory[]; category: TaskCategory } {
  const normalizedName = normalizeCategoryName(name);
  const slug = slugifyCategoryName(normalizedName);

  const cached = categoryCache.get(slug);
  if (cached) return { categories, category: cached };

  const existing = categories.find((c) => c.slug === slug);
  if (existing) {
    categoryCache.set(slug, existing);
    return { categories, category: existing };
  }

  const created: TaskCategory = {
    id: nextNumericId(categories),
    name: normalizedName,
    slug,
  };
  const nextCategories = [...categories, created];
  categoryCache.set(slug, created);
  return { categories: nextCategories, category: created };
}

function applyAddCalendar(prev: CloudMirrorV1, command: Extract<CueCommand, { kind: 'add_calendar' }>): CloudMirrorV1 {
  let nextClasses = [...prev.classes];
  for (const row of command.classes) {
    const eventType = normalizeCalendarEventType(row.eventType);
    const recurrence = row.recurrence || (ONE_TIME_EVENT_TYPES.has(eventType) ? 'none' : 'weekly');
    const nextRow: ClassItem = {
      id: nextNumericId(nextClasses),
      title: row.title,
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      location: row.location ?? null,
      recurrence,
      eventType,
      specificDate: row.specificDate ?? null,
    };
    nextClasses = [...nextClasses, nextRow];
  }
  return { ...prev, classes: nextClasses };
}

function applyAddTasks(prev: CloudMirrorV1, command: Extract<CueCommand, { kind: 'add_tasks' }>): CloudMirrorV1 {
  let nextCategories = [...prev.taskCategories];
  let nextTasks = [...prev.tasks];
  const categoryCache = new Map<string, TaskCategory>();

  // Match mobile fallback behavior.
  const fallbackGeneral = nextCategories.find((c) => c.slug === 'general') ?? {
    id: nextNumericId(nextCategories),
    name: 'General',
    slug: 'general',
  };
  if (!nextCategories.find((c) => c.slug === fallbackGeneral.slug)) {
    nextCategories = [...nextCategories, fallbackGeneral];
  }
  categoryCache.set(fallbackGeneral.slug, fallbackGeneral);

  for (const row of command.tasks) {
    const categoryLabel = row.category?.trim() ? row.category : fallbackGeneral.name;
    const ensured = ensureCategory(nextCategories, categoryCache, categoryLabel);
    nextCategories = ensured.categories;

    const task: TaskItem = {
      id: nextNumericId(nextTasks),
      categoryId: ensured.category.id,
      title: row.title,
      dueAt: row.dueAt ?? null,
      estimatedMinutes: row.estimatedMinutes ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    nextTasks = [...nextTasks, task];
  }

  return {
    ...prev,
    taskCategories: nextCategories,
    tasks: nextTasks,
  };
}

export function applyCueCommandToMirror(prev: CloudMirrorV1, command: CueCommand): CloudMirrorV1 {
  if (command.kind === 'empty_calendar') {
    return prev;
  }
  if (command.kind === 'clear_classes') {
    return { ...prev, classes: [] };
  }
  if (command.kind === 'replace_classes') {
    const reset = { ...prev, classes: [] };
    return applyAddCalendar(reset, { kind: 'add_calendar', classes: command.classes });
  }
  if (command.kind === 'add_tasks') {
    return applyAddTasks(prev, command);
  }
  return applyAddCalendar(prev, command);
}
