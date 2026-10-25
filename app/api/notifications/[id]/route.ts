import { z } from 'zod';
import { api, errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { notificationPatchSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';

/** Als gelesen markieren (oder zurücknehmen). „Gelesen“ bedeutet nicht „erledigt“. */
export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = z.string().uuid().parse((await ctx.params).id);
  const { read } = notificationPatchSchema.parse(await readJson(req));
  const updated = await getRepo().setNotificationRead(id, read ? new Date().toISOString() : null);
  if (!updated) return errorResponse('Benachrichtigung nicht gefunden.', 404);
  return json({ ok: true, readAt: updated.readAt });
});
