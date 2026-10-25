import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mondayOf } from '@/lib/domain/dates';
import type { NotificationRow, Settings, Task, TaskEvent, WeekReview } from '@/lib/domain/types';
import type { Repo, TaskPatch } from './repo';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const TASK_COLUMNS: Record<keyof Omit<Task, 'time'> | 'time', string> = {
  id: 'id', title: 'title', notes: 'notes', category: 'category', kind: 'kind', date: 'date', weekStart: 'week_start',
  time: 'time', dueAt: 'due_at', priority: 'priority', estimatedMinutes: 'estimated_minutes', contextTags: 'context_tags',
  status: 'status', completedAt: 'completed_at', originalScheduledDate: 'original_scheduled_date',
  originalWeekStart: 'original_week_start', createdAt: 'created_at', updatedAt: 'updated_at', version: 'version',
};

function toTask(r: Row): Task {
  return {
    id: r.id, title: r.title, notes: r.notes ?? null, category: r.category, kind: r.kind,
    date: r.date ?? null, weekStart: r.week_start ?? null, time: r.time ? String(r.time).slice(0, 5) : null,
    dueAt: r.due_at ?? null, priority: r.priority ?? null, estimatedMinutes: r.estimated_minutes ?? null,
    contextTags: r.context_tags ?? [], status: r.status, completedAt: r.completed_at ?? null,
    originalScheduledDate: r.original_scheduled_date ?? null, originalWeekStart: r.original_week_start ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at, version: r.version,
  };
}

function toRow(t: Partial<Task>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(t)) {
    const col = (TASK_COLUMNS as Record<string, string>)[key];
    if (col) out[col] = value;
  }
  return out;
}

function toNotification(r: Row): NotificationRow {
  return {
    id: r.id, taskId: r.task_id, type: r.type, originalWeek: r.original_week, originalDate: r.original_date,
    createdAt: r.created_at, readAt: r.read_at ?? null, dismissedAt: r.dismissed_at ?? null, resolvedAt: r.resolved_at ?? null,
  };
}

function toReview(r: Row): WeekReview {
  return {
    weekStart: r.week_start, isoYear: r.iso_year, isoWeek: r.iso_week,
    dailyTotal: r.daily_total, dailyDone: r.daily_done, businessTotal: r.business_total, businessDone: r.business_done,
    privateTotal: r.private_total, privateDone: r.private_done, goalsTotal: r.goals_total, goalsDone: r.goals_done,
    summary: r.summary, finalizedAt: r.finalized_at, ruleVersion: r.rule_version,
  };
}

function reviewRow(r: WeekReview): Row {
  return {
    week_start: r.weekStart, iso_year: r.isoYear, iso_week: r.isoWeek,
    daily_total: r.dailyTotal, daily_done: r.dailyDone, business_total: r.businessTotal, business_done: r.businessDone,
    private_total: r.privateTotal, private_done: r.privateDone, goals_total: r.goalsTotal, goals_done: r.goalsDone,
    summary: r.summary, rule_version: r.ruleVersion, finalized_at: r.finalizedAt ?? new Date().toISOString(),
  };
}

