import { launch } from './browser.mjs';
import fs from 'node:fs';
const out = process.env.NAN_OUT || 'build/nan-hunt';
fs.mkdirSync(out, { recursive: true });
const variants = process.argv.slice(2);
const b = await launch();
for (const v of variants) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto(`http://127.0.0.1:5178/film.html?edit=main&w=960&h=540&nobloom=1&${v}`);
  await p.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90000 });
  await p.evaluate(() => window.FILM.render(3));
  // Count pure-black pixels in the canvas centre region via a readback.
  const n = await p.evaluate(() => { const c = document.querySelector('canvas'); const x = document.createElement('canvas'); x.width = c.width; x.height = c.height; const g = x.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) k++; return k; });
  await p.screenshot({ path: `${out}/nan-${v.replace(/[^a-z]/g, '') || 'base'}.png` });
  console.log(v || 'base', 'black pixels', n);
  await p.close();
}
await b.close();
