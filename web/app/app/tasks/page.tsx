'use client';

import { useMemo, useState } from 'react';

import type { TaskCategory, TaskItem } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';
import {
  applyTaskEditsToLinkedCalendar,
  CALENDAR_TASK_SOURCE,
} from '@/lib/study-task-sync';

type ModalMode =
  | 'choice'
  | 'category'
  | 'task'
  | 'edit-task'
  | 'edit-category'
  | null;

type TaskDraft = {
  id: number | null;
  title: string;
  details: string;
  estimatedMinutes: string;
  dueAt: string;
  categoryId: number | null;
  status: 'open' | 'done';
};

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
          <polyline
            points="6,11 9.5,14.5 16,8"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle
            cx="11"
            cy="11"
            r="10.5"
            fill="none"
            stroke="var(--sc-border)"
            strokeWidth="1.5"
            className="transition hover:stroke-accent"
          />
        </svg>
      )}
    </button>
  );
}

function taskToDraft(task?: TaskItem | null): TaskDraft {
  return {
    id: task?.id ?? null,
    title: task?.title ?? '',
    details: task?.details ?? '',
    estimatedMinutes:
      task?.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
    dueAt: task?.dueAt ? task.dueAt.slice(0, 16) : '',
    categoryId: task?.categoryId ?? null,
    status: isDone(task?.status) ? 'done' : 'open',
  };
}

