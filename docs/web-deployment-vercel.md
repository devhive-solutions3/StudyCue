# StudyCue Web — DNS & Vercel (Tier W-0)

Canonical production URL: **https://studycueplanner.com**

See also: [`domain-migration.md`](./domain-migration.md)

## Custom domain DNS

Point your registrar to Vercel per **Project → Settings → Domains** for `studycueplanner.com` and `www.studycueplanner.com`.

Verify:

```bash
dig +short studycueplanner.com CNAME
dig +short www.studycueplanner.com CNAME
```

In Vercel Domains, status must be **Valid Configuration**. Then **Refresh**.

## Vercel — project **study-cue**

1. **Git**: Project connected to **`devhive-solutions3/StudyCue`** (branch `main`).
2. **Project → Settings → Build and Deployment** → **Root Directory** → **`web`** → Save.
3. **Framework Preset**: Next.js (from `web/package.json`).
4. **Project → Settings → Domains** → **Add**:
   - `studycueplanner.com`
   - `www.studycueplanner.com`
   - Wait until **Valid** + HTTPS.
   - Optional: keep `studycue.solutionsdevhive.com` and configure a redirect to `https://studycueplanner.com`.
5. **Environment variables** — **Production / Preview**:

   - **Firebase (public):** `EXPO_PUBLIC_FIREBASE_*` — same names as mobile. Do not rename on Vercel.
   - **Cue AI (server-only):** `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` — not `EXPO_PUBLIC_*`.
   - **Cue AI URL:** `EXPO_PUBLIC_AI_PROXY_URL` = **`/api/cue`**
   - **Site (required for canonical URLs):**
     - `EXPO_PUBLIC_SITE_URL` = `https://studycueplanner.com`
     - `NEXT_PUBLIC_SITE_URL` = `https://studycueplanner.com`
   - `FIREBASE_ADMIN_*` server-only vars for `/api/session` (see Firebase Admin setup).

   Full Cue + mobile proxy steps: [`cue-ai-deployment.md`](./cue-ai-deployment.md).

6. After save, **Deployments → Redeploy** latest `main`.

7. Confirm:
   - `https://studycueplanner.com` serves StudyCue
   - `https://studycueplanner.com/ads.txt` returns AdSense verification
   - `https://studycueplanner.com/sitemap.xml` uses `studycueplanner.com` URLs

**404 `NOT_FOUND` on custom domain** — usually wrong DNS target, domain not added on project **study-cue**, or stale deploy. See Vercel domain card for the exact CNAME.
