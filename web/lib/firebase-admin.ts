import 'server-only';

import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminConfigError';
  }
}

export type FirebaseAdminStatus = {
  configured: boolean;
  source: 'service_account_json' | 'service_account_fields' | 'application_default' | null;
  message: string | null;
  diagnostics: {
    hasServiceAccountKey: boolean;
    hasProjectId: boolean;
    hasClientEmail: boolean;
    hasPrivateKey: boolean;
    privateKeyStartsCorrectly: boolean;
    credentialMode: 'service_account_json' | 'split_env' | 'application_default' | 'missing' | 'invalid_private_key';
  };
};

let adminApp: App | null = null;
let adminInitError: Error | null = null;
const IS_DEV = process.env.NODE_ENV !== 'production';

function readPrivateKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\\n/g, '\n');
}

function isPrivateKeyFormatValid(privateKey: string | undefined): boolean {
  if (!privateKey) return false;
  return (
    privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
    privateKey.includes('-----END PRIVATE KEY-----')
  );
}

function readEnvSignals() {
  const serviceAccountKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
    process.env.FIRE_SERVICE_ACCOUNT_KEY?.trim() ||
    '';
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || '';
  const privateKey = readPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const hasGoogleApplicationCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());

  return {
    serviceAccountKey,
    projectId,
    clientEmail,
    privateKey,
    hasGoogleApplicationCredentials,
    hasServiceAccountKey: Boolean(serviceAccountKey),
    hasProjectId: Boolean(projectId),
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(privateKey),
    privateKeyStartsCorrectly: isPrivateKeyFormatValid(privateKey),
  };
}

function logFirebaseAdminDiagnostics(status: FirebaseAdminStatus) {
  if (!IS_DEV) return;
  console.info('[admin] firebase-admin diagnostics', status.diagnostics);
}

function readServiceAccountFromJson() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
    process.env.FIRE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new AdminConfigError(
        'FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email, or private_key.',
      );
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: readPrivateKey(parsed.private_key) ?? parsed.private_key,
    };
  } catch (error) {
    if (error instanceof AdminConfigError) throw error;
    throw new AdminConfigError('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }
}

function readServiceAccountFromFields() {
  const { projectId, clientEmail, privateKey, privateKeyStartsCorrectly } = readEnvSignals();

  if (!projectId && !clientEmail && !privateKey) return null;
  if (!projectId || !clientEmail || !privateKey) {
    throw new AdminConfigError(
      'Firebase Admin credentials are incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }
  if (!privateKeyStartsCorrectly) {
    throw new AdminConfigError('FIREBASE_PRIVATE_KEY is present but invalid format.');
  }

  return { projectId, clientEmail, privateKey };
}

export function readFirebaseAdminStatus(): FirebaseAdminStatus {
  const signals = readEnvSignals();

  if (signals.hasServiceAccountKey) {
    const status: FirebaseAdminStatus = {
      configured: true,
      source: 'service_account_json',
      message: null,
      diagnostics: {
        hasServiceAccountKey: signals.hasServiceAccountKey,
        hasProjectId: signals.hasProjectId,
        hasClientEmail: signals.hasClientEmail,
        hasPrivateKey: signals.hasPrivateKey,
        privateKeyStartsCorrectly: signals.privateKeyStartsCorrectly,
        credentialMode: 'service_account_json',
      },
    };
    logFirebaseAdminDiagnostics(status);
    return status;
  }

  if (signals.hasProjectId || signals.hasClientEmail || signals.hasPrivateKey) {
    const valid = signals.hasProjectId && signals.hasClientEmail && signals.hasPrivateKey;
    const formatValid = signals.privateKeyStartsCorrectly;
    const status: FirebaseAdminStatus = {
      configured: valid && formatValid,
      source: valid && formatValid ? 'service_account_fields' : null,
      message: valid
        ? formatValid
          ? null
          : 'FIREBASE_PRIVATE_KEY is present but invalid format.'
        : 'Firebase Admin credentials are incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      diagnostics: {
        hasServiceAccountKey: signals.hasServiceAccountKey,
        hasProjectId: signals.hasProjectId,
        hasClientEmail: signals.hasClientEmail,
        hasPrivateKey: signals.hasPrivateKey,
        privateKeyStartsCorrectly: signals.privateKeyStartsCorrectly,
        credentialMode: formatValid ? 'split_env' : 'invalid_private_key',
      },
    };
    logFirebaseAdminDiagnostics(status);
    return status;
  }

  if (signals.hasGoogleApplicationCredentials) {
    const status: FirebaseAdminStatus = {
      configured: true,
      source: 'application_default',
      message: null,
      diagnostics: {
        hasServiceAccountKey: signals.hasServiceAccountKey,
        hasProjectId: signals.hasProjectId,
        hasClientEmail: signals.hasClientEmail,
        hasPrivateKey: signals.hasPrivateKey,
        privateKeyStartsCorrectly: signals.privateKeyStartsCorrectly,
        credentialMode: 'application_default',
      },
    };
    logFirebaseAdminDiagnostics(status);
    return status;
  }

  const status: FirebaseAdminStatus = {
    configured: false,
    source: null,
    message:
      'Firebase Admin credentials are not configured correctly. Add FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID.',
    diagnostics: {
      hasServiceAccountKey: signals.hasServiceAccountKey,
      hasProjectId: signals.hasProjectId,
      hasClientEmail: signals.hasClientEmail,
      hasPrivateKey: signals.hasPrivateKey,
      privateKeyStartsCorrectly: signals.privateKeyStartsCorrectly,
      credentialMode: 'missing',
    },
  };
  logFirebaseAdminDiagnostics(status);
  return status;
}

export function isFirebaseAdminCredentialError(error: unknown): boolean {
  if (error instanceof AdminConfigError) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('default credentials') ||
    message.includes('google oauth2 access token') ||
    message.includes('could not load the default credentials') ||
    message.includes('credential implementation provided to initializeapp')
  );
}

function createFirebaseAdminApp(): App {
  if (adminApp) return adminApp;
  if (adminInitError) {
    if (!IS_DEV) throw adminInitError;
    adminInitError = null;
  }
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  try {
    const fromJson = readServiceAccountFromJson();
    if (fromJson) {
      adminApp = initializeApp({
        credential: cert({
          projectId: fromJson.projectId,
          clientEmail: fromJson.clientEmail,
          privateKey: fromJson.privateKey,
        }),
        projectId: fromJson.projectId,
      });
      return adminApp;
    }

    const fromFields = readServiceAccountFromFields();
    if (fromFields) {
      adminApp = initializeApp({
        credential: cert({
          projectId: fromFields.projectId,
          clientEmail: fromFields.clientEmail,
          privateKey: fromFields.privateKey,
        }),
        projectId: fromFields.projectId,
      });
      return adminApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
      });
      return adminApp;
    }

    throw new AdminConfigError(readFirebaseAdminStatus().message ?? 'Firebase Admin credentials are not configured.');
  } catch (error) {
    adminInitError = error instanceof Error ? error : new Error('Firebase Admin initialization failed.');
    throw adminInitError;
  }
}

export function getFirebaseAdminAuth() {
  return getAuth(createFirebaseAdminApp());
}

export function getFirebaseAdminDb() {
  return getFirestore(createFirebaseAdminApp());
}
