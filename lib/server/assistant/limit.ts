/** Einfache Bremse gegen versehentliche Dauerschleifen (pro Serverinstanz): 30 Aufrufe je 10 Minuten und Art. */
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 30;

export function allow(kind: string, now = Date.now()): boolean {
  const list = (hits.get(kind) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX) {
    hits.set(kind, list);
    return false;
  }
  list.push(now);
  hits.set(kind, list);
  return true;
}
