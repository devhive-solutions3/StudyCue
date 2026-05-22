# Firestore cloud mirror schema (StudyCue)

All user-owned data sits under **`users/{uid}`** so security rules reduce to **`request.auth.uid == uid`**.

Document IDs use **SQLite row `id`** as **string** (e.g. `"42"`). Web and mobile reconcile on that key.

## Subcollections

### `users/{uid}/classes/{id}`

| Field           | Type   | Notes |
|-----------------|--------|------|
| `title`         | string |      |
| `weekday`       | string \| null | |
| `startTime`     | string \| null | |
| `endTime`       | string \| null | |
| `location`      | string \| null | |
| `notes`         | string \| null | |
| `recurrence`    | string \| null | |
| `eventType`     | string \| null | |
| `specificDate`  | string \| null | |
| `updatedAt`     | timestamp | |

### `users/{uid}/tasks/{id}`

| Field               | Type    |
|---------------------|---------|
| `categorySqliteId`| string \| null |
| `title` | string |
| `dueAt` | string \| null |
| `estimatedMinutes` | number \| null |
| `difficulty` | string \| null |
| `priority` | number \| null |
| `status` | string |
| `notes` | string \| null |
| `updatedAt` | timestamp |

### `users/{uid}/taskCategories/{id}`

| Field | Type |
|-------|------|
| `name` | string |
| `slug` | string |
| `updatedAt` | timestamp |

### `users/{uid}/studySessions/{id}`

| Field | Type |
|-------|------|
| `subjectId` | number \| null |
| `taskId` | number \| null |
| `startedAt` | string \| null |
| `endedAt` | string \| null |
| `focusMinutes` | number \| null |
| `breakMinutes` | number \| null |
| `sessionType` | string \| null |
| `completed` | boolean |
| `updatedAt` | timestamp |

### `users/{uid}/preferences/default`

Singleton document for study prefs (mirrors `ai_preferences` per user):

| Field | Type |
|-------|------|
| `preferredFocusMinutes` | number |
| `preferredBreakMinutes` | number |
| `dailyGoalMinutes` | number |
| `energyMode` | string |

### Optional parent doc `users/{uid}`

| Field | Type | Notes |
|-------|------|------|
| `displayName` | string \| null | optional cache |
| `email` | string \| null | optional cache |

Local `users_local` remains SQLite-only for offline ID mapping; **`uid`** is Firebase Auth UID everywhere in Firestore.

## Sync semantics (MVP)

- **Mobile**: SQLite is source-of-truth for reads; mutations write SQLite then enqueue **full push snapshot** (`pushUserDataToFirestore`) debounced (~2s batch).
- **Web**: Reads/writes Firestore directly for dashboard; mobile eventually receives via pull on next foreground.
- **Conflict**: Last-write-wins on `updatedAt` per document (fine for single user per UID).
