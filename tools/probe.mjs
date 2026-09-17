import { launch } from './browser.mjs';
const times = process.argv.slice(2).map(Number);
const b = await launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto('http://127.0.0.1:5178/film.html?edit=main&w=960&h=540');
await p.waitForFunction(() => document.body.dataset.ready === '1' || document.body.dataset.error, undefined, { timeout: 90000 });
for (const t of times) {
  const r = await p.evaluate(t => window.FILM.probe(t), t);
  console.log(t, JSON.stringify({ ik: r.ik, claws: r.claws.map(c => c.map(v => +v.toFixed(3))), eyes: r.eyes.map(c => c.map(v => +v.toFixed(3))), anatomy: r.anatomy.map(v => +v.toFixed(3)), cam: r.cam.map(v => +v.toFixed(2)) }));
}
await b.close();
