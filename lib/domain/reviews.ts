import { isoWeekOf, weekDays } from './dates';
import type { Task, WeekReview, WeekStats } from './types';

/** Wird erhöht, wenn sich die Zählregeln ändern. Gespeicherte Rückblicke behalten ihre Version. */
export const REVIEW_RULE_VERSION = 1;

/** Zählregeln, wie sie auch in der App angezeigt werden. */
export const COUNTING_RULES = [
  'Gezählt werden Tagesaufgaben, die am Wochenende für diese Kalenderwoche geplant sind. Wer eine Aufgabe in eine andere Woche verschiebt, nimmt sie aus dieser Woche heraus.',
  'Als erledigt zählt, was beim Wochenabschluss den Status „erledigt“ hat.',
  'Wochenziele werden getrennt von den Tagesaufgaben gezählt.',
  'Der Rückblick wird beim Wochenwechsel einmalig gespeichert und danach nicht mehr automatisch verändert.',
];

export const emptyStats = (): WeekStats => ({
  dailyTotal: 0, dailyDone: 0,
  businessTotal: 0, businessDone: 0,
  privateTotal: 0, privateDone: 0,
  goalsTotal: 0, goalsDone: 0,
});

export function computeWeekStats(tasks: Task[], weekStart: string): WeekStats {
  const days = new Set(weekDays(weekStart));
  const s = emptyStats();
  for (const t of tasks) {
    if (t.kind === 'daily' && t.date && days.has(t.date)) {
      s.dailyTotal++;
      if (t.status === 'done') s.dailyDone++;
      if (t.category === 'business') {
        s.businessTotal++;
        if (t.status === 'done') s.businessDone++;
      } else {
        s.privateTotal++;
        if (t.status === 'done') s.privateDone++;
      }
    } else if (t.kind === 'weekly' && t.weekStart === weekStart) {
      s.goalsTotal++;
      if (t.status === 'done') s.goalsDone++;
    }
  }
  return s;
}

export const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export function hasContent(s: WeekStats): boolean {
  return s.dailyTotal > 0 || s.goalsTotal > 0;
}

/** Kurzes, sachliches Wochenfazit. */
export function buildSummary(s: WeekStats): string {
  if (!hasContent(s)) return 'In dieser Woche war nichts geplant.';
  const parts: string[] = [];
  if (s.dailyTotal > 0) {
    const p = percent(s.dailyDone, s.dailyTotal);
    parts.push(`${s.dailyDone} von ${s.dailyTotal} Tagesaufgaben erledigt (${p} %).`);
    if (p >= 80) parts.push('Eine solide Woche.');
    else if (p >= 50) parts.push('Der größere Teil ist geschafft.');
    else if (s.dailyDone > 0) parts.push('Einiges ist offen geblieben. Prüfe, was davon noch wichtig ist.');
    else parts.push('Keine Tagesaufgabe wurde abgehakt. Prüfe, ob die Planung zur Woche gepasst hat.');
    parts.push(`Business: ${s.businessDone} erledigt, Privat: ${s.privateDone} erledigt.`);
  }
  if (s.goalsTotal > 0) parts.push(`Wochenziele: ${s.goalsDone} von ${s.goalsTotal} erreicht.`);
  return parts.join(' ');
}

/** Vergleich zur Vorwoche mit Hinweis auf unterschiedliche Planungsmengen. */
export function buildComparison(cur: WeekStats, prev: WeekStats | null | undefined): string | null {
  if (!prev || prev.dailyTotal === 0 || cur.dailyTotal === 0) return null;
  const pc = percent(cur.dailyDone, cur.dailyTotal);
  const pp = percent(prev.dailyDone, prev.dailyTotal);
  const diff = pc - pp;
  const head = `Vorwoche: ${prev.dailyDone} von ${prev.dailyTotal} (${pp} %). Das sind ${diff === 0 ? 'gleich viele Prozent' : `${Math.abs(diff)} Prozentpunkte ${diff > 0 ? 'mehr' : 'weniger'}`}.`;
  const planDiff = Math.abs(cur.dailyTotal - prev.dailyTotal);
  const warn = planDiff >= 3 || planDiff / Math.max(cur.dailyTotal, prev.dailyTotal) >= 0.25
    ? ` Geplant waren ${cur.dailyTotal} statt ${prev.dailyTotal} Aufgaben, der Vergleich ist daher nur bedingt aussagekräftig.`
    : '';
  return head + warn;
}

export function makeReview(weekStart: string, s: WeekStats, finalizedAt: string | null): WeekReview {
  const { year, week } = isoWeekOf(weekStart);
  return { ...s, weekStart, isoYear: year, isoWeek: week, summary: buildSummary(s), finalizedAt, ruleVersion: REVIEW_RULE_VERSION };
}
