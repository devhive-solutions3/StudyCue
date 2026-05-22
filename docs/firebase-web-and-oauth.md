# Firebase Web App & Google OAuth (Tier W-0)

These steps happen in Google Cloud Console and Firebase Console — not in Git.

## 1. Second Firebase Web app (same Firebase project)

1. Open **Firebase Console** → your StudyCue project.
2. **Project settings** (gear) → scroll to **Your apps** → **Add app** → **Web** (`</>`).
3. Register an app nickname e.g. `StudyCue Web` — copy the **Firebase config snippet** fields into **`web/.env.local`** matching [`web/.env.example`](../../web/.env.example) (`NEXT_PUBLIC_FIREBASE_*`).

The Auth user directory is shared with the Expo mobile client automatically.

## 2. Google OAuth client ID (Web)

1. **Google Cloud Console** → **APIs & Services** → **Credentials**.
2. **Create credentials** → **OAuth client ID** → **Application type: Web application**.
3. Under **Authorized JavaScript origins**, add:

   - `http://localhost:3000`
   - `https://study-cue-gamma.vercel.app`
   - `https://studycue.<your-apex-domain>` (after DNS is attached)

4. Authorized redirect URIs for Firebase Hosted-style auth helpers (if Firebase suggests them):

   - Use the URIs Firebase lists for **Google sign-in method** enablement (`authDomain` redirects).

In **Firebase Console** → **Authentication** → **Sign-in method**, enable **Google** and paste the OAuth client IDs as prompted (Web vs iOS/Android are separate).

## 3. Service account for `/api/session` (optional but recommended)

1. Firebase Console → **Project settings** → **Service accounts** → **Generate new private key**.
2. Store JSON as **`FIREBASE_ADMIN_PROJECT_ID`**, **`FIREBASE_ADMIN_CLIENT_EMAIL`**, **`FIREBASE_ADMIN_PRIVATE_KEY`** (escaped newlines in Vercel) — see `web/` env docs.
