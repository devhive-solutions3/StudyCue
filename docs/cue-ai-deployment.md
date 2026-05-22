# Cue AI — deployment (web + mobile)

## Architecture

| Client | Where Groq/Gemini run | Env var |
|--------|------------------------|---------|
| **Web (Vercel)** | Built-in Next.js routes on the **same domain** | `POST /api/groq`, `POST /api/cue` |
| **Mobile (Expo)** | Separate **Fly.io** `backend-proxy` | `EXPO_PUBLIC_AI_PROXY_URL` |

Web does **not** need the Fly proxy in production if you use the Next API routes (recommended).

```
Web browser  →  https://your-domain.com/api/groq  →  Groq (GROQ_API_KEY on Vercel)
            →  https://your-domain.com/api/cue   →  Gemini fallback (GEMINI_API_KEY on Vercel)

Expo app     →  https://studycue.fly.dev/api/groq  →  Groq (GROQ_API_KEY on Fly)
            →  https://studycue.fly.dev/api/cue   →  Gemini (GEMINI_API_KEY on Fly)
```

---

## 1. Web — Vercel (`web/` project)

**Root Directory** = `web` (see [`web-deployment-vercel.md`](./web-deployment-vercel.md)).

### Environment variables (Production + Preview)

**Server-only** (Vercel → Settings → Environment Variables — **do not** enable “Expose to Browser”):

| Variable | Required | Notes |
|----------|----------|--------|
| `GROQ_API_KEY` | Yes | Primary Cue provider (text + schedule images) |
| `GEMINI_API_KEY` | Yes | Fallback when Groq fails / rate limit |
| `GEMINI_MODEL` | Optional | Default `gemini-2.0-flash` |
| `FIREBASE_ADMIN_*` | If using `/api/session` | See Firebase Admin docs |

**Public** (`EXPO_PUBLIC_*` on Vercel — same names as Expo; safe in the browser):

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Yes | |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Yes | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Yes | Keep this exact name on Vercel |
| `EXPO_PUBLIC_SITE_URL` | Yes | e.g. `https://studycue.yourdomain.com` |
| `EXPO_PUBLIC_AI_PROXY_URL` | Recommended | Value **`/api/cue`** (same-origin Next routes). Skip the variable entirely if you prefer auto-default — do **not** save an empty value. |

Do **not** put `GROQ_API_KEY` / `GEMINI_API_KEY` in `EXPO_PUBLIC_*`. Local dev may still use `NEXT_PUBLIC_*` aliases; the web app reads both.

### After deploy — smoke test

```bash
curl -sS -X POST "https://YOUR_VERCEL_DOMAIN/api/groq" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"say hi"}],"max_tokens":32}'
```

Expect JSON: `{"text":"..."}`. If you see `Missing GROQ_API_KEY`, add the secret in Vercel and redeploy.

---

## 2. Mobile — Fly.io (`backend-proxy/`)

Used by Expo only. App name in [`backend-proxy/fly.toml`](../backend-proxy/fly.toml): **`studycue`**.

### One-time deploy

```bash
cd backend-proxy
fly auth login
fly apps list   # confirm studycue exists or: fly launch --no-deploy
fly secrets set GROQ_API_KEY="..." GEMINI_API_KEY="..."
fly deploy
```

### Health check

```bash
curl -sS https://studycue.fly.dev/health
curl -sS -X POST https://studycue.fly.dev/api/groq \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}],"max_tokens":16}'
```

### Expo production env (EAS / build)

In **EAS secrets** or `eas.json` env for production builds:

```txt
EXPO_PUBLIC_AI_PROXY_URL=https://studycue.fly.dev/api/cue
```

Local simulator can keep `http://localhost:3001/api/cue` if you run `npm run dev:proxy` on the Mac.

---

## 3. Optional: web uses Fly instead of Vercel routes

Only if you want one shared proxy for everything:

```txt
NEXT_PUBLIC_AI_PROXY_URL=https://studycue.fly.dev/api/cue
```

You can omit `GROQ_API_KEY` / `GEMINI_API_KEY` on Vercel in that mode (keys live on Fly only). Extra latency + CORS must be allowed on `backend-proxy` (already has `cors()`).

Default recommendation: **keep web on `/api/cue`** (keys on Vercel).

---

## Checklist

- [ ] Vercel: `GROQ_API_KEY`, `GEMINI_API_KEY` set (server-only)
- [ ] Vercel: `EXPO_PUBLIC_FIREBASE_*` unchanged; `EXPO_PUBLIC_AI_PROXY_URL=/api/cue` or unset
- [ ] Vercel: redeploy after env changes
- [ ] Fly: secrets set, `fly deploy`, `/health` OK
- [ ] EAS: `EXPO_PUBLIC_AI_PROXY_URL=https://studycue.fly.dev/api/cue`
- [ ] Test schedule image on production web chat
