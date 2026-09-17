// Same story instant must give identical pixels whatever was rendered before.
import { launch } from './browser.mjs';
import crypto from 'node:crypto';
const b = await launch();
async function hashAt(order) {
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto(`${process.env.FLY_BASE || 'http://127.0.0.1:5178'}/film.html?w=640&h=360`);
  await p.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90000 });
  const out = {};
  for (const t of order) {
    await p.evaluate(x => window.FILM.render(x), t);
    const png = await p.screenshot();
    out[t] = crypto.createHash('sha256').update(png).digest('hex').slice(0, 16);
  }
  await p.close();
  return out;
}
const targets = [3, 12.5, 24, 36, 45, 53, 60, 66];
const forward = await hashAt(targets);
const backward = await hashAt([67, 50, 20, ...[...targets].reverse(), 5, ...targets]);
const rows = targets.map(t => ({ t, forward: forward[t], afterSeeks: backward[t], same: forward[t] === backward[t] }));
console.table(rows);
await b.close();
process.exit(rows.every(r => r.same) ? 0 : 1);
