'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mic, Send, Square } from 'lucide-react';
import { ApiError, api } from '@/lib/client/api';
import type { Action } from '@/lib/server/assistant/schema';
import { useDayly } from './store';
import { Sheet } from './ui';

interface Proposal { id: string; action: Action; summary: string }
interface ChatResult { message: string; question: string | null; proposals: Proposal[]; skipped: string[] }
interface ApplyResponse { batchId: string; results: { index: number; ok: boolean; eventId?: string | null; error?: string }[] }
type Turn = { role: 'user' | 'assistant'; content: string };
type Rec = 'idle' | 'recording' | 'transcribing';

const MAX_RECORD_MS = 90_000;
const pickMime = () => (typeof MediaRecorder === 'undefined' ? '' : ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '');

export function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { reload } = useDayly();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<{ ok: number; failed: string[]; eventIds: string[] } | null>(null);
  const [undone, setUndone] = useState(false);
  const [rec, setRec] = useState<Rec>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<{ enabled: boolean }>('/api/assistant').then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<ChatResult>('/api/assistant', { method: 'POST', body: JSON.stringify({ text: t, history: history.slice(-6) }) });
      setResult(r);
      setSelected(new Set(r.proposals.map((p) => p.id)));
      if (r.question) {
        setHistory((h) => [...h, { role: 'user', content: t }, { role: 'assistant', content: r.question! }]);
      } else {
        setHistory([]);
      }
      setText('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Etwas ist schiefgelaufen.');
    }
    setBusy(false);
  }, [text, busy, history]);

  async function applySelected() {
    if (!result) return;
    const actions = result.proposals.filter((p) => selected.has(p.id)).map((p) => p.action);
    if (!actions.length) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<ApplyResponse>('/api/assistant/apply', { method: 'POST', body: JSON.stringify({ actions }) });
      setApplied({
        ok: r.results.filter((x) => x.ok).length,
        failed: r.results.filter((x) => !x.ok).map((x) => x.error ?? 'Fehlgeschlagen.'),
        eventIds: r.results.filter((x) => x.ok && x.eventId).map((x) => x.eventId!),
      });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Etwas ist schiefgelaufen.');
    }
    setBusy(false);
  }

  async function undoAll() {
    if (!applied) return;
    setBusy(true);
    try {
      for (const id of [...applied.eventIds].reverse()) await api(`/api/events/${id}/undo`, { method: 'POST' });
      setUndone(true);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Rückgängig ist fehlgeschlagen.');
    }
    setBusy(false);
  }

  function reset() {
    setResult(null);
    setApplied(null);
    setUndone(false);
    setHistory([]);
    setError('');
    setTimeout(() => input.current?.focus(), 0);
  }

  /* ------------------------------------------------------------ Sprache */
  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Dieses Gerät oder dieser Browser kann keine Sprache aufnehmen. Du kannst stattdessen tippen.');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => void finishRecording(r.mimeType || mime || 'audio/mp4');
      recorder.current = r;
      r.start();
      setRec('recording');
      timer.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      setError(denied ? 'Der Mikrofonzugriff ist nicht erlaubt. Erlaube ihn in den iPhone-Einstellungen für Safari bzw. diese App und versuche es erneut.' : 'Das Mikrofon konnte nicht gestartet werden.');
    }
  }

  function stopRecording() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }

  async function finishRecording(mime: string) {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const blob = new Blob(chunks.current, { type: mime.split(';')[0] });
    chunks.current = [];
    if (blob.size < 1500) {
      setRec('idle');
      setError('Die Aufnahme war zu kurz. Bitte sprich etwas länger.');
      return;
    }
    setRec('transcribing');
    try {
      const form = new FormData();
      form.append('audio', blob, 'aufnahme');
      const res = await fetch('/api/assistant/transcribe', { method: 'POST', body: form, credentials: 'same-origin' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(data?.error ?? 'Die Spracherkennung ist fehlgeschlagen.', res.status);
      setText((cur) => (cur ? cur + ' ' : '') + data.text);
      setTimeout(() => input.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Keine Verbindung zum Server.');
    }
    setRec('idle');
  }

  /* ------------------------------------------------------------ Ansicht */
  if (enabled === null) {
    return (
      <Sheet title="dayly. Assistent" onClose={onClose}>
        <div className="center" style={{ minHeight: 160 }}><div className="spin" /></div>
      </Sheet>
    );
  }

  if (!enabled) {
    return (
      <Sheet title="dayly. Assistent" onClose={onClose}>
        <div className="card" style={{ marginTop: 14 }}>
          <strong>Noch nicht verbunden</strong>
          <p>
            Der Assistent ist eingebaut, aber es ist noch kein OpenAI-Schlüssel hinterlegt. Bis dahin wird nichts aufgenommen, nichts an eine KI gesendet und nichts an deinen Aufgaben verändert.
          </p>
          <p>Einrichten: bei Vercel unter Project → Settings → Environment Variables den Eintrag <code>OPENAI_API_KEY</code> anlegen und unter Deployments neu veröffentlichen.</p>
        </div>
        <button className="btn block" onClick={onClose}>Verstanden</button>
      </Sheet>
    );
  }

  if (applied) {
    return (
      <Sheet title="dayly. Assistent" onClose={onClose}>
        <div className="card" style={{ marginTop: 14 }}>
          <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Check size={18} color="#3ba46b" strokeWidth={3} />
            {undone ? 'Alles rückgängig gemacht' : `${applied.ok} ${applied.ok === 1 ? 'Änderung' : 'Änderungen'} übernommen`}
          </strong>
          {applied.failed.map((f, i) => <p key={i} className="err">{f}</p>)}
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          {!undone && applied.eventIds.length > 0 && <button className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => void undoAll()}>Rückgängig</button>}
          <button className="btn" style={{ flex: 1 }} onClick={reset}>Weitere Änderung</button>
        </div>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onClose}>Fertig</button>
      </Sheet>
    );
  }

  const placeholder = result?.question ? 'Deine Antwort …' : 'z. B. „Verschiebe das Material-Checken auf übermorgen und leg für Freitag ein Telefonat mit dem Steuerberater an.“';

  return (
    <Sheet title="dayly. Assistent" onClose={onClose}>
      {!result && <p style={{ marginTop: 10 }}>Sprich oder schreib, was du planen oder ändern willst. Du siehst alles zuerst als Vorschlag und bestätigst es.</p>}

      {result && (
        <div style={{ marginTop: 14 }}>
          {result.message && <p style={{ fontSize: 14, color: '#4b566a' }}>{result.message}</p>}
          {result.question && <div className="card" style={{ marginTop: 8 }}><strong>{result.question}</strong></div>}
          {result.proposals.length > 0 && (
            <div style={{ marginTop: 10 }} role="group" aria-label="Vorgeschlagene Änderungen">
              {result.proposals.map((p) => {
                const on = selected.has(p.id);
                return (
                  <label key={p.id} className={`prop ${on ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                    />
                    <span>{p.summary}</span>
                  </label>
                );
              })}
            </div>
          )}
          {result.skipped.map((s, i) => <p key={i} className="muted" style={{ marginTop: 6 }}>{s}</p>)}
        </div>
      )}

      <textarea
        ref={input}
        className="input"
        style={{ marginTop: 14 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(); }}
        aria-label="Nachricht an den Assistenten"
      />

      {rec === 'recording' && <p className="rec-hint">● Aufnahme läuft … tippe auf Stopp, wenn du fertig bist.</p>}
      {rec === 'transcribing' && <p className="rec-hint">Ich höre zu und schreibe mit …</p>}
      {error && <div className="err" role="alert">{error}</div>}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className={`mic ${rec === 'recording' ? 'live' : ''}`}
          onClick={() => (rec === 'recording' ? stopRecording() : void startRecording())}
          disabled={rec === 'transcribing' || busy}
          aria-label={rec === 'recording' ? 'Aufnahme beenden' : 'Sprachaufnahme starten'}
        >
          {rec === 'recording' ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
        </button>
        <button className="btn" style={{ flex: 1, padding: 14 }} disabled={busy || !text.trim() || rec !== 'idle'} onClick={() => void send()}>
          <Send size={16} /> {busy && !result ? 'Denke nach …' : result?.question ? 'Antworten' : 'Senden'}
        </button>
      </div>

      {result && result.proposals.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="btn block" style={{ background: '#3ba46b', marginTop: 0 }} disabled={busy || selected.size === 0} onClick={() => void applySelected()}>
            {selected.size} {selected.size === 1 ? 'Änderung' : 'Änderungen'} übernehmen
          </button>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={reset} disabled={busy}>Verwerfen</button>
        </div>
      )}
    </Sheet>
  );
}
