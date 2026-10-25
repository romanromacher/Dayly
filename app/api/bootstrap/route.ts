import { addDays, mondayOf, todayBerlin } from '@/lib/domain/dates';
import { api, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { carryOverOpenTasks, ensureReviews, listNotificationViews, syncNotifications } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Alles, was die App beim Start braucht, in einem Aufruf. */
export const GET = api(async () => {
  const repo = getRepo();
  const today = todayBerlin();

  await carryOverOpenTasks(repo, today);
  await syncNotifications(repo, today);

  const from = addDays(mondayOf(today), -28);
  const to = addDays(mondayOf(today), 8 * 7 + 6);
  const [tasks, notifications, reviews, settings] = await Promise.all([
    repo.listTasksInRange(from, to),
    listNotificationViews(repo, today),
    ensureReviews(repo, today, 12),
    repo.getSettings(),
  ]);
  return json({ today, window: { from, to }, tasks, notifications, reviews, settings });
});
