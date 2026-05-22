# StudyCue Web — DNS & Vercel (Tier W-0)

## Custom domain DNS (DevHive Baby Domain Solutions)

Ensure a **CNAME** record exists:

| Type   | Host      | Target                 | TTL |
|--------|-----------|-------------------------|-----|
| CNAME  | `studycue` | `cname.vercel-dns.com` | 300 |

Confirm the **full hostname** (`studycue.<your-root-domain>`) resolves with `dig` or your registrar’s DNS checker.

## Vercel — project **study-cue**

1. **Git**: Project must be connected to **`devhive-solutions3/StudyCue`** (branch `main`). If Production still shows an old app (e.g. “BetterStudy”), disconnect the wrong repo or redeploy from StudyCue.
2. **Project → Settings → Build and Deployment** (not General) → **Root Directory** → **`web`** → Save.
3. **Framework Preset**: Next.js (from `web/package.json`).
4. **Project → Settings → Domains** → **Add** `studycue.solutionsdevhive.com` → wait until **Valid** + HTTPS.
4. **Environment variables** — set in Vercel for **Production / Preview**:

   - **Firebase (public):** `EXPO_PUBLIC_FIREBASE_*` — same names as mobile (e.g. `EXPO_PUBLIC_FIREBASE_APP_ID`). Do not rename on Vercel.
   - **Cue AI (server-only):** `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` — not `EXPO_PUBLIC_*`.
   - **Cue AI URL:** `EXPO_PUBLIC_AI_PROXY_URL` = **`/api/cue`** (huwag blank/empty string — kung wala kang ilalagay, huwag na lang gumawa ng variable na ito).
   - **Site:** `EXPO_PUBLIC_SITE_URL` = `https://studycue.solutionsdevhive.com` (must include `https://` — not `/api/cue`).
   - `FIREBASE_ADMIN_*` server-only vars for `/api/session` (see Firebase Admin setup).

   Full Cue + mobile proxy steps: [`cue-ai-deployment.md`](./cue-ai-deployment.md).

5. After save, **Deployments → Redeploy** latest `main` (commit with StudyCue `web/` app).

6. Confirm Production URL shows **StudyCue** (not another product). Working default: `https://study-cue.vercel.app` only after the correct Git deploy.

**404 on custom domain** (`studycue.solutionsdevhive.com`) with `x-vercel-error: NOT_FOUND` = domain not added to this project, or DNS points to Vercel without a matching deployment.
