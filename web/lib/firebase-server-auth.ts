type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

type IdentityToolkitLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

function getFirebaseApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    ''
  );
}

function normalizeBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;
  return token.length <= 4096 ? token : null;
}

export function readBearerToken(request: Request): string | null {
  return normalizeBearerToken(request.headers.get('authorization'));
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey || !idToken?.trim()) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as IdentityToolkitLookupResponse;
    const user = data.users?.[0];
    if (!user?.localId) return null;

    return {
      uid: user.localId,
      email: user.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireFirebaseAuth(request: Request): Promise<VerifiedFirebaseUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  return verifyFirebaseIdToken(token);
}