function fail(context: string, error: { message: string; code?: string }): never {
  throw new Error(`Supabase (${context}): ${error.message}`);
}

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export function createSupabaseRepo(): Repo {
  const db = () => client();
  return {
    async listTasksInRange(from, to) {
      const weekFrom = mondayOf(from);
      const { data, error } = await db()
        .from('tasks')
        .select('*')
        .or(`and(kind.eq.daily,date.gte.${from},date.lte.${to}),and(kind.eq.weekly,week_start.gte.${weekFrom},week_start.lte.${to})`)
        .order('created_at', { ascending: true })
        .range(0, 4999);
      if (error) fail('listTasksInRange', error);
      return (data ?? []).map(toTask);
    },

    async listOpenTasks() {
      const { data, error } = await db().from('tasks').select('*').eq('status', 'open').order('created_at').range(0, 4999);
      if (error) fail('listOpenTasks', error);
      return (data ?? []).map(toTask);
    },

    async getTask(id) {
      const { data, error } = await db().from('tasks').select('*').eq('id', id).maybeSingle();
      if (error) fail('getTask', error);
      return data ? toTask(data) : null;
    },

    async getTasksByIds(ids) {
      if (!ids.length) return [];
      const { data, error } = await db().from('tasks').select('*').in('id', ids);
      if (error) fail('getTasksByIds', error);
      return (data ?? []).map(toTask);
    },

    async insertTask(task) {
      const { data, error } = await db().from('tasks').insert(toRow(task)).select('*').single();
      if (error) fail('insertTask', error);
      return toTask(data);
    },

    async updateTask(id, patch: TaskPatch, expectedVersion) {
      const row = { ...toRow(patch), version: expectedVersion + 1 };
      const { data, error } = await db().from('tasks').update(row).eq('id', id).eq('version', expectedVersion).select('*').maybeSingle();
      if (error) fail('updateTask', error);
      return data ? toTask(data) : null;
    },

    async deleteTask(id) {
      const { data, error } = await db().from('tasks').delete().eq('id', id).select('*').maybeSingle();
      if (error) fail('deleteTask', error);
      return data ? toTask(data) : null;
    },

    async insertEvent(e: TaskEvent) {
      const { error } = await db().from('task_events').insert({
        id: e.id, task_id: e.taskId, type: e.type, source: e.source, batch_id: e.batchId,
        before: e.before, after: e.after, created_at: e.createdAt,
      });
      if (error) fail('insertEvent', error);
    },

    async getEvent(id) {
      const { data, error } = await db().from('task_events').select('*').eq('id', id).maybeSingle();
      if (error) fail('getEvent', error);
      if (!data) return null;
      return {
        id: data.id, taskId: data.task_id, type: data.type, source: data.source, batchId: data.batch_id,
        before: data.before, after: data.after, createdAt: data.created_at, undoneAt: data.undone_at,
      };
    },

    async markEventUndone(id, at) {
      const { data, error } = await db().from('task_events').update({ undone_at: at }).eq('id', id).is('undone_at', null).select('id');
      if (error) fail('markEventUndone', error);
      return (data?.length ?? 0) > 0;
    },

    async listActiveNotifications() {
      const { data, error } = await db().from('notifications').select('*').is('resolved_at', null).is('dismissed_at', null).order('original_date');
      if (error) fail('listActiveNotifications', error);
      return (data ?? []).map(toNotification);
    },

    async insertNotifications(rows) {
      let inserted = 0;
      for (const n of rows) {
        const { error } = await db().from('notifications').insert({
          id: n.id, task_id: n.taskId, type: n.type, original_week: n.originalWeek, original_date: n.originalDate, created_at: n.createdAt,
        });
        if (!error) inserted++;
        else if (error.code !== '23505') fail('insertNotifications', error); // 23505 = es gibt schon eine aktive Erinnerung
      }
      return inserted;
    },

    async resolveNotifications(ids, at) {
      if (!ids.length) return;
      const { error } = await db().from('notifications').update({ resolved_at: at }).in('id', ids);
      if (error) fail('resolveNotifications', error);
    },

    async setNotificationRead(id, readAt) {
      const { data, error } = await db().from('notifications').update({ read_at: readAt }).eq('id', id).select('*').maybeSingle();
      if (error) fail('setNotificationRead', error);
      return data ? toNotification(data) : null;
    },

    async getReviews(weekStarts) {
      if (!weekStarts.length) return [];
      const { data, error } = await db().from('weekly_reviews').select('*').in('week_start', weekStarts);
      if (error) fail('getReviews', error);
      return (data ?? []).map(toReview);
    },

    async insertReview(review) {
      const { error } = await db().from('weekly_reviews').insert(reviewRow(review));
      if (!error) return true;
      if (error.code === '23505') return false;
      fail('insertReview', error);
    },

    async replaceReview(review) {
      const { error } = await db().from('weekly_reviews').upsert(reviewRow(review), { onConflict: 'week_start' });
      if (error) fail('replaceReview', error);
    },

    async getSettings() {
      const { data, error } = await db().from('settings').select('*').eq('id', 1).maybeSingle();
      if (error) fail('getSettings', error);
      return { carryOverOpen: Boolean(data?.carry_over_open) };
    },

    async updateSettings(patch) {
      const row: Row = { id: 1, updated_at: new Date().toISOString() };
      if (patch.carryOverOpen !== undefined) row.carry_over_open = patch.carryOverOpen;
      const { data, error } = await db().from('settings').upsert(row, { onConflict: 'id' }).select('*').single();
      if (error) fail('updateSettings', error);
      return { carryOverOpen: Boolean(data.carry_over_open) };
    },
  };
}

