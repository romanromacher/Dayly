import { api, json, readJson } from '@/lib/server/http';
import { applyActions } from '@/lib/server/assistant/apply';
import { applyRequestSchema } from '@/lib/server/assistant/schema';
import { getRepo } from '@/lib/server/repo-index';

export const runtime = 'nodejs';

export const POST = api(async (req) => {
  const { actions } = applyRequestSchema.parse(await readJson(req));
  return json(await applyActions(getRepo(), actions));
});
