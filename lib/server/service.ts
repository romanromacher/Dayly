import { randomUUID } from 'node:crypto';
import { addDays, diffDays, mondayOf, isoWeekOf, weekKey } from '@/lib/domain/dates';
import { dueNotices, notificationAnchor } from '@/lib/domain/notifications';
import { computeWeekStats, hasContent, makeReview } from '@/lib/domain/reviews';
import type { NotificationRow, NotificationView, Task, TaskEvent, WeekReview } from '@/lib/domain/types';
import { ConflictError, NotFoundError, ValidationError, type Repo, type TaskPatch } from './repo';
import type { CreateTaskInput, PatchTaskInput } from './schemas';

type Source = TaskEvent['source'];
interface Ctx {
  source?: Source;
  batchId?: string | null;
  now?: Date;
}

const DUPLICATE_WINDOW_MS = 15_000;

function newEvent(taskId: string, type: TaskEvent['type'], before: Task | null, after: Task | null, ctx: Ctx, nowIso: string): TaskEvent {
  return {
    id: randomUUID(), taskId, type, source: ctx.source ?? 'user', batchId: ctx.batchId ?? null,
    before, after, createdAt: nowIso, undoneAt: null,
  };
}

/* ------------------------------------------------------------------ Aufgaben */

export function buildNewTask(input: CreateTaskInput, nowIso: string): Task {
  const daily = input.kind === 'daily';
  const date = daily ? input.date ?? null : null;
  const weekStart = daily ? null : mondayOf(input.weekStart!);
  return {
    id: input.id ?? randomUUID(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    category: input.category,
    kind: input.kind,
    date,
    weekStart,
    time: daily ? input.time ?? null : null,
    dueAt: null,
    priority: input.priority ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    contextTags: input.contextTags ?? [],
    status: 'open',
    completedAt: null,
    originalScheduledDate: date,
    originalWeekStart: weekStart,
    createdAt: nowIso,
    updatedAt: nowIso,
    version: 1,
  };
}

export async function createTask(repo: Repo, input: CreateTaskInput, ctx: Ctx = {}) {
  const now = ctx.now ?? new Date();
  const nowIso = now.toISOString();

  // Wiederholter Aufruf mit derselben ID (z. B. nach Netzabbruch) legt nichts doppelt an.
  if (input.id) {
    const existing = await repo.getTask(input.id);
    if (existing) return { task: existing, eventId: null as string | null, deduped: true };
  }

  const task = buildNewTask(input, nowIso);

  // Schutz vor versehentlichem Doppel-Tippen: gleiche offene Aufgabe in den letzten Sekunden.
  const ref = task.date ?? task.weekStart!;
  const sameDay = await repo.listTasksInRange(ref, ref);
  const dup = sameDay.find(
    (t) =>
      t.kind === task.kind && t.category === task.category && t.status === 'open' &&
      t.title.trim().toLowerCase() === task.title.toLowerCase() &&
      (t.date ?? t.weekStart) === ref &&
      now.getTime() - new Date(t.createdAt).getTime() < DUPLICATE_WINDOW_MS,
  );
  if (dup) return { task: dup, eventId: null as string | null, deduped: true };

  const saved = await repo.insertTask(task);
  const event = newEvent(saved.id, 'create', null, saved, ctx, nowIso);
  await repo.insertEvent(event);
  return { task: saved, eventId: event.id as string | null, deduped: false };
}

function buildPatch(cur: Task, input: PatchTaskInput, nowIso: string): TaskPatch {
  const p: TaskPatch = {};
  if (cur.kind === 'daily' && input.weekStart !== undefined) throw new ValidationError('Tagesaufgaben haben keine Wochenzuordnung.');
  if (cur.kind === 'weekly' && (input.date !== undefined || (input.time !== undefined && input.time !== null)))
    throw new ValidationError('Wochenziele haben weder Tag noch Uhrzeit.');

  if (input.title !== undefined && input.title.trim() !== cur.title) p.title = input.title.trim();
  if (input.notes !== undefined && (input.notes?.trim() || null) !== cur.notes) p.notes = input.notes?.trim() || null;
  if (input.category !== undefined && input.category !== cur.category) p.category = input.category;
  if (input.date !== undefined && input.date !== cur.date) p.date = input.date;
  if (input.weekStart !== undefined) {
    const ws = mondayOf(input.weekStart);
    if (ws !== cur.weekStart) p.weekStart = ws;
  }
  if (input.time !== undefined && input.time !== cur.time) p.time = input.time;
  if (input.priority !== undefined && input.priority !== cur.priority) p.priority = input.priority;
  if (input.estimatedMinutes !== undefined && input.estimatedMinutes !== cur.estimatedMinutes) p.estimatedMinutes = input.estimatedMinutes;
  if (input.contextTags !== undefined && JSON.stringify(input.contextTags) !== JSON.stringify(cur.contextTags)) p.contextTags = input.contextTags;
  if (input.status !== undefined && input.status !== cur.status) {
    p.status = input.status;
    p.completedAt = input.status === 'done' ? nowIso : null;
  }
  if (Object.keys(p).length) p.updatedAt = nowIso;
  return p;
}

async function resolveNotificationsForTask(repo: Repo, taskId: string, nowIso: string) {
  const active = await repo.listActiveNotifications();
  const ids = active.filter((n) => n.taskId === taskId).map((n) => n.id);
  if (ids.length) await repo.resolveNotifications(ids, nowIso);
}

export async function patchTask(repo: Repo, id: string, input: PatchTaskInput, ctx: Ctx = {}) {
  const nowIso = (ctx.now ?? new Date()).toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await repo.getTask(id);
    if (!cur) throw new NotFoundError('Aufgabe nicht gefunden.');
    if (input.expectedVersion !== undefined && input.expectedVersion !== cur.version) throw new ConflictError();

    const patch = buildPatch(cur, input, nowIso);
    if (!Object.keys(patch).length) return { task: cur, eventId: null as string | null, unchanged: true };

    const updated = await repo.updateTask(id, patch, cur.version);
    if (!updated) {
      if (input.expectedVersion !== undefined) throw new ConflictError();
      continue; // gleichzeitige Änderung: einmal mit frischer Version erneut versuchen
    }
    const event = newEvent(id, 'update', cur, updated, ctx, nowIso);
    await repo.insertEvent(event);
    if (patch.status === 'done') await resolveNotificationsForTask(repo, id, nowIso);
    return { task: updated, eventId: event.id as string | null, unchanged: false };
  }
  throw new ConflictError();
}

