import { z } from 'zod';
import { isValidDate, isValidTime } from '@/lib/domain/dates';

const dateStr = z.string().refine(isValidDate, 'Ungültiges Datum (erwartet YYYY-MM-DD)');
const timeStr = z.string().refine(isValidTime, 'Ungültige Uhrzeit (erwartet HH:MM)');
const title = z.string().trim().min(1).max(300);
const notes = z.string().max(4000);

/** Die einzigen Änderungen, die der Assistent vorschlagen und die App ausführen darf. */
export const actionSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    title,
    category: z.enum(['business', 'private']),
    kind: z.enum(['daily', 'weekly']),
    /** Tagesaufgabe: der Tag. Wochenziel: ein beliebiger Tag in der Zielwoche. */
    date: dateStr,
    time: timeStr.nullable().optional(),
    notes: notes.nullable().optional(),
  }).strict(),
  z.object({
    op: z.literal('update'),
    taskId: z.string().uuid(),
    title: title.optional(),
    category: z.enum(['business', 'private']).optional(),
    date: dateStr.optional(),
    /** null = Uhrzeit entfernen */
    time: timeStr.nullable().optional(),
    notes: notes.nullable().optional(),
  }).strict(),
  z.object({
    op: z.literal('complete'),
    taskId: z.string().uuid(),
    done: z.boolean(),
  }).strict(),
]);

export type Action = z.infer<typeof actionSchema>;
export const actionsSchema = z.array(actionSchema).min(1).max(20);

export const chatRequestSchema = z.object({
  text: z.string().trim().min(1, 'Bitte sag oder schreib etwas.').max(2000, 'Der Text ist zu lang (maximal 2000 Zeichen).'),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(8)
    .optional(),
}).strict();

export const applyRequestSchema = z.object({ actions: actionsSchema }).strict();

/* ----- Werkzeug-Argumente, wie das Modell sie liefert (mit Kurz-IDs "T12") ----- */
const ref = z.string().regex(/^T\d{1,4}$/, 'Ungültige Aufgaben-ID');
export const toolArgs = {
  create_task: z.object({
    title,
    category: z.enum(['business', 'private']),
    kind: z.enum(['daily', 'weekly']),
    date: dateStr,
    time: timeStr.nullable().optional(),
    notes: notes.nullable().optional(),
  }),
  update_task: z.object({
    task_ref: ref,
    title: title.optional(),
    category: z.enum(['business', 'private']).optional(),
    date: dateStr.optional(),
    time: z.union([timeStr, z.literal('')]).nullable().optional(),
    notes: notes.nullable().optional(),
  }),
  set_task_done: z.object({ task_ref: ref, done: z.boolean() }),
  ask_user: z.object({ question: z.string().trim().min(1).max(400) }),
} as const;

/** Werkzeugbeschreibung im Format der OpenAI-API. */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Legt eine neue Tagesaufgabe oder ein neues Wochenziel an. Nur verwenden, wenn es keine passende offene Aufgabe gibt.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Kurzer, klarer Titel.' },
          category: { type: 'string', enum: ['business', 'private'] },
          kind: { type: 'string', enum: ['daily', 'weekly'], description: 'daily = Aufgabe für einen bestimmten Tag, weekly = Wochenziel ohne festen Tag.' },
          date: { type: 'string', description: 'YYYY-MM-DD. Bei daily der Tag, bei weekly ein beliebiger Tag der Zielwoche.' },
          time: { type: ['string', 'null'], description: 'HH:MM, nur bei daily und nur wenn eine Uhrzeit genannt wurde.' },
          notes: { type: ['string', 'null'], description: 'Optionale Notiz.' },
        },
        required: ['title', 'category', 'kind', 'date'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Ändert eine bestehende Aufgabe oder verschiebt sie auf einen anderen Tag bzw. in eine andere Woche. Nur die Felder angeben, die sich ändern.',
      parameters: {
        type: 'object',
        properties: {
          task_ref: { type: 'string', description: 'ID aus der Aufgabenliste, z. B. T12.' },
          title: { type: 'string' },
          category: { type: 'string', enum: ['business', 'private'] },
          date: { type: 'string', description: 'Neuer Tag (YYYY-MM-DD). Bei Wochenzielen ein beliebiger Tag der neuen Woche.' },
          time: { type: ['string', 'null'], description: 'HH:MM oder leerer String, um die Uhrzeit zu entfernen.' },
          notes: { type: ['string', 'null'] },
        },
        required: ['task_ref'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_task_done',
      description: 'Hakt eine bestehende Aufgabe ab (done = true) oder öffnet sie wieder (done = false).',
      parameters: {
        type: 'object',
        properties: { task_ref: { type: 'string', description: 'ID aus der Aufgabenliste, z. B. T12.' }, done: { type: 'boolean' } },
        required: ['task_ref', 'done'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Stellt eine kurze Rückfrage, wenn die Anfrage unklar oder mehrdeutig ist (z. B. mehrere passende Aufgaben, unklarer Tag). Statt zu raten immer nachfragen.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string', description: 'Eine kurze, konkrete Frage auf Deutsch.' } },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
] as const;
