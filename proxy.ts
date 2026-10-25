import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from '@/lib/server/session';

/** Alles außer Login, Manifest und Icons erfordert ein gültiges Anmelde-Cookie. */
const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/api\/login$/, /^\/api\/cron\//, /^\/manifest\.webmanifest$/, /^\/icons\//, /^\/favicon\.ico$/];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const secret = sessionSecret();
  const ok = secret ? await verifySessionToken(secret, req.cookies.get(SESSION_COOKIE)?.value) : false;
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
