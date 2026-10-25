/** Signierte Anmelde-Cookies. Läuft im Proxy (Edge/Node) und in Route Handlern (Web Crypto). */
export const SESSION_COOKIE = 'dayly_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export async function createSessionToken(secret: string, ttlSeconds = SESSION_TTL_SECONDS, nowMs = Date.now()): Promise<string> {
  const payload = toB64Url(enc.encode(JSON.stringify({ v: 1, exp: Math.floor(nowMs / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(payload)));
  return `${payload}.${toB64Url(sig)}`;
}

export async function verifySessionToken(secret: string, token: string | undefined | null, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return false;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, ['verify']), fromB64Url(sig) as BufferSource, enc.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload))) as { v?: number; exp?: number };
    return data.v === 1 && typeof data.exp === 'number' && data.exp > Math.floor(nowMs / 1000);
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}
