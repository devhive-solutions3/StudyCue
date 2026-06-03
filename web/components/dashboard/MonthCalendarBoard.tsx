'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ClassItem } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import {
  addLocalDays,
  createLocalMonthCells,
  localDateFromKey,
  localDateKey,
  type LocalCalendarCell,
} from '@/lib/local-date';
import { nextNumericId } from '@/lib/mirror-bootstrap';
import { withSyncedClasses } from '@/lib/study-task-sync';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 76;
const MIN_EVENT_HEIGHT = 32;
const WEEK_EVENT_MIN_HEIGHT = 48;
const STACKED_EVENT_GAP = 4;
const EVENT_TYPES = ['class', 'study', 'quiz', 'exam', 'deadline'] as const;
const RECURRENCES = ['once', 'weekly', 'monthly', 'yearly'] as const;

type CalendarView = 'day' | 'week' | 'month';
type EventType = (typeof EVENT_TYPES)[number];
type Recurrence = (typeof RECURRENCES)[number];
type Cell = LocalCalendarCell;
type EventDraft = {
  id?: number;
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  recurrence: Recurrence;
  parentEventId: string | null;
  notes: string;
};
type CalendarEvent = EventDraft & {
  id: number;
  source: ClassItem;
  weekday: string;
  occurrenceIso: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
type TimedEventLayout = {
  event: CalendarEvent;
  events: CalendarEvent[];
  key: string;
  column: number;
  columnCount: number;
  stackIndex: number;
  layout: 'columns' | 'stack';
};

const EMPTY_DRAFT: EventDraft = {
  title: '',
  type: 'class',
  date: localDateKey(),
  startTime: '09:00',
  endTime: '10:00',
  location: '',
  recurrence: 'once',
  parentEventId: null,
  notes: '',
};

function addDays(iso: string, days: number) {
  return addLocalDays(iso, days);
}

function startOfWeek(iso: string) {
  const d = localDateFromKey(iso);
  d.setDate(d.getDate() - d.getDay() + 1);
  return localDateKey(d);
}

function endOfWeek(iso: string) {
  return addDays(startOfWeek(iso), 6);
}

function rangeDays(startIso: string, endIso: string) {
  const out: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

function createCells(year: number, month: number): Cell[] {
  return createLocalMonthCells(year, month);
}

function normalizeType(raw: string | null | undefined): EventType {
  const value = (raw ?? '').toLowerCase();
  if (EVENT_TYPES.includes(value as EventType)) return value as EventType;
  return 'class';
}

function normalizeRecurrence(raw: string | null | undefined): Recurrence {
  const value = (raw ?? '').toLowerCase();
  if (value === 'none') return 'once';
  if (RECURRENCES.includes(value as Recurrence)) return value as Recurrence;
  return 'weekly';
}

function eventDate(row: ClassItem) {
  if (row.specificDate) return row.specificDate.slice(0, 10);
  const weekdayIndex = WEEKDAY_NAMES.findIndex((w) => w === row.weekday);
  if (weekdayIndex >= 0) {
    const today = new Date();
    const diff = weekdayIndex - today.getDay();
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    return localDateKey(d);
  }
  return localDateKey();
}

function normalizeEvent(row: ClassItem, occurrenceIso?: string): CalendarEvent | null {
  if (!row.title?.trim() || !row.startTime || !row.endTime) return null;
  const date = eventDate(row);
  const recurrence = normalizeRecurrence(row.recurrence);
  const iso = occurrenceIso ?? date;
  return {
    id: row.id,
    source: row,
    title: row.title.trim(),
    type: normalizeType(row.eventType),
    date,
    weekday: row.weekday ?? WEEKDAY_NAMES[localDateFromKey(date).getDay()],
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location ?? '',
    recurrence,
    parentEventId: row.parentEventId ?? null,
    notes: row.notes ?? '',
    occurrenceIso: iso,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function eventOccursOnDate(event: CalendarEvent, iso: string) {
  const base = localDateFromKey(event.date);
  const target = localDateFromKey(iso);
  if (iso < event.date) return false;
  if (event.recurrence === 'once') return iso === event.date;
  if (event.recurrence === 'weekly') return base.getDay() === target.getDay();
  if (event.recurrence === 'monthly') return base.getDate() === target.getDate();
  return base.getMonth() === target.getMonth() && base.getDate() === target.getDate();
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function getEventTop(startTime: string) {
  return (toMinutes(startTime) / 60) * HOUR_HEIGHT;
}

function getEventHeight(startTime: string, endTime: string) {
  const durationMinutes = Math.max(toMinutes(endTime) - toMinutes(startTime), 15);
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT);
}

type TimedEventRenderGroup = {
  key: string;
  event: CalendarEvent;
  events: CalendarEvent[];
  startTime: string;
  endTime: string;
};

function renderGroupKey(event: CalendarEvent) {
  return `${event.occurrenceIso || event.date}-${event.startTime}-${event.endTime}`;
}

function groupExactTimeEvents(events: CalendarEvent[], summarizeExactMatches: boolean) {
  if (!summarizeExactMatches) {
    return dedupeEvents(events).map((event) => ({
      key: renderEventKey(event),
      event,
      events: [event],
      startTime: event.startTime,
      endTime: event.endTime,
    }));
  }

  const byTime = new Map<string, CalendarEvent[]>();
  for (const event of dedupeEvents(events)) {
    const key = renderGroupKey(event);
    byTime.set(key, [...(byTime.get(key) ?? []), event]);
  }

  return [...byTime.entries()].map(([key, groupedEvents]) => {
    const sortedEvents = sortEvents(groupedEvents);
    const event = sortedEvents[0];
    return {
      key,
      event,
      events: sortedEvents,
      startTime: event.startTime,
      endTime: event.endTime,
    };
  });
}

function mergeOverlapClusters(groups: TimedEventRenderGroup[]): TimedEventRenderGroup[][] {
  const clusters: TimedEventRenderGroup[][] = [];
  for (const event of groups) {
    const matchIndices = clusters
      .map((cluster, index) => (cluster.some((existing) => overlaps(existing, event)) ? index : -1))
      .filter((index) => index >= 0);
    if (matchIndices.length === 0) {
      clusters.push([event]);
      continue;
    }
    const primary = matchIndices[0];
    clusters[primary].push(event);
    for (let i = matchIndices.length - 1; i > 0; i -= 1) {
      const idx = matchIndices[i];
      clusters[primary].push(...clusters[idx]);
      clusters.splice(idx, 1);
    }
    clusters[primary] = [...new Map(clusters[primary].map((row) => [row.key, row])).values()];
  }
  return clusters;
}

function layoutTimedEventsForDay(
  events: CalendarEvent[],
  options: { stackOverlaps?: boolean; summarizeExactMatches?: boolean } = {},
) {
  if (!events.length) return [];
  const layouts: TimedEventLayout[] = [];
  const renderGroups = groupExactTimeEvents(events, Boolean(options.summarizeExactMatches));
  for (const cluster of mergeOverlapClusters(renderGroups)) {
    const sorted = [...cluster].sort(
      (a, b) =>
        toMinutes(a.startTime) - toMinutes(b.startTime) ||
        toMinutes(a.endTime) - toMinutes(b.endTime) ||
        a.event.title.localeCompare(b.event.title) ||
        a.event.id - b.event.id,
    );
    const columnEnds: number[] = [];
    const assigned: Array<{ group: TimedEventRenderGroup; column: number }> = [];
    for (const event of sorted) {
      const start = toMinutes(event.startTime);
      const end = toMinutes(event.endTime);
      let column = columnEnds.findIndex((endMin) => endMin <= start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[column] = end;
      }
      assigned.push({ group: event, column });
    }
    const columnCount = Math.max(columnEnds.length, 1);
    if ((options.stackOverlaps && columnCount > 1) || columnCount > 4) {
      sorted.forEach((group, stackIndex) => {
        layouts.push({
          event: group.event,
          events: group.events,
          key: group.key,
          column: 0,
          columnCount: 1,
          stackIndex,
          layout: 'stack',
        });
      });
      continue;
    }
    for (const row of assigned) {
      layouts.push({
        event: row.group.event,
        events: row.group.events,
        key: row.group.key,
        column: row.column,
        columnCount,
        stackIndex: 0,
        layout: 'columns',
      });
    }
  }
  return layouts.sort(
    (a, b) =>
      toMinutes(a.event.startTime) - toMinutes(b.event.startTime) ||
      toMinutes(a.event.endTime) - toMinutes(b.event.endTime) ||
      a.stackIndex - b.stackIndex ||
      a.column - b.column ||
      a.event.title.localeCompare(b.event.title) ||
      a.event.id - b.event.id,
  );
}

function timeLabel(time: string) {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm ?? 0).padStart(2, '0')} ${period}`;
}

function timeRange(event: Pick<CalendarEvent, 'startTime' | 'endTime'>) {
  return `${timeLabel(event.startTime)}–${timeLabel(event.endTime)}`;
}

function renderEventKey(event: CalendarEvent) {
  return `${event.occurrenceIso || event.date}-${event.id}`;
}

function eventFreshness(event: CalendarEvent) {
  return event.updatedAt ?? event.createdAt ?? '';
}

function dedupeEvents(events: CalendarEvent[]) {
  const byIdentity = new Map<string, CalendarEvent>();

  for (const event of events) {
    const key = renderEventKey(event);
    const existing = byIdentity.get(key);
    if (!existing || eventFreshness(event) > eventFreshness(existing)) {
      byIdentity.set(key, event);
    }
  }

  return [...byIdentity.values()];
}

function replacementParentIdsForDate(events: CalendarEvent[], occurrences: CalendarEvent[]) {
  const parentById = new Map(events.map((event) => [event.id, event]));
  const replacements = new Set<number>();

  for (const occurrence of occurrences) {
    const parentId = Number(occurrence.parentEventId);
    if (!Number.isFinite(parentId) || parentId === occurrence.id) continue;
    const parent = parentById.get(parentId);
    if (!parent || parent.recurrence === 'once') continue;
    if (parent.type === occurrence.type) {
      replacements.add(parentId);
    }
  }

  return replacements;
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort(
    (a, b) =>
      toMinutes(a.startTime) - toMinutes(b.startTime) ||
      toMinutes(a.endTime) - toMinutes(b.endTime) ||
      a.title.localeCompare(b.title) ||
      a.id - b.id,
  );
}

function buildEventsForDate(events: CalendarEvent[], iso: string) {
  const occurrences = events
    .filter((event) => eventOccursOnDate(event, iso))
    .map((event) => ({ ...event, occurrenceIso: iso }));
  const replacementParentIds = replacementParentIdsForDate(events, occurrences);
  const normalizedOccurrences = occurrences.filter(
    (event) => !(event.recurrence !== 'once' && replacementParentIds.has(event.id)),
  );

  return sortEvents(dedupeEvents(normalizedOccurrences));
}

function buildEventsByDate(events: CalendarEvent[], dayIsos: string[]) {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const iso of dayIsos) {
    byDate.set(iso, buildEventsForDate(events, iso));
  }
  return byDate;
}

function getEventsFromSource(eventsByDate: Map<string, CalendarEvent[]>, iso: string) {
  return eventsByDate.get(iso) ?? [];
}

function countEventsInSource(eventsByDate: Map<string, CalendarEvent[]>) {
  let count = 0;
  for (const events of eventsByDate.values()) {
    count += events.length;
  }
  return count;
}

function normalizeEvents(rows: ClassItem[]) {
  const byId = new Map<number, CalendarEvent>();

  for (const row of rows) {
    const event = normalizeEvent(row);
    if (!event) {
      continue;
    }
    const existing = byId.get(event.id);
    if (!existing || eventFreshness(event) > eventFreshness(existing)) {
      byId.set(event.id, event);
    }
  }

  return [...byId.values()];
}

function typeStyle(type: EventType) {
  const map: Record<EventType, { background: string; color: string }> = {
    class: { background: 'var(--sc-blue-soft)', color: 'var(--sc-blue)' },
    study: { background: 'var(--sc-teal-soft)', color: 'var(--sc-teal)' },
    quiz: { background: 'var(--sc-yellow-soft)', color: 'var(--sc-yellow)' },
    exam: { background: 'var(--sc-danger-soft)', color: 'var(--sc-danger)' },
    deadline: { background: 'var(--sc-pink-soft)', color: 'var(--sc-pink)' },
  };
  return map[type];
}

function typeLabel(type: EventType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function recurrenceLabel(recurrence: Recurrence) {
  return recurrence === 'once' ? 'One-time' : recurrence;
}

function getEventsForDate(events: CalendarEvent[], iso: string) {
  return buildEventsForDate(events, iso);
}

function overlaps(a: Pick<EventDraft, 'startTime' | 'endTime'>, b: Pick<EventDraft, 'startTime' | 'endTime'>) {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(a.endTime) > toMinutes(b.startTime);
}

function TimedCalendarGrid({
  dayIsos,
  eventsByDate,
  selectedIso,
  onSelectDay,
  onOpenEvent,
}: {
  dayIsos: string[];
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedIso: string;
  onSelectDay: (iso: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const gridHeight = HOURS.length * HOUR_HEIGHT;
  const isWeek = dayIsos.length > 1;

  return (
    <div className="max-h-[720px] min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-1">
      <div className="calendar-week-grid min-w-0 max-w-full">
        <div className={isWeek ? 'grid grid-cols-[72px_repeat(7,minmax(0,1fr))] sm:grid-cols-[86px_repeat(7,minmax(0,1fr))]' : 'grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[86px_minmax(0,1fr)]'}>
          <div />
          {dayIsos.map((iso) => (
            <button
              key={`head-${iso}`}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`min-w-0 border-b border-border px-1 py-3 text-center text-[11px] font-extrabold sm:px-3 sm:text-xs ${iso === selectedIso ? 'text-accent' : 'text-text-muted'}`}
            >
              {DAY_LABELS[localDateFromKey(iso).getDay()]} {localDateFromKey(iso).getDate()}
            </button>
          ))}
        </div>
        <div className="flex">
          <div className="calendar-time-column w-[72px] shrink-0 sm:w-[86px]">
            {HOURS.map((hour) => (
              <div key={hour} className="calendar-time-slot" style={{ height: HOUR_HEIGHT }}>
                {timeLabel(`${String(hour).padStart(2, '0')}:00`)}
              </div>
            ))}
          </div>
          <div className={isWeek ? 'grid min-w-0 flex-1 grid-cols-7' : 'min-w-0 flex-1'}>
            {dayIsos.map((iso) => {
              const dayLayouts = layoutTimedEventsForDay(getEventsFromSource(eventsByDate, iso), {
                stackOverlaps: isWeek,
                summarizeExactMatches: isWeek,
              });
              return (
                <div
                  key={iso}
                  className="calendar-day-column relative border-r border-border last:border-r-0"
                  style={{ height: gridHeight }}
                  onClick={() => onSelectDay(iso)}
                >
                  {dayLayouts.map(({ event, events, key, column, columnCount, stackIndex, layout }) => {
                    const colors = typeStyle(event.type);
                    const stacked = layout === 'stack';
                    const groupedCount = events.length;
                    const eventHeight = isWeek
                      ? Math.max(getEventHeight(event.startTime, event.endTime), WEEK_EVENT_MIN_HEIGHT)
                      : getEventHeight(event.startTime, event.endTime);
                    const widthExpr = `((100% - 16px) / ${columnCount})`;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="calendar-event-block"
                        data-layout={layout}
                        data-grouped={groupedCount > 1 ? 'true' : 'false'}
                        style={{
                          top: stacked
                            ? getEventTop(event.startTime) + stackIndex * (WEEK_EVENT_MIN_HEIGHT + STACKED_EVENT_GAP)
                            : getEventTop(event.startTime),
                          height: stacked ? WEEK_EVENT_MIN_HEIGHT : eventHeight,
                          left: stacked ? 8 : `calc(8px + ${column} * ${widthExpr})`,
                          width: stacked ? 'calc(100% - 16px)' : `calc(${widthExpr})`,
                          background: colors.background,
                          color: colors.color,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDay(event.occurrenceIso || event.date);
                          if (groupedCount === 1) {
                            onOpenEvent(event);
                          }
                        }}
                      >
                        <span className="calendar-event-main-row">
                          <span className="calendar-event-title truncate">{event.title}</span>
                          {groupedCount > 1 ? (
                            <span className="calendar-event-count-pill">
                              +{groupedCount - 1} more
                            </span>
                          ) : null}
                        </span>
                        <p className="calendar-event-time">{timeRange(event)}</p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-bold text-text-muted">12 AM–11 PM · scroll for full day</p>
    </div>
  );
}

function findConflicts(events: CalendarEvent[], draft: EventDraft) {
  const draftEvent = { ...draft, id: draft.id ?? -1, occurrenceIso: draft.date } as CalendarEvent;
  const dates = draft.recurrence === 'once' ? [draft.date] : rangeDays(draft.date, addDays(draft.date, 42));
  return dates.flatMap((iso) =>
    getEventsForDate(events, iso).filter((event) => event.id !== draft.id && eventOccursOnDate(draftEvent, iso) && overlaps(draft, event)),
  );
}

function resolveMasterEventId(event: Pick<CalendarEvent, 'id' | 'parentEventId' | 'recurrence'>) {
  const parentId = Number(event.parentEventId);
  if (event.recurrence !== 'once' && Number.isFinite(parentId)) return parentId;
  return event.id;
}

export default function MonthCalendarBoard() {
  const { mirror, commitMirror, persistNow } = useMirror();
  const todayIso = localDateKey();
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>({ ...EMPTY_DRAFT, date: todayIso });
  const [conflicts, setConflicts] = useState<CalendarEvent[] | null>(null);

  const selectedDate = localDateFromKey(selectedIso);
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();
  const cells = createCells(year, month);
  const normalizedEvents = useMemo(() => normalizeEvents(mirror.classes), [mirror.classes]);
  const weekStart = startOfWeek(selectedIso);
  const weekEnd = endOfWeek(selectedIso);
  const weekDays = useMemo(() => rangeDays(weekStart, weekEnd), [weekStart, weekEnd]);
  const selectedDayEventsByDate = useMemo(
    () => buildEventsByDate(normalizedEvents, [selectedIso]),
    [normalizedEvents, selectedIso],
  );
  const weekEventsByDate = useMemo(
    () => buildEventsByDate(normalizedEvents, weekDays),
    [normalizedEvents, weekDays],
  );
  const monthEventsByDate = buildEventsByDate(normalizedEvents, cells.map((cell) => cell.iso));
  const selectedEvents = getEventsFromSource(selectedDayEventsByDate, selectedIso);
  const visibleEventCount =
    calendarView === 'day'
      ? countEventsInSource(selectedDayEventsByDate)
      : calendarView === 'week'
        ? countEventsInSource(weekEventsByDate)
        : countEventsInSource(monthEventsByDate);
  function move(delta: number) {
    if (calendarView === 'day') setSelectedIso(addDays(selectedIso, delta));
    if (calendarView === 'week') setSelectedIso(addDays(selectedIso, delta * 7));
    if (calendarView === 'month') {
      const next = new Date(year, month + delta, selectedDate.getDate());
      setSelectedIso(localDateKey(next));
    }
  }

  const closeAddEventModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const openAddEventModal = useCallback((date = selectedIso) => {
    setDraft({ ...EMPTY_DRAFT, date });
    setModalOpen(true);
  }, [selectedIso]);

  function openEdit(event: CalendarEvent) {
    const masterId = resolveMasterEventId(event);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[calendar-edit]', {
        eventId: event.id,
        isRecurring: event.recurrence !== 'once',
        masterId,
        updateScope: event.recurrence !== 'once' ? 'entire_series' : 'single_event',
      });
    }
    setDraft({
      id: masterId,
      title: event.title,
      type: event.type,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      recurrence: event.recurrence,
      parentEventId: event.parentEventId,
      notes: event.notes,
    });
    setModalOpen(true);
  }

  function saveDraft(skipConflict = false) {
    const cleaned = { ...draft, title: draft.title.trim(), location: draft.location.trim() };
    if (!cleaned.title || cleaned.endTime <= cleaned.startTime) return;
    if (!skipConflict) {
      const found = findConflicts(normalizedEvents, cleaned);
      if (found.length > 0) {
        setConflicts(found);
        return;
      }
    }
    const parentClass = findConflicts(normalizedEvents, cleaned).find((event) => event.type === 'class' && ['quiz', 'exam'].includes(cleaned.type));
    if (process.env.NODE_ENV !== 'production') {
      console.info('[calendar-edit-save]', {
        eventId: cleaned.id ?? null,
        isRecurring: cleaned.recurrence !== 'once',
        masterId: cleaned.id ?? null,
        updateScope: cleaned.recurrence !== 'once' ? 'entire_series' : 'single_event',
        updatedOccurrences: cleaned.recurrence === 'once' ? 1 : 'generated-from-master',
      });
    }
    commitMirror((prev) => {
      const now = new Date().toISOString();
      const row: ClassItem = {
        id: cleaned.id ?? nextNumericId(prev.classes),
        title: cleaned.title,
        weekday: WEEKDAY_NAMES[localDateFromKey(cleaned.date).getDay()],
        startTime: cleaned.startTime,
        endTime: cleaned.endTime,
        location: cleaned.location || null,
        recurrence: cleaned.recurrence === 'once' ? 'none' : cleaned.recurrence,
        eventType: cleaned.type,
        specificDate: cleaned.date,
        parentEventId: parentClass ? String(parentClass.id) : cleaned.parentEventId,
        notes: cleaned.notes || null,
        createdAt: cleaned.id ? undefined : now,
        updatedAt: now,
      } as ClassItem;
      const nextClasses = cleaned.id
        ? prev.classes.map((event) => (event.id === cleaned.id ? { ...event, ...row } : event))
        : [...prev.classes, row];
      return withSyncedClasses(prev, nextClasses);
    });
    window.setTimeout(() => {
      void persistNow();
    }, 0);
    setSelectedIso(cleaned.date);
    closeAddEventModal();
    setConflicts(null);
  }

  function deleteEvent(id: number) {
    const masterEvent = mirror.classes.find((event) => event.id === id);
    const recurrence = normalizeRecurrence(masterEvent?.recurrence);
    const isRecurring = recurrence !== 'once';
    if (
      !window.confirm(
        isRecurring
          ? 'Delete this recurring event and all of its occurrences?'
          : 'Delete this calendar event?',
      )
    ) {
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info('[calendar-delete]', {
        eventId: id,
        isRecurring,
        masterId: id,
        updateScope: isRecurring ? 'entire_series' : 'single_event',
        updatedOccurrences: isRecurring ? 'all-generated-occurrences' : 1,
      });
    }
    commitMirror((prev) => withSyncedClasses(prev, prev.classes.filter((event) => event.id !== id)));
    window.setTimeout(() => {
      void persistNow();
    }, 0);
  }

  function deleteAllClassEvents() {
    const count = normalizedEvents.filter((event) => event.type === 'class').length;
    if (count === 0) return;
    if (!window.confirm(`Delete all ${count} class event${count === 1 ? '' : 's'}? Quiz, exam, study, and deadline events will stay.`)) return;
    commitMirror((prev) =>
      withSyncedClasses(
        prev,
        prev.classes.filter((event) => normalizeType(event.eventType) !== 'class'),
      ),
    );
    window.setTimeout(() => {
      void persistNow();
    }, 0);
  }

  const title =
    calendarView === 'day'
      ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : calendarView === 'week'
        ? `Week of ${localDateFromKey(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${localDateFromKey(weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `${MONTHS[month]} ${year}`;

  return (
    <div className="sc-app-page-wide w-full min-w-0 max-w-full">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Schedule planner</p>
          <h1 className="sc-page-title mt-1 text-text-primary">Calendar</h1>
          <p className="mt-1 text-sm text-text-secondary">Day, week, and month view with recurring classes, event colors, and conflict checks.</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-wrap rounded-full border border-border bg-surface-2 p-1">
            {(['day', 'week', 'month'] as CalendarView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setCalendarView(view)}
                className="rounded-full px-4 py-2 text-xs font-extrabold capitalize transition"
                style={calendarView === view ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { color: 'var(--sc-text-secondary)' }}
              >
                {view}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openAddEventModal()}
            className="relative z-10 shrink-0 pointer-events-auto sc-btn-primary min-h-[42px] rounded-full px-5"
          >
            + Add Event
          </button>
        </div>
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-[18px] xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,350px)]">
        <section className="sc-panel min-w-0 overflow-hidden rounded-[28px]">
          <header className="sc-panel-header">
            <button type="button" onClick={() => move(-1)} className="rounded-[12px] px-3 py-2 text-xs font-extrabold text-text-muted hover:bg-surface-2">
              &lt;
            </button>
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-text-primary">{title}</h2>
              <p className="mt-1 text-xs font-bold text-text-muted">{visibleEventCount} event{visibleEventCount === 1 ? '' : 's'} visible</p>
            </div>
            <button type="button" onClick={() => move(1)} className="rounded-[12px] px-3 py-2 text-xs font-extrabold text-text-muted hover:bg-surface-2">
              &gt;
            </button>
          </header>
          <div className="p-4 md:p-6">
            {calendarView === 'month' ? (
              <div className="grid min-w-0 grid-cols-7 gap-[9px] text-center">
                {DAY_LABELS.map((d) => (
                  <span key={d} className="py-1 text-xs font-medium text-text-muted">{d}</span>
                ))}
                {cells.map((cell) => {
                  const events = getEventsFromSource(monthEventsByDate, cell.iso);
                  return (
                    <div
                      key={cell.iso}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedIso(cell.iso)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedIso(cell.iso);
                        }
                      }}
                      className={`min-h-[100px] rounded-[16px] border p-2 text-left transition ${cell.iso === selectedIso ? 'border-accent bg-accent-light' : 'border-border bg-surface hover:bg-surface-2'} ${cell.otherMonth ? 'opacity-45' : ''}`}
                    >
                      <span className="text-xs font-extrabold text-text-secondary">{cell.day}</span>
                      <div className="mt-2 space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <button
                            type="button"
                            key={renderEventKey(event)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(event);
                            }}
                            className="block w-full truncate rounded-md px-2 py-1 text-left text-[10px] font-bold"
                            style={typeStyle(event.type)}
                          >
                            {event.title}
                          </button>
                        ))}
                        {events.length > 2 ? <span className="text-[10px] text-text-muted">+{events.length - 2} more</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <TimedCalendarGrid
                dayIsos={calendarView === 'week' ? weekDays : [selectedIso]}
                eventsByDate={calendarView === 'week' ? weekEventsByDate : selectedDayEventsByDate}
                selectedIso={selectedIso}
                onSelectDay={setSelectedIso}
                onOpenEvent={openEdit}
              />
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-[18px]">
          <section className="sc-panel rounded-[24px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold text-text-primary">Selected Day</h3>
              <span className="sc-badge">{selectedIso.slice(5)}</span>
            </div>
            <div className="space-y-3">
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-text-muted">No events for this date.</p>
              ) : (
                selectedEvents.map((event) => (
                  <div key={renderEventKey(event)} className="rounded-[16px] border border-border bg-surface-2 p-4">
                    <span className="rounded-full px-2 py-1 text-[10px] font-extrabold" style={typeStyle(event.type)}>{typeLabel(event.type)}</span>
                    <p className="mt-3 font-extrabold text-text-primary">{event.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{timeRange(event)} · {recurrenceLabel(event.recurrence)}</p>
                    {event.location ? <p className="mt-1 text-xs text-text-secondary">{event.location}</p> : null}
                    {event.notes ? <p className="mt-2 text-xs leading-5 text-text-secondary">{event.notes}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => openEdit(event)} className="text-xs font-extrabold text-accent">Edit</button>
                      <button type="button" onClick={() => deleteEvent(event.id)} className="text-xs font-extrabold text-danger">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="sc-panel rounded-[24px] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-text-primary">Event Types</h3>
              <button
                type="button"
                onClick={deleteAllClassEvents}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-extrabold text-danger hover:bg-surface"
              >
                Clear classes
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {EVENT_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-3 text-sm text-text-secondary">
                  <span className="h-3 w-3 rounded-full" style={typeStyle(type)} />
                  {typeLabel(type)}
                </div>
              ))}
            </div>
          </section>

          <section className="sc-panel rounded-[24px] p-5">
            <h3 className="font-extrabold text-text-primary">Cue Import</h3>
            <p className="mt-2 text-xs text-text-muted">Upload a schedule image; Cue can extract classes and add recurring weekly events.</p>
            <Link href="/app/chat" className="sc-btn-primary mt-4 min-h-[44px] w-full rounded-[14px] text-sm">
              Import with Cue
            </Link>
          </section>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => openAddEventModal()}
        className="fixed right-[34px] bottom-[128px] z-[95] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-3xl font-light text-white shadow-[var(--sc-shadow-accent)] pointer-events-auto touch-manipulation max-[900px]:right-6 max-[900px]:bottom-[128px]"
      >
        +
      </button>

      {modalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-sc-portal-root
              className="fixed inset-0 z-[120] flex min-h-dvh w-full items-start justify-center overflow-x-hidden bg-black/50 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm pointer-events-auto sm:items-center sm:overflow-y-auto sm:px-4 sm:py-8 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              onClick={closeAddEventModal}
            >
              <div
                className="add-event-modal box-border z-[121] w-full min-w-0 overflow-hidden rounded-[26px] border border-border bg-surface shadow-[var(--sc-shadow-md)] sm:max-w-[42rem] sm:rounded-[30px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal box-border max-h-[calc(100dvh-24px)] min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-3.5 sm:max-h-[calc(100dvh-96px)] sm:p-8">
                  <div className="mb-4 flex min-w-0 max-w-full items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                    <h2 className="min-w-0 max-w-full text-xl font-extrabold text-text-primary sm:text-2xl">
                      {draft.id ? 'Edit Event' : '+ Add Event'}
                    </h2>
                    <button type="button" onClick={closeAddEventModal} className="shrink-0 rounded-full bg-surface-2 px-3 py-2 text-text-secondary">×</button>
                  </div>
                  <div className="min-w-0 max-w-full overflow-hidden space-y-3 sm:space-y-4">
                {draft.recurrence !== 'once' ? (
                  <p className="rounded-[16px] border border-accent/20 bg-accent/5 px-4 py-3 text-xs font-medium text-text-secondary">
                    Editing this recurring event updates all occurrences in the series.
                  </p>
                ) : null}
                <PillGroup label="Type" values={EVENT_TYPES} value={draft.type} onChange={(type) => setDraft((p) => ({ ...p, type }))} formatter={typeLabel} />
                <input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Math Chapter 5" className="sc-input box-border w-full min-w-0 max-w-full" />
                <input value={draft.location} onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))} placeholder="Optional location" className="sc-input box-border w-full min-w-0 max-w-full" />
                <textarea value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Details or notes" rows={4} className="sc-input box-border w-full min-w-0 max-w-full resize-y py-3" />
                <PillGroup label="Recurrence" values={RECURRENCES} value={draft.recurrence} onChange={(recurrence) => setDraft((p) => ({ ...p, recurrence }))} formatter={recurrenceLabel} />
                <div className="min-w-0 max-w-full space-y-3">
                  <input type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} className="sc-input box-border w-full min-w-0 max-w-full" />
                  <div className="time-grid grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="time" value={draft.startTime} onChange={(e) => setDraft((p) => ({ ...p, startTime: e.target.value }))} className="sc-input box-border w-full min-w-0 max-w-full" />
                    <input type="time" value={draft.endTime} onChange={(e) => setDraft((p) => ({ ...p, endTime: e.target.value }))} className="sc-input box-border w-full min-w-0 max-w-full" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={closeAddEventModal} className="sc-btn-secondary box-border min-h-[58px] w-full min-w-0 max-w-full rounded-full">
                    Cancel
                  </button>
                  <button type="button" onClick={() => saveDraft(false)} className="sc-btn-primary box-border min-h-[58px] w-full min-w-0 max-w-full rounded-full">
                    {draft.id ? 'Save Changes' : 'Add to Calendar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}

      {conflicts && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-sc-portal-root
              className="fixed inset-0 z-[122] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
              onClick={() => setConflicts(null)}
            >
              <div
                className="z-[123] w-full max-w-[460px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]"
                onClick={(e) => e.stopPropagation()}
              >
            <h2 className="text-xl font-extrabold text-text-primary">Schedule Conflict</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {['quiz', 'exam'].includes(draft.type) && conflicts.some((event) => event.type === 'class')
                ? 'This can be added as an assessment inside the class block.'
                : 'This event overlaps with another event.'}
            </p>
            <div className="mt-4 rounded-[16px] bg-surface-2 p-3 text-sm text-text-primary">
              New: {draft.title || 'Untitled'} · {timeLabel(draft.startTime)}–{timeLabel(draft.endTime)}
            </div>
            <div className="mt-3 space-y-2">
              {conflicts.map((event) => (
                <div key={renderEventKey(event)} className="rounded-[14px] border border-border px-3 py-2 text-sm text-text-secondary">
                  {event.title} · {timeRange(event)}
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setConflicts(null)} className="sc-btn-secondary rounded-full">Cancel</button>
              <button type="button" onClick={() => saveDraft(true)} className="sc-btn-primary rounded-full">Add Anyway</button>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PillGroup<T extends string>({
  label,
  values,
  value,
  onChange,
  formatter,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatter: (value: T) => string;
}) {
  return (
    <div className="min-w-0 max-w-full">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <div className="grid min-w-0 max-w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className="w-full min-w-0 max-w-full overflow-hidden rounded-full px-3 py-2 text-center text-xs leading-tight font-extrabold whitespace-normal break-words transition sm:w-auto sm:px-4 sm:text-sm sm:whitespace-nowrap"
            style={item === value ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}
          >
            {formatter(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
