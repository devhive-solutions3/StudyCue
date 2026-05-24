import type { ClassItem, CloudMirrorV1, TaskCategory, TaskItem } from '@studycue/types';

import { nextNumericId } from '@/lib/mirror-bootstrap';

export const CALENDAR_TASK_SOURCE = 'calendar';
const IS_DEV = process.env.NODE_ENV !== 'production';

const GENERAL_CATEGORY_SLUG = 'general';

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeEventType(raw: string | null | undefined) {
  return String(raw ?? '').trim().toLowerCase();
}

export function isStudyEvent(eventType: string | null | undefined) {
  return normalizeEventType(eventType) === 'study';
}

function normalizeTaskDetails(raw: string | null | undefined) {
  const value = raw?.trim();
  return value ? value : null;
}

function legacyTaskSourceEventId(task: TaskItem) {
  const raw =
    task.sourceEventId ??
    (task as TaskItem & { calendarEventId?: unknown }).calendarEventId ??
    (task as TaskItem & { eventId?: unknown }).eventId;
  const normalized = Number(raw);
  return Number.isFinite(normalized) ? normalized : null;
}

export function isTaskDone(task: TaskItem) {
  const status = String(task.status ?? '')
    .trim()
    .toLowerCase();
  const completed = (task as TaskItem & { completed?: unknown }).completed;
  return status === 'done' || status === 'completed' || completed === true || completed === 1;
}

export function isActiveTask(task: TaskItem) {
  return !isTaskDone(task);
}

function ensureGeneralCategory(categories: TaskCategory[]) {
  const existing = categories.find((category) => category.slug === GENERAL_CATEGORY_SLUG);
  if (existing) {
    return { categories, category: existing };
  }

  const created: TaskCategory = {
    id: nextNumericId(categories),
    name: 'General',
    slug: GENERAL_CATEGORY_SLUG,
  };

  return {
    categories: [...categories, created],
    category: created,
  };
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function nextDateForWeekday(weekday: string, now: Date) {
  const index = WEEKDAY_INDEX[weekday.trim().toLowerCase()];
  if (index == null) return null;
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  const diff = (index - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diff);
  return next;
}

function nextOccurrenceDate(event: ClassItem, now = new Date()) {
  const recurrence = (event.recurrence ?? '').trim().toLowerCase();
  const baseSpecificDate = event.specificDate ? parseIsoDate(event.specificDate.slice(0, 10)) : null;

  if (recurrence === 'none' || recurrence === 'once' || recurrence === '') {
    return baseSpecificDate;
  }

  if (recurrence === 'weekly') {
    return event.weekday ? nextDateForWeekday(event.weekday, now) : baseSpecificDate;
  }

  if (recurrence === 'monthly' && baseSpecificDate) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), baseSpecificDate.getDate());
    candidate.setHours(0, 0, 0, 0);
    if (candidate < now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  if (recurrence === 'yearly' && baseSpecificDate) {
    const candidate = new Date(now.getFullYear(), baseSpecificDate.getMonth(), baseSpecificDate.getDate());
    candidate.setHours(0, 0, 0, 0);
    if (candidate < now) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  return baseSpecificDate;
}

function buildDueAt(event: ClassItem) {
  const recurrence = (event.recurrence ?? '').trim().toLowerCase();
  const date = nextOccurrenceDate(event);
  if (!date) return null;
  const startTime = event.startTime?.trim();
  if (!startTime) return `${toIsoDate(date)}T00:00:00`;

  const dueDate = new Date(date);
  const [hour, minute] = startTime.split(':').map(Number);
  dueDate.setHours(hour ?? 0, minute ?? 0, 0, 0);

  if (dueDate < new Date()) {
    if (recurrence === 'weekly') dueDate.setDate(dueDate.getDate() + 7);
    if (recurrence === 'monthly') dueDate.setMonth(dueDate.getMonth() + 1);
    if (recurrence === 'yearly') dueDate.setFullYear(dueDate.getFullYear() + 1);
  }

  return `${toIsoDate(dueDate)}T${String(dueDate.getHours()).padStart(2, '0')}:${String(
    dueDate.getMinutes(),
  ).padStart(2, '0')}:00`;
}

function estimateMinutes(event: ClassItem) {
  const start = event.startTime?.split(':').map(Number);
  const end = event.endTime?.split(':').map(Number);
  if (!start || !end || start.length < 2 || end.length < 2) return null;
  const startMinutes = (start[0] ?? 0) * 60 + (start[1] ?? 0);
  const endMinutes = (end[0] ?? 0) * 60 + (end[1] ?? 0);
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : null;
}

function isCalendarLinkedTask(task: TaskItem) {
  return task.sourceType === CALENDAR_TASK_SOURCE || legacyTaskSourceEventId(task) != null;
}

function pickPreferredCalendarTask(current: TaskItem, candidate: TaskItem) {
  const currentUpdated = Date.parse(current.updatedAt ?? current.createdAt ?? '') || 0;
  const candidateUpdated = Date.parse(candidate.updatedAt ?? candidate.createdAt ?? '') || 0;
  const currentScore =
    (current.details ? 2 : 0) +
    (current.dueAt ? 2 : 0) +
    (current.estimatedMinutes ? 1 : 0) +
    (current.title?.trim() ? 1 : 0);
  const candidateScore =
    (candidate.details ? 2 : 0) +
    (candidate.dueAt ? 2 : 0) +
    (candidate.estimatedMinutes ? 1 : 0) +
    (candidate.title?.trim() ? 1 : 0);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }
  return candidateUpdated >= currentUpdated ? candidate : current;
}

