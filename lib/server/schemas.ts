import { z } from 'zod';
import { isValidDate, isValidTime } from '@/lib/domain/dates';

const dateStr = z.string().refine(isValidDate, 'Ungültiges Datum (erwartet YYYY-MM-DD)');
const timeStr = z.string().refine(isValidTime, 'Ungültige Uhrzeit (erwartet HH:MM)');
const tags = z.array(z.string().trim().min(1).max(30)).max(10);

export const createTaskSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Titel fehlt').max(300),
    notes: z.string().max(4000).nullable().optional(),
    category: z.enum(['business', 'private']),
    kind: z.enum(['daily', 'weekly']),
    date: dateStr.optional(),
    weekStart: dateStr.optional(),
    time: timeStr.nullable().optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
    estimatedMinutes: z.number().int().positive().max(1440).nullable().optional(),
    contextTags: tags.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.kind === 'daily' && !v.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Tagesaufgaben brauchen ein Datum' });
    if (v.kind === 'weekly' && !v.weekStart) ctx.addIssue({ code: 'custom', path: ['weekStart'], message: 'Wochenziele brauchen eine Woche' });
    if (v.kind === 'weekly' && v.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Wochenziele haben keine Uhrzeit' });
  });

export const patchTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    notes: z.string().max(4000).nullable().optional(),
    category: z.enum(['business', 'private']).optional(),
    date: dateStr.optional(),
    weekStart: dateStr.optional(),
    time: timeStr.nullable().optional(),
    status: z.enum(['open', 'done']).optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
    estimatedMinutes: z.number().int().positive().max(1440).nullable().optional(),
    contextTags: tags.optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const settingsSchema = z.object({ carryOverOpen: z.boolean().optional() }).strict();
export const notificationPatchSchema = z.object({ read: z.boolean() }).strict();
export const loginSchema = z.object({ passcode: z.string().min(1).max(200) }).strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;
