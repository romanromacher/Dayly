import { randomUUID } from 'node:crypto';
import { mondayOf } from '@/lib/domain/dates';
import type { Repo } from '@/lib/server/repo';
import { createTaskSchema } from '@/lib/server/schemas';
import { createTask, patchTask } from '@/lib/server/service';
import { findDuplicate } from './plan';
import type { Action } from './schema';

export interface ApplyResult {
  index: number;
  ok: boolean;
  eventId?: string | null;
  error?: string;
}

/**
 * Führt bestätigte Vorschläge aus. Jede Änderung läuft durch dieselbe Service-Schicht wie
 * Änderungen von Hand (Prüfungen, Versionierung, Protokoll), mit Quelle "ai" und gemeinsamer batch_id.
 */
export async function applyActions(repo: Repo, actions: Action[]): Promise<{ batchId: string; results: ApplyResult[] }> {
  const batchId = randomUUID();
  const ctx = { source: 'ai' as const, batchId };
  const results: ApplyResult[] = [];

  for (let index = 0; index < actions.length; index++) {
    const a = actions[index];
    try {
      if (a.op === 'create') {
        if (await findDuplicate(repo, a.kind, a.date, a.title)) {
          results.push({ index, ok: false, error: `„${a.title}“ gibt es schon.` });
          continue;
        }
        const input = createTaskSchema.parse(
          a.kind === 'daily'
            ? { kind: 'daily', category: a.category, title: a.title, date: a.date, time: a.time ?? null, notes: a.notes ?? null }
            : { kind: 'weekly', category: a.category, title: a.title, weekStart: mondayOf(a.date), notes: a.notes ?? null },
        );
        const r = await createTask(repo, input, ctx);
        results.push({ index, ok: true, eventId: r.eventId });
      } else if (a.op === 'complete') {
        const r = await patchTask(repo, a.taskId, { status: a.done ? 'done' : 'open' }, ctx);
        results.push({ index, ok: true, eventId: r.eventId });
      } else {
        const task = await repo.getTask(a.taskId);
        if (!task) {
          results.push({ index, ok: false, error: 'Aufgabe nicht gefunden.' });
          continue;
        }
        const patch: Parameters<typeof patchTask>[2] = {};
        if (a.title !== undefined) patch.title = a.title;
        if (a.category !== undefined) patch.category = a.category;
        if (a.notes !== undefined) patch.notes = a.notes;
        if (a.date !== undefined) {
          if (task.kind === 'daily') patch.date = a.date;
          else patch.weekStart = mondayOf(a.date);
        }
        if (a.time !== undefined && task.kind === 'daily') patch.time = a.time;
        const r = await patchTask(repo, a.taskId, patch, ctx);
        results.push({ index, ok: true, eventId: r.eventId });
      }
    } catch (e) {
      results.push({ index, ok: false, error: e instanceof Error ? e.message : 'Fehlgeschlagen.' });
    }
  }
  return { batchId, results };
}
