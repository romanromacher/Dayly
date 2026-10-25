import { api, errorResponse, json } from '@/lib/server/http';
import { aiConfig, AiNotConfiguredError, transcribe } from '@/lib/server/assistant/openai';
import { allow } from '@/lib/server/assistant/limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel erlaubt Anfragen bis ca. 4,5 MB
const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' };

/** Nimmt eine kurze Aufnahme entgegen und gibt nur den Text zurück. Die Aufnahme wird nicht gespeichert. */
export const POST = api(async (req) => {
  if (!aiConfig().key) return errorResponse(new AiNotConfiguredError().message, 503);
  if (!allow('voice')) return errorResponse('Zu viele Aufnahmen in kurzer Zeit. Bitte warte einen Moment.', 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get('audio');
  if (!(file instanceof Blob) || file.size === 0) return errorResponse('Keine Aufnahme erhalten.', 400);
  if (file.size > MAX_BYTES) return errorResponse('Die Aufnahme ist zu lang. Bitte fasse dich kürzer (etwa eine Minute).', 413);
  const base = file.type.split(';')[0].trim().toLowerCase();
  const ext = EXT[base];
  if (!ext) return errorResponse('Dieses Audioformat wird nicht unterstützt.', 400);
  const text = await transcribe(file, `aufnahme.${ext}`);
  if (!text) return errorResponse('Ich konnte nichts verstehen. Bitte versuche es noch einmal.', 422);
  return json({ text });
});
