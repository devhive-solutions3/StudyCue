# Lighthouse targets (marketing)

Goal from Phase plan: **~95** on Performance / Accessibility / Best Practices / SEO for `/`, `/blog/*`, `/resources/*`.

## How we measure

Run Chrome DevTools Lighthouse (mobile emulation) locally against **`next build && next start`** for cold-cache realism.

Alternatively use **`npx lighthouse <url>`** in CI sparingly — flaky infra.

## Tuning playbook

1. **Images**: Prefer CSS gradients first; defer hero raster assets; add explicit `sizes` whenever `<Image>` joins.
2. **Scripts**: AdSense stays `afterInteractive`; Plausible defer; skip Sentry replay until needed.
3. **Fonts**: Geist subsets already minimal — avoid extra weights.
4. **Accessibility**: Maintain visible focus outlines on `/app` dashboards (WCAG AA contrast on slate palette).
