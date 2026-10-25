/**
 * Datums-Helfer. Alle Kalendertage sind Strings "YYYY-MM-DD" und werden über UTC-Mittag
 * gerechnet, damit Sommer-/Winterzeit nie einen Tag verschiebt.
 */
export const TZ = 'Europe/Berlin';

export const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const DAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export const MONTH_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const;
export const MONTH_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function toUtc(s: string): Date {
  const m = DATE_RE.exec(s);
  if (!m) throw new Error(`Ungültiges Datum: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Heutiger Kalendertag in Europe/Berlin. */
export function todayBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function addDays(s: string, n: number): string {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Anzahl Kalendertage von a bis b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Montag = 0 … Sonntag = 6 */
export function weekdayIndex(s: string): number {
  return (toUtc(s).getUTCDay() + 6) % 7;
}

export function mondayOf(s: string): string {
  return addDays(s, -weekdayIndex(s));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** ISO-8601-Kalenderwoche (Woche mit dem ersten Donnerstag des Jahres ist KW 1). */
export function isoWeekOf(s: string): { year: number; week: number } {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // Donnerstag dieser Woche
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}

export function weekKey(s: string): string {
  const { year, week } = isoWeekOf(s);
  return `${year}-W${pad(week)}`;
}

export function weekLabel(s: string): string {
  return `KW ${isoWeekOf(s).week}`;
}

export function formatDayMonth(s: string): string {
  const d = toUtc(s);
  return `${d.getUTCDate()}. ${MONTH_SHORT[d.getUTCMonth()]}`;
}

export function formatRange(weekStart: string): string {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}`;
}

export function formatDayLong(s: string): string {
  const d = toUtc(s);
  return `${DAY_LONG[weekdayIndex(s)]}, ${d.getUTCDate()}. ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDayShort(s: string): string {
  return `${DAY_SHORT[weekdayIndex(s)]}., ${formatDayMonth(s)}`;
}

export function monthYearLabel(s: string): string {
  const d = toUtc(s);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dayOfMonth(s: string): number {
  return toUtc(s).getUTCDate();
}
