import { describe, expect, it } from 'vitest';
import { buildComparison, buildSummary, computeWeekStats, percent } from '../lib/domain/reviews';
import type { Task } from '../lib/domain/types';

let n = 0;
const mk = (p: Partial<Task>): Task => ({
  id: String(++n), title: 't', notes: null, category: 'business', kind: 'daily', date: '2026-10-26', weekStart: null,
  time: null, dueAt: null, priority: null, estimatedMinutes: null, contextTags: [], status: 'open', completedAt: null,
  originalScheduledDate: '2026-10-26', originalWeekStart: null, createdAt: '', updatedAt: '', version: 1, ...p,
});

describe('Wochenstatistik', () => {
  const tasks = [
    mk({ date: '2026-10-26', status: 'done' }),
    mk({ date: '2026-11-01', category: 'private', status: 'done' }),
    mk({ date: '2026-10-28', category: 'private' }),
    mk({ date: '2026-11-02' }), // nächste Woche, zählt nicht
    mk({ kind: 'weekly', date: null, weekStart: '2026-10-26', status: 'done' }),
    mk({ kind: 'weekly', date: null, weekStart: '2026-10-26' }),
    mk({ kind: 'weekly', date: null, weekStart: '2026-11-02' }),
  ];

  it('zählt Tagesaufgaben und Wochenziele getrennt', () => {
    const s = computeWeekStats(tasks, '2026-10-26');
    expect(s).toMatchObject({
      dailyTotal: 3, dailyDone: 2, businessTotal: 1, businessDone: 1, privateTotal: 2, privateDone: 1, goalsTotal: 2, goalsDone: 1,
    });
  });

  it('zählt Sonntag noch zur Woche, Montag nicht', () => {
    expect(computeWeekStats(tasks, '2026-11-02').dailyTotal).toBe(1);
  });

  it('rechnet Prozent', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });

  it('schreibt ein sachliches Fazit', () => {
    const s = computeWeekStats(tasks, '2026-10-26');
    expect(buildSummary(s)).toContain('2 von 3 Tagesaufgaben erledigt (67 %)');
    expect(buildSummary(s)).toContain('Wochenziele: 1 von 2');
    expect(buildSummary(computeWeekStats([], '2026-10-26'))).toBe('In dieser Woche war nichts geplant.');
  });

  it('warnt im Vergleich bei unterschiedlicher Planungsmenge', () => {
    const cur = computeWeekStats(tasks, '2026-10-26');
    const prev = { ...cur, dailyTotal: 10, dailyDone: 9 };
    expect(buildComparison(cur, prev)).toContain('nur bedingt aussagekräftig');
    const similar = { ...cur, dailyTotal: 3, dailyDone: 3 };
    expect(buildComparison(cur, similar)).not.toContain('bedingt');
    expect(buildComparison(cur, null)).toBeNull();
  });
});
