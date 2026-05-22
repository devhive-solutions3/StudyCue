const WEEKDAYS = new Set([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ParsedClassRow = {
  title: string;
  weekday: string;
  startTime: string;
  endTime: string;
  location?: string;
  eventType?: string;
  recurrence?: string;
  specificDate?: string;
};

export type ParsedTaskRow = {
  title: string;
  dueAt?: string;
  estimatedMinutes?: number;
  category?: string;
};

export type CueCommand =
  | { kind: 'add_calendar'; classes: ParsedClassRow[] }
  | { kind: 'clear_classes' }
  | { kind: 'replace_classes'; classes: ParsedClassRow[] }
  | { kind: 'add_tasks'; tasks: ParsedTaskRow[] }
  | { kind: 'empty_calendar' };

export type CueCommandParseResult =
  | { status: 'none' }
  | { status: 'calendar_intent_tasks_only' }
  | { status: 'invalid_json' }
  | { status: 'invalid_payload' }
  | { status: 'unsupported' }
  | { status: 'ok'; command: CueCommand };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWeekday(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (!WEEKDAYS.has(normalized)) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isValidTime(input: unknown): input is string {
  return typeof input === 'string' && TIME_24H.test(input.trim());
}

function toMinutes(input: string): number {
  const [h, m] = input.split(':').map(Number);
  return h * 60 + m;
}

function normalizeClassRow(input: unknown): ParsedClassRow | null {
  if (!isObject(input)) return null;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const weekdayRaw = typeof input.weekday === 'string' ? input.weekday : '';
  const weekday = normalizeWeekday(weekdayRaw);
  const startTime = typeof input.startTime === 'string' ? input.startTime.trim() : '';
  const endTime = typeof input.endTime === 'string' ? input.endTime.trim() : '';
  if (!title || !weekday || !isValidTime(startTime) || !isValidTime(endTime)) {
    return null;
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    return null;
  }

  return {
    title,
    weekday,
    startTime,
    endTime,
    location: typeof input.location === 'string' ? input.location.trim() || undefined : undefined,
    eventType: typeof input.eventType === 'string' ? input.eventType.trim() || undefined : undefined,
    recurrence: typeof input.recurrence === 'string' ? input.recurrence.trim() || undefined : undefined,
    specificDate: typeof input.specificDate === 'string' ? input.specificDate.trim() || undefined : undefined,
  };
}

function normalizeTaskRow(input: unknown): ParsedTaskRow | null {
  if (!isObject(input)) return null;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;
  const estimatedMinutes =
    typeof input.estimatedMinutes === 'number' && Number.isFinite(input.estimatedMinutes)
      ? Math.max(1, Math.round(input.estimatedMinutes))
      : undefined;

  return {
    title,
    dueAt: typeof input.dueAt === 'string' ? input.dueAt.trim() || undefined : undefined,
    estimatedMinutes,
    category: typeof input.category === 'string' ? input.category.trim() || undefined : undefined,
  };
}

export function userMessagePrefersCalendar(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/\b(not|instead|only)\b[^.!?]{0,80}\b(todo|to-?do|task\s*list)\b/i.test(t)) return true;
  if (/\b(calendar|calendar tab|time block|schedule block)\b/i.test(t)) return true;
  if (/\b(on|to|onto|into|put)[^.!?]{0,40}\b(my\s+)?(calendar|schedule)\b/i.test(t)) return true;
  return false;
}

export function extractFencedJsonBodies(text: string): string[] {
  const re = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[1]?.trim();
    if (s) out.push(s);
  }
  return out;
}

function parseJsonSafe(input: string): unknown | null {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function parseCommandFromParsedJson(parsed: unknown): CueCommandParseResult {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { status: 'ok', command: { kind: 'empty_calendar' } };
    }
    const normalizedRows = parsed.map(normalizeClassRow);
    if (normalizedRows.every((row) => row !== null)) {
      return { status: 'ok', command: { kind: 'add_calendar', classes: normalizedRows as ParsedClassRow[] } };
    }
    return { status: 'invalid_payload' };
  }

  if (!isObject(parsed)) return { status: 'unsupported' };

  const action = typeof parsed.action === 'string' ? parsed.action : '';
  if (action === 'clear_classes') {
    return { status: 'ok', command: { kind: 'clear_classes' } };
  }
  if (action === 'replace_classes') {
    if (!Array.isArray(parsed.classes)) return { status: 'invalid_payload' };
    const normalizedRows = parsed.classes.map(normalizeClassRow);
    if (!normalizedRows.length || normalizedRows.some((row) => row === null)) {
      return { status: 'invalid_payload' };
    }
    return { status: 'ok', command: { kind: 'replace_classes', classes: normalizedRows as ParsedClassRow[] } };
  }
  if (action === 'add_tasks') {
    if (!Array.isArray(parsed.tasks)) return { status: 'invalid_payload' };
    const normalizedRows = parsed.tasks.map(normalizeTaskRow);
    if (!normalizedRows.length || normalizedRows.some((row) => row === null)) {
      return { status: 'invalid_payload' };
    }
    return { status: 'ok', command: { kind: 'add_tasks', tasks: normalizedRows as ParsedTaskRow[] } };
  }

  return { status: 'unsupported' };
}

export function parseCueCommandFromResponse(cueText: string, latestUserMessage: string): CueCommandParseResult {
  const fencedBodies = extractFencedJsonBodies(cueText);
  const parsedFenceCandidates = fencedBodies
    .map((body) => ({ body, parsed: parseJsonSafe(body) }))
    .filter((entry) => entry.parsed !== null);

  if (userMessagePrefersCalendar(latestUserMessage) && parsedFenceCandidates.length > 0) {
    const onlyTasks = parsedFenceCandidates.every((entry) => {
      const outcome = parseCommandFromParsedJson(entry.parsed);
      return outcome.status === 'ok' && outcome.command.kind === 'add_tasks';
    });
    if (onlyTasks) return { status: 'calendar_intent_tasks_only' };
  }

  for (const entry of parsedFenceCandidates) {
    const outcome = parseCommandFromParsedJson(entry.parsed);
    if (outcome.status === 'ok') return outcome;
    if (outcome.status === 'invalid_payload') return outcome;
  }

  if (fencedBodies.length > 0) {
    return parsedFenceCandidates.length > 0 ? { status: 'unsupported' } : { status: 'invalid_json' };
  }

  const trimmed = cueText.trim();
  const startsLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (startsLikeJson) {
    const parsed = parseJsonSafe(trimmed);
    if (parsed === null) return { status: 'invalid_json' };
    return parseCommandFromParsedJson(parsed);
  }

  return { status: 'none' };
}
