'use client';

import { useMemo, useState } from 'react';

import { formatAdminDate } from '@/lib/admin-shared';
import type { AnnouncementRecord, AnnouncementTargetPlan, AnnouncementType } from '@/lib/announcements-types';

const PLAN_OPTIONS: AnnouncementTargetPlan[] = ['all', 'free', 'beta', 'premium'];
const TYPE_OPTIONS: AnnouncementType[] = [
  'update',
  'maintenance',
  'feature',
  'warning',
  'beta',
  'general',
];

export default function AdminAnnouncementsClient({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementRecord[];
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    announcementId: '',
    title: '',
    message: '',
    type: 'general' as AnnouncementType,
    targetPlans: ['all'] as AnnouncementTargetPlan[],
    ctaLabel: '',
    ctaHref: '',
    publishNow: false,
    expiresAt: '',
  });

  const sorted = useMemo(
    () => [...announcements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [announcements],
  );

  function resetForm() {
    setForm({
      announcementId: '',
      title: '',
      message: '',
      type: 'general',
      targetPlans: ['all'],
      ctaLabel: '',
      ctaHref: '',
      publishNow: false,
      expiresAt: '',
    });
  }

  function togglePlan(plan: AnnouncementTargetPlan) {
    setForm((prev) => {
      const has = prev.targetPlans.includes(plan);
      const next = has ? prev.targetPlans.filter((p) => p !== plan) : [...prev.targetPlans, plan];
      return { ...prev, targetPlans: next.length ? next : (['all'] as AnnouncementTargetPlan[]) };
    });
  }

  async function saveAnnouncement() {
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(form.announcementId);
      const res = await fetch(
        isEdit ? `/api/admin/announcements/${form.announcementId}` : '/api/admin/announcements',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: form.title,
            message: form.message,
            type: form.type,
            targetPlans: form.targetPlans,
            ctaLabel: form.ctaLabel || null,
            ctaHref: form.ctaHref || null,
            publishNow: form.publishNow,
            expiresAt: form.expiresAt || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed.');
      const record = data.announcement as AnnouncementRecord;
      setAnnouncements((prev) => {
        const without = prev.filter((a) => a.announcementId !== record.announcementId);
        return [record, ...without];
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: 'draft' | 'published' | 'archived') {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed.');
      const record = data.announcement as AnnouncementRecord;
      setAnnouncements((prev) => prev.map((a) => (a.announcementId === id ? record : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">
          {form.announcementId ? 'Edit announcement' : 'Create announcement'}
        </h3>
        <div className="mt-4 grid gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <textarea
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Message"
            rows={4}
            className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnouncementType }))}
              className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              type="datetime-local"
              className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => togglePlan(plan)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  form.targetPlans.includes(plan)
                    ? 'bg-accent text-white'
                    : 'border border-white/10 bg-black/20 text-text-secondary'
                }`}
              >
                {plan}
              </button>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={form.ctaLabel}
              onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
              placeholder="CTA label (optional)"
              className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
            <input
              value={form.ctaHref}
              onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
              placeholder="CTA URL (optional)"
              className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.publishNow}
              onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
            />
            Publish now
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAnnouncement()}
              className="rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {form.announcementId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[12px] border border-white/10 px-4 py-2 text-sm"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">Announcements</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Targets</th>
                <th className="pb-2 pr-3">Published</th>
                <th className="pb-2 pr-3">Expires</th>
                <th className="pb-2 pr-3">Created by</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.announcementId} className="border-t border-white/8 text-text-secondary">
                  <td className="py-2 pr-3 text-text-primary">{row.title}</td>
                  <td className="py-2 pr-3">{row.type}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3">{row.targetPlans.join(', ')}</td>
                  <td className="py-2 pr-3">{formatAdminDate(row.publishedAt)}</td>
                  <td className="py-2 pr-3">{formatAdminDate(row.expiresAt)}</td>
                  <td className="py-2 pr-3">{row.createdByEmail ?? row.createdByUid}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-white/10 px-2 py-1 text-xs"
                        onClick={() =>
                          setForm({
                            announcementId: row.announcementId,
                            title: row.title,
                            message: row.message,
                            type: row.type,
                            targetPlans: row.targetPlans,
                            ctaLabel: row.ctaLabel ?? '',
                            ctaHref: row.ctaHref ?? '',
                            publishNow: false,
                            expiresAt: row.expiresAt?.slice(0, 16) ?? '',
                          })
                        }
                      >
                        Edit
                      </button>
                      {row.status !== 'published' ? (
                        <button
                          type="button"
                          className="rounded border border-white/10 px-2 py-1 text-xs"
                          onClick={() => void setStatus(row.announcementId, 'published')}
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-white/10 px-2 py-1 text-xs"
                          onClick={() => void setStatus(row.announcementId, 'draft')}
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded border border-white/10 px-2 py-1 text-xs"
                        onClick={() => void setStatus(row.announcementId, 'archived')}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
