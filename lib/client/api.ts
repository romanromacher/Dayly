export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Dünner fetch-Wrapper. Das Session-Cookie ist httpOnly und wird automatisch mitgeschickt. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Keine Verbindung zum Server.', 0);
  }
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/login')) {
    window.location.href = '/login';
    throw new ApiError('Bitte neu anmelden.', 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || 'Etwas ist schiefgelaufen.', res.status);
  return data as T;
}

export function newId(): string {
  const c: Crypto = crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
