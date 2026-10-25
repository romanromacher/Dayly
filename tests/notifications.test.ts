import { describe, expect, it } from 'vitest';
import { dueNotices, isDueForOpenNotice, openDurationLabel, originalWeekOf } from '../lib/domain/notifications';
import type { Task } from '../lib/domain/types';

const base: Task = {
  id: '1', title: 'Video Abgabe', notes: null, category: 'business', kind: 'daily',
  date: '2026-04-22', weekStart: null, time: null, dueAt: null, priority: null, estimatedMinutes: null,
  contextTags: [], status: 'open', completedAt: null,
  originalScheduledDate: '2026-04-22', originalWeekStart: null,
  createdAt: '2026-04-20T08:00:00Z', updatedAt: '2026-04-20T08:00:00Z', version: 1,
};

describe('21-Tage-Regel', () => {
  it('meldet erst ab 21 vollen Kalendertagen', () => {
    expect(isDueForOpenNotice(base, '2026-05-12')).toBe(false); // 20 Tage
    expect(isDueForOpenNotice(base, '2026-05-13')).toBe(true); // 21 Tage
    expect(isDueForOpenNotice(base, '2026-06-01')).toBe(true);
  });

  it('meldet erledigte Aufgaben nicht', () => {
    expect(isDueForOpenNotice({ ...base, status: 'done' }, '2026-06-01')).toBe(false);
  });

  it('nutzt den Ursprung, auch wenn die Aufgabe verschoben wurde', () => {
    const moved = { ...base, date: '2026-05-12' }; // heute verschoben, Ursprung bleibt
    expect(isDueForOpenNotice(moved, '2026-05-13')).toBe(true);
  });

  it('gibt die ursprüngliche KW an, nicht die aktuelle', () => {
    expect(originalWeekOf(base)).toEqual({ year: 2026, week: 17 });
    expect(originalWeekOf({ ...base, originalScheduledDate: '2026-04-20' })).toEqual({ year: 2026, week: 17 });
  });

  it('rechnet bei Wochenzielen ab dem Sonntag der Zielwoche', () => {
    const goal: Task = { ...base, kind: 'weekly', date: null, weekStart: '2026-04-20', originalScheduledDate: null, originalWeekStart: '2026-04-20' };
    // Sonntag der Zielwoche = 26.04. -> +21 = 17.05.
    expect(isDueForOpenNotice(goal, '2026-05-16')).toBe(false);
    expect(isDueForOpenNotice(goal, '2026-05-17')).toBe(true);
    expect(originalWeekOf(goal)).toEqual({ year: 2026, week: 17 });
  });

  it('funktioniert über den Jahreswechsel', () => {
    const t = { ...base, date: '2026-12-20', originalScheduledDate: '2026-12-20' };
    expect(isDueForOpenNotice(t, '2027-01-09')).toBe(false); // 20 Tage
    expect(isDueForOpenNotice(t, '2027-01-10')).toBe(true); // 21 Tage
    expect(originalWeekOf(t)).toEqual({ year: 2026, week: 51 });
  });

  it('ignoriert Aufgaben ohne Startdatum', () => {
    expect(isDueForOpenNotice({ ...base, originalScheduledDate: null }, '2030-01-01')).toBe(false);
  });

  it('filtert eine Liste', () => {
    const list = [base, { ...base, id: '2', originalScheduledDate: '2026-05-10' }, { ...base, id: '3', status: 'done' as const }];
    expect(dueNotices(list, '2026-05-13').map((t) => t.id)).toEqual(['1']);
  });

  it('formuliert die Dauer', () => {
    expect(openDurationLabel(21)).toBe('seit 3 Wochen offen');
    expect(openDurationLabel(27)).toBe('seit 3 Wochen offen');
    expect(openDurationLabel(28)).toBe('seit 4 Wochen offen');
  });
});
