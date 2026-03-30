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
http://localhost:3000/api/cue
```

## Server env vars

- `GEMINI_API_KEY`: secret, server-only
- `GEMINI_MODEL`: optional, server-only
- `PORT`: optional

## Deploy later

This folder can be deployed as a small Node service or adapted into a serverless function. Keep the same `/api/cue` request and response shape so the Expo client does not need to change.
