import { api, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { settingsSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';

export const PATCH = api(async (req) => {
  const patch = settingsSchema.parse(await readJson(req));
  return json({ settings: await getRepo().updateSettings(patch) });
});
