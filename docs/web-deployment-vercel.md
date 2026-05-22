# StudyCue Web — DNS & Vercel (Tier W-0)

## Custom domain DNS (DevHive Baby Domain Solutions)

Ensure a **CNAME** record exists:

| Type   | Host      | Target                 | TTL |
|--------|-----------|-------------------------|-----|
| CNAME  | `studycue` | `cname.vercel-dns.com` | 300 |

Confirm the **full hostname** (`studycue.<your-root-domain>`) resolves with `dig` or your registrar’s DNS checker.

## Vercel — project **study-cue**

1. **Project → Settings → General → Root Directory** → **`web`** (required after Next.js exists in this repo).
2. **Framework Preset**: Next.js (auto-detected from `web/package.json`).
3. **Project → Settings → Domains** → **Add** your full hostname `studycue.<apex>` → wait until **Valid** and HTTPS certificates issue.
4. **Environment variables** — set in Vercel for **Production / Preview**:

   - **Firebase (public):** `EXPO_PUBLIC_FIREBASE_*` — same names as mobile (e.g. `EXPO_PUBLIC_FIREBASE_APP_ID`). Do not rename on Vercel.
   - **Cue AI (server-only):** `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` — not `EXPO_PUBLIC_*`.
   - **Cue AI URL:** `EXPO_PUBLIC_AI_PROXY_URL` = **`/api/cue`** (huwag blank/empty string — kung wala kang ilalagay, huwag na lang gumawa ng variable na ito).
   - **Site:** `EXPO_PUBLIC_SITE_URL` = production URL.
   - `FIREBASE_ADMIN_*` server-only vars for `/api/session` (see Firebase Admin setup).

   Full Cue + mobile proxy steps: [`cue-ai-deployment.md`](./cue-ai-deployment.md).

5. Production preview URLs (before custom domain attaches):

   - `https://study-cue-gamma.vercel.app`

After adding **Root Directory = `web`**, redeploy `main`; the repo-root **404** should disappear once `web/app/page.tsx` exists.
