# Cue Chat Manual QA Checklist

- Send a text-only prompt and verify Cue returns a normal assistant message.
- Send image + text and verify attachment preview appears, sends, and clears after send.
- Trigger an unauthenticated calendar/task save and verify auth-specific message appears.
- Send malformed calendar command response and verify friendly parse/validation error copy.
- Force a failed request (offline or backend down) and verify retry button appears and works.
- Confirm loading bubble ("Cue is thinking...") appears during request and disappears after.
- Verify long chat threads remain smooth and autoscroll to latest message.
- Verify keyboard behavior on iOS/Android keeps composer usable without overlap.
- Verify upload/send/remove controls have accessibility labels and hints in screen reader.
