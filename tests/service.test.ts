import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Repo } from '@/lib/server/repo';

let repo: Repo;
let svc: typeof import('@/lib/server/service');

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'dayly-')));
  const { createFileRepo } = await import('@/lib/server/repo-file');
  svc = await import('@/lib/server/service');
  repo = createFileRepo();
});

const daily = (title: string, date: string) => ({ kind: 'daily' as const, category: 'business' as const, title, date });

describe('Service', () => {
  it('legt idempotent an und verhindert schnelle Dubletten', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const a = await svc.createTask(repo, { ...daily('Doppelt', '2026-05-12'), id });
    const b = await svc.createTask(repo, { ...daily('Doppelt', '2026-05-12'), id });
    expect(a.deduped).toBe(false);
    expect(b.deduped).toBe(true);
    const c = await svc.createTask(repo, daily('Doppelt', '2026-05-12'));
    expect(c.deduped).toBe(true);
    expect((await repo.listTasksInRange('2026-05-12', '2026-05-12')).length).toBe(1);
  });

  it('Verschieben behält den ursprünglichen Tag, Rückgängig stellt wieder her', async () => {
    const { task } = await svc.createTask(repo, daily('Verschieben', '2026-05-01'));
    const moved = await svc.patchTask(repo, task.id, { date: '2026-05-20' });
    expect(moved.task.date).toBe('2026-05-20');
    expect(moved.task.originalScheduledDate).toBe('2026-05-01');
    await svc.undoEvent(repo, moved.eventId!);
    expect((await repo.getTask(task.id))!.date).toBe('2026-05-01');
  });

  it('erzeugt die 21-Tage-Meldung einmalig und löst sie beim Erledigen auf', async () => {
    const { task } = await svc.createTask(repo, daily('Alt', '2026-04-20'));
    await svc.syncNotifications(repo, '2026-05-11');
    await svc.syncNotifications(repo, '2026-05-12');
    let views = (await svc.listNotificationViews(repo, '2026-05-12')).filter((v) => v.taskId === task.id);
    expect(views).toHaveLength(1);
    expect(views[0].originalWeekLabel).toBe('KW 17');
    await svc.patchTask(repo, task.id, { status: 'done' });
    views = (await svc.listNotificationViews(repo, '2026-05-12')).filter((v) => v.taskId === task.id);
    expect(views).toHaveLength(0);
  });

  it('lehnt Wochenziele mit Uhrzeit-Patch und falscher Art ab', async () => {
    const { task } = await svc.createTask(repo, { kind: 'weekly', category: 'private', title: 'Ziel', weekStart: '2026-05-11' });
    await expect(svc.patchTask(repo, task.id, { time: '10:00' })).rejects.toThrow();
  });
});
