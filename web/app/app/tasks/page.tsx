'use client';

import { useMemo, useState } from 'react';

import type { TaskCategory } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

type ModalMode = 'choice' | 'category' | 'task' | null;

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function slugify(name: string) {
  return cleanName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isDone(status: string | null | undefined) {
  return ['done', 'completed'].includes((status ?? '').toLowerCase());
}

function CircleCheck({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={checked ? 'Mark as open' : 'Mark as done'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 transition"
    >
      {checked ? (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10.5" fill="var(--sc-accent)" stroke="var(--sc-accent)" />
          <polyline points="6,11 9.5,14.5 16,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10.5" fill="none" stroke="var(--sc-border)" strokeWidth="1.5" className="transition hover:stroke-accent" />
        </svg>
      )}
    </button>
  );
}

export default function TasksRoutePage() {
  const { mirror, commitMirror } = useMirror();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [categoryName, setCategoryName] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState<number | null>(mirror.taskCategories[0]?.id ?? null);

  const categories = useMemo(
    () => [...mirror.taskCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [mirror.taskCategories],
  );
  const categoryLookup = useMemo(
    () => new Map(mirror.taskCategories.map((c) => [c.id, c])),
    [mirror.taskCategories],
  );
  const doneCount = mirror.tasks.filter((task) => isDone(task.status)).length;
  const filteredTasks = useMemo(() => {
    const pool = selectedCategoryId === 'all' ? mirror.tasks : mirror.tasks.filter((task) => task.categoryId === selectedCategoryId);
    return [...pool].sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [mirror.tasks, selectedCategoryId]);

  function closeModal() {
    setModalMode(null);
    setCategoryName('');
    setTaskTitle('');
    setEstimatedMinutes('');
  }

  function addCategory() {
    const name = cleanName(categoryName);
    const slug = slugify(name);
    if (!name || !slug) return;
    commitMirror((prev) => {
      if (prev.taskCategories.some((category) => category.slug === slug)) return prev;
      const row: TaskCategory = { id: nextNumericId(prev.taskCategories), name, slug };
      return { ...prev, taskCategories: [...prev.taskCategories, row] };
    });
    closeModal();
  }

  function deleteCategory(category: TaskCategory) {
    const affectedTasks = mirror.tasks.filter((task) => task.categoryId === category.id).length;
    const message =
      affectedTasks > 0
        ? `Delete "${category.name}"? ${affectedTasks} task${affectedTasks === 1 ? '' : 's'} will be moved to General/uncategorized.`
        : `Delete "${category.name}"?`;
    if (!window.confirm(message)) return;

    commitMirror((prev) => ({
      ...prev,
      taskCategories: prev.taskCategories.filter((row) => row.id !== category.id),
      tasks: prev.tasks.map((task) =>
        task.categoryId === category.id ? { ...task, categoryId: null } : task,
      ),
    }));

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId('all');
    }
    if (taskCategoryId === category.id) {
      const nextCategory = categories.find((row) => row.id !== category.id);
      setTaskCategoryId(nextCategory?.id ?? null);
    }
  }

  function addTask() {
    const title = cleanName(taskTitle);
    if (!title) return;
    const minutes = Number(estimatedMinutes);
    commitMirror((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          id: nextNumericId(prev.tasks),
          categoryId: taskCategoryId,
          title,
          dueAt: null,
          estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    closeModal();
  }

  function toggleTask(taskId: number) {
    commitMirror((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, status: isDone(task.status) ? 'open' : 'done' } : task)),
    }));
  }

  return (
    <div className="sc-app-page w-full min-w-0 max-w-full space-y-[22px]">
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Task planner</p>
          <h1 className="sc-page-title mt-1 text-text-primary">Tasks</h1>
          <p className="mt-1 text-sm text-text-secondary">Mobile-style Add flow: choose Add Category or Add Task, then use category chips.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="sc-badge">{doneCount} of {mirror.tasks.length} finished</div>
          <button type="button" onClick={() => setModalMode('choice')} className="sc-btn-primary rounded-full px-5">+ Add</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelectedCategoryId('all')} className="rounded-full px-5 py-2 text-sm font-extrabold transition" style={selectedCategoryId === 'all' ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}>
          All
        </button>
        {categories.map((category) => (
          <span
            key={category.id}
            className="inline-flex items-center overflow-hidden rounded-full"
            style={selectedCategoryId === category.id ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}
          >
            <button type="button" onClick={() => setSelectedCategoryId(category.id)} className="px-5 py-2 text-sm font-extrabold transition">
              {category.name}
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(category)}
              aria-label={`Delete ${category.name} category`}
              className="border-l border-white/20 px-3 py-2 text-xs font-extrabold opacity-80 transition hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-[18px] xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,320px)]">
        <section className="sc-panel min-w-0 rounded-[24px]">
          <div className="sc-panel-header">
            <h2 className="text-base font-extrabold text-text-primary">Open Tasks</h2>
            <button type="button" onClick={() => setModalMode('choice')} className="sc-btn-primary rounded-[14px] px-5 py-2 text-sm">+ Add</button>
          </div>
          <div className="space-y-2 p-5">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-text-muted">No tasks in this category.</p>
            ) : (
              filteredTasks.map((task) => {
                const done = isDone(task.status);
                const category = task.categoryId != null ? categoryLookup.get(task.categoryId) : null;
                return (
                  <div key={task.id} className={`flex min-h-[62px] items-center gap-3 rounded-[16px] border border-border bg-surface-2 px-[14px] py-3 ${done ? 'opacity-65' : ''}`}>
                    <CircleCheck checked={done} onClick={() => toggleTask(task.id)} />
                    <span className={`flex-1 text-sm text-text-primary ${done ? 'line-through' : ''}`}>
                      {task.title ?? 'Untitled task'}
                      <span className="block text-xs text-text-muted no-underline" style={{ textDecoration: 'none' }}>
                        {category?.name ?? 'General'}
                        {task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ''}
                        {task.dueAt ? ` · Due: ${new Date(task.dueAt).toLocaleDateString()}` : ''}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="sc-panel min-w-0 h-fit rounded-[24px] p-6">
          <h2 className="text-base font-extrabold text-text-primary">Task Logic</h2>
          <p className="mt-4 text-xs leading-relaxed text-text-muted">
            Same as mobile: Add opens a choice modal. Add Task uses title, estimated minutes, and category chips.
          </p>
        </section>
      </div>

      <button type="button" onClick={() => setModalMode('choice')} className="fixed right-[34px] bottom-[128px] z-[75] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-3xl font-light text-white shadow-[var(--sc-shadow-accent)] max-[900px]:right-6 max-[900px]:bottom-[112px]">
        +
      </button>

      {modalMode === 'choice' ? (
        <ModalShell title="Add" subtitle="What do you want to add?" onClose={closeModal}>
          <button type="button" onClick={() => setModalMode('category')} className="sc-btn-secondary min-h-[48px] rounded-[14px]">Add Category</button>
          <button type="button" onClick={() => setModalMode('task')} className="sc-btn-secondary min-h-[48px] rounded-[14px]">Add Task</button>
          <button type="button" onClick={closeModal} className="sc-btn-secondary min-h-[48px] rounded-[14px]">Cancel</button>
        </ModalShell>
      ) : null}

      {modalMode === 'category' ? (
        <ModalShell title="Add Category" onClose={closeModal}>
          <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" className="sc-input" />
          <button type="button" onClick={addCategory} className="sc-btn-primary min-h-[58px] rounded-full">Add Category</button>
        </ModalShell>
      ) : null}

      {modalMode === 'task' ? (
        <ModalShell title="Add Task" onClose={closeModal}>
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="sc-input" />
          <input value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value.replace(/[^\d]/g, ''))} placeholder="Estimated minutes (optional)" className="sc-input" />
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button key={category.id} type="button" onClick={() => setTaskCategoryId(category.id)} className="rounded-full px-4 py-2 text-sm font-extrabold" style={taskCategoryId === category.id ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}>
                  {category.name}
                </button>
              ))}
              <button type="button" onClick={() => setTaskCategoryId(null)} className="rounded-full px-4 py-2 text-sm font-extrabold" style={taskCategoryId == null ? { background: 'var(--sc-accent)', color: 'white', boxShadow: 'var(--sc-shadow-accent)' } : { background: 'var(--sc-surface-soft)', color: 'var(--sc-text-secondary)' }}>
                General
              </button>
            </div>
          </div>
          <button type="button" onClick={addTask} className="sc-btn-primary min-h-[58px] rounded-full">Add Task</button>
        </ModalShell>
      ) : null}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-primary">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-surface-2 px-3 py-2 text-text-secondary">×</button>
        </div>
        <div className="grid gap-3">{children}</div>
      </div>
    </div>
  );
}
