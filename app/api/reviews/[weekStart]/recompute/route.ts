import { isValidDate, todayBerlin } from '@/lib/domain/dates';
import { api, errorResponse, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { recomputeReview } from '@/lib/server/service';

export const runtime = 'nodejs';

/** Nur auf ausdrücklichen Wunsch: gespeicherten Rückblick einer abgeschlossenen Woche neu berechnen. */
export const POST = api(async (_req, ctx: { params: Promise<{ weekStart: string }> }) => {
  const { weekStart } = await ctx.params;
  if (!isValidDate(weekStart)) return errorResponse('Ungültiges Datum.', 400);
  return json({ review: await recomputeReview(getRepo(), weekStart, todayBerlin()) });
});
