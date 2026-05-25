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

function FormField({
  label,
  name,
  type = 'number',
  step,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-text-primary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
      />
    </div>
  );
}

function FormSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-black/10 p-4 md:p-5">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {helper ? <p className="text-xs leading-5 text-text-muted">{helper}</p> : null}
      </div>
      {children}
    </section>
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
          Estimated finance tracker. AI cost is derived from logged token usage plus editable token pricing. Premium revenue is premium-user count multiplied by the configured monthly premium price.
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

      <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-text-primary">Current month estimate</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Month: {dashboard.currentMonthSummary.monthKey}. Beta users are excluded from premium revenue.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
            Premium users counted: <span className="font-semibold text-text-primary">{dashboard.currentMonthSummary.premiumUserCount}</span>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Premium revenue estimate" value={adminMoney(dashboard.currentMonthSummary.premiumRevenuePhp)} />
          <SummaryCard label="AI cost estimate" value={adminMoney(dashboard.currentMonthSummary.aiCostPhp)} />
          <SummaryCard label="Revenue this month" value={adminMoney(dashboard.currentMonthSummary.totalRevenuePhp)} />
          <SummaryCard label="Net this month" value={adminMoney(dashboard.currentMonthSummary.netPhp)} />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Groq token basis</p>
            <p className="mt-2">Input tokens: {dashboard.currentMonthSummary.groqInputTokens.toLocaleString()}</p>
            <p>Output tokens: {dashboard.currentMonthSummary.groqOutputTokens.toLocaleString()}</p>
            <p>Total tokens: {dashboard.currentMonthSummary.groqTotalTokens.toLocaleString()}</p>
            <p className="mt-2 font-medium text-text-primary">Estimated cost: {adminMoney(dashboard.currentMonthSummary.groqCostPhp)}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Gemini token basis</p>
            <p className="mt-2">Input tokens: {dashboard.currentMonthSummary.geminiInputTokens.toLocaleString()}</p>
            <p>Output tokens: {dashboard.currentMonthSummary.geminiOutputTokens.toLocaleString()}</p>
            <p>Total tokens: {dashboard.currentMonthSummary.geminiTotalTokens.toLocaleString()}</p>
            <p className="mt-2 font-medium text-text-primary">Estimated cost: {adminMoney(dashboard.currentMonthSummary.geminiCostPhp)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_48px_rgba(9,12,35,0.16)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
          <div>
            <h2 className="text-base font-bold text-text-primary">Revenue calculator settings</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Set monthly prices and costs used to estimate revenue, AI spending, and net income.
            </p>
          </div>
          <form action={saveRevenueMetricAction} className="mt-6 space-y-6">
            <FormSection title="Period">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="scope" className="text-sm font-semibold text-text-primary">
                    Scope
                  </label>
                  <select
                    id="scope"
                    name="scope"
                    defaultValue="daily"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-sm text-text-primary outline-none transition focus:border-accent/35"
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <FormField
                  label="Key"
                  name="key"
                  type="text"
                  placeholder="YYYY-MM-DD or YYYY-MM"
                />
              </div>
            </FormSection>

            <div className="grid gap-6 xl:grid-cols-2">
              <FormSection
                title="Revenue assumptions (PHP)"
                helper="Used to estimate monthly revenue from Premium users."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormField
                    label="Ads revenue"
                    name="adsRevenuePhp"
                    step="0.01"
                    placeholder="0"
                  />
                  <FormField
                    label="Premium price"
                    name="premiumPricePhp"
                    step="0.01"
                    placeholder="99"
                  />
                  <FormField
                    label="Other revenue"
                    name="otherRevenuePhp"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </FormSection>

              <FormSection
                title="AI token pricing"
                helper="Prices are per 1M tokens in USD."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Groq input"
                    name="groqInputUsdPerMillion"
                    step="0.0001"
                    defaultValue="0.59"
                    placeholder="0.59"
                  />
                  <FormField
                    label="Groq output"
                    name="groqOutputUsdPerMillion"
                    step="0.0001"
                    defaultValue="0.79"
                    placeholder="0.79"
                  />
                  <FormField
                    label="Gemini input"
                    name="geminiInputUsdPerMillion"
                    step="0.0001"
                    defaultValue="0.1"
                    placeholder="0.10"
                  />
                  <FormField
                    label="Gemini output"
                    name="geminiOutputUsdPerMillion"
                    step="0.0001"
                    defaultValue="0.4"
                    placeholder="0.40"
                  />
                  <FormField
                    label="USD to PHP"
                    name="usdToPhp"
                    step="0.01"
                    defaultValue={dashboard.currentMonthSummary.usdToPhp}
                    placeholder="56"
                  />
                </div>
              </FormSection>
            </div>

            <FormSection title="Monthly infrastructure costs">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  label="Firebase cost"
                  name="firebaseCostPhp"
                  step="0.01"
                  placeholder="0"
                />
                <FormField
                  label="Vercel cost"
                  name="vercelCostPhp"
                  step="0.01"
                  placeholder="0"
                />
                <FormField
                  label="Other cost"
                  name="otherCostPhp"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </FormSection>

            <FormSection title="Notes">
              <textarea
                id="notes"
                name="notes"
                rows={5}
                placeholder="Add context for this saved estimate…"
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/35"
              />
            </FormSection>

            <div className="flex flex-col gap-3 border-t border-white/8 pt-5 md:flex-row md:items-center md:justify-between">
              <p className="text-xs leading-5 text-text-muted">
                Values are estimates and can be updated anytime.
              </p>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 px-5 text-sm font-semibold text-text-primary transition hover:border-accent/40"
              >
                Save settings
              </button>
            </div>
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
                    <th className="px-4 py-3">Premium users</th>
                    <th className="px-4 py-3">Premium price</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.monthly.map((metric) => {
                    return (
                      <tr key={metric.key} className="border-t border-white/8 text-text-secondary">
                        <td className="px-4 py-4 align-top text-text-primary">{metric.key}</td>
                        <td className="px-4 py-4 align-top">
                          {metric.key === dashboard.currentMonthSummary.monthKey ? dashboard.currentMonthSummary.premiumUserCount : 'Current month only'}
                        </td>
                        <td className="px-4 py-4 align-top">{adminMoney(metric.premiumPricePhp)}</td>
                        <td className="px-4 py-4 align-top">{adminMoney(metric.revenuePhp ?? 0)}</td>
                        <td className="px-4 py-4 align-top">{adminMoney(metric.costPhp ?? 0)}</td>
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
