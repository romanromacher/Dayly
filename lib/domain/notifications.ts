import { addDays, diffDays, isoWeekOf } from './dates';
import { OPEN_THRESHOLD_DAYS, type Task } from './types';

/**
 * Ausgangspunkt für die 21-Tage-Frist.
 * - daily: der ursprünglich geplante Tag (bleibt beim Verschieben unverändert)
 * - weekly: der letzte Tag der ursprünglichen Zielwoche (Sonntag)
 * Aufgaben ohne Startdatum erzeugen keine Meldung.
 */
export function notificationAnchor(task: Pick<Task, 'kind' | 'originalScheduledDate' | 'originalWeekStart'>): string | null {
  if (task.kind === 'daily') return task.originalScheduledDate;
  return task.originalWeekStart ? addDays(task.originalWeekStart, 6) : null;
}

/** Kalendertage seit dem Ausgangspunkt, oder null ohne Ausgangspunkt. */
export function daysOpenSince(task: Task, today: string): number | null {
  const anchor = notificationAnchor(task);
  return anchor ? diffDays(anchor, today) : null;
}

/** Offen und mindestens 21 volle Kalendertage nach dem Ausgangspunkt. */
export function isDueForOpenNotice(task: Task, today: string): boolean {
  if (task.status !== 'open') return false;
  const days = daysOpenSince(task, today);
  return days !== null && days >= OPEN_THRESHOLD_DAYS;
}

/** Ursprünglich geplante ISO-Woche (nicht die aktuelle). */
export function originalWeekOf(task: Pick<Task, 'kind' | 'originalScheduledDate' | 'originalWeekStart'>): { year: number; week: number } | null {
  const ref = task.kind === 'daily' ? task.originalScheduledDate : task.originalWeekStart;
  return ref ? isoWeekOf(ref) : null;
}

export function dueNotices(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => isDueForOpenNotice(t, today));
}

export function openDurationLabel(days: number): string {
  const weeks = Math.floor(days / 7);
  return `seit ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'} offen`;
}
