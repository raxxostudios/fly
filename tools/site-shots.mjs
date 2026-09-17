// Screenshot the story page at given viewport and story times, with console capture.
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [out, w, h, ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(process.env.DPR || 1), isMobile: Number(w) < 800, hasTouch: Number(w) < 800, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
p.on('requestfailed', r => logs.push('requestfailed: ' + r.url()));
p.on('response', r => { if (r.status() >= 400) logs.push(`http ${r.status()}: ${r.url()}`); });
await p.goto(`${process.env.FLY_BASE || 'http://127.0.0.1:5178'}/index.html${process.env.QUERY || ''}`);
await p.waitForFunction(() => !document.querySelector('#play').disabled && document.body.dataset.renderer, undefined, { timeout: 90000 });
await p.waitForTimeout(1200);
const tag = `${w}x${h}${process.env.REDUCED ? '-reduced' : ''}`;
await p.screenshot({ path: `${out}/${tag}-home.png` });
for (const t of times) {
  if (t === 'quiz') {
    await p.click('#navQuiz'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${tag}-quiz.png`, fullPage: false });
    continue;
  }
  await p.evaluate(t => { const s = document.querySelector('#scrub'); s.value = t; s.dispatchEvent(new Event('input')); }, Number(t));
  await p.waitForTimeout(500);
  if (process.env.SCROLLPANEL) await p.evaluate(() => document.querySelector('#document').scrollIntoView());
  await p.screenshot({ path: `${out}/${tag}-t${String(t).padStart(2, '0')}.png` });
}
const metrics = await p.evaluate(() => ({ renderer: document.body.dataset.renderer, docW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
console.log(JSON.stringify(metrics));
console.log(logs.join('\n'));
await b.close();
