/**
 * cue-api.ts
 *
 * Public entry point for the Cue AI layer. Tries providers in order:
 *
 *   1. Apple Foundation Models  — on-device, iOS 26+, iPhone 15 Pro / 16+
 *   2. Groq                     — free cloud, all other devices
 *   3. Gemini proxy             — existing proxy, last resort
 *
 * Provider implementations live in lib/cue-providers.ts.
 */

import {
  appleFoundationModelProvider,
  groqProvider,
  geminiProxyProvider,
  createAttachment as _createAttachment,
  type CueAttachment,
  type ProviderParams,
} from './cue-providers';

// Re-export types consumed by CueChatScreen
export type { CueAttachment };

export type CueMessage = {
  role: 'user' | 'cue';
  text: string;
  imageUri?: string;
};

export async function fetchCueResponse(params: {
  attachment?: CueAttachment;
  history: CueMessage[];
  latestUserText: string;
}): Promise<string> {
  const providerParams: ProviderParams = {
    history: params.history,
    latestUserText: params.latestUserText,
    attachment: params.attachment,
  };

  // --- Tier 1: Apple Foundation Models (on-device) ---
  // Only attempted on iOS; silently skipped on Android and simulator.
  // Note: image attachments are not supported on-device — text only.
  const appleResult = await appleFoundationModelProvider(providerParams);
  if (appleResult) return appleResult;

  // --- Tier 2: Groq (free cloud fallback) ---
  // Covers all devices Apple Intelligence cannot run on.
  const groqResult = await groqProvider(providerParams);
  if (groqResult) return groqResult;

  // --- Tier 3: Gemini proxy (existing implementation) ---
  // Last resort — includes image attachment support.
  return geminiProxyProvider(providerParams);
}

export function createAttachment(uri: string): CueAttachment {
  return _createAttachment(uri);
}
