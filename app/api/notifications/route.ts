import { todayBerlin } from '@/lib/domain/dates';
import { api, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo-index';
import { listNotificationViews, syncNotifications } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async () => {
  const repo = getRepo();
  const today = todayBerlin();
  await syncNotifications(repo, today);
  return json({ notifications: await listNotificationViews(repo, today) });
});
