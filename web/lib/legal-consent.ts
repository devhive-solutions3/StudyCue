export const LEGAL_VERSION = '2026-06-01';
export const TERMS_VERSION = LEGAL_VERSION;
export const PRIVACY_VERSION = LEGAL_VERSION;
export const COOKIES_VERSION = LEGAL_VERSION;

export type LegalAcceptancePayload = {
  termsAccepted: true;
  privacyAccepted: true;
  adsDisclosureAccepted: true;
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion: string;
};

export function buildLegalAcceptancePayload(): LegalAcceptancePayload {
  return {
    termsAccepted: true,
    privacyAccepted: true,
    adsDisclosureAccepted: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    cookiesVersion: COOKIES_VERSION,
  };
}

export function hasCurrentLegalAcceptance(profile: {
  termsAccepted?: unknown;
  privacyAccepted?: unknown;
  adsDisclosureAccepted?: unknown;
  termsVersion?: unknown;
  privacyVersion?: unknown;
  cookiesVersion?: unknown;
} | null | undefined): boolean {
  return (
    profile?.termsAccepted === true &&
    profile.privacyAccepted === true &&
    profile.adsDisclosureAccepted === true &&
    profile.termsVersion === TERMS_VERSION &&
    profile.privacyVersion === PRIVACY_VERSION &&
    profile.cookiesVersion === COOKIES_VERSION
  );
}
