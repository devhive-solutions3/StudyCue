import { readAdminDataSourceStatus, readRevenueDashboard, saveRevenueMetricAction } from '@/lib/admin-data';
import { adminMoney } from '@/lib/admin-shared';

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-tight text-text-primary">{value}</p>
    </article>
  );
}

export default async function AdminRevenuePage() {
  const dataSource = readAdminDataSourceStatus();
  const dashboard = await readRevenueDashboard();

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Admin / Revenue</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Revenue and spending</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Manual finance tracker until payments, ads, and infrastructure billing are integrated directly.
        </p>
      </div>

      {!dataSource.configured ? (
        <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100/90">
          Firebase Admin credentials are not configured. Revenue metrics can be viewed and saved after admin credentials are added server-side.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total revenue" value={adminMoney(dashboard.totals.revenuePhp)} />
        <SummaryCard label="Total cost" value={adminMoney(dashboard.totals.costPhp)} />
        <SummaryCard label="Net" value={adminMoney(dashboard.totals.netPhp)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <h2 className="text-base font-bold text-text-primary">Add or update metrics</h2>
          <form action={saveRevenueMetricAction} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-text-primary">Scope</label>
                <select
                  name="scope"
                  defaultValue="daily"
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                >
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Key</label>
                <input
                  name="key"
                  placeholder="YYYY-MM-DD or YYYY-MM"
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-semibold text-text-primary">Ads revenue (PHP)</label>
                <input name="adsRevenuePhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Premium revenue (PHP)</label>
                <input name="premiumRevenuePhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Other revenue (PHP)</label>
                <input name="otherRevenuePhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-semibold text-text-primary">Groq cost (PHP)</label>
                <input name="groqCostPhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Gemini cost (PHP)</label>
                <input name="geminiCostPhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Firebase cost (PHP)</label>
                <input name="firebaseCostPhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-text-primary">Vercel cost (PHP)</label>
                <input name="vercelCostPhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Other cost (PHP)</label>
                <input name="otherCostPhp" type="number" step="0.01" className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-text-primary">Notes</label>
              <textarea
                name="notes"
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </div>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 px-5 text-sm font-semibold text-text-primary transition hover:border-accent/40"
            >
              Save metric
            </button>
          </form>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-base font-bold text-text-primary">Monthly revenue vs cost</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.monthly.map((metric) => {
                    const revenue = metric.adsRevenuePhp + metric.premiumRevenuePhp + metric.otherRevenuePhp;
                    const cost = metric.groqCostPhp + metric.geminiCostPhp + metric.firebaseCostPhp + metric.vercelCostPhp + metric.otherCostPhp;
                    return (
                      <tr key={metric.key} className="border-t border-white/8 text-text-secondary">
                        <td className="px-4 py-4 align-top text-text-primary">{metric.key}</td>
                        <td className="px-4 py-4 align-top">{adminMoney(revenue)}</td>
                        <td className="px-4 py-4 align-top">{adminMoney(cost)}</td>
                        <td className="px-4 py-4 align-top">{adminMoney(metric.netPhp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-base font-bold text-text-primary">Saved daily metrics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/10 text-xs uppercase tracking-[0.2em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Net</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.daily.map((metric) => (
                    <tr key={metric.key} className="border-t border-white/8 text-text-secondary">
                      <td className="px-4 py-4 align-top text-text-primary">{metric.key}</td>
                      <td className="px-4 py-4 align-top">{adminMoney(metric.netPhp)}</td>
                      <td className="px-4 py-4 align-top">{metric.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
