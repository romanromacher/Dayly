import { todayBerlin } from '@/lib/domain/dates';
import { api, errorResponse, json, readJson } from '@/lib/server/http';
import { aiConfig, AiNotConfiguredError } from '@/lib/server/assistant/openai';
import { handleChat } from '@/lib/server/assistant/plan';
import { chatRequestSchema } from '@/lib/server/assistant/schema';
import { allow } from '@/lib/server/assistant/limit';
import { getRepo } from '@/lib/server/repo-index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Ist der Assistent verbunden? (Die Oberfläche zeigt sonst klar „nicht verbunden“.) */
export const GET = api(async () => json({ enabled: Boolean(aiConfig().key) }));

export const POST = api(async (req) => {
  if (!aiConfig().key) return errorResponse(new AiNotConfiguredError().message, 503);
  if (!allow('chat')) return errorResponse('Zu viele Anfragen in kurzer Zeit. Bitte warte einen Moment.', 429);
  const input = chatRequestSchema.parse(await readJson(req));
  return json(await handleChat(getRepo(), input, todayBerlin()));
});
