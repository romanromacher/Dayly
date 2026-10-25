'use client';

import { useMemo, useState } from 'react';
import { addDays, formatRange, mondayOf, isoWeekOf } from '@/lib/domain/dates';
import { buildComparison, COUNTING_RULES, computeWeekStats, makeReview, percent } from '@/lib/domain/reviews';
import type { WeekReview } from '@/lib/domain/types';
import { useDayly } from './store';
import { Meter } from './ui';

export function SuccessView() {
  const { tasks, reviews, today, recomputeReview } = useDayly();
  const current = mondayOf(today);
  const [sel, setSel] = useState(current);

  const entries = useMemo<WeekReview[]>(() => {
    const live = makeReview(current, computeWeekStats(tasks, current), null);
    return [live, ...reviews.filter((r) => r.weekStart !== current)].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [tasks, reviews, current]);

  const r = entries.find((e) => e.weekStart === sel) ?? entries[0];
  const prev = entries.find((e) => e.weekStart === addDays(r.weekStart, -7));
  const comparison = buildComparison(r, prev);
  const live = r.finalizedAt === null;
  const hasPast = entries.length > 1;

  return (
    <div>
      <section className="section">
        <div className="line">
          <h2>Wochenrückblick</h2>
          <select className="select" style={{ width: 'auto' }} value={r.weekStart} onChange={(e) => setSel(e.target.value)} aria-label="Woche wählen">
            {entries.map((e) => (
              <option key={e.weekStart} value={e.weekStart}>KW {e.isoWeek}{e.isoYear !== isoWeekOf(current).year ? ` · ${e.isoYear}` : ''}</option>
            ))}
          </select>
        </div>
        <p>{formatRange(r.weekStart)}{live ? ' · Woche läuft noch' : ''}</p>
      </section>

      <section className="section dark">
        <p className="eyebrow-p">ERLEDIGTE TAGESAUFGABEN</p>
        <div className="progress">{r.dailyDone} von {r.dailyTotal}</div>
        <p>{percent(r.dailyDone, r.dailyTotal)}% geschafft</p>
        <Meter pct={percent(r.dailyDone, r.dailyTotal)} />
      </section>

      <section className="section stats">
        <div style={{ background: '#fff3f1', color: '#a65f56' }}>
          Business<strong>{r.businessDone}</strong><span className="muted">von {r.businessTotal} erledigt</span>
        </div>
        <div style={{ background: '#edf4ff', color: '#4e78be' }}>
          Privat<strong>{r.privateDone}</strong><span className="muted">von {r.privateTotal} erledigt</span>
        </div>
      </section>

      <section className="section card">
        <div className="line">
          <strong>Wochenziele</strong>
          <span>{r.goalsDone}/{r.goalsTotal}</span>
        </div>
        <Meter pct={percent(r.goalsDone, r.goalsTotal)} />
      </section>

      <section className="section">
        <h2>Zusammenfassung</h2>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#4b566a' }}>{r.summary || 'In dieser Woche war nichts geplant.'}</p>
        {comparison && <p style={{ fontSize: 13, lineHeight: 1.5 }}>{comparison}</p>}
      </section>

      <section className="section">
        <h2>Deine letzten Wochen</h2>
        {!hasPast && <p>Sobald eine Woche abgeschlossen ist, wird ihr Rückblick hier automatisch gespeichert.</p>}
        {entries.map((e) => (
          <button key={e.weekStart} className={`card hist ${e.weekStart === r.weekStart ? 'sel' : ''}`} onClick={() => { setSel(e.weekStart); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="line">
              <strong>KW {e.isoWeek}</strong>
              <span>{e.dailyDone}/{e.dailyTotal} erledigt</span>
            </div>
            <p>{formatRange(e.weekStart)} · Ziele {e.goalsDone}/{e.goalsTotal}{e.finalizedAt === null ? ' · läuft' : ''}</p>
          </button>
        ))}
      </section>

      <details className="rules">
        <summary>So wird gezählt</summary>
        <ul style={{ paddingLeft: 18 }}>{COUNTING_RULES.map((x) => <li key={x}>{x}</li>)}</ul>
        {!live && (
          <button className="btn ghost" onClick={() => { if (window.confirm('Den gespeicherten Rückblick dieser Woche mit den heutigen Daten neu berechnen?')) void recomputeReview(r.weekStart); }}>
            Rückblick neu berechnen
          </button>
        )}
      </details>
    </div>
  );
}
