# Cookie consent — Klaro (Tier W-0 decision)

**Decision:** Use **[Klaro](https://github.com/KIProtect/klaro)** (OSS) for GDPR/ePrivacy-aligned consent **before** loading:

- Google AdSense (when publisher ID is configured)
- Plausible Analytics (optional; consent-gated — also offer no-cookies mode)

Implementation lives in **`web/components/CookieConsent.tsx`** and loads Klaro from `cdn.jsdelivr.net` behind user acceptance.
