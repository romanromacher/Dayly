'use client';

import { useState } from 'react';
import { CheckCheck } from 'lucide-react';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const d = await res.json().catch(() => null);
      setError(d?.error ?? 'Anmeldung fehlgeschlagen.');
    } catch {
      setError('Keine Verbindung zum Server.');
    }
    setBusy(false);
  }

  return (
    <main className="app">
      <div className="center">
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 320 }}>
          <div className="brand" style={{ justifyContent: 'center' }}><span className="logo"><CheckCheck size={20} strokeWidth={2.6} /></span>dayly.</div>
          <p style={{ margin: '14px 0 20px' }}>Dein Tag. Dein Tempo.</p>
          <label className="field" style={{ textAlign: 'left' }}>
            <span>Passcode</span>
            <input className="input" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn block" disabled={busy || !code}>{busy ? 'Prüfe …' : 'Öffnen'}</button>
        </form>
      </div>
    </main>
  );
}
