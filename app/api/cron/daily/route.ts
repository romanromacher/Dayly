import { createHash, timingSafeEqual } from 'node:crypto';
import { todayBerlin } from '@/lib/domain/dates';
import { api, errorResponse, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { carryOverOpenTasks, ensureReviews, syncNotifications } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sha = (s: string) => createHash('sha256').update(s).digest();

/**
 * Täglicher Server-Job (siehe vercel.json). Läuft nach Mitternacht Berlin:
 * erzeugt 21-Tage-Hinweise, erstellt fehlende Wochenrückblicke, übernimmt optional offene Aufgaben.
 * Geschützt durch CRON_SECRET (Vercel sendet es als Bearer-Token).
 */
export const GET = api(
  async (req) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return errorResponse('CRON_SECRET ist nicht gesetzt.', 500);
    const header = req.headers.get('authorization') ?? '';
    if (!timingSafeEqual(sha(header), sha(`Bearer ${secret}`))) return errorResponse('Nicht erlaubt.', 401);

    const repo = getRepo();
    const today = todayBerlin();
    const moved = await carryOverOpenTasks(repo, today);
    const notices = await syncNotifications(repo, today);
    const reviews = await ensureReviews(repo, today, 12);
    return json({ today, moved, notices, reviews: reviews.length });
  },
  { auth: false },
);
