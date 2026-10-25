import { todayBerlin } from '@/lib/domain/dates';
import { api, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { ensureReviews } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req) => {
  const raw = Number(new URL(req.url).searchParams.get('count') ?? 12);
  const count = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 104) : 12;
  return json({ reviews: await ensureReviews(getRepo(), todayBerlin(), count) });
});
