// Erzeugt die App-Icons (PWA / iPhone-Homescreen) aus einer SVG-Vorlage. Aufruf: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Doppel-Haken weiß auf dunklem Grund (#20283a), wie das Logo der App.
const svg = (size, pad, round) => {
  const s = size - pad * 2;
  const k = s / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${round ? size * 0.225 : 0}" fill="#20283a"/>
    <g transform="translate(${pad} ${pad}) scale(${k})" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 53 L36 72 L66 30"/>
      <path d="M50 66 L55 72 L84 30" opacity=".9"/>
    </g>
  </svg>`;
};

const jobs = [
  ['icon-192.png', 192, 30, true],
  ['icon-512.png', 512, 80, true],
  ['icon-maskable-512.png', 512, 130, false], // Maskable: Motiv in der sicheren Zone, volle Fläche
  ['apple-touch-icon.png', 180, 28, false], // iOS rundet selbst ab
];
for (const [name, size, pad, round] of jobs) {
  await sharp(Buffer.from(svg(size, pad, round))).png().toFile(out + name);
  console.log('geschrieben', name);
}
