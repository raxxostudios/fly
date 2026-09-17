import { launch } from './browser.mjs';
const out = process.argv[2];
const b = await launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
p.on('console', m => logs.push(m.type() + ': ' + m.text()));
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
await p.goto('http://127.0.0.1:5178/index.html');
await p.waitForFunction(() => !document.querySelector('#play').disabled && !document.querySelector('#sceneLoading'), undefined, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/home.png` });
for (const t of [2, 12, 25, 30, 38, 45, 52, 60, 66]) {
  await p.evaluate(t => { const s = document.querySelector('#scrub'); s.value = t; s.dispatchEvent(new Event('input')); }, t);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/t${String(t).padStart(2, '0')}.png` });
}
console.log(logs.join('\n'));
await b.close();
