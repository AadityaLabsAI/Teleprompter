import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'dist/index.html',
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'dist/teleqen-mark.svg',
];

for (const relative of required) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing build output: ${relative}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Teleqen') throw new Error('Manifest name mismatch');
if (manifest.start_url !== '/') throw new Error('Manifest start_url mismatch');
if (manifest.display !== 'standalone') throw new Error('Manifest display should be standalone');
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) throw new Error('Manifest has no icons');

const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
for (const marker of ['Teleqen', '/manifest.webmanifest', '/teleqen-mark.svg']) {
  if (!html.includes(marker)) throw new Error(`Missing HTML marker: ${marker}`);
}

const sw = fs.readFileSync(path.join(root, 'dist/sw.js'), 'utf8');
for (const marker of ['teleqen-shell-v2', 'skipWaiting', 'clients.claim']) {
  if (!sw.includes(marker)) throw new Error(`Missing service-worker marker: ${marker}`);
}

console.log('Teleqen smoke checks passed.');
