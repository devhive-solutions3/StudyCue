# StudyCue production domain — studycueplanner.com

Canonical production URL: **https://studycueplanner.com**

Previous custom domain: `studycue.solutionsdevhive.com` (redirect at Vercel/DNS when still attached).

## Vercel

1. **Domains** (Project → Settings → Domains):
   - `studycueplanner.com`
   - `www.studycueplanner.com` (redirect to apex or serve both — pick one canonical in Search Console)
2. **Environment variables** (Production):
   - `EXPO_PUBLIC_SITE_URL` = `https://studycueplanner.com`
   - `NEXT_PUBLIC_SITE_URL` = `https://studycueplanner.com`
3. Keep Firebase, AI proxy, and API keys unchanged (see `.env.example`).
4. Optional: keep the old domain on the project and set a **308 redirect** to `https://studycueplanner.com` in Vercel domain settings.

## Firebase Console

**Authentication → Settings → Authorized domains** — add:

- `studycueplanner.com`
- `www.studycueplanner.com`
- `localhost` (local dev)

Do **not** change:

- `authDomain`: `studycue-3d831.firebaseapp.com`
- `projectId`: `studycue-3d831`

**Authentication → Templates → Password reset** — Action URL:

`https://studycueplanner.com/auth/action`

## Google OAuth (Cloud Console)

**APIs & Services → Credentials → Web client** — Authorized JavaScript origins:

- `https://studycueplanner.com`
- `https://www.studycueplanner.com`
- `http://localhost:3000`

## Google Search Console

- Add property: `studycueplanner.com`
- Submit sitemap: `https://studycueplanner.com/sitemap.xml`

## Google AdSense

- Site URL: `https://studycueplanner.com`
- Verify `ads.txt`: `https://studycueplanner.com/ads.txt`

File in repo: `web/public/ads.txt`

```
google.com, pub-9703603099562509, DIRECT, f08c47fec0942fa0
```

## App code fallbacks

When `EXPO_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SITE_URL` are unset at build time, `web/lib/site-config.ts` falls back to `https://studycueplanner.com` on Vercel production builds.
