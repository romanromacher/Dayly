import type { NotificationRow, Settings, Task, TaskEvent, WeekReview } from '@/lib/domain/types';

export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt' | 'version'>>;

/**
 * Speicherschicht. Es gibt zwei Implementierungen:
 *  - Supabase (Produktion)
 *  - lokale JSON-Datei (nur Entwicklung, DATA_BACKEND=file)
 * Alle Fachregeln liegen in service.ts, damit beide identisch funktionieren.
 */
export interface Repo {
  listTasksInRange(from: string, to: string): Promise<Task[]>;
  listOpenTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  getTasksByIds(ids: string[]): Promise<Task[]>;
  insertTask(task: Task): Promise<Task>;
  /** Gibt null zurück, wenn keine Aufgabe mit dieser ID UND Version existiert (Konflikt oder nicht vorhanden). */
  updateTask(id: string, patch: TaskPatch, expectedVersion: number): Promise<Task | null>;
  deleteTask(id: string): Promise<Task | null>;

  insertEvent(event: TaskEvent): Promise<void>;
  getEvent(id: string): Promise<TaskEvent | null>;
  markEventUndone(id: string, at: string): Promise<boolean>;

  listActiveNotifications(): Promise<NotificationRow[]>;
  /** Fügt nur Zeilen ein, für die noch keine aktive Erinnerung (Aufgabe + Typ) existiert. */
  insertNotifications(rows: NotificationRow[]): Promise<number>;
  resolveNotifications(ids: string[], at: string): Promise<void>;
  setNotificationRead(id: string, readAt: string | null): Promise<NotificationRow | null>;

  getReviews(weekStarts: string[]): Promise<WeekReview[]>;
  /** Legt nur an, wenn noch kein Rückblick für diese Woche existiert. Gibt true zurück, wenn neu angelegt. */
  insertReview(review: WeekReview): Promise<boolean>;
  replaceReview(review: WeekReview): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}

export class ConflictError extends Error {
  constructor(message = 'Die Aufgabe wurde inzwischen geändert.') {
    super(message);
    this.name = 'ConflictError';
  }
}
export class NotFoundError extends Error {
  constructor(message = 'Nicht gefunden.') {
    super(message);
    this.name = 'NotFoundError';
  }
}
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
