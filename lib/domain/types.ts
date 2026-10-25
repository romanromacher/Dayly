export type Category = 'business' | 'private';
export type Kind = 'daily' | 'weekly';
export type Status = 'open' | 'done';

/** Eine Aufgabe. Datumsfelder sind Kalendertage im Format YYYY-MM-DD (Zeitzone Europe/Berlin). */
export interface Task {
  id: string;
  title: string;
  notes: string | null;
  category: Category;
  kind: Kind;
  /** Nur bei kind = 'daily'. */
  date: string | null;
  /** Nur bei kind = 'weekly': Montag der Kalenderwoche. */
  weekStart: string | null;
  /** HH:MM, nur bei kind = 'daily'. */
  time: string | null;
  dueAt: string | null;
  priority: 1 | 2 | 3 | null;
  estimatedMinutes: number | null;
  contextTags: string[];
  status: Status;
  completedAt: string | null;
  /** Ursprünglich geplanter Tag. Bleibt beim Verschieben unverändert. Nur daily. */
  originalScheduledDate: string | null;
  /** Ursprünglich geplante Zielwoche (Montag). Bleibt beim Verschieben unverändert. Nur weekly. */
  originalWeekStart: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type NotificationType = 'open_21_days';

export interface NotificationRow {
  id: string;
  taskId: string;
  type: NotificationType;
  /** Ursprüngliche ISO-Woche, z. B. "2026-W17". */
  originalWeek: string;
  /** Ausgangspunkt der 21 Tage (YYYY-MM-DD). */
  originalDate: string;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
}

/** Aufbereitet für die Glocke in der App. */
export interface NotificationView {
  id: string;
  taskId: string;
  title: string;
  category: Category;
  kind: Kind;
  /** "KW 17" – die ursprünglich geplante Kalenderwoche. */
  originalWeekLabel: string;
  originalIsoYear: number;
  originalDate: string;
  daysOpen: number;
  weeksOpen: number;
  readAt: string | null;
  createdAt: string;
  /** Wo die Aufgabe jetzt liegt (nach Verschiebungen). */
  currentDate: string | null;
  currentWeekStart: string | null;
}

export interface WeekStats {
  dailyTotal: number;
  dailyDone: number;
  businessTotal: number;
  businessDone: number;
  privateTotal: number;
  privateDone: number;
  goalsTotal: number;
  goalsDone: number;
}

export interface WeekReview extends WeekStats {
  weekStart: string;
  isoYear: number;
  isoWeek: number;
  summary: string;
  /** null, solange die Woche noch läuft (Live-Werte). */
  finalizedAt: string | null;
  ruleVersion: number;
}

export interface Settings {
  carryOverOpen: boolean;
}

export type EventType = 'create' | 'update' | 'delete';

export interface TaskEvent {
  id: string;
  taskId: string;
  type: EventType;
  source: 'user' | 'ai' | 'system';
  batchId: string | null;
  before: Task | null;
  after: Task | null;
  createdAt: string;
  undoneAt: string | null;
}

export const OPEN_THRESHOLD_DAYS = 21;
