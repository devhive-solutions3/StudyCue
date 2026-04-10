import { describe, expect, it } from 'vitest';
import { parseCueCommandFromResponse } from './cue-chat-response';

describe('parseCueCommandFromResponse', () => {
  it('parses calendar array from fenced json', () => {
    const response = `
Sure, here is the schedule:
\`\`\`json
[
  { "title": "Math", "weekday": "Monday", "startTime": "09:00", "endTime": "10:00" }
]
\`\`\`
`;
    const parsed = parseCueCommandFromResponse(response, 'put this on my calendar');
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.command.kind).toBe('add_calendar');
    }
  });

  it('flags calendar-intent with tasks-only fences', () => {
    const response = `
\`\`\`json
{ "action": "add_tasks", "tasks": [{ "title": "Read chapter 2" }] }
\`\`\`
`;
    const parsed = parseCueCommandFromResponse(response, 'add this to my calendar');
    expect(parsed.status).toBe('calendar_intent_tasks_only');
  });

  it('returns invalid_json for malformed full json response', () => {
    const parsed = parseCueCommandFromResponse('{ "action": "clear_classes"', 'clear my classes');
    expect(parsed.status).toBe('invalid_json');
  });

  it('returns invalid_payload for invalid class times', () => {
    const response = `
\`\`\`json
[
  { "title": "Physics", "weekday": "Tuesday", "startTime": "14:00", "endTime": "11:00" }
]
\`\`\`
`;
    const parsed = parseCueCommandFromResponse(response, 'save to calendar');
    expect(parsed.status).toBe('invalid_payload');
  });

  it('parses replace_classes action with valid rows', () => {
    const response = `
\`\`\`json
{
  "action": "replace_classes",
  "classes": [
    { "title": "Chemistry", "weekday": "Wednesday", "startTime": "13:00", "endTime": "14:00" }
  ]
}
\`\`\`
`;
    const parsed = parseCueCommandFromResponse(response, 'replace my schedule');
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.command.kind).toBe('replace_classes');
    }
  });
});
