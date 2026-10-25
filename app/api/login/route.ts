import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { api, errorResponse, readJson } from '@/lib/server/http';
import { loginSchema } from '@/lib/server/schemas';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, sessionSecret } from '@/lib/server/session';

export const runtime = 'nodejs';

const sha = (s: string) => createHash('sha256').update(s).digest();

// Einfache Bremse gegen Durchprobieren (pro Serverinstanz; zusätzlich hilft ein langer Passcode).
const failures = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

function clientKey(req: Request) {
  return (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
}

export const POST = api(
  async (req) => {
    const expected = process.env.APP_PASSCODE;
    const secret = sessionSecret();
    if (!expected || !secret) {
      return errorResponse('Der Server ist nicht fertig eingerichtet (APP_PASSCODE oder SESSION_SECRET fehlt).', 500);
    }

    const key = clientKey(req);
    const now = Date.now();
    const f = failures.get(key);
    if (f && now - f.first < WINDOW_MS && f.count >= MAX_FAILS) {
      return errorResponse('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
    }

    const { passcode } = loginSchema.parse(await readJson(req));
    if (!timingSafeEqual(sha(passcode), sha(expected))) {
      const cur = f && now - f.first < WINDOW_MS ? f : { count: 0, first: now };
      failures.set(key, { count: cur.count + 1, first: cur.first });
      await new Promise((r) => setTimeout(r, 700));
      return errorResponse('Der Passcode stimmt nicht.', 401);
    }

    failures.delete(key);
    const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  },
  { auth: false },
);
