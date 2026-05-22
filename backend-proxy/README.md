# StudyCue AI Proxy

Minimal Express proxy for Cue AI requests.

## Purpose

- Holds `GEMINI_API_KEY` on the server only
- Accepts Cue payloads from the mobile app
- Calls Gemini server-side
- Returns parsed text back to the app

## Setup

1. Copy `.env.example` to `.env`
2. Set `GEMINI_API_KEY`
3. Install dependencies with `npm install`
4. Start the proxy with `npm start`

The Expo app should point `EXPO_PUBLIC_AI_PROXY_URL` to:

```txt
http://localhost:3001/api/cue
```

(Use port **3001** so it does not clash with Next.js on **3000**.)

For **web** local dev, prefer built-in Next routes: set `NEXT_PUBLIC_AI_PROXY_URL=/api/cue` and put `GROQ_API_KEY` / `GEMINI_API_KEY` in `web/.env.local` (no separate proxy process required).

## Server env vars

- `GROQ_API_KEY`: secret, server-only (Groq vision + text)
- `GEMINI_API_KEY`: secret, server-only (fallback)
- `GEMINI_MODEL`: optional, server-only
- `PORT`: optional (default **3001**)

## Deploy later

This folder can be deployed as a small Node service or adapted into a serverless function. Keep the same `/api/cue` request and response shape so the Expo client does not need to change.
