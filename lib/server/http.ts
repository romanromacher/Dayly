import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { readCookie, SESSION_COOKIE, sessionSecret, verifySessionToken } from './session';
import { ConflictError, NotFoundError, ValidationError } from './repo';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, status);
}

/** Zweite Absicherung zusätzlich zum Proxy: prüft das Anmelde-Cookie in jedem Handler. */
export async function isAuthenticated(req: Request): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  return verifySessionToken(secret, readCookie(req.headers.get('cookie'), SESSION_COOKIE));
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function api<C = unknown>(handler: Handler<C>, opts: { auth?: boolean } = {}): Handler<C> {
  const auth = opts.auth ?? true;
  return async (req, ctx) => {
    try {
      if (auth && !(await isAuthenticated(req))) return errorResponse('Nicht angemeldet.', 401);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ZodError) {
        return errorResponse('Ungültige Eingabe.', 400, { details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
      }
      if (e instanceof ValidationError) return errorResponse(e.message, 400);
      if (e instanceof NotFoundError) return errorResponse(e.message, 404);
      if (e instanceof ConflictError) return errorResponse(e.message, 409);
      console.error('[api]', e);
      return errorResponse('Interner Fehler.', 500);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError('Ungültiger JSON-Body.');
  }
}
