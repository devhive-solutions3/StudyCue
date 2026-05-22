'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { ClassItem } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 76;
const MIN_EVENT_HEIGHT = 32;
const EVENT_TYPES = ['class', 'study', 'quiz', 'exam', 'deadline'] as const;
const RECURRENCES = ['once', 'weekly', 'monthly', 'yearly'] as const;

type CalendarView = 'day' | 'week' | 'month';
type EventType = (typeof EVENT_TYPES)[number];
type Recurrence = (typeof RECURRENCES)[number];
type Cell = { day: number; otherMonth: boolean; iso: string };
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

const EMPTY_DRAFT: EventDraft = {
  title: '',
  type: 'class',
  date: localIso(new Date()),
  startTime: '09:00',
  endTime: '10:00',
  location: '',
  recurrence: 'once',
  parentEventId: null,
  notes: '',
};

function localIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(iso: string, days: number) {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + days);
  return localIso(d);
}

function startOfWeek(iso: string) {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() - d.getDay() + 1);
  return localIso(d);
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
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const out: Cell[] = [];
  for (let i = 0; i < first; i += 1) {
    const d = prevDays - first + 1 + i;
    out.push({ day: d, otherMonth: true, iso: localIso(new Date(year, month - 1, d)) });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    out.push({ day: d, otherMonth: false, iso: localIso(new Date(year, month, d)) });
  }
  while (out.length % 7 !== 0) {
    const d = out.length - (first + daysInMonth) + 1;
    out.push({ day: d, otherMonth: true, iso: localIso(new Date(year, month + 1, d)) });
  }
  return out;
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
    return localIso(d);
  }
  return localIso(new Date());
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
    weekday: row.weekday ?? WEEKDAY_NAMES[dateFromIso(date).getDay()],
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location ?? '',
    recurrence,
    parentEventId: null,
    notes: '',
    occurrenceIso: iso,
    createdAt: null,
    updatedAt: null,
  };
}

function eventOccursOnDate(event: CalendarEvent, iso: string) {
  const base = dateFromIso(event.date);
  const target = dateFromIso(iso);
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

function mergeOverlapClusters(events: CalendarEvent[]): CalendarEvent[][] {
  const clusters: CalendarEvent[][] = [];
  for (const event of events) {
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
    clusters[primary] = [...new Map(clusters[primary].map((row) => [row.id, row])).values()];
  }
  return clusters;
}

function layoutTimedEventsForDay(events: CalendarEvent[]) {
  if (!events.length) return [];
  const layouts: Array<{ event: CalendarEvent; column: number; columnCount: number }> = [];
  for (const cluster of mergeOverlapClusters(events)) {
    const sorted = [...cluster].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.id - b.id);
    const columnEnds: number[] = [];
    const assigned: Array<{ event: CalendarEvent; column: number }> = [];
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
      assigned.push({ event, column });
    }
    const columnCount = Math.max(columnEnds.length, 1);
    for (const row of assigned) {
      layouts.push({ event: row.event, column: row.column, columnCount });
    }
  }
  return layouts;
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
  return events
    .filter((event) => eventOccursOnDate(event, iso))
    .map((event) => ({ ...event, occurrenceIso: iso }))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

function getEventsForRange(events: CalendarEvent[], startIso: string, endIso: string) {
  return rangeDays(startIso, endIso).flatMap((iso) => getEventsForDate(events, iso));
}

function overlaps(a: Pick<CalendarEvent | EventDraft, 'startTime' | 'endTime'>, b: Pick<CalendarEvent | EventDraft, 'startTime' | 'endTime'>) {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(a.endTime) > toMinutes(b.startTime);
}

