export type LocalCalendarCell = { day: number; otherMonth: boolean; iso: string };

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function localDateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function localDateKeyFromParts(year: number, monthIndex: number, day: number) {
  return localDateKey(new Date(year, monthIndex, day));
}

export function addLocalDays(key: string, days: number) {
  const date = localDateFromKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function timestampToLocalDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDateKey(new Date(value));
}

export function createLocalMonthCells(year: number, monthIndex: number): LocalCalendarCell[] {
  const first = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevDays = new Date(year, monthIndex, 0).getDate();
  const out: LocalCalendarCell[] = [];

  for (let i = 0; i < first; i += 1) {
    const day = prevDays - first + 1 + i;
    out.push({ day, otherMonth: true, iso: localDateKeyFromParts(year, monthIndex - 1, day) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    out.push({ day, otherMonth: false, iso: localDateKeyFromParts(year, monthIndex, day) });
  }
  while (out.length % 7 !== 0) {
    const day = out.length - (first + daysInMonth) + 1;
    out.push({ day, otherMonth: true, iso: localDateKeyFromParts(year, monthIndex + 1, day) });
  }

  return out;
}
