import { diffDays, isValidDate } from '@/lib/domain/dates';
import { api, errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { createTaskSchema } from '@/lib/server/schemas';
import { createTask } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!isValidDate(from) || !isValidDate(to) || to < from) return errorResponse('from und to müssen gültige Daten sein.', 400);
  if (diffDays(from, to) > 400) return errorResponse('Der Zeitraum ist zu groß (maximal 400 Tage).', 400);
  return json({ tasks: await getRepo().listTasksInRange(from, to) });
});

export const POST = api(async (req) => {
  const input = createTaskSchema.parse(await readJson(req));
  const result = await createTask(getRepo(), input);
  return json(result, result.deduped ? 200 : 201);
});
