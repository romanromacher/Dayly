import { z } from 'zod';
import { api, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { patchTaskSchema } from '@/lib/server/schemas';
import { deleteTask, patchTask } from '@/lib/server/service';

export const runtime = 'nodejs';
const idSchema = z.string().uuid();

export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await ctx.params).id);
  const input = patchTaskSchema.parse(await readJson(req));
  return json(await patchTask(getRepo(), id, input));
});

export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const id = idSchema.parse((await ctx.params).id);
  return json(await deleteTask(getRepo(), id));
});
