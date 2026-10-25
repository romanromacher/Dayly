'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, diffDays, mondayOf, todayBerlin } from '@/lib/domain/dates';
import type { Category, NotificationView, Settings, Task, WeekReview } from '@/lib/domain/types';
import type { CreateTaskInput, PatchTaskInput } from '@/lib/server/schemas';
import { api, ApiError, newId } from '@/lib/client/api';

export type Tab = 'heute' | 'woche' | 'erfolge';
export type Filter = 'alle' | Category;
export type NewTask = Omit<CreateTaskInput, 'id'>;
export type PatchInput = Omit<PatchTaskInput, 'expectedVersion'>;

interface Toast {
  id: number;
  text: string;
  undoEventId?: string | null;
  error?: boolean;
}

interface Boot {
  today: string;
  window: { from: string; to: string };
  tasks: Task[];
  notifications: NotificationView[];
  reviews: WeekReview[];
  settings: Settings;
}

export interface Store {
  ready: boolean;
  loadError: string | null;
  today: string;
  tasks: Task[];
  notifications: NotificationView[];
  reviews: WeekReview[];
  settings: Settings;
  toast: Toast | null;
  tab: Tab;
  selected: string;
  filter: Filter;
  epoch: number;
  setTab: (t: Tab) => void;
  setSelected: (d: string) => void;
  changeWeek: (n: number) => void;
  setFilter: (f: Filter) => void;
  reload: () => Promise<void>;
  ensureWeek: (weekStart: string) => Promise<void>;
  createTask: (t: NewTask) => Promise<void>;
  patch: (id: string, p: PatchInput, toast?: string) => Promise<void>;
  toggle: (t: Task) => Promise<void>;
  remove: (t: Task) => Promise<void>;
  undo: (eventId: string) => Promise<void>;
  dismissToast: () => void;
  markRead: (id: string, read: boolean) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  recomputeReview: (weekStart: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useDayly(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDayly außerhalb des Providers');
  return c;
}

const anchor = (t: Task) => (t.kind === 'daily' ? t.date : t.weekStart) ?? '';

function applyPatch(t: Task, p: PatchInput): Task {
  const next: Task = { ...t, updatedAt: new Date().toISOString() };
  if (p.title !== undefined) next.title = p.title;
  if (p.notes !== undefined) next.notes = p.notes;
  if (p.category !== undefined) next.category = p.category;
  if (p.time !== undefined && t.kind === 'daily') next.time = p.time;
  if (p.date !== undefined && t.kind === 'daily') next.date = p.date;
  if (p.weekStart !== undefined && t.kind === 'weekly') next.weekStart = mondayOf(p.weekStart);
  if (p.status !== undefined) {
    next.status = p.status;
    next.completedAt = p.status === 'done' ? new Date().toISOString() : null;
  }
  return next;
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Etwas ist schiefgelaufen.');

export function DaylyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayBerlin());
  const [taskMap, setTaskMap] = useState<Record<string, Task>>({});
  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [reviews, setReviews] = useState<WeekReview[]>([]);
  const [settings, setSettings] = useState<Settings>({ carryOverOpen: false });
  const [toast, setToast] = useState<Toast | null>(null);
  const [tab, setTabState] = useState<Tab>('heute');
  const [selected, setSelectedState] = useState(() => todayBerlin());
  const [filter, setFilter] = useState<Filter>('alle');
  const [epoch, setEpoch] = useState(0);

  const loaded = useRef<{ from: string; to: string } | null>(null);
  const queues = useRef(new Map<string, Promise<unknown>>());
  const lastBoot = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayRef = useRef(today);
  todayRef.current = today;

  const showToast = useCallback((text: string, opts: { undoEventId?: string | null; error?: boolean } = {}) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, text, ...opts });
    toastTimer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), opts.undoEventId ? 6000 : 4000);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const reload = useCallback(async () => {
    try {
      const d = await api<Boot>('/api/bootstrap');
      const map: Record<string, Task> = {};
      for (const t of d.tasks) map[t.id] = t;
      setTaskMap(map);
      loaded.current = d.window;
      setNotifications(d.notifications);
      setReviews(d.reviews);
      setSettings(d.settings);
      if (todayRef.current !== d.today) setSelectedState(d.today); // neuer Tag: Auswahl springt auf heute
      setToday(d.today);
      lastBoot.current = Date.now();
      setLoadError(null);
      setReady(true);
      setEpoch((e) => e + 1);
    } catch (e) {
      if (!ready) setLoadError(errMsg(e));
      else showToast(errMsg(e), { error: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Beim Zurückkehren in die App: Datum prüfen und Daten auffrischen (z. B. nach Mitternacht oder Änderungen auf anderem Gerät).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const nowDay = todayBerlin();
      if (nowDay !== todayRef.current || Date.now() - lastBoot.current > 60_000) void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reload]);

  const ensureRange = useCallback(async (from: string, to: string) => {
    const l = loaded.current;
    if (l && from >= l.from && to <= l.to) return;
    let nf = l ? (from < l.from ? from : l.from) : from;
    let nt = l ? (to > l.to ? to : l.to) : to;
    let reset = false;
    if (diffDays(nf, nt) > 380) {
      nf = from;
      nt = to;
      reset = true;
    }
    try {
      const r = await api<{ tasks: Task[] }>(`/api/tasks?from=${nf}&to=${nt}`);
      setTaskMap((prev) => {
        const next: Record<string, Task> = {};
        if (!reset) for (const t of Object.values(prev)) if (anchor(t) < nf || anchor(t) > nt) next[t.id] = t;
        for (const t of r.tasks) next[t.id] = t;
        return next;
      });
      loaded.current = { from: nf, to: nt };
    } catch (e) {
      showToast(errMsg(e), { error: true });
    }
  }, [showToast]);

  const ensureWeek = useCallback((weekStart: string) => ensureRange(weekStart, addDays(weekStart, 6)), [ensureRange]);

  const refreshNotifications = useCallback(async () => {
    try {
      const r = await api<{ notifications: NotificationView[] }>('/api/notifications');
      setNotifications(r.notifications);
    } catch {
      /* nicht kritisch */
    }
  }, []);

  const enqueue = useCallback((id: string, fn: () => Promise<void>) => {
    const prev = queues.current.get(id) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    queues.current.set(id, next);
    return next;
  }, []);

  const fail = useCallback(
    async (e: unknown) => {
      showToast(errMsg(e), { error: true });
      await reload();
    },
    [reload, showToast],
  );

  const createTask = useCallback(
    async (input: NewTask) => {
      const id = newId();
      const now = new Date().toISOString();
      const daily = input.kind === 'daily';
      const weekStart = input.weekStart ? mondayOf(input.weekStart) : undefined;
      const optimistic: Task = {
        id,
        title: input.title,
        notes: input.notes ?? null,
        category: input.category,
        kind: input.kind,
        date: daily ? input.date ?? null : null,
        weekStart: daily ? null : weekStart ?? null,
        time: daily ? input.time ?? null : null,
        dueAt: null,
        priority: input.priority ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        contextTags: input.contextTags ?? [],
        status: 'open',
        completedAt: null,
        originalScheduledDate: daily ? input.date ?? null : null,
        originalWeekStart: daily ? null : weekStart ?? null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      setTaskMap((m) => ({ ...m, [id]: optimistic }));
      await enqueue(id, async () => {
        try {
          const r = await api<{ task: Task; eventId: string | null; deduped: boolean }>('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({ ...input, ...(weekStart ? { weekStart } : {}), id }),
          });
          setTaskMap((m) => {
            const next = { ...m };
            if (r.task.id !== id) delete next[id];
            next[r.task.id] = r.task;
            return next;
          });
          if (r.deduped) showToast('Diese Aufgabe gab es schon – nichts doppelt angelegt.');
        } catch (e) {
          await fail(e);
        }
      });
    },
    [enqueue, fail, showToast],
  );

  const patch = useCallback(
    async (id: string, p: PatchInput, toastText?: string) => {
      setTaskMap((m) => (m[id] ? { ...m, [id]: applyPatch(m[id], p) } : m));
      await enqueue(id, async () => {
        try {
          const r = await api<{ task: Task; eventId: string | null }>(`/api/tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(p),
          });
          setTaskMap((m) => (m[id] ? { ...m, [id]: r.task } : m));
          if (toastText) showToast(toastText, { undoEventId: r.eventId });
          void refreshNotifications();
        } catch (e) {
          await fail(e);
        }
      });
    },
    [enqueue, fail, refreshNotifications, showToast],
  );

  const toggle = useCallback((t: Task) => patch(t.id, { status: t.status === 'done' ? 'open' : 'done' }), [patch]);

  const remove = useCallback(
    async (t: Task) => {
      setTaskMap((m) => {
        const next = { ...m };
        delete next[t.id];
        return next;
      });
      await enqueue(t.id, async () => {
        try {
          const r = await api<{ eventId: string }>(`/api/tasks/${t.id}`, { method: 'DELETE' });
          showToast('Aufgabe gelöscht', { undoEventId: r.eventId });
          void refreshNotifications();
        } catch (e) {
          await fail(e);
        }
      });
    },
    [enqueue, fail, refreshNotifications, showToast],
  );

  const undo = useCallback(
    async (eventId: string) => {
      setToast(null);
      try {
        await api(`/api/events/${eventId}/undo`, { method: 'POST' });
        await reload();
        showToast('Rückgängig gemacht');
      } catch (e) {
        showToast(errMsg(e), { error: true });
      }
    },
    [reload, showToast],
  );

  const markRead = useCallback(
    async (id: string, read: boolean) => {
      const stamp = read ? new Date().toISOString() : null;
      setNotifications((n) => n.map((x) => (x.id === id ? { ...x, readAt: stamp } : x)));
      try {
        await api(`/api/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ read }) });
      } catch (e) {
        showToast(errMsg(e), { error: true });
        void refreshNotifications();
      }
    },
    [refreshNotifications, showToast],
  );

  const updateSettings = useCallback(
    async (s: Partial<Settings>) => {
      setSettings((cur) => ({ ...cur, ...s }));
      try {
        const r = await api<{ settings: Settings }>('/api/settings', { method: 'PATCH', body: JSON.stringify(s) });
        setSettings(r.settings);
      } catch (e) {
        showToast(errMsg(e), { error: true });
        void reload();
      }
    },
    [reload, showToast],
  );

  const recomputeReview = useCallback(
    async (weekStart: string) => {
      try {
        const r = await api<{ review: WeekReview }>(`/api/reviews/${weekStart}/recompute`, { method: 'POST' });
        setReviews((list) => [...list.filter((x) => x.weekStart !== weekStart), r.review].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
        showToast('Rückblick neu berechnet');
      } catch (e) {
        showToast(errMsg(e), { error: true });
      }
    },
    [showToast],
  );

  const logout = useCallback(async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }, []);

  const setTab = useCallback(
    (t: Tab) => {
      setTabState(t);
      if (t === 'heute') setSelectedState(todayRef.current);
      window.scrollTo({ top: 0 });
    },
    [],
  );

  const setSelected = useCallback((d: string) => setSelectedState(d), []);

  const changeWeek = useCallback((n: number) => {
    setSelectedState((s) => addDays(mondayOf(s), 7 * n));
  }, []);

  const tasks = useMemo(() => Object.values(taskMap), [taskMap]);

  const value: Store = {
    ready, loadError, today, tasks, notifications, reviews, settings, toast, tab, selected, filter, epoch,
    setTab, setSelected, changeWeek, setFilter, reload, ensureWeek, createTask, patch, toggle, remove, undo,
    dismissToast, markRead, updateSettings, recomputeReview, logout,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
