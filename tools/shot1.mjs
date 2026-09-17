import { launch } from './browser.mjs';
const [query, t, out] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:5178/film.html?w=960&h=540&${query}`);
await p.waitForFunction(() => document.body.dataset.ready === '1' || document.body.dataset.error, undefined, { timeout: 90000 });
for (const tt of t.split(',')) { await p.evaluate(x => window.FILM.render(x), Number(tt)); await p.screenshot({ path: out.replace('.png', `-${tt}.png`) }); }
await b.close();
