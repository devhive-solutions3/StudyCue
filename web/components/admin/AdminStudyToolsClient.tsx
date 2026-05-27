'use client';

import { useMemo, useState } from 'react';

import { formatAdminDate } from '@/lib/admin-shared';
import type { StudyToolsAdminDashboard } from '@/lib/admin-study-tools-data';

type Filter =
  | 'all'
  | 'beta'
  | 'premium'
  | 'quiz'
  | 'flashcards'
  | 'cue'
  | 'rate_limited';

export default function AdminStudyToolsClient({ dashboard }: { dashboard: StudyToolsAdminDashboard }) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredEvents = useMemo(() => {
    return dashboard.recentEvents.filter((event) => {
      if (filter === 'beta') return event.userPlan === 'beta';
      if (filter === 'premium') return event.userPlan === 'premium';
      if (filter === 'quiz') return event.toolType === 'quiz';
      if (filter === 'flashcards') return event.toolType === 'flashcards';
      if (filter === 'cue') return event.sourceSurface === 'cue_ai';
      if (filter === 'rate_limited') return event.status === 'rate_limited';
      return true;
    });
  }, [dashboard.recentEvents, filter]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Quiz generations today', value: dashboard.summary.quizGenerationsToday },
          { label: 'Flashcard generations today', value: dashboard.summary.flashcardGenerationsToday },
          { label: 'File Study today', value: dashboard.summary.fileStudyGenerationsToday },
          { label: 'Cue quiz today', value: dashboard.summary.cueQuizGenerationsToday },
          { label: 'Cue flashcards today', value: dashboard.summary.cueFlashcardGenerationsToday },
          { label: 'Rate-limited today', value: dashboard.summary.rateLimitedToday },
          { label: 'Active Beta (study tools)', value: dashboard.summary.activeBetaUsers },
          { label: 'Active Premium (study tools)', value: dashboard.summary.activePremiumUsers },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Beta quiz', value: dashboard.byPlan.betaQuiz },
          { label: 'Beta flashcards', value: dashboard.byPlan.betaFlashcards },
          { label: 'Premium quiz', value: dashboard.byPlan.premiumQuiz },
          { label: 'Premium flashcards', value: dashboard.byPlan.premiumFlashcards },
        ].map((card) => (
          <div key={card.label} className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{card.label}</p>
            <p className="mt-2 text-xl font-bold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">Top users today</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Quiz</th>
                <th className="pb-2 pr-4">Flashcards</th>
                <th className="pb-2 pr-4">File Study</th>
                <th className="pb-2 pr-4">Used / limit</th>
                <th className="pb-2 pr-4">Refresh</th>
                <th className="pb-2 pr-4">Last</th>
                <th className="pb-2">Page / Cue</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.topUsers.map((user) => (
                <tr key={user.uid} className="border-t border-white/8 text-text-secondary">
                  <td className="py-2 pr-4 text-text-primary">{user.email ?? user.uid}</td>
                  <td className="py-2 pr-4 capitalize">{user.plan}</td>
                  <td className="py-2 pr-4">{user.quizToday}</td>
                  <td className="py-2 pr-4">{user.flashcardsToday}</td>
                  <td className="py-2 pr-4">{user.fileStudyToday}</td>
                  <td className="py-2 pr-4">
                    {user.studyToolsUsed}/{user.studyToolLimit || '—'}
                  </td>
                  <td className="py-2 pr-4">{user.resetLabel}</td>
                  <td className="py-2 pr-4">{formatAdminDate(user.lastGeneratedAt)}</td>
                  <td className="py-2">
                    {user.fromPages} / {user.fromCue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">Recent generations</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary"
          >
            <option value="all">All</option>
            <option value="beta">Beta</option>
            <option value="premium">Premium</option>
            <option value="quiz">Quiz</option>
            <option value="flashcards">Flashcards</option>
            <option value="cue">Cue-generated only</option>
            <option value="rate_limited">Rate-limited</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Tool</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Items</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.eventId} className="border-t border-white/8 text-text-secondary">
                  <td className="py-2 pr-4">{formatAdminDate(event.createdAt)}</td>
                  <td className="py-2 pr-4 text-text-primary">{event.uid}</td>
                  <td className="py-2 pr-4 capitalize">{event.userPlan}</td>
                  <td className="py-2 pr-4">{event.toolType}</td>
                  <td className="py-2 pr-4">{event.sourceSurface}</td>
                  <td className="py-2 pr-4">{event.itemCount}</td>
                  <td className="py-2 pr-4">{event.status}</td>
                  <td className="py-2">{event.endpoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
