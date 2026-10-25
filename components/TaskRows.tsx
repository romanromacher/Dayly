'use client';

import { Check, Circle, CircleDot, MoreHorizontal, Target } from 'lucide-react';
import { formatDayShort, weekLabel } from '@/lib/domain/dates';
import type { Task } from '@/lib/domain/types';
import { useDayly } from './store';
import { CAT_LABEL } from './ui';

export function TaskRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { toggle } = useDayly();
  const done = task.status === 'done';
  const moved = task.originalScheduledDate && task.originalScheduledDate !== task.date;
  return (
    <div className={`task ${task.category === 'private' ? 'private' : ''} ${done ? 'done' : ''}`}>
      <button className="task-main" onClick={() => toggle(task)} aria-pressed={done} aria-label={`${task.title} ${done ? 'wieder öffnen' : 'abhaken'}`}>
        <span className="check">{done && <Check size={18} strokeWidth={3} />}</span>
        <span style={{ minWidth: 0 }}>
          <span className="name">{task.title}</span>
          <span className="meta">
            {CAT_LABEL[task.category]}
            {task.time ? ` · ${task.time} Uhr` : ''}
            {moved && !done ? ` · verschoben von ${formatDayShort(task.originalScheduledDate!)}` : ''}
          </span>
        </span>
      </button>
      <button className="more" onClick={() => onEdit(task)} aria-label={`${task.title} bearbeiten`}>
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

export function GoalCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { toggle } = useDayly();
  const done = task.status === 'done';
  const moved = task.originalWeekStart && task.originalWeekStart !== task.weekStart;
  return (
    <div className={`goal ${done ? 'done' : ''}`}>
      <button className="goal-main" onClick={() => toggle(task)} aria-pressed={done} aria-label={`${task.title} ${done ? 'wieder öffnen' : 'als erreicht markieren'}`}>
        <div className="line">
          <span className="gname" style={{ display: 'flex', gap: 8 }}>
            {done ? <Check size={18} strokeWidth={3} color="#3ba46b" style={{ flex: 'none', marginTop: 1 }} /> : <Target size={18} style={{ flex: 'none', marginTop: 1 }} />}
            <span>{task.title}</span>
          </span>
          {done ? <CircleDot size={18} color="#3ba46b" /> : <Circle size={18} color="#a0a8b4" />}
        </div>
        <span className={`pill ${task.category === 'private' ? 'private' : ''}`}>
          {CAT_LABEL[task.category]}
          {moved && !done ? ` · ursprünglich ${weekLabel(task.originalWeekStart!)}` : ''}
        </span>
      </button>
      <button className="more" onClick={() => onEdit(task)} aria-label={`${task.title} bearbeiten`}>
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}
