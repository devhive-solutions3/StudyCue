# StudyCue Web — DNS & Vercel (Tier W-0)

## Custom domain DNS (DevHive Baby Domain Solutions)

Use the **project-specific** CNAME from **project study-cue only** → **Domains** → `studycue.solutionsdevhive.com` → **Learn more**.

**Do not** reuse the `www` / `@` target (`fa50cc6b38b7fb22.vercel-dns-017.com`) — that hostname serves **DevHive Solutions**, not StudyCue. Pointing `studycue` there yields **Valid** in the wrong sense and edge **`NOT_FOUND`**.

| Type   | Host       | Target                                                        | TTL |
|--------|------------|---------------------------------------------------------------|-----|
| CNAME  | `studycue` | *(copy from study-cue → Domains → Learn more — unique hash)* | 300 |

Verify:

```bash
dig +short studycue.solutionsdevhive.com CNAME
# must match the CNAME shown on the study-cue project domain card — NOT cname.vercel-dns.com, NOT www’s fa50cc6b… target.
```

In Vercel Domains, status must be **Valid Configuration** (not “DNS Change Recommended”). Then **Refresh**.

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

**404 `NOT_FOUND` on custom domain** (`x-vercel-error: NOT_FOUND`) — Vercel edge received the hostname but could not map it to a deployment. Common causes:

1. **Wrong CNAME** — `studycue` still points to `cname.vercel-dns.com` while the project expects `fa50cc6b38b7fb22.vercel-dns-017.com`.
2. Domain not added on project **study-cue**, or Domains status not **Valid**.
3. **Stale / skipped** Production deploy (build ~2s) — redeploy `main` with Root Directory `web`.

This is **not** a missing Next.js page; the request never reaches your app.
