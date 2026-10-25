'use client';

import { useState } from 'react';
import { mondayOf, weekLabel } from '@/lib/domain/dates';
import { openDurationLabel } from '@/lib/domain/notifications';
import type { NotificationView } from '@/lib/domain/types';
import { useDayly } from './store';

export function NoticePanel({ onOpenTask }: { onOpenTask: (n: NotificationView) => void }) {
  const { notifications, markRead, patch, today } = useDayly();
  const [confirm, setConfirm] = useState<string | null>(null);

  function move(n: NotificationView) {
    setConfirm(null);
    void patch(n.taskId, n.kind === 'daily' ? { date: today } : { weekStart: mondayOf(today) }, 'Auf heute bzw. diese Woche verschoben');
  }

  return (
    <div className="notices" role="region" aria-label="Benachrichtigungen">
      <div className="line">
        <strong>Benachrichtigungen</strong>
        <span className="muted">Seit 21+ Tagen offen</span>
      </div>
      {notifications.length === 0 && <p style={{ marginTop: 10 }}>Alles im grünen Bereich – keine Aufgabe ist seit 21 Tagen oder länger offen.</p>}
      {notifications.map((n) => (
        <div key={n.id} className={`notice ${n.readAt ? 'read' : ''}`}>
          <strong>
            {n.title}
            <span className="kw">{n.originalWeekLabel}{n.originalIsoYear ? ` · ${n.originalIsoYear}` : ''}</span>
          </strong>
          <small>
            Ursprünglich geplant in {n.originalWeekLabel} ({n.kind === 'weekly' ? 'Wochenziel' : 'Tagesaufgabe'}) · {openDurationLabel(n.daysOpen)} ({n.daysOpen} Tage).
            {n.currentWeekStart && n.kind === 'weekly' && n.currentWeekStart !== mondayOf(n.originalDate) ? ` Jetzt in ${weekLabel(n.currentWeekStart)}.` : ''}
          </small>
          <div className="actions">
            <button className="primary" onClick={() => onOpenTask(n)}>Öffnen</button>
            {confirm === n.id ? (
              <>
                <button onClick={() => move(n)}>Ja, verschieben</button>
                <button onClick={() => setConfirm(null)}>Abbrechen</button>
              </>
            ) : (
              <button onClick={() => setConfirm(n.id)}>Auf heute verschieben</button>
            )}
            <button onClick={() => void markRead(n.id, !n.readAt)}>{n.readAt ? 'Als ungelesen' : 'Als gelesen markieren'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
