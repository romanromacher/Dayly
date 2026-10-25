import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ChatMessage, ModelReply } from '@/lib/server/assistant/openai';
import type { Repo } from '@/lib/server/repo';

let repo: Repo;
let svc: typeof import('@/lib/server/service');
let plan: typeof import('@/lib/server/assistant/plan');
let apply: typeof import('@/lib/server/assistant/apply');

const TODAY = '2026-10-25'; // Sonntag
const call = (name: string, args: unknown) => ({ name, arguments: JSON.stringify(args) });
const reply = (toolCalls: ReturnType<typeof call>[], content: string | null = null): ModelReply => ({ content, toolCalls });
/** Findet wie das echte Modell die Kurz-ID einer Aufgabe in der Liste des System-Prompts. */
const refOf = (messages: ChatMessage[], title: string) => {
  const line = messages[0].content.split('\n').find((l) => /^T\d+ \|/.test(l) && l.endsWith(`| ${title}`));
  if (!line) throw new Error('Titel nicht in der Liste: ' + title);
  return line.split(' | ')[0];
};

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'dayly-ai-')));
  repo = (await import('@/lib/server/repo-file')).createFileRepo();
  svc = await import('@/lib/server/service');
  plan = await import('@/lib/server/assistant/plan');
  apply = await import('@/lib/server/assistant/apply');
  await svc.createTask(repo, { kind: 'daily', category: 'business', title: 'Material prüfen', date: TODAY });
  await svc.createTask(repo, { kind: 'daily', category: 'private', title: 'Wocheneinkauf', date: '2026-10-26' });
  await svc.createTask(repo, { kind: 'weekly', category: 'private', title: 'Drei Sporteinheiten', weekStart: '2026-10-19' });
});

describe('Assistent: Vorschläge', () => {
  it('Prompt enthält Kalender, Datum und Aufgabenliste mit Kurz-IDs', async () => {
    let seen = '';
    await plan.handleChat(repo, { text: 'hallo' }, TODAY, async (m) => ((seen = m[0].content), reply([], 'Hi')));
    expect(seen).toContain('Sonntag 2026-10-25 (heute)');
    expect(seen).toContain('Dienstag 2026-10-27 (übermorgen)');
    expect(seen).toMatch(/T\d+ \| Tag \| Business \| 2026-10-25 \(So\) \| offen \| Material prüfen/);
    expect(seen).toMatch(/Wochenziel \| Privat \| Woche ab 2026-10-19 \(KW 43\)/);
  });

  it('übersetzt "verschieben" in eine Änderung mit lesbarer Zusammenfassung', async () => {
    const r = await plan.handleChat(repo, { text: 'Material auf übermorgen' }, TODAY, async (m) =>
      reply([call('update_task', { task_ref: refOf(m, 'Material prüfen'), date: '2026-10-27' })]),
    );
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].action).toMatchObject({ op: 'update', date: '2026-10-27' });
    expect(r.proposals[0].summary).toContain('Material prüfen');
    expect(r.proposals[0].summary).toContain('Di., 27. Okt.');
  });

  it('legt Dubletten nicht an (auch nicht doppelt im selben Vorschlag)', async () => {
    const r = await plan.handleChat(repo, { text: 'x' }, TODAY, async () =>
      reply([
        call('create_task', { title: 'wocheneinkauf!', category: 'private', kind: 'daily', date: '2026-10-26' }),
        call('create_task', { title: 'Steuerberater anrufen', category: 'business', kind: 'daily', date: '2026-10-28' }),
        call('create_task', { title: 'Steuerberater  anrufen', category: 'business', kind: 'daily', date: '2026-10-28' }),
      ]),
    );
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].action).toMatchObject({ op: 'create', title: 'Steuerberater anrufen' });
    expect(r.skipped).toHaveLength(2);
  });

  it('blockiert erfundene IDs, unbekannte Werkzeuge, ungültige Daten und Uhrzeit bei Wochenzielen', async () => {
    const r = await plan.handleChat(repo, { text: 'x' }, TODAY, async (m) =>
      reply([
        call('update_task', { task_ref: 'T999', date: '2026-10-27' }),
        call('delete_everything', {}),
        call('create_task', { title: 'Kaputt', category: 'business', kind: 'daily', date: '31.10.2026' }),
        call('update_task', { task_ref: refOf(m, 'Drei Sporteinheiten'), time: '10:00' }),
      ]),
    );
    expect(r.proposals).toHaveLength(0);
    expect(r.skipped.length).toBe(4);
  });

  it('gibt Rückfragen weiter', async () => {
    const r = await plan.handleChat(repo, { text: 'verschieb das' }, TODAY, async () => reply([call('ask_user', { question: 'Welche Aufgabe meinst du?' })]));
    expect(r.question).toBe('Welche Aufgabe meinst du?');
    expect(r.proposals).toHaveLength(0);
  });

  it('Wochenziel verschieben: ein Tag der Zielwoche genügt', async () => {
    const r = await plan.handleChat(repo, { text: 'x' }, TODAY, async (m) =>
      reply([call('update_task', { task_ref: refOf(m, 'Drei Sporteinheiten'), date: '2026-10-28' })]),
    );
    expect(r.proposals[0].summary).toContain('KW 43 → KW 44');
  });
});

describe('Assistent: Ausführen', () => {
  it('führt bestätigte Änderungen als Stapel mit Quelle "ai" aus und bleibt rückgängig-fähig', async () => {
    const [mat] = (await repo.listTasksInRange(TODAY, TODAY)).filter((t) => t.title === 'Material prüfen');
    const res = await apply.applyActions(repo, [
      { op: 'update', taskId: mat.id, date: '2026-10-27' },
      { op: 'create', title: 'Telefonat Steuerberater', category: 'business', kind: 'daily', date: '2026-10-30', time: '09:30' },
      { op: 'complete', taskId: mat.id, done: true },
      { op: 'create', title: 'Wocheneinkauf', category: 'private', kind: 'daily', date: '2026-10-26' }, // Dublette
      { op: 'update', taskId: '00000000-0000-4000-8000-000000000000', title: 'Geist' },
    ]);
    expect(res.results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    const after = await repo.getTask(mat.id);
    expect(after).toMatchObject({ date: '2026-10-27', status: 'done', originalScheduledDate: TODAY });
    const ev = await repo.getEvent(res.results[0].eventId!);
    expect(ev).toMatchObject({ source: 'ai', batchId: res.batchId });
    await svc.undoEvent(repo, res.results[2].eventId!);
    await svc.undoEvent(repo, res.results[0].eventId!);
    expect(await repo.getTask(mat.id)).toMatchObject({ date: TODAY, status: 'open' });
  });

  it('verschiebt Wochenziele auf den Montag der Zielwoche', async () => {
    const [goal] = (await repo.listTasksInRange('2026-10-19', '2026-10-19')).filter((t) => t.kind === 'weekly');
    await apply.applyActions(repo, [{ op: 'update', taskId: goal.id, date: '2026-10-28' }]);
    const g = await repo.getTask(goal.id);
    expect(g).toMatchObject({ weekStart: '2026-10-26', originalWeekStart: '2026-10-19' });
  });
});
