# Data safety · StudyCue web mirror

StudyCue treats **SQLite on mobile** as the offline source of truth. The web app edits a **single Firestore JSON document**:

`users/{uid}/mirror/snapshot` (`json` string + `updatedAt` timestamp).

## What crosses the wire

1. HTTPS cookies holding a short-lived Firebase ID token reference (`/api/session`).
2. The mirror blob (categories, classes, tasks, sessions, mirrored preferences).

## Guarantees implemented in-repo

- `firestore.rules` scopes every path under `/users/{uid}` to `request.auth.uid`.
- Middleware rejects `/app/*` visitors without a valid ID token cookie.
- Ad scripts do not mount on authenticated dashboard routes (`/app/*`), login/register, or API session routes.

## Deletion

Deleting an account triggers `deleteMirrorDocument` plus Auth user removal per `web/lib/firebase-client.ts`.

## Operational checklist

1. Rotate AI proxy keys independently from Firebase secrets.
2. Enable Firebase App Check once mobile + web SDKs stabilized.
3. Monitor Firestore writes for mirror size (stay under Firestore limits).
