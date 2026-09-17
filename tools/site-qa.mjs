// Interactive QA of the story page: playback, pause, seeking backwards,
// chapter jumps, replay, view toggles, the full three-question quiz, share
// dialog, overflow, qualifier visibility, console errors and frame rate.
// node tools/site-qa.mjs <outDir>
import { launch } from './browser.mjs';
import fs from 'node:fs';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const base = process.env.FLY_BASE || 'http://127.0.0.1:5178';
const configs = [
  { name: 'desktop-1920', viewport: { width: 1920, height: 1080 }, dpr: 1 },
  { name: 'retina-1440', viewport: { width: 1440, height: 900 }, dpr: 2 },
  { name: 'laptop-1366', viewport: { width: 1366, height: 768 }, dpr: 1 },
  { name: 'phone-390', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true },
  { name: 'reduced-1440', viewport: { width: 1440, height: 900 }, dpr: 1, reduced: true },
  { name: 'nowebgl-1440', viewport: { width: 1440, height: 900 }, dpr: 1, args: ['--disable-webgl', '--disable-3d-apis'] }
];
const results = [];
for (const c of configs) {
  const b = await launch({ args: c.args || [] });
  const ctx = await b.newContext({ viewport: c.viewport, deviceScaleFactor: c.dpr, isMobile: !!c.mobile, hasTouch: !!c.mobile, reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 160)); });
  p.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });
  const r = { name: c.name, checks: {} };
  const check = (k, v) => { r.checks[k] = v; };
  const time = () => p.$eval('#time', e => e.textContent);
  const shot = n => p.screenshot({ path: `${out}/${c.name}-${n}.png` });
  try {
    await p.goto(`${base}/index.html`);
    await p.waitForFunction(() => !document.querySelector('#play').disabled && document.body.dataset.renderer, undefined, { timeout: 90000 });
    check('renderer', await p.evaluate(() => document.body.dataset.renderer));
    await p.waitForTimeout(800);
    await shot('home');
    const layout = await p.evaluate(() => {
      const vis = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && r.left >= 0 && r.right <= innerWidth + 1; };
      return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, qualifier: vis('#qualifier'), signal: vis('#signalLabel'), headline: vis('#stageHeadline'), watch: vis('#startStory'), soundDefault: document.querySelector('#sound').getAttribute('aria-pressed') };
    });
    check('layout', layout);
    // Play, then pause.
    await p.click('#play');
    await p.waitForTimeout(2500);
    const t1 = await time();
    await p.click('#play');
    await p.waitForTimeout(1200);
    const t2 = await time();
    await p.waitForTimeout(1200);
    const t3 = await time();
    check('playAdvances', t1 !== '00:00 / 01:08');
    check('pauseHolds', t2 === t3);
    await shot('playing');
    // Chapter jump forward, then seek backwards with the scrubber.
    await p.evaluate(() => document.querySelector('[data-seek="56"]').click());
    await p.waitForTimeout(700);
    check('chapterJump', await p.$eval('#pageNumber', e => e.textContent));
    await shot('verdict');
    await p.evaluate(() => { const s = document.querySelector('#scrub'); s.value = 12; s.dispatchEvent(new Event('input')); });
    await p.waitForTimeout(700);
    check('seekBack', { time: await time(), panel: await p.$eval('#storyPanel .eyebrow', e => e.textContent) });
    await shot('seek-back-12');
    for (const t of [24, 45, 53]) {
      await p.evaluate(t => { const s = document.querySelector('#scrub'); s.value = t; s.dispatchEvent(new Event('input')); }, t);
      await p.waitForTimeout(700);
      await shot(`t${t}`);
      const vis = await p.evaluate(() => ({ q: document.querySelector('#qualifier').innerText.replace(/\n/g, ' '), sig: document.querySelector('#signalLabel').innerText }));
      check(`labels${t}`, vis);
    }
    // Replay from the end, starting from a paused state.
    if ((await p.getAttribute('#play', 'aria-label')) === 'Pause story') await p.click('#play');
    await p.evaluate(() => { const s = document.querySelector('#scrub'); s.value = 67.6; s.dispatchEvent(new Event('input')); });
    await p.click('#play');
    await p.waitForFunction(() => document.querySelector('#time').textContent.startsWith('01:08'), undefined, { timeout: 8000 });
    const ended = await time();
    await p.click('#play');
    await p.waitForTimeout(1200);
    check('replay', { ended, restarted: await time() });
    if ((await p.getAttribute('#play', 'aria-label')) === 'Pause story') await p.click('#play');
    // Views.
    for (const v of ['fly', 'brain', 'both']) {
      await p.evaluate(v => document.querySelector(`[data-view="${v}"]`).click(), v);
      await p.waitForTimeout(500);
      if (v !== 'both') await shot(`view-${v}`);
    }
    check('viewsPressed', await p.evaluate(() => document.querySelector('[data-view="both"]').getAttribute('aria-pressed')));
    // Quiz: three answers and the result.
    await p.evaluate(() => document.querySelector('#navQuiz').click());
    await p.waitForTimeout(500);
    for (let i = 0; i < 3; i++) {
      await p.click(`[data-answer="${i % 4}"]`);
      await p.waitForTimeout(250);
      if (i === 0) await shot('quiz-answered');
      await p.click('#nextQuiz');
      await p.waitForTimeout(300);
    }
    check('quizResult', await p.$eval('#storyPanel .eyebrow', e => e.textContent));
    await shot('quiz-result');
    await p.click('#quizHome');
    await p.waitForTimeout(400);
    check('backHome', await p.$eval('#storyPanel h1', e => e.textContent));
    // Share dialog.
    await p.click('#share');
    await p.waitForTimeout(300);
    check('shareOpen', await p.evaluate(() => document.querySelector('#shareDialog').open));
    await p.click('#closeShare');
    // Frame rate during the heaviest and a calm section.
    if (!c.args) {
      const fps = {};
      for (const t of [12, 45]) {
        await p.evaluate(t => { const s = document.querySelector('#scrub'); s.value = t; s.dispatchEvent(new Event('input')); }, t);
        await p.click('#play');
        fps[t] = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));
        await p.click('#play');
      }
      check('fpsHeadless', fps);
    }
    check('overflowAfter', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  } catch (e) { errors.push('qa ' + e.message.split('\n')[0]); }
  r.errors = errors;
  results.push(r);
  await b.close();
}
fs.writeFileSync(`${out}/site-qa.json`, JSON.stringify(results, null, 1));
for (const r of results) console.log(r.name, JSON.stringify(r.checks), r.errors.length ? 'ERRORS ' + JSON.stringify(r.errors.slice(0, 6)) : 'no errors');