export default function TasksRoutePage() {
  const { mirror, commitMirror } = useMirror();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => taskToDraft(null));
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useMemo(
    () => [...mirror.taskCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [mirror.taskCategories],
  );
  const categoryLookup = useMemo(
    () => new Map(mirror.taskCategories.map((category) => [category.id, category])),
    [mirror.taskCategories],
  );
  const generalCategory = useMemo(
    () => mirror.taskCategories.find((category) => category.slug === 'general') ?? null,
    [mirror.taskCategories],
  );
  const doneCount = mirror.tasks.filter((task) => isDone(task.status)).length;
  const filteredTasks = useMemo(() => {
    const pool =
      selectedCategoryId === 'all'
        ? mirror.tasks
        : mirror.tasks.filter((task) => task.categoryId === selectedCategoryId);
    return [...pool].sort(
      (a, b) =>
        Number(isDone(a.status)) - Number(isDone(b.status)) ||
        String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
    );
  }, [mirror.tasks, selectedCategoryId]);

  function closeModal() {
    setModalMode(null);
    setCategoryName('');
    setEditingCategoryId(null);
    setTaskDraft(taskToDraft(null));
    setFormError(null);
  }

  function openAddTaskModal() {
    setTaskDraft({
      id: null,
      title: '',
      details: '',
      estimatedMinutes: '',
      dueAt: '',
      categoryId: generalCategory?.id ?? null,
      status: 'open',
    });
    setModalMode('task');
    setFormError(null);
  }

  function openEditTaskModal(task: TaskItem) {
    setTaskDraft(taskToDraft(task));
    setModalMode('edit-task');
    setFormError(null);
  }

  function openEditCategoryModal(category: TaskCategory) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setModalMode('edit-category');
    setFormError(null);
  }

  function addCategory() {
    const name = cleanName(categoryName);
    const slug = slugify(name);
    if (!name || !slug) {
      setFormError('Enter a category name.');
      return;
    }
    if (mirror.taskCategories.some((category) => category.slug === slug)) {
      setFormError('That category already exists.');
      return;
    }
    commitMirror((prev) => ({
      ...prev,
      taskCategories: [
        ...prev.taskCategories,
        { id: nextNumericId(prev.taskCategories), name, slug },
      ],
    }));
    closeModal();
  }

  function renameCategory() {
    const categoryId = editingCategoryId;
    if (categoryId == null) return;
    const name = cleanName(categoryName);
    const slug = slugify(name);
    if (!name || !slug) {
      setFormError('Category name cannot be empty.');
      return;
    }
    if (
      mirror.taskCategories.some(
        (category) => category.id !== categoryId && category.slug === slug,
      )
    ) {
      setFormError('A category with that name already exists.');
      return;
    }
    commitMirror((prev) => ({
      ...prev,
      taskCategories: prev.taskCategories.map((category) =>
        category.id === categoryId ? { ...category, name, slug } : category,
      ),
    }));
    closeModal();
  }

  function deleteCategory(category: TaskCategory) {
    if (category.slug === 'general') {
      setFormError('General cannot be deleted.');
      return;
    }
    const generalId = generalCategory?.id ?? null;
    const affectedTasks = mirror.tasks.filter((task) => task.categoryId === category.id).length;
    const message =
      affectedTasks > 0
        ? `Delete "${category.name}"? ${affectedTasks} task${affectedTasks === 1 ? '' : 's'} will move to General.`
        : `Delete "${category.name}"?`;
    if (!window.confirm(message)) return;

    commitMirror((prev) => ({
      ...prev,
      taskCategories: prev.taskCategories.filter((row) => row.id !== category.id),
      tasks: prev.tasks.map((task) =>
        task.categoryId === category.id ? { ...task, categoryId: generalId } : task,
      ),
    }));

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId('all');
    }
  }

  function saveTask() {
    const title = cleanName(taskDraft.title);
    if (!title) {
      setFormError('Task title cannot be empty.');
      return;
    }

    const minutes = Number(taskDraft.estimatedMinutes);
    const nextDueAt = taskDraft.dueAt ? new Date(taskDraft.dueAt).toISOString() : null;
    const nextDetails = taskDraft.details.trim() || null;
    const nextStatus = taskDraft.status;

    if (modalMode === 'task') {
      commitMirror((prev) => ({
        ...prev,
        tasks: [
          ...prev.tasks,
          {
            id: nextNumericId(prev.tasks),
            categoryId: taskDraft.categoryId,
            title,
            details: nextDetails,
            dueAt: nextDueAt,
            estimatedMinutes:
              Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
            status: nextStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
      closeModal();
      return;
    }

    if (taskDraft.id == null) return;
    commitMirror((prev) =>
      applyTaskEditsToLinkedCalendar(prev, taskDraft.id as number, {
        title,
        details: nextDetails,
        dueAt: nextDueAt,
        estimatedMinutes:
          Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
        categoryId: taskDraft.categoryId,
        status: nextStatus,
      }),
    );
    closeModal();
  }

  function toggleTask(taskId: number) {
    commitMirror((prev) =>
      applyTaskEditsToLinkedCalendar(prev, taskId, {
        status: mirror.tasks.find((task) => task.id === taskId && isDone(task.status))
          ? 'open'
          : 'done',
      }),
    );
  }

  return (
    <div className="sc-app-page w-full min-w-0 max-w-full space-y-[22px]">
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Task planner</p>
          <h1 className="sc-page-title mt-1 text-text-primary">Tasks</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Edit tasks, rename categories, and keep Study-linked calendar tasks in sync.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="sc-badge">
            {doneCount} of {mirror.tasks.length} finished
          </div>
          <button
            type="button"
            onClick={() => setModalMode('choice')}
            className="sc-btn-primary rounded-full px-5"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('all')}
          className="rounded-full px-5 py-2 text-sm font-extrabold transition"
          style={
            selectedCategoryId === 'all'
              ? {
                  background: 'var(--sc-accent)',
                  color: 'white',
                  boxShadow: 'var(--sc-shadow-accent)',
                }
              : {
                  background: 'var(--sc-surface-soft)',
                  color: 'var(--sc-text-secondary)',
                }
          }
        >
          All
        </button>
        {categories.map((category) => (
          <span
            key={category.id}
            className="inline-flex items-center overflow-hidden rounded-full"
            style={
              selectedCategoryId === category.id
                ? {
                    background: 'var(--sc-accent)',
                    color: 'white',
                    boxShadow: 'var(--sc-shadow-accent)',
                  }
                : {
                    background: 'var(--sc-surface-soft)',
                    color: 'var(--sc-text-secondary)',
                  }
            }
          >
            <button
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className="px-5 py-2 text-sm font-extrabold transition"
            >
              {category.name}
            </button>
            <button
              type="button"
              onClick={() => openEditCategoryModal(category)}
              aria-label={`Rename ${category.name} category`}
              className="border-l border-white/20 px-3 py-2 text-xs font-extrabold opacity-80 transition hover:opacity-100"
            >
              Edit
            </button>
            {category.slug !== 'general' ? (
              <button
                type="button"
                onClick={() => deleteCategory(category)}
                aria-label={`Delete ${category.name} category`}
                className="border-l border-white/20 px-3 py-2 text-xs font-extrabold opacity-80 transition hover:opacity-100"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-[18px] xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,320px)]">
        <section className="sc-panel min-w-0 rounded-[24px]">
          <div className="sc-panel-header">
            <h2 className="text-base font-extrabold text-text-primary">Open Tasks</h2>
            <button
              type="button"
              onClick={() => setModalMode('choice')}
              className="sc-btn-primary rounded-[14px] px-5 py-2 text-sm"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2 p-5">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-text-muted">No tasks in this category.</p>
            ) : (
              filteredTasks.map((task) => {
                const done = isDone(task.status);
                const category =
                  task.categoryId != null ? categoryLookup.get(task.categoryId) : null;
                const linkedFromCalendar =
                  task.sourceType === CALENDAR_TASK_SOURCE &&
                  typeof task.sourceEventId === 'number';

                return (
                  <div
                    key={task.id}
                    className={`flex min-h-[74px] w-full items-start gap-3 rounded-[16px] border border-border bg-surface-2 px-[14px] py-3 text-left ${done ? 'opacity-65' : ''}`}
                  >
                    <CircleCheck checked={done} onClick={() => toggleTask(task.id)} />
                    <button
                      type="button"
                      onClick={() => openEditTaskModal(task)}
                      className="flex-1 text-left"
                    >
                      <span
                        className={`block text-sm text-text-primary ${done ? 'line-through' : ''}`}
                      >
                        {task.title ?? 'Untitled task'}
                      </span>
                      <span
                        className="mt-1 block text-xs text-text-muted"
                        style={{ textDecoration: 'none' }}
                      >
                        {category?.name ?? 'General'}
                        {task.estimatedMinutes
                          ? ` · ${task.estimatedMinutes} min`
                          : ''}
                        {task.dueAt
                          ? ` · Due: ${new Date(task.dueAt).toLocaleString()}`
                          : ''}
                      </span>
                      {linkedFromCalendar ? (
                        <span className="mt-1 inline-flex rounded-full bg-accent-light px-2 py-1 text-[10px] font-extrabold text-accent">
                          Linked from calendar
                        </span>
                      ) : null}
                      {task.details ? (
                        <span className="mt-2 block text-xs leading-5 text-text-secondary">
                          {task.details}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditTaskModal(task)}
                      className="pt-1 text-xs font-extrabold text-accent"
                    >
                      Edit
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="sc-panel min-w-0 h-fit rounded-[24px] p-6">
          <h2 className="text-base font-extrabold text-text-primary">Task Logic</h2>
          <p className="mt-4 text-xs leading-relaxed text-text-muted">
            Study-linked tasks stay tied to their calendar event. Renaming a category updates
            every task using that category through the existing category id mapping.
          </p>
          {formError ? <p className="mt-4 text-xs text-rose-500">{formError}</p> : null}
        </section>
      </div>

      <button
        type="button"
        onClick={() => setModalMode('choice')}
        className="fixed bottom-[128px] right-[34px] z-[75] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-3xl font-light text-white shadow-[var(--sc-shadow-accent)] max-[900px]:bottom-[112px] max-[900px]:right-6"
      >
        +
      </button>

      {modalMode === 'choice' ? (
        <ModalShell title="Add" subtitle="What do you want to add?" onClose={closeModal}>
          <button
            type="button"
            onClick={() => setModalMode('category')}
            className="sc-btn-secondary min-h-[48px] rounded-[14px]"
          >
            Add Category
          </button>
          <button
            type="button"
            onClick={openAddTaskModal}
            className="sc-btn-secondary min-h-[48px] rounded-[14px]"
          >
            Add Task
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="sc-btn-secondary min-h-[48px] rounded-[14px]"
          >
            Cancel
          </button>
        </ModalShell>
      ) : null}

      {modalMode === 'category' ? (
        <ModalShell title="Add Category" onClose={closeModal}>
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Category name"
            className="sc-input"
          />
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
          <button
            type="button"
            onClick={addCategory}
            className="sc-btn-primary min-h-[58px] rounded-full"
          >
            Add Category
          </button>
        </ModalShell>
      ) : null}

      {modalMode === 'edit-category' ? (
        <ModalShell title="Rename Category" onClose={closeModal}>
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Category name"
            className="sc-input"
          />
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
          <button
            type="button"
            onClick={renameCategory}
            className="sc-btn-primary min-h-[58px] rounded-full"
          >
            Save Category
          </button>
        </ModalShell>
      ) : null}

      {modalMode === 'task' || modalMode === 'edit-task' ? (
        <ModalShell
          title={modalMode === 'edit-task' ? 'Edit Task' : 'Add Task'}
          onClose={closeModal}
        >
          <input
            value={taskDraft.title}
            onChange={(e) =>
              setTaskDraft((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="Task title"
            className="sc-input"
          />
          <textarea
            value={taskDraft.details}
            onChange={(e) =>
              setTaskDraft((prev) => ({ ...prev, details: e.target.value }))
            }
            placeholder="Details or notes"
            rows={4}
            className="sc-input resize-y py-3"
          />
          <input
            value={taskDraft.estimatedMinutes}
            onChange={(e) =>
              setTaskDraft((prev) => ({
                ...prev,
                estimatedMinutes: e.target.value.replace(/[^\d]/g, ''),
              }))
            }
            placeholder="Estimated minutes (optional)"
            className="sc-input"
          />
          <input
            type="datetime-local"
            value={taskDraft.dueAt}
            onChange={(e) =>
              setTaskDraft((prev) => ({ ...prev, dueAt: e.target.value }))
            }
            className="sc-input"
          />
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">
              Category
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setTaskDraft((prev) => ({ ...prev, categoryId: generalCategory?.id ?? null }))
                }
                className="rounded-full px-4 py-2 text-sm font-extrabold"
                style={
                  taskDraft.categoryId === (generalCategory?.id ?? null)
                    ? {
                        background: 'var(--sc-accent)',
                        color: 'white',
                        boxShadow: 'var(--sc-shadow-accent)',
                      }
                    : {
                        background: 'var(--sc-surface-soft)',
                        color: 'var(--sc-text-secondary)',
                      }
                }
              >
                General
              </button>
              {categories
                .filter((category) => category.slug !== 'general')
                .map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setTaskDraft((prev) => ({ ...prev, categoryId: category.id }))
                    }
                    className="rounded-full px-4 py-2 text-sm font-extrabold"
                    style={
                      taskDraft.categoryId === category.id
                        ? {
                            background: 'var(--sc-accent)',
                            color: 'white',
                            boxShadow: 'var(--sc-shadow-accent)',
                          }
                        : {
                            background: 'var(--sc-surface-soft)',
                            color: 'var(--sc-text-secondary)',
                          }
                    }
                  >
                    {category.name}
                  </button>
                ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">
              Status
            </p>
            <div className="flex gap-2">
              {(['open', 'done'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTaskDraft((prev) => ({ ...prev, status }))}
                  className="rounded-full px-4 py-2 text-sm font-extrabold capitalize"
                  style={
                    taskDraft.status === status
                      ? {
                          background: 'var(--sc-accent)',
                          color: 'white',
                          boxShadow: 'var(--sc-shadow-accent)',
                        }
                      : {
                          background: 'var(--sc-surface-soft)',
                          color: 'var(--sc-text-secondary)',
                        }
                  }
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          {taskDraft.id != null &&
          mirror.tasks.find((task) => task.id === taskDraft.id)?.sourceType ===
            CALENDAR_TASK_SOURCE ? (
            <p className="text-xs text-text-muted">
              Linked from calendar. Saving title/details also updates the source Study event.
            </p>
          ) : null}
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
          <button
            type="button"
            onClick={saveTask}
            className="sc-btn-primary min-h-[58px] rounded-full"
          >
            {modalMode === 'edit-task' ? 'Save Task' : 'Add Task'}
          </button>
        </ModalShell>
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-primary">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-2 px-3 py-2 text-text-secondary"
          >
            ×
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
      </div>
    </div>
  );
}