function TimedCalendarGrid({
  dayIsos,
  events,
  selectedIso,
  onSelectDay,
}: {
  dayIsos: string[];
  events: CalendarEvent[];
  selectedIso: string;
  onSelectDay: (iso: string) => void;
}) {
  const gridHeight = HOURS.length * HOUR_HEIGHT;
  const isWeek = dayIsos.length > 1;

  return (
    <div className="max-h-[720px] overflow-auto pr-1">
      <div className="calendar-week-grid min-w-[760px]">
        <div className={isWeek ? 'grid grid-cols-[86px_repeat(7,minmax(0,1fr))]' : 'grid grid-cols-[86px_minmax(300px,1fr)]'}>
          <div />
          {dayIsos.map((iso) => (
            <button
              key={`head-${iso}`}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`border-b border-border p-3 text-center text-xs font-extrabold ${iso === selectedIso ? 'text-accent' : 'text-text-muted'}`}
            >
              {DAY_LABELS[dateFromIso(iso).getDay()]} {dateFromIso(iso).getDate()}
            </button>
          ))}
        </div>
        <div className="flex">
          <div className="calendar-time-column w-[86px] shrink-0">
            {HOURS.map((hour) => (
              <div key={hour} className="calendar-time-slot" style={{ height: HOUR_HEIGHT }}>
                {timeLabel(`${String(hour).padStart(2, '0')}:00`)}
              </div>
            ))}
          </div>
          <div className={isWeek ? 'grid min-w-0 flex-1 grid-cols-7' : 'min-w-0 flex-1'}>
            {dayIsos.map((iso) => {
              const dayLayouts = layoutTimedEventsForDay(getEventsForDate(events, iso));
              return (
                <div
                  key={iso}
                  className="calendar-day-column relative border-r border-border last:border-r-0"
                  style={{ height: gridHeight }}
                  onClick={() => onSelectDay(iso)}
                >
                  {dayLayouts.map(({ event, column, columnCount }) => {
                    const colors = typeStyle(event.type);
                    const widthExpr = `((100% - 16px) / ${columnCount})`;
                    return (
                      <button
                        key={`${iso}-${event.id}`}
                        type="button"
                        className="calendar-event-block"
                        style={{
                          top: getEventTop(event.startTime),
                          height: getEventHeight(event.startTime, event.endTime),
                          left: `calc(8px + ${column} * ${widthExpr})`,
                          width: `calc(${widthExpr})`,
                          background: colors.background,
                          color: colors.color,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDay(iso);
                        }}
                      >
                        <p className="calendar-event-title truncate">{event.title}</p>
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

export default function MonthCalendarBoard() {
  const { mirror, commitMirror } = useMirror();
  const todayIso = localIso(new Date());
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>({ ...EMPTY_DRAFT, date: todayIso });
  const [conflicts, setConflicts] = useState<CalendarEvent[] | null>(null);

  const selectedDate = dateFromIso(selectedIso);
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();
  const cells = createCells(year, month);
  const normalizedEvents = useMemo(
    () => mirror.classes.map((row) => normalizeEvent(row)).filter((row): row is CalendarEvent => row != null),
    [mirror.classes],
  );
  const selectedEvents = useMemo(() => getEventsForDate(normalizedEvents, selectedIso), [normalizedEvents, selectedIso]);
  const weekStart = startOfWeek(selectedIso);
  const weekEnd = endOfWeek(selectedIso);
  const weekDays = useMemo(() => rangeDays(weekStart, weekEnd), [weekStart, weekEnd]);
  const visibleEventCount =
    calendarView === 'day'
      ? getEventsForDate(normalizedEvents, selectedIso).length
      : calendarView === 'week'
        ? getEventsForRange(normalizedEvents, weekStart, weekEnd).length
        : getEventsForRange(normalizedEvents, cells[0]?.iso ?? selectedIso, cells[cells.length - 1]?.iso ?? selectedIso).length;
  function move(delta: number) {
    if (calendarView === 'day') setSelectedIso(addDays(selectedIso, delta));
    if (calendarView === 'week') setSelectedIso(addDays(selectedIso, delta * 7));
    if (calendarView === 'month') {
      const next = new Date(year, month + delta, selectedDate.getDate());
      setSelectedIso(localIso(next));
    }
  }

  function openAdd(date = selectedIso) {
    setDraft({ ...EMPTY_DRAFT, date });
    setModalOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setDraft({
      id: event.id,
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
    commitMirror((prev) => {
      const now = new Date().toISOString();
      const row: ClassItem = {
        id: cleaned.id ?? nextNumericId(prev.classes),
        title: cleaned.title,
        weekday: WEEKDAY_NAMES[dateFromIso(cleaned.date).getDay()],
        startTime: cleaned.startTime,
        endTime: cleaned.endTime,
        location: cleaned.location || null,
        recurrence: cleaned.recurrence === 'once' ? 'none' : cleaned.recurrence,
        eventType: cleaned.type,
        specificDate: cleaned.recurrence === 'once' ? cleaned.date : cleaned.date,
        parentEventId: parentClass ? String(parentClass.id) : cleaned.parentEventId,
        notes: cleaned.notes || null,
        createdAt: cleaned.id ? undefined : now,
        updatedAt: now,
      } as ClassItem;
      return {
        ...prev,
        classes: cleaned.id ? prev.classes.map((event) => (event.id === cleaned.id ? { ...event, ...row } : event)) : [...prev.classes, row],
      };
    });
    setSelectedIso(cleaned.date);
    setModalOpen(false);
    setConflicts(null);
  }

  function deleteEvent(id: number) {
    if (!window.confirm('Delete this calendar event?')) return;
    commitMirror((prev) => ({ ...prev, classes: prev.classes.filter((event) => event.id !== id) }));
  }

  function deleteAllClassEvents() {
    const count = normalizedEvents.filter((event) => event.type === 'class').length;
    if (count === 0) return;
    if (!window.confirm(`Delete all ${count} class event${count === 1 ? '' : 's'}? Quiz, exam, study, and deadline events will stay.`)) return;
    commitMirror((prev) => ({
      ...prev,
      classes: prev.classes.filter((event) => normalizeType(event.eventType) !== 'class'),
    }));
  }

  const title =
    calendarView === 'day'
      ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : calendarView === 'week'
        ? `Week of ${dateFromIso(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${dateFromIso(weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `${MONTHS[month]} ${year}`;

  return (
    <div className="sc-app-page-wide">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Schedule planner</p>
          <h1 className="sc-page-title mt-1 text-text-primary">Calendar</h1>
          <p className="mt-1 text-sm text-text-secondary">Day, week, and month view with recurring classes, event colors, and conflict checks.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-border bg-surface-2 p-1">
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
          <button type="button" onClick={() => openAdd()} className="sc-btn-primary min-h-[42px] rounded-full px-5">
            + Add Event
          </button>
        </div>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.8fr)_350px]">
        <section className="sc-panel overflow-hidden rounded-[28px]">
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
              <div className="grid grid-cols-7 gap-[9px] text-center">
                {DAY_LABELS.map((d) => (
                  <span key={d} className="py-1 text-xs font-medium text-text-muted">{d}</span>
                ))}
                {cells.map((cell) => {
                  const events = getEventsForDate(normalizedEvents, cell.iso);
                  return (
                    <button
                      type="button"
                      key={cell.iso}
                      onClick={() => setSelectedIso(cell.iso)}
                      className={`min-h-[100px] rounded-[16px] border p-2 text-left transition ${cell.iso === selectedIso ? 'border-accent bg-accent-light' : 'border-border bg-surface hover:bg-surface-2'} ${cell.otherMonth ? 'opacity-45' : ''}`}
                    >
                      <span className="text-xs font-extrabold text-text-secondary">{cell.day}</span>
                      <div className="mt-2 space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <span key={`${cell.iso}-${event.id}`} className="block truncate rounded-md px-2 py-1 text-[10px] font-bold" style={typeStyle(event.type)}>
                            {event.title}
                          </span>
                        ))}
                        {events.length > 2 ? <span className="text-[10px] text-text-muted">+{events.length - 2} more</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <TimedCalendarGrid
                dayIsos={calendarView === 'week' ? weekDays : [selectedIso]}
                events={normalizedEvents}
                selectedIso={selectedIso}
                onSelectDay={setSelectedIso}
              />
            )}
          </div>
        </section>

        <aside className="space-y-[18px]">
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
                  <div key={event.id} className="rounded-[16px] border border-border bg-surface-2 p-4">
                    <span className="rounded-full px-2 py-1 text-[10px] font-extrabold" style={typeStyle(event.type)}>{typeLabel(event.type)}</span>
                    <p className="mt-3 font-extrabold text-text-primary">{event.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{timeRange(event)} · {recurrenceLabel(event.recurrence)}</p>
                    {event.location ? <p className="mt-1 text-xs text-text-secondary">{event.location}</p> : null}
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

      <button type="button" onClick={() => openAdd()} className="fixed right-[34px] bottom-[128px] z-[75] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-3xl font-light text-white shadow-[var(--sc-shadow-accent)] max-[900px]:right-6 max-[900px]:bottom-[112px]">
        +
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[560px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-text-primary">{draft.id ? 'Edit Event' : '+ Add Event'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-full bg-surface-2 px-3 py-2 text-text-secondary">×</button>
            </div>
            <div className="space-y-4">
              <PillGroup label="Type" values={EVENT_TYPES} value={draft.type} onChange={(type) => setDraft((p) => ({ ...p, type }))} formatter={typeLabel} />
              <input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Math Chapter 5" className="sc-input" />
              <input value={draft.location} onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))} placeholder="Optional location" className="sc-input" />
              <PillGroup label="Recurrence" values={RECURRENCES} value={draft.recurrence} onChange={(recurrence) => setDraft((p) => ({ ...p, recurrence }))} formatter={recurrenceLabel} />
              <input type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} className="sc-input" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="time" value={draft.startTime} onChange={(e) => setDraft((p) => ({ ...p, startTime: e.target.value }))} className="sc-input" />
                <input type="time" value={draft.endTime} onChange={(e) => setDraft((p) => ({ ...p, endTime: e.target.value }))} className="sc-input" />
              </div>
              <button type="button" onClick={() => saveDraft(false)} className="sc-btn-primary min-h-[58px] w-full rounded-full">
                Add to Calendar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conflicts ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
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
                <div key={event.id} className="rounded-[14px] border border-border px-3 py-2 text-sm text-text-secondary">
                  {event.title} · {timeRange(event)}
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setConflicts(null)} className="sc-btn-secondary rounded-full">Cancel</button>
              <button type="button" onClick={() => saveDraft(true)} className="sc-btn-primary rounded-full">Add Anyway</button>
            </div>
          </div>
        </div>
      ) : null}
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
    <div>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className="rounded-full px-4 py-2 text-sm font-extrabold transition"
            style={item === value ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}
          >
            {formatter(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
