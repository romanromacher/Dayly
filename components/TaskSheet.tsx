'use client';

import { useState } from 'react';
import { addDays, formatRange, mondayOf, weekLabel } from '@/lib/domain/dates';
import { isValidDate } from '@/lib/domain/dates';
import type { Category, Kind, Task } from '@/lib/domain/types';
import { useDayly } from './store';
import { Sheet } from './ui';

export interface TaskSheetState {
  task?: Task;
  kind?: Kind;
}

export function TaskSheet({ state, onClose }: { state: TaskSheetState; onClose: () => void }) {
  const { createTask, patch, remove, selected, today } = useDayly();
  const editing = state.task;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [category, setCategory] = useState<Category>(editing?.category ?? 'business');
  const [kind, setKind] = useState<Kind>(editing?.kind ?? state.kind ?? 'daily');
  const [date, setDate] = useState(editing ? (editing.kind === 'daily' ? editing.date! : editing.weekStart!) : selected);
  const [time, setTime] = useState(editing?.time ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const weekStart = isValidDate(date) ? mondayOf(date) : null;

  async function save() {
    const t = title.trim();
    if (!t) return setError('Bitte gib einen Titel ein.');
    if (!isValidDate(date)) return setError('Bitte wähle ein Datum.');
    setError('');
    if (editing) {
      const p: Parameters<typeof patch>[1] = { title: t, category, notes: notes.trim() || null };
      if (editing.kind === 'daily') {
        p.date = date;
        p.time = time || null;
      } else {
        p.weekStart = mondayOf(date);
      }
      onClose();
      await patch(editing.id, p);
    } else {
      onClose();
      await createTask(
        kind === 'daily'
          ? { title: t, category, kind, date, time: time || null, notes: notes.trim() || null }
          : { title: t, category, kind, weekStart: mondayOf(date), notes: notes.trim() || null },
      );
    }
  }

  const heading = editing ? (editing.kind === 'weekly' ? 'Wochenziel bearbeiten' : 'Aufgabe bearbeiten') : kind === 'weekly' ? 'Neues Wochenziel' : 'Neue Aufgabe';

  return (
    <Sheet title={heading} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span>Titel</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was steht an?" maxLength={300} autoFocus={!editing} />
        </label>

        <div className="field">
          <span>Bereich</span>
          <div className="seg">
            <button type="button" className={category === 'business' ? 'on biz' : ''} onClick={() => setCategory('business')}>Business</button>
            <button type="button" className={category === 'private' ? 'on priv' : ''} onClick={() => setCategory('private')}>Privat</button>
          </div>
        </div>

        {!editing && (
          <div className="field">
            <span>Art</span>
            <div className="seg">
              <button type="button" className={kind === 'daily' ? 'on neutral' : ''} onClick={() => setKind('daily')}>Tagesaufgabe</button>
              <button type="button" className={kind === 'weekly' ? 'on neutral' : ''} onClick={() => setKind('weekly')}>Wochenziel</button>
            </div>
          </div>
        )}

        <label className="field">
          <span>{kind === 'daily' ? 'Tag' : 'Woche (beliebiger Tag darin)'}</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {kind === 'weekly' && weekStart && (
          <p>{weekLabel(weekStart)} · {formatRange(weekStart)}</p>
        )}
        {kind === 'daily' && (
          <div className="seg" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setDate(today)}>Heute</button>
            <button type="button" onClick={() => setDate(addDays(today, 1))}>Morgen</button>
            <button type="button" onClick={() => setDate(addDays(today, 2))}>Übermorgen</button>
          </div>
        )}

        {kind === 'daily' && (
          <label className="field">
            <span>Uhrzeit (optional)</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>Notiz (optional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </label>

        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn block" type="submit">Speichern</button>

        {editing && (
          <div style={{ marginTop: 10 }}>
            {confirmDelete ? (
              <div className="row">
                <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Abbrechen</button>
                <button
                  type="button"
                  className="btn danger"
                  style={{ flex: 1 }}
                  onClick={() => {
                    onClose();
                    void remove(editing);
                  }}
                >
                  Wirklich löschen
                </button>
              </div>
            ) : (
              <button type="button" className="btn danger block" style={{ marginTop: 0 }} onClick={() => setConfirmDelete(true)}>
                Löschen
              </button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  );
}
