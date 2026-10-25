import { promises as fs } from 'node:fs';
import path from 'node:path';
import { mondayOf } from '@/lib/domain/dates';
import type { NotificationRow, Settings, Task, TaskEvent, WeekReview } from '@/lib/domain/types';
import type { Repo, TaskPatch } from './repo';

/**
 * Lokale JSON-Datei – NUR für die Entwicklung ohne Supabase (DATA_BACKEND=file).
 * Auf Servern ohne dauerhaftes Dateisystem (z. B. Vercel) geht der Inhalt verloren.
 */
interface Db {
  tasks: Task[];
  events: TaskEvent[];
  notifications: NotificationRow[];
  reviews: WeekReview[];
  settings: Settings;
}

const FILE = path.join(process.cwd(), '.data', 'dayly.json');
let chain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Db;
  } catch {
    return { tasks: [], events: [], notifications: [], reviews: [], settings: { carryOverOpen: false } };
  }
}

async function save(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, FILE);
}

/** Alle Zugriffe laufen nacheinander, damit parallele Requests sich nicht überschreiben. */
function tx<T>(fn: (db: Db) => T | Promise<T>, write = false): Promise<T> {
  const run = chain.then(async () => {
    const db = await load();
    const result = await fn(db);
    if (write) await save(db);
    return result;
  });
  chain = run.catch(() => undefined);
  return run;
}

const byCreated = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt);

export function createFileRepo(): Repo {
  return {
    listTasksInRange: (from, to) =>
      tx((db) => {
        const wf = mondayOf(from);
        return db.tasks
          .filter((t) => (t.kind === 'daily' ? t.date! >= from && t.date! <= to : t.weekStart! >= wf && t.weekStart! <= to))
          .sort(byCreated);
      }),
    listOpenTasks: () => tx((db) => db.tasks.filter((t) => t.status === 'open').sort(byCreated)),
    getTask: (id) => tx((db) => db.tasks.find((t) => t.id === id) ?? null),
    getTasksByIds: (ids) => tx((db) => db.tasks.filter((t) => ids.includes(t.id))),
    insertTask: (task) =>
      tx((db) => {
        if (db.tasks.some((t) => t.id === task.id)) throw new Error('Aufgabe existiert bereits.');
        db.tasks.push(task);
        return task;
      }, true),
    updateTask: (id, patch: TaskPatch, expectedVersion) =>
      tx((db) => {
        const i = db.tasks.findIndex((t) => t.id === id && t.version === expectedVersion);
        if (i < 0) return null;
        db.tasks[i] = { ...db.tasks[i], ...patch, version: expectedVersion + 1 };
        return db.tasks[i];
      }, true),
    deleteTask: (id) =>
      tx((db) => {
        const i = db.tasks.findIndex((t) => t.id === id);
        if (i < 0) return null;
        const [removed] = db.tasks.splice(i, 1);
        db.notifications = db.notifications.filter((n) => n.taskId !== id); // wie ON DELETE CASCADE
        return removed;
      }, true),

    insertEvent: (event) => tx((db) => void db.events.push(event), true),
    getEvent: (id) => tx((db) => db.events.find((e) => e.id === id) ?? null),
    markEventUndone: (id, at) =>
      tx((db) => {
        const e = db.events.find((x) => x.id === id && !x.undoneAt);
        if (!e) return false;
        e.undoneAt = at;
        return true;
      }, true),

    listActiveNotifications: () =>
      tx((db) => db.notifications.filter((n) => !n.resolvedAt && !n.dismissedAt).sort((a, b) => a.originalDate.localeCompare(b.originalDate))),
    insertNotifications: (rows) =>
      tx((db) => {
        let n = 0;
        for (const r of rows) {
          const exists = db.notifications.some((x) => x.taskId === r.taskId && x.type === r.type && !x.resolvedAt && !x.dismissedAt);
          if (!exists) {
            db.notifications.push(r);
            n++;
          }
        }
        return n;
      }, true),
    resolveNotifications: (ids, at) =>
      tx((db) => {
        for (const n of db.notifications) if (ids.includes(n.id)) n.resolvedAt = at;
      }, true),
    setNotificationRead: (id, readAt) =>
      tx((db) => {
        const n = db.notifications.find((x) => x.id === id);
        if (!n) return null;
        n.readAt = readAt;
        return n;
      }, true),

    getReviews: (weekStarts) => tx((db) => db.reviews.filter((r) => weekStarts.includes(r.weekStart))),
    insertReview: (review) =>
      tx((db) => {
        if (db.reviews.some((r) => r.weekStart === review.weekStart)) return false;
        db.reviews.push(review);
        return true;
      }, true),
    replaceReview: (review) =>
      tx((db) => {
        db.reviews = db.reviews.filter((r) => r.weekStart !== review.weekStart);
        db.reviews.push(review);
      }, true),

    getSettings: () => tx((db) => db.settings),
    updateSettings: (patch) =>
      tx((db) => {
        db.settings = { ...db.settings, ...patch };
        return db.settings;
      }, true),
  };
}