export function syncStudyCalendarTasks(mirror: CloudMirrorV1): CloudMirrorV1 {
  const syncedStudyEvents = mirror.classes.filter(
    (event) =>
      isStudyEvent(event.eventType) &&
      typeof event.id === 'number' &&
      event.title?.trim(),
  );

  const ensured = ensureGeneralCategory(mirror.taskCategories);
  const studyEventsById = new Map(syncedStudyEvents.map((event) => [event.id, event]));
  const usedEventIds = new Set<number>();
  const nowIso = new Date().toISOString();
  let taskIdCursor = nextNumericId(mirror.tasks);
  const syncActions: Array<{
    eventId: number;
    rawEventType: string | null | undefined;
    normalizedEventType: string;
    action: 'create' | 'update' | 'delete' | 'skip';
    taskId?: number;
    duplicateCount?: number;
  }> = [];

  const nextTasks: TaskItem[] = [];
  const preferredLinkedTasks = new Map<number, TaskItem>();
  const duplicateCounts = new Map<number, number>();

  for (const task of mirror.tasks) {
    if (!isCalendarLinkedTask(task)) continue;
    const eventId = legacyTaskSourceEventId(task);
    if (eventId == null) continue;
    duplicateCounts.set(eventId, (duplicateCounts.get(eventId) ?? 0) + 1);
    const existing = preferredLinkedTasks.get(eventId);
    preferredLinkedTasks.set(eventId, existing ? pickPreferredCalendarTask(existing, task) : task);
  }

  for (const task of mirror.tasks) {
    if (!isCalendarLinkedTask(task)) {
      nextTasks.push(task);
      continue;
    }

    const eventId = legacyTaskSourceEventId(task);
    if (eventId == null) {
      nextTasks.push(task);
      continue;
    }
    const preferredTask = preferredLinkedTasks.get(eventId);
    if (preferredTask && preferredTask.id !== task.id) {
      syncActions.push({
        eventId,
        rawEventType: null,
        normalizedEventType: '',
        action: 'skip',
        taskId: task.id,
        duplicateCount: duplicateCounts.get(eventId) ?? 1,
      });
      continue;
    }
    const event = studyEventsById.get(eventId);
    if (!event || usedEventIds.has(eventId)) {
      syncActions.push({
        eventId,
        rawEventType: event?.eventType ?? null,
        normalizedEventType: normalizeEventType(event?.eventType),
        action: 'delete',
        taskId: task.id,
      });
      continue;
    }

    usedEventIds.add(eventId);
    syncActions.push({
      eventId,
      rawEventType: event.eventType,
      normalizedEventType: normalizeEventType(event.eventType),
      action: 'update',
      taskId: task.id,
    });
    nextTasks.push({
      ...task,
      categoryId: ensured.category.id,
      title: event.title?.trim() ?? task.title,
      details: normalizeTaskDetails(event.notes),
      dueAt: buildDueAt(event),
      estimatedMinutes: estimateMinutes(event),
      status: isTaskDone(task) ? task.status ?? 'done' : task.status ?? 'open',
      sourceType: CALENDAR_TASK_SOURCE,
      sourceEventId: event.id,
      updatedAt: nowIso,
    });
  }

  for (const event of syncedStudyEvents) {
    if (usedEventIds.has(event.id)) continue;
    syncActions.push({
      eventId: event.id,
      rawEventType: event.eventType,
      normalizedEventType: normalizeEventType(event.eventType),
      action: 'create',
      taskId: taskIdCursor,
      duplicateCount: duplicateCounts.get(event.id) ?? 0,
    });
    nextTasks.push({
      id: taskIdCursor,
      categoryId: ensured.category.id,
      title: event.title?.trim() ?? 'Study session',
      details: normalizeTaskDetails(event.notes),
      dueAt: buildDueAt(event),
      estimatedMinutes: estimateMinutes(event),
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
      sourceType: CALENDAR_TASK_SOURCE,
      sourceEventId: event.id,
    });
    taskIdCursor += 1;
  }

  if (IS_DEV && syncActions.length > 0) {
    syncActions.forEach((entry) => {
      console.info('[calendar-study-sync]', entry);
    });
  }

  return {
    ...mirror,
    taskCategories: ensured.categories,
    tasks: nextTasks,
  };
}

export function withSyncedClasses(mirror: CloudMirrorV1, classes: ClassItem[]) {
  return syncStudyCalendarTasks({
    ...mirror,
    classes,
  });
}

export function applyTaskEditsToLinkedCalendar(
  mirror: CloudMirrorV1,
  taskId: number,
  updates: Partial<TaskItem>,
) {
  const task = mirror.tasks.find((row) => row.id === taskId);
  if (!task) return mirror;

  const updatedTask: TaskItem = {
    ...task,
    ...updates,
    title: updates.title ?? task.title,
    details: updates.details ?? task.details ?? null,
    updatedAt: new Date().toISOString(),
  };

  let nextMirror: CloudMirrorV1 = {
    ...mirror,
    tasks: mirror.tasks.map((row) => (row.id === taskId ? updatedTask : row)),
  };

  if (updatedTask.sourceType === CALENDAR_TASK_SOURCE && typeof updatedTask.sourceEventId === 'number') {
    const nextClasses = mirror.classes.map((event) => {
      if (event.id !== updatedTask.sourceEventId) return event;
      return {
        ...event,
        title: updatedTask.title?.trim() || event.title,
        notes: normalizeTaskDetails(updatedTask.details),
        updatedAt: new Date().toISOString(),
      };
    });
    nextMirror = {
      ...nextMirror,
      classes: nextClasses,
    };
    return syncStudyCalendarTasks(nextMirror);
  }

  return nextMirror;
}
