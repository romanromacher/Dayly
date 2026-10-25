import { ValidationError } from '@/lib/server/repo';
import { TOOL_DEFINITIONS } from './schema';

export interface AiConfig {
  key: string | null;
  base: string;
  model: string;
  transcribeModel: string;
}

export function aiConfig(): AiConfig {
  return {
    key: process.env.OPENAI_API_KEY?.trim() || null,
    base: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  };
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('Der KI-Assistent ist noch nicht verbunden (OPENAI_API_KEY fehlt).');
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelReply {
  content: string | null;
  toolCalls: { name: string; arguments: string }[];
}

function httpError(status: number): Error {
  if (status === 401) return new ValidationError('Der OpenAI-Schlüssel wurde abgelehnt. Bitte prüfe OPENAI_API_KEY.');
  if (status === 429) return new ValidationError('OpenAI meldet: Limit erreicht oder Guthaben aufgebraucht. Prüfe unter platform.openai.com → Settings → Billing.');
  if (status === 404) return new ValidationError('Das eingestellte KI-Modell wurde nicht gefunden. Prüfe OPENAI_MODEL.');
  return new ValidationError('Die KI ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.');
}

export async function chat(messages: ChatMessage[], cfg = aiConfig()): Promise<ModelReply> {
  if (!cfg.key) throw new AiNotConfiguredError();
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, messages, tools: TOOL_DEFINITIONS, tool_choice: 'auto', parallel_tool_calls: true }),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new ValidationError('Die KI ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.');
  }
  if (!res.ok) throw httpError(res.status);
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  } | null;
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new ValidationError('Die KI hat keine verwertbare Antwort geliefert.');
  return {
    content: msg.content?.trim() || null,
    toolCalls: (msg.tool_calls ?? []).flatMap((c) => (c.function?.name ? [{ name: c.function.name, arguments: c.function.arguments ?? '{}' }] : [])),
  };
}

export async function transcribe(audio: Blob, filename: string, cfg = aiConfig()): Promise<string> {
  if (!cfg.key) throw new AiNotConfiguredError();
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', cfg.transcribeModel);
  form.append('language', 'de');
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ValidationError('Die Spracherkennung ist gerade nicht erreichbar.');
  }
  if (!res.ok) throw httpError(res.status);
  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  return (data?.text ?? '').trim();
}
