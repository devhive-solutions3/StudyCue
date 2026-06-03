'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  adminMoney,
  formatAdminDateKey,
  formatTokens,
  type AiUsageDashboard,
} from '@/lib/admin-shared';

function formatChartDateLabel(value: unknown) {
  return formatAdminDateKey(typeof value === 'string' ? value : null);
}

export default function AdminUsageCharts({
  daily,
  providerSplit,
}: Pick<AiUsageDashboard, 'daily' | 'providerSplit'>) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="text-base font-bold text-text-primary">Daily requests last 30 days</h3>
        </div>
        <div className="h-[320px] min-w-0 p-5">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,148,184,0.18)" vertical={false} />
              <XAxis
                dataKey="dateKey"
                tick={{ fontSize: 11 }}
                tickFormatter={formatChartDateLabel}
                stroke="var(--sc-text-muted)"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--sc-text-muted)" />
              <Tooltip
                formatter={(value) => [formatTokens(Number(value) || 0), 'Requests']}
                labelFormatter={formatChartDateLabel}
                contentStyle={{
                  background: 'var(--sc-surface-elevated)',
                  border: '1px solid var(--sc-border)',
                  borderRadius: '16px',
                }}
              />
              <Bar dataKey="requests" fill="var(--sc-accent)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="text-base font-bold text-text-primary">Daily tokens last 30 days</h3>
        </div>
        <div className="h-[320px] min-w-0 p-5">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,148,184,0.18)" vertical={false} />
              <XAxis
                dataKey="dateKey"
                tick={{ fontSize: 11 }}
                tickFormatter={formatChartDateLabel}
                stroke="var(--sc-text-muted)"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--sc-text-muted)" />
              <Tooltip
                formatter={(value) => [formatTokens(Number(value) || 0), 'Tokens']}
                labelFormatter={formatChartDateLabel}
                contentStyle={{
                  background: 'var(--sc-surface-elevated)',
                  border: '1px solid var(--sc-border)',
                  borderRadius: '16px',
                }}
              />
              <Bar dataKey="tokens" fill="var(--sc-blue)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6 xl:col-span-2">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="text-base font-bold text-text-primary">Provider split: Groq vs Gemini</h3>
        </div>
        <div className="h-[320px] min-w-0 p-5">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={providerSplit}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,148,184,0.18)" vertical={false} />
              <XAxis dataKey="provider" tick={{ fontSize: 12 }} stroke="var(--sc-text-muted)" />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="var(--sc-text-muted)" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="var(--sc-text-muted)" />
              <Tooltip
                formatter={(value, name) => {
                  if (String(name).includes('Cost')) return [adminMoney(Number(value) || 0), name];
                  return [formatTokens(Number(value) || 0), name];
                }}
                contentStyle={{
                  background: 'var(--sc-surface-elevated)',
                  border: '1px solid var(--sc-border)',
                  borderRadius: '16px',
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="requests" fill="var(--sc-accent)" radius={[10, 10, 0, 0]} />
              <Bar yAxisId="left" dataKey="tokens" fill="var(--sc-blue)" radius={[10, 10, 0, 0]} />
              <Bar yAxisId="right" dataKey="costPhp" name="Cost (PHP)" fill="var(--sc-teal)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
