'use client';

import { ArrowUpRight, Plus, Target } from 'lucide-react';
import { mondayOf, monthYearLabel, formatDayShort } from '@/lib/domain/dates';
import { percent } from '@/lib/domain/reviews';
import type { Filter } from './store';
import { useDayly } from './store';
import { TaskRow } from './TaskRows';
import { DayStrip, Meter } from './ui';
import type { Task } from '@/lib/domain/types';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'business', label: 'Business' },
  { id: 'private', label: 'Privat' },
];

export function FilterChips() {
  const { filter, setFilter } = useDayly();
  return (
    <div className="filters" role="group" aria-label="Filter">
      {FILTERS.map((f) => (
        <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function TodayView({ onNew, onEdit }: { onNew: (kind: 'daily' | 'weekly') => void; onEdit: (t: Task) => void }) {
  const { tasks, selected, today, filter, setTab } = useDayly();
  const day = tasks.filter((t) => t.kind === 'daily' && t.date === selected);
  const done = day.filter((t) => t.status === 'done').length;
  const shown = day
    .filter((t) => filter === 'alle' || t.category === filter)
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt.localeCompare(b.createdAt));
  const goals = tasks.filter((t) => t.kind === 'weekly' && t.weekStart === mondayOf(selected));
  const goalsDone = goals.filter((g) => g.status === 'done').length;
  const empty = tasks.length === 0;

  return (
    <div>
      <section className="section dark">
        <p className="eyebrow-p">{selected === today ? 'DEIN TAGESFORTSCHRITT' : `FORTSCHRITT · ${formatDayShort(selected).toUpperCase()}`}</p>
        <div className="progress">{done} von {day.length} erledigt</div>
        <p>Jeder Haken zählt.</p>
        <Meter pct={percent(done, day.length)} />
      </section>

      <section className="section">
        <div className="line">
          <h2>{monthYearLabel(selected)}</h2>
          <span className="muted">Diese Woche</span>
        </div>
        <DayStrip start={selected} />
      </section>

      <section className="section">
        <div className="line">
          <div>
            <h2>Deine Tagesaufgaben</h2>
            <p>{day.length - done} offen · {done} erledigt</p>
          </div>
          <button className="btn" onClick={() => onNew('daily')}><Plus size={14} /> Neu</button>
        </div>
        <FilterChips />
        {shown.map((t) => <TaskRow key={t.id} task={t} onEdit={onEdit} />)}
        {shown.length === 0 && <p>{empty ? 'Noch nichts geplant. Tippe auf „Neu“, um deine erste Aufgabe anzulegen.' : 'Keine Aufgaben für diesen Tag.'}</p>}
      </section>

      <button className="section card click" onClick={() => setTab('woche')}>
        <div className="line">
          <div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={18} /> Deine Wochenziele</strong>
            <p>{goalsDone} von {goals.length} geschafft · Zur Wochenübersicht</p>
          </div>
          <ArrowUpRight size={20} />
        </div>
      </button>
    </div>
  );
}
