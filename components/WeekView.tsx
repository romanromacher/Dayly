'use client';

import { ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react';
import { addDays, formatDayLong, formatRange, isoWeekOf, mondayOf } from '@/lib/domain/dates';
import { percent } from '@/lib/domain/reviews';
import type { Task } from '@/lib/domain/types';
import { useDayly } from './store';
import { GoalCard, TaskRow } from './TaskRows';
import { FilterChips } from './TodayView';
import { DayStrip, Meter } from './ui';

export function WeekView({ onNew, onEdit }: { onNew: (kind: 'daily' | 'weekly') => void; onEdit: (t: Task) => void }) {
  const { tasks, selected, filter, changeWeek } = useDayly();
  const ws = mondayOf(selected);
  const we = addDays(ws, 6);
  const weekDaily = tasks.filter((t) => t.kind === 'daily' && t.date! >= ws && t.date! <= we);
  const weekDone = weekDaily.filter((t) => t.status === 'done').length;
  const day = weekDaily
    .filter((t) => t.date === selected && (filter === 'alle' || t.category === filter))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt.localeCompare(b.createdAt));
  const goals = tasks.filter((t) => t.kind === 'weekly' && t.weekStart === ws);
  const goalsDone = goals.filter((g) => g.status === 'done').length;
  const goalsShown = goals.filter((g) => filter === 'alle' || g.category === filter).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.createdAt.localeCompare(b.createdAt));

  return (
    <div>
      <section className="section">
        <div className="line">
          <div>
            <h2>Kalenderwoche {isoWeekOf(ws).week}</h2>
            <p>{formatRange(ws)}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="close" onClick={() => changeWeek(-1)} aria-label="Vorherige Woche"><ChevronLeft size={18} /></button>
            <button className="close" onClick={() => changeWeek(1)} aria-label="Nächste Woche"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <DayStrip start={ws} />
          <div className="line" style={{ marginTop: 15 }}>
            <p style={{ margin: 0 }}>Tagesaufgaben diese Woche</p>
            <strong style={{ fontSize: 13 }}>{weekDone}/{weekDaily.length}</strong>
          </div>
          <Meter pct={percent(weekDone, weekDaily.length)} />
        </div>
      </section>

      <section className="section">
        <div className="line">
          <h2>{formatDayLong(selected)}</h2>
          <button className="btn" onClick={() => onNew('daily')}><Plus size={14} /> Aufgabe</button>
        </div>
        <FilterChips />
        {day.map((t) => <TaskRow key={t.id} task={t} onEdit={onEdit} />)}
        {day.length === 0 && <p>Keine Tagesaufgaben für diesen Tag.</p>}
      </section>

      <section className="section" style={{ borderTop: '1px solid #e8ecf2', paddingTop: 22 }}>
        <div className="line">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={20} /> Wochenziele</h2>
            <p>Unabhängig vom einzelnen Tag</p>
          </div>
          <button className="btn" onClick={() => onNew('weekly')}><Plus size={14} /> Ziel</button>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="line">
            <span className="muted">Wochenfortschritt</span>
            <strong>{goalsDone}/{goals.length}</strong>
          </div>
          <Meter pct={percent(goalsDone, goals.length)} />
        </div>
        {goalsShown.map((g) => <GoalCard key={g.id} task={g} onEdit={onEdit} />)}
        {goalsShown.length === 0 && <p style={{ marginTop: 12 }}>Keine Wochenziele.</p>}
      </section>
    </div>
  );
}
