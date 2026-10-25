'use client';

import { useEffect, useState } from 'react';
import { Bell, CalendarDays, CheckCheck, House, Mic, Settings, Trophy } from 'lucide-react';
import { formatDayLong, mondayOf } from '@/lib/domain/dates';
import type { Kind, NotificationView, Task } from '@/lib/domain/types';
import { api } from '@/lib/client/api';
import { AssistantSheet } from './AssistantSheet';
import { NoticePanel } from './NoticePanel';
import { SettingsSheet } from './SettingsSheet';
import { DaylyProvider, useDayly, type Tab } from './store';
import { SuccessView } from './SuccessView';
import { TaskSheet, type TaskSheetState } from './TaskSheet';
import { TodayView } from './TodayView';
import { WeekView } from './WeekView';

const HEAD: Record<Tab, [string, string]> = {
  heute: ['Dein Tag. Dein Tempo.', 'Konzentriere dich auf das, was heute zählt.'],
  woche: ['Alles im Blick.', 'Plane deine Tage. Erreiche deine Wochenziele.'],
  erfolge: ['Deine Erfolge.', 'Sieh, was du Woche für Woche geschafft hast.'],
};

type Overlay = null | { type: 'task'; state: TaskSheetState } | { type: 'settings' } | { type: 'assistant' };

export default function AppShell() {
  return (
    <DaylyProvider>
      <Shell />
    </DaylyProvider>
  );
}

function Shell() {
  const { ready, loadError, reload, today, tab, setTab, selected, setSelected, notifications, toast, undo, dismissToast, ensureWeek, epoch } = useDayly();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [bell, setBell] = useState(false);

  // Daten für die angezeigte Woche sicherstellen (auch beim Blättern in andere Wochen).
  const week = mondayOf(selected);
  useEffect(() => {
    if (ready) void ensureWeek(week);
  }, [ready, week, epoch, ensureWeek]);

  if (!ready) {
    return (
      <main className="app">
        <div className="center">
          <div>
            <div className="brand" style={{ justifyContent: 'center' }}><span className="logo"><CheckCheck size={20} /></span>dayly.</div>
            {loadError ? (
              <>
                <p style={{ marginTop: 18 }}>{loadError}</p>
                <button className="btn" onClick={() => void reload()}>Erneut versuchen</button>
              </>
            ) : (
              <div style={{ marginTop: 22 }}><div className="spin" /><p>Lade deine Aufgaben …</p></div>
            )}
          </div>
        </div>
      </main>
    );
  }

  const unread = notifications.filter((n) => !n.readAt).length;
  const openNew = (kind: Kind) => setOverlay({ type: 'task', state: { kind } });
  const openEdit = (task: Task) => setOverlay({ type: 'task', state: { task } });
  const openFromNotice = async (n: NotificationView) => {
    const anchor = n.currentDate ?? n.currentWeekStart;
    if (!anchor) return;
    setTab('woche');
    setSelected(anchor);
    setBell(false);
    try {
      const r = await api<{ tasks: Task[] }>(`/api/tasks?from=${anchor}&to=${anchor}`);
      const t = r.tasks.find((x) => x.id === n.taskId);
      if (t) setOverlay({ type: 'task', state: { task: t } });
    } catch {
      /* Ansicht ist trotzdem auf der richtigen Woche */
    }
  };
  const [h1, sub] = HEAD[tab];

  return (
    <>
      <main className="app">
        <header className="header">
          <div className="brand"><span className="logo"><CheckCheck size={20} strokeWidth={2.6} /></span>dayly.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button className="icon-btn" onClick={() => setBell((b) => !b)} aria-label={`Benachrichtigungen${unread ? `, ${unread} ungelesen` : ''}`} aria-expanded={bell}>
              <Bell size={19} />
              {unread > 0 && <span className="count">{unread}</span>}
            </button>
            <button className="icon-btn plain" onClick={() => setOverlay({ type: 'settings' })} aria-label="Einstellungen"><Settings size={22} /></button>
          </div>
        </header>

        {bell && <NoticePanel onOpenTask={openFromNotice} />}

        <section className="section">
          <div className="eyebrow">{formatDayLong(today)}</div>
          <h1>{h1}</h1>
          <p>{sub}</p>
        </section>

        {tab === 'heute' && <TodayView onNew={openNew} onEdit={openEdit} />}
        {tab === 'woche' && <WeekView onNew={openNew} onEdit={openEdit} />}
        {tab === 'erfolge' && <SuccessView />}

        <nav className="nav" aria-label="Hauptnavigation">
          {([['heute', 'Heute', House], ['woche', 'Woche', CalendarDays], ['erfolge', 'Erfolge', Trophy]] as const).map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
      </main>

      <button className="fab" onClick={() => setOverlay({ type: 'assistant' })} aria-label="KI-Assistent öffnen"><Mic size={22} /></button>

      {toast && (
        <div className={`toast ${toast.error ? 'error' : ''}`} role="status">
          <span>{toast.text}</span>
          {toast.undoEventId ? <button onClick={() => void undo(toast.undoEventId!)}>Rückgängig</button> : <button onClick={dismissToast} aria-label="Schließen">OK</button>}
        </div>
      )}

      {overlay?.type === 'task' && <TaskSheet state={overlay.state} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'settings' && <SettingsSheet onClose={() => setOverlay(null)} />}
      {overlay?.type === 'assistant' && <AssistantSheet onClose={() => setOverlay(null)} />}
    </>
  );
}
