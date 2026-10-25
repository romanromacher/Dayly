'use client';

import { useDayly } from './store';
import { Sheet } from './ui';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, logout } = useDayly();
  return (
    <Sheet title="Einstellungen" onClose={onClose}>
      <label className="switch">
        <span>
          <strong>Offene Aufgaben automatisch auf heute holen</strong>
          <p>Nicht erledigte Tagesaufgaben früherer Tage werden jeden Morgen auf den aktuellen Tag verschoben. Die ursprüngliche Kalenderwoche bleibt gespeichert.</p>
        </span>
        <input type="checkbox" checked={settings.carryOverOpen} onChange={(e) => void updateSettings({ carryOverOpen: e.target.checked })} />
      </label>
      <button className="btn ghost block" onClick={() => void logout()}>
        Abmelden
      </button>
    </Sheet>
  );
}
