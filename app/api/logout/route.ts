import { NextResponse } from 'next/server';
import { api } from '@/lib/server/http';
import { SESSION_COOKIE } from '@/lib/server/session';

export const POST = api(
  async () => {
    const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  },
  { auth: false },
);