export async function deleteTask(repo: Repo, id: string, ctx: Ctx = {}) {
  const nowIso = (ctx.now ?? new Date()).toISOString();
  const removed = await repo.deleteTask(id);
  if (!removed) throw new NotFoundError('Aufgabe nicht gefunden.');
  const event = newEvent(id, 'delete', removed, null, ctx, nowIso);
  await repo.insertEvent(event);
  return { eventId: event.id };
}

/** Macht eine einzelne protokollierte Änderung rückgängig. */
export async function undoEvent(repo: Repo, eventId: string, now = new Date()) {
  const nowIso = now.toISOString();
  const ev = await repo.getEvent(eventId);
  if (!ev) throw new NotFoundError('Änderung nicht gefunden.');
  if (ev.undoneAt) throw new ConflictError('Diese Änderung wurde schon rückgängig gemacht.');
  if (!(await repo.markEventUndone(eventId, nowIso))) throw new ConflictError('Diese Änderung wurde schon rückgängig gemacht.');

  if (ev.type === 'create') {
    await repo.deleteTask(ev.taskId);
    return { task: null as Task | null };
  }
  if (ev.type === 'delete') {
    if (!ev.before) throw new ValidationError('Der Verlauf ist unvollständig.');
    if (await repo.getTask(ev.taskId)) throw new ConflictError('Die Aufgabe existiert bereits.');
    const restored = await repo.insertTask({ ...ev.before, updatedAt: nowIso });
    return { task: restored as Task | null };
  }
  // update
  const cur = await repo.getTask(ev.taskId);
  if (!cur) throw new NotFoundError('Die Aufgabe existiert nicht mehr.');
  if (!ev.before) throw new ValidationError('Der Verlauf ist unvollständig.');
  const { id: _id, createdAt: _c, version: _v, ...fields } = ev.before;
  void _id; void _c; void _v;
  const restored = await repo.updateTask(ev.taskId, { ...fields, updatedAt: nowIso }, cur.version);
  if (!restored) throw new ConflictError();
  if (restored.status === 'done') await resolveNotificationsForTask(repo, restored.id, nowIso);
  return { task: restored as Task | null };
}

/* -------------------------------------------------- Optionale Übernahme offener Aufgaben */

export async function carryOverOpenTasks(repo: Repo, today: string): Promise<number> {
  const settings = await repo.getSettings();
  if (!settings.carryOverOpen) return 0;
  const open = await repo.listOpenTasks();
  const stale = open.filter((t) => t.kind === 'daily' && t.date! < today);
  const batchId = randomUUID();
  for (const t of stale) await patchTask(repo, t.id, { date: today }, { source: 'system', batchId });
  return stale.length;
}

