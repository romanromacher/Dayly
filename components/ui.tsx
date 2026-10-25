'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { addDays, dayOfMonth, DAY_SHORT, mondayOf } from '@/lib/domain/dates';
import type { Task } from '@/lib/domain/types';
import { useDayly } from './store';

export const CAT_LABEL = { business: 'Business', private: 'Privat' } as const;

export function Meter({ pct }: { pct: number }) {
  return (
    <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="line">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Schließen">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Wochenleiste Mo–So mit farbigen Punkten (Business = Koralle, Privat = Blau). */
export function DayStrip({ start }: { start: string }) {
  const { tasks, selected, setSelected, today } = useDayly();
  const monday = mondayOf(start);
  return (
    <div className="weekdays">
      {DAY_SHORT.map((label, i) => {
        const d = addDays(monday, i);
        const ts = tasks.filter((t: Task) => t.kind === 'daily' && t.date === d);
        const active = d === selected;
        return (
          <button
            key={d}
            className={`day ${active ? 'active' : ''} ${d === today ? 'today' : ''}`}
            onClick={() => setSelected(d)}
            aria-pressed={active}
            aria-label={`${label} ${dayOfMonth(d)}`}
          >
            <small>{label}</small>
            {dayOfMonth(d)}
            <span className="dots">
              {ts.some((t) => t.category === 'business') && <i className="dot" />}
              {ts.some((t) => t.category === 'private') && <i className="dot blue" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
