/**
 * Marketing App Store frames at Apple's required pixel sizes.
 * These are branded composites for listing review — replace with Simulator captures when you have them.
 *
 * Usage: node store/generate-screenshots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'screenshots');
const logoPath = path.join(__dirname, '..', 'assets', 'waiair-logo.png');

const SIZES = [
  { folder: 'iphone-6.9', w: 1320, h: 2868 },
  { folder: 'iphone-6.7', w: 1290, h: 2796 },
  { folder: 'ipad-13', w: 2064, h: 2752 },
];

const SHOTS = [
  {
    file: '01-live-board',
    headline: 'Live flight boards worldwide',
    sub: 'Departures · Arrivals · Gates',
    rows: [
      ['VZ317', 'HKT → BKK', '07:30', 'Boarding', 'Gate 9 · T3', '#22c55e'],
      ['PG408', 'HKT → USM', '07:30', 'Boarding', 'Gate 83B', '#22c55e'],
      ['TG205', 'HKT → BKK', '08:10', 'On time', 'Gate 4', '#C9A84C'],
      ['FD3021', 'HKT → DMK', '08:25', 'Delayed', 'Gate 12', '#f59e0b'],
    ],
  },
  {
    file: '02-never-miss',
    headline: 'Never miss boarding again',
    sub: 'Track your flight · Lock screen Live Activity',
    rows: [
      ['VZ317', 'HKT → BKK', '07:30', 'Boarding Now', 'Gate 9 · T3', '#22c55e'],
    ],
    extra: 'weather',
  },
  {
    file: '03-tracked',
    headline: 'Gate changes · Delays · Weather',
    sub: 'Your flights, followed in real time',
    rows: [
      ['VZ317', 'HKT → BKK', '07:30', 'Boarding', 'Gate 9', '#22c55e'],
      ['PG408', 'HKT → USM', '07:30', 'On time', 'Gate 83B', '#C9A84C'],
    ],
  },
  {
    file: '04-dark-board',
    headline: 'Your flight, beautifully tracked',
    sub: 'Dark mode departures',
    rows: [
      ['KL808', 'AMS → BKK', '21:40', 'On time', 'Gate E18', '#C9A84C'],
      ['SQ325', 'AMS → SIN', '22:05', 'Boarding', 'Gate D6', '#22c55e'],
      ['HV6885', 'AMS → FAO', '22:15', 'Delayed', 'Gate C4', '#f59e0b'],
    ],
  },
  {
    file: '05-after-landing',
    headline: 'Welcome to your destination',
    sub: 'Weather · Currency · Next steps',
    rows: [
      ['VZ317', 'HKT → BKK', '09:05', 'Landed', 'Baggage 4', '#a78bfa'],
    ],
    extra: 'landing',
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function frameSvg(w, h, shot) {
  const pad = Math.round(w * 0.07);
  const headlineSize = Math.round(w * 0.062);
  const subSize = Math.round(w * 0.028);
  const cardX = pad;
  const cardW = w - pad * 2;
  const cardY = Math.round(h * 0.28);
  const rowH = Math.round(h * 0.09);
  const radius = Math.round(w * 0.04);

  const rows = shot.rows.map((r, i) => {
    const y = cardY + 24 + i * (rowH + 14);
    return `
      <rect x="${cardX}" y="${y}" width="${cardW}" height="${rowH}" rx="${radius}" fill="#121A2E"/>
      <text x="${cardX + 28}" y="${y + rowH * 0.42}" fill="#F8FAFC" font-size="${Math.round(w * 0.038)}" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${esc(r[0])}</text>
      <text x="${cardX + 28}" y="${y + rowH * 0.72}" fill="#8896B0" font-size="${Math.round(w * 0.024)}" font-family="system-ui, -apple-system, sans-serif">${esc(r[1])}  ·  ${esc(r[4])}</text>
      <text x="${cardX + cardW - 28}" y="${y + rowH * 0.42}" text-anchor="end" fill="#C9A84C" font-size="${Math.round(w * 0.038)}" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${esc(r[2])}</text>
      <text x="${cardX + cardW - 28}" y="${y + rowH * 0.72}" text-anchor="end" fill="${r[5]}" font-size="${Math.round(w * 0.024)}" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${esc(r[3])}</text>
    `;
  }).join('');

  let extra = '';
  if (shot.extra === 'weather') {
    const y = cardY + 24 + shot.rows.length * (rowH + 14);
    extra = `
      <rect x="${cardX}" y="${y}" width="${cardW}" height="${rowH}" rx="${radius}" fill="#121A2E"/>
      <text x="${cardX + 28}" y="${y + rowH * 0.45}" fill="#F8FAFC" font-size="${Math.round(w * 0.032)}" font-weight="600" font-family="system-ui, -apple-system, sans-serif">Bangkok  32°C  ·  THB 37.2 / EUR</text>
      <text x="${cardX + 28}" y="${y + rowH * 0.75}" fill="#8896B0" font-size="${Math.round(w * 0.022)}" font-family="system-ui, -apple-system, sans-serif">Partly cloudy  ·  Route tracked</text>
    `;
  }
  if (shot.extra === 'landing') {
    const y = cardY + 24 + shot.rows.length * (rowH + 14);
    extra = `
      <rect x="${cardX}" y="${y}" width="${cardW}" height="${Math.round(rowH * 1.35)}" rx="${radius}" fill="#121A2E"/>
      <text x="${cardX + 28}" y="${y + 48}" fill="#C9A84C" font-size="${Math.round(w * 0.03)}" font-weight="700" font-family="system-ui, -apple-system, sans-serif">AFTER LANDING</text>
      <text x="${cardX + 28}" y="${y + 96}" fill="#F8FAFC" font-size="${Math.round(w * 0.028)}" font-family="system-ui, -apple-system, sans-serif">Grab · Taxi · Weather 31°C · USD 1 = THB 36.4</text>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0F1E"/>
      <stop offset="55%" stop-color="#0B1F3A"/>
      <stop offset="100%" stop-color="#12284D"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w * 0.88}" cy="${h * 0.08}" r="${w * 0.32}" fill="#C9A84C" fill-opacity="0.12"/>
  <circle cx="${w * 0.1}" cy="${h * 0.92}" r="${w * 0.28}" fill="#1A2F5A" fill-opacity="0.9"/>
  <text x="${pad + Math.round(w * 0.14)}" y="${Math.round(h * 0.085)}" fill="#C9A84C" font-size="${Math.round(w * 0.028)}" font-weight="700" font-family="system-ui, -apple-system, sans-serif">WAIAIR</text>
  <text x="${pad}" y="${Math.round(h * 0.20)}" fill="#F8FAFC" font-size="${headlineSize}" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${esc(shot.headline)}</text>
  <text x="${pad}" y="${Math.round(h * 0.235)}" fill="#8896B0" font-size="${subSize}" font-family="system-ui, -apple-system, sans-serif">${esc(shot.sub)}</text>
  ${rows}
  ${extra}
  <text x="${w / 2}" y="${h - pad}" text-anchor="middle" fill="#8896B0" font-size="${Math.round(w * 0.022)}" font-family="system-ui, -apple-system, sans-serif">Live gates · Delays · Track flights</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const logoExists = fs.existsSync(path.resolve(logoPath));

  for (const size of SIZES) {
    const dir = path.join(outDir, size.folder);
    fs.mkdirSync(dir, { recursive: true });
    const logoSize = Math.round(size.w * 0.12);
    const logoBuf = logoExists
      ? await sharp(logoPath).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      : null;
    for (const shot of SHOTS) {
      const svg = frameSvg(size.w, size.h, shot);
      const dest = path.join(dir, `${shot.file}.png`);
      let img = sharp(Buffer.from(svg));
      if (logoBuf) {
        img = img.composite([{ input: logoBuf, left: Math.round(size.w * 0.07), top: Math.round(size.h * 0.04) }]);
      }
      await img.png().toFile(dest);
      console.log(dest);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