/* ------------------------------------------------------------ 21-Tage-Benachrichtigungen */

/** Erzeugt fehlende Erinnerungen (idempotent) und löst Erinnerungen für erledigte Aufgaben auf. */
export async function syncNotifications(repo: Repo, today: string, now = new Date()) {
  const open = await repo.listOpenTasks();
  const active = await repo.listActiveNotifications();
  const nowIso = now.toISOString();

  const withActive = new Set(active.map((n) => n.taskId));
  const rows: NotificationRow[] = dueNotices(open, today)
    .filter((t) => !withActive.has(t.id))
    .map((t) => {
      const ref = t.kind === 'daily' ? t.originalScheduledDate! : t.originalWeekStart!;
      return {
        id: randomUUID(), taskId: t.id, type: 'open_21_days' as const, originalWeek: weekKey(ref),
        originalDate: notificationAnchor(t)!, createdAt: nowIso, readAt: null, dismissedAt: null, resolvedAt: null,
      };
    });
  const created = rows.length ? await repo.insertNotifications(rows) : 0;

  const openIds = new Set(open.map((t) => t.id));
  const stale = active.filter((n) => !openIds.has(n.taskId));
  if (stale.length) await repo.resolveNotifications(stale.map((n) => n.id), nowIso);
  return { created, resolved: stale.length };
}

export async function listNotificationViews(repo: Repo, today: string): Promise<NotificationView[]> {
  const active = await repo.listActiveNotifications();
  const tasks = new Map((await repo.getTasksByIds(active.map((n) => n.taskId))).map((t) => [t.id, t]));
  const views: NotificationView[] = [];
  for (const n of active) {
    const t = tasks.get(n.taskId);
    if (!t || t.status !== 'open') continue;
    const ref = t.kind === 'daily' ? t.originalScheduledDate : t.originalWeekStart;
    if (!ref) continue;
    const { year, week } = isoWeekOf(ref);
    const daysOpen = diffDays(n.originalDate, today);
    views.push({
      id: n.id, taskId: t.id, title: t.title, category: t.category, kind: t.kind,
      originalWeekLabel: `KW ${week}`, originalIsoYear: year, originalDate: n.originalDate,
      daysOpen, weeksOpen: Math.floor(daysOpen / 7), readAt: n.readAt, createdAt: n.createdAt,
      currentDate: t.date, currentWeekStart: t.weekStart,
    });
  }
  // Ungelesene zuerst, dann die ältesten
  return views.sort((a, b) => Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)) || a.originalDate.localeCompare(b.originalDate));
}

/* --------------------------------------------------------------------- Wochenrückblicke */

/**
 * Stellt sicher, dass für abgeschlossene Wochen (die letzten `count`) ein gespeicherter Rückblick existiert.
 * Wochen ohne jede Aufgabe bekommen keinen Rückblick. Bestehende Rückblicke werden nie neu berechnet.
 */
export async function ensureReviews(repo: Repo, today: string, count = 12, now = new Date()): Promise<WeekReview[]> {
  const current = mondayOf(today);
  const weeks = Array.from({ length: count }, (_, i) => addDays(current, -7 * (i + 1)));
  const existing = new Map((await repo.getReviews(weeks)).map((r) => [r.weekStart, r]));
  const missing = weeks.filter((w) => !existing.has(w));

  if (missing.length) {
    const from = missing[missing.length - 1];
    const to = addDays(missing[0], 6);
    const tasks = await repo.listTasksInRange(from, to);
    for (const w of missing) {
      const stats = computeWeekStats(tasks, w);
      if (!hasContent(stats)) continue;
      const review = makeReview(w, stats, now.toISOString());
      if (!(await repo.insertReview(review))) {
        const stored = (await repo.getReviews([w]))[0];
        if (stored) existing.set(w, stored);
      } else {
        existing.set(w, review);
      }
    }
  }
  return [...existing.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** Nur auf ausdrücklichen Wunsch: Rückblick einer abgeschlossenen Woche neu berechnen. */
export async function recomputeReview(repo: Repo, weekStart: string, today: string, now = new Date()): Promise<WeekReview> {
  if (mondayOf(weekStart) !== weekStart) throw new ValidationError('weekStart muss ein Montag sein.');
  if (weekStart >= mondayOf(today)) throw new ValidationError('Laufende Wochen haben noch keinen gespeicherten Rückblick.');
  const tasks = await repo.listTasksInRange(weekStart, addDays(weekStart, 6));
  const review = makeReview(weekStart, computeWeekStats(tasks, weekStart), now.toISOString());
  await repo.replaceReview(review);
  return review;
}
