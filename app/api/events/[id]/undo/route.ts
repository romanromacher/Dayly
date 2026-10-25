import { z } from 'zod';
import { api, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { undoEvent } from '@/lib/server/service';

export const runtime = 'nodejs';

export const POST = api(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const id = z.string().uuid().parse((await ctx.params).id);
  return json(await undoEvent(getRepo(), id));
});
