'use client';

import { useEffect, useState, type FormEvent } from 'react';
import dayjs from 'dayjs';

import type { CloudMirrorV1, TaskItem } from '@studycue/types';

import { useDashboardUi } from '@/context/dashboard-ui';
import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

export default function TasksColumn({ mirror }: { mirror: CloudMirrorV1 }) {
  const { commitMirror } = useMirror();
  const { newTaskSignal } = useDashboardUi();

  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!newTaskSignal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [newTaskSignal]);

  const [activeTab, setActiveTab] = useState<'All' | 'Today' | 'Upcoming' | 'Overdue' | 'Done'>('All');

  function addTask(evt: FormEvent) {
    evt.preventDefault();
    if (!title.trim()) return;

    commitMirror((prev) => {
      const id = nextNumericId(prev.tasks);
      const fallbackCat = prev.taskCategories[0]?.id ?? null;
      const row: TaskItem = {
        id,
        categoryId: fallbackCat,
        title: title.trim(),
        dueAt: null,
        estimatedMinutes: null,
        status: 'open',
        createdAt: new Date().toISOString(),
      };

      return { ...prev, tasks: [...prev.tasks, row] };
    });

    setTitle('');
    setOpen(false);
  }

  function toggleDone(taskId: number) {
    commitMirror((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: (t.status ?? '').toLowerCase() === 'completed' ? 'open' : 'completed' }
          : t,
      ),
    }));
  }

  const today = dayjs().startOf('day');
  const filtered = mirror.tasks.filter((t) => {
    const status = (t.status ?? '').toLowerCase();
    const done = status === 'done' || status === 'completed';
    const due = t.dueAt ? dayjs(t.dueAt) : null;
    if (activeTab === 'Done') return done;
    if (activeTab === 'Today') return !done && !!due && due.isSame(today, 'day');
    if (activeTab === 'Upcoming') return !done && (!!due ? due.isAfter(today, 'day') : true);
    if (activeTab === 'Overdue') return !done && !!due && due.isBefore(today, 'day');
    return true;
  });
  const doneCount = mirror.tasks.filter((t) => ['done', 'completed'].includes((t.status ?? '').toLowerCase())).length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[17px] font-extrabold text-text-primary">Tasks</p>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-text-muted">
          {doneCount} / {mirror.tasks.length} done
        </span>
      </div>
      <article className="sc-panel">
        <div className="sc-panel-header">
          <p className="text-[15px] font-extrabold text-text-primary">All Tasks</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="sc-btn-primary text-xs"
          >
            {open ? 'Close' : 'Add task'}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
          {(['All', 'Today', 'Upcoming', 'Overdue', 'Done'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold',
                activeTab === tab ? 'border-transparent bg-accent text-white' : 'border-transparent text-text-muted hover:bg-surface-2',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>

        {open ? (
          <form onSubmit={addTask} className="space-y-3 border-b border-border bg-surface-2/70 px-5 py-4">
            <label className="block text-[11px] uppercase tracking-[0.3em] text-text-muted">Quick capture</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Read chapter..."
              className="sc-input"
            />
            <button type="submit" className="sc-btn-primary text-xs">
              Add task
            </button>
          </form>
        ) : null}

        <div className="p-5">
          {filtered.length === 0 ? (
            <div className="rounded-[12px] py-8 text-center">
              <p className="text-sm font-medium text-text-primary">No tasks yet</p>
              <p className="mt-1 text-xs text-text-muted">Add your first task to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 15).map((t) => {
                const done = ['done', 'completed'].includes((t.status ?? '').toLowerCase());
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleDone(t.id)}
                    className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-2 px-4 py-3 text-left text-sm text-text-primary hover:bg-accent-light"
                  >
                    <span className={done ? 'line-through opacity-60' : ''}>{(t.title ?? '').trim() || 'Untitled task'}</span>
                    <span className="shrink-0 text-[11px] text-text-muted">{done ? 'Done' : 'Open'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
