// High-resolution poster, social card and a labelled contact sheet source.
import { launch } from './browser.mjs';
const base = process.env.FLY_BASE || 'http://127.0.0.1:5178';
const b = await launch();
async function shot(w, h, t, path, edit = 'main') {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`${base}/film.html?edit=${edit}&w=${w}&h=${h}`);
  await p.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90000 });
  await p.evaluate(x => window.FILM.render(x), t);
  await p.screenshot({ path, type: path.endsWith('.jpg') ? 'jpeg' : 'png', quality: path.endsWith('.jpg') ? 92 : undefined });
  await p.close();
}
await shot(3840, 2160, 45, 'build/film/FLY-poster-4k.png');
await shot(1920, 1080, 45, 'build/film/FLY-poster.jpg');
await shot(1200, 630, 66, 'build/film/FLY-og.jpg');
for (const t of [0.5, 4, 12, 22, 30, 38, 45, 52, 60, 66]) await shot(960, 540, t, `build/stills/sheet-${String(t).padStart(4, '0')}.png`);
await b.close();
console.log('stills done');
