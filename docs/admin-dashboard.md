# Admin Dashboard Configuration

StudyCue admin pages use the Firebase Admin SDK on the server only. Do not expose these values to the client. Do not use `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefixes.

## Environment variables

Preferred:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=
```

Alternative:

```env
FIREBASE_PROJECT_ID=studycue-3d831
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Local-only fallback:

```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

## Local setup

1. Open Firebase Console.
2. Go to Project Settings.
3. Open the Service accounts tab.
4. Generate a new private key.
5. Put the full JSON string into `FIREBASE_SERVICE_ACCOUNT_KEY` in `web/.env.local`, or extract `project_id`, `client_email`, and `private_key` into the individual env vars above.
6. Restart the dev server.

## Notes

- These credentials must stay server-side only.
- Do not commit service account JSON files.
- If credentials are missing, `/admin` still loads for allowed admins and shows a configuration warning instead of crashing.
