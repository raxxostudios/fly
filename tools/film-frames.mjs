// Render selected film frames to PNG for visual QA.
// node tools/film-frames.mjs <outDir> <edit> <w> <h> t1 t2 ...
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [out, edit = 'main', w = '1920', h = '1080', ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs = [];
p.on('console', m => { if (m.type() !== 'log' || /error|warn/i.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
const base = process.env.FLY_BASE || 'http://127.0.0.1:5178';
await p.goto(`${base}/film.html?edit=${edit}&w=${w}&h=${h}${process.env.PROBE ? '&probe=1' : ''}`);
await p.waitForFunction(() => document.body.dataset.ready === '1' || document.body.dataset.error, undefined, { timeout: 90000 });
const err = await p.evaluate(() => document.body.dataset.error);
if (err) { console.log('BOOT ERROR', err, logs.join('\n')); process.exit(1); }
for (const t of times) {
  const t0 = Date.now();
  const r = await p.evaluate(t => window.FILM.render(t), Number(t));
  await p.screenshot({ path: `${out}/${edit}-${String(t).padStart(5, '0')}.png` });
  console.log(t, 'story', r.story.toFixed(2), 'ms', Date.now() - t0, r.probe ? JSON.stringify({ ik: r.probe.ik }) : '');
}
console.log(logs.slice(0, 30).join('\n'));
await b.close();
