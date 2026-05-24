'use client';

import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';

import type { CloudMirrorV1 } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { orderedWeekdays } from '@/lib/mirror-bootstrap';
import { withSyncedClasses } from '@/lib/study-task-sync';

export default function CalendarBoard() {
  const { mirror, commitMirror } = useMirror();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(ev: DragEndEvent) {
    const overId = ev.over?.id?.toString();
    const activeId = ev.active?.id?.toString();
    if (!overId || !activeId) return;

    const match = /^class:(\d+)$/.exec(activeId);
    if (!match || !overId.startsWith('drop:')) return;
    const classId = Number(match[1]);
    const weekday = overId.slice('drop:'.length);

    commitMirror((prev: CloudMirrorV1) =>
      withSyncedClasses(
        prev,
        prev.classes.map((c) => (c.id === classId ? { ...c, weekday } : c)),
      ),
    );
  }

  const weekdayOrder = orderedWeekdays();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Calendar board</h1>
        <p className="text-sm text-text-secondary">Drag strips between weekday lanes. Mirrors the `classes` rows in SQLite.</p>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {weekdayOrder.map((d) => (
            <DayColumn key={d} weekday={d} mirror={mirror} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function DayColumn({ weekday, mirror }: { weekday: string; mirror: CloudMirrorV1 }) {
  const drops = mirror.classes.filter((c) => (c.weekday ?? '').toLowerCase() === weekday.toLowerCase());
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${weekday}`,
    data: { weekday },
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'min-h-[180px] rounded-[12px] border p-3',
        isOver ? 'border-purple-300 bg-accent-light' : 'border-border bg-surface',
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{weekday}</p>
      <div className="mt-2 space-y-2">
        {drops.length === 0 ? (
          <p className="text-[11px] text-text-muted">Drop a class here.</p>
        ) : (
          drops.map((c) => <ClassChip key={`${weekday}:${c.id}`} cls={c} />)
        )}
      </div>
    </div>
  );
}

function ClassChip({ cls }: { cls: CloudMirrorV1['classes'][number] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `class:${cls.id}`,
    data: cls,
  });
  const style = {
    transform: CSS.Transform.toString(transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1 }),
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'flex w-full flex-col rounded-[10px] border px-3 py-2 text-left text-xs transition',
        isDragging ? 'border-purple-300 bg-accent-light text-text-primary' : 'border-border bg-surface-2 text-text-primary',
      )}
    >
      <span className="font-semibold">{cls.title ?? 'Untitled course'}</span>
      <span className="text-[11px] text-text-secondary">
        {cls.startTime ?? '—'} – {cls.endTime ?? '—'}
      </span>
    </button>
  );
}
