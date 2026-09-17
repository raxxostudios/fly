// Geometry QA across the story timeline: paper separation, camera and fly
// clearance, claw contact and foot skating. Prints a JSON summary and exits
// non-zero on any violation. Authored-scene checks, not physics validation.
import { launch } from './browser.mjs';
import { beats } from '../dist/timeline.js';
const step = Number(process.env.STEP || 1 / 15), from = Number(process.env.FROM || 0), to = Number(process.env.TO || 68);
const SHEET = [5.2 / 2, 7.35 / 2];
const b = await launch();
const p = await b.newPage({ viewport: { width: 480, height: 270 } });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(`${process.env.FLY_BASE || 'http://127.0.0.1:5178'}/film.html?w=480&h=270`);
await p.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90000 });
const times = []; for (let t = from; t <= to + 1e-9; t += step) times.push(+t.toFixed(4));
const frames = await p.evaluate(ts => ts.map(t => { const r = window.FILM.probe(t); return { t, ...r }; }), times);
await b.close();

const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
function obb(s) {
  const m = s.matrix;
  const ax = [norm([m[0], m[1], m[2]]), norm([m[4], m[5], m[6]]), norm([m[8], m[9], m[10]])];
  return { c: [m[12], m[13], m[14]], ax, h: [SHEET[0], SHEET[1], .9 * Math.abs(s.curl) + Math.abs(s.flutter) + .004], name: s.name };
}
function overlap(A, B) {
  const axes = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const c of B.ax) { const x = cross(a, c); if (Math.hypot(...x) > 1e-6) axes.push(norm(x)); }
  const d = sub(B.c, A.c);
  let minSep = Infinity;
  for (const L of axes) {
    const ra = A.h.reduce((s, h, i) => s + h * Math.abs(dot(A.ax[i], L)), 0);
    const rb = B.h.reduce((s, h, i) => s + h * Math.abs(dot(B.ax[i], L)), 0);
    const sep = Math.abs(dot(d, L)) - (ra + rb);
    if (sep > 0) return { hit: false, sep };
    minSep = Math.min(minSep, -sep);
  }
  return { hit: true, depth: minSep };
}
function pointDist(P, B) { // distance from point to OBB
  const d = sub(P, B.c); let s = 0;
  for (let i = 0; i < 3; i++) { const v = dot(d, B.ax[i]); const e = Math.max(0, Math.abs(v) - B.h[i]); s += e * e; }
  return Math.sqrt(s);
}
const issues = { sheetPairs: [], camera: [], fly: [], desk: [], contact: [], skate: [], ik: [] };
let prev = null, minCam = Infinity, minFly = Infinity, maxIk = 0, maxSkate = 0;
for (const f of frames) {
  const bt = beats(f.t);
  const vis = f.sheets.filter(s => s.visible).map(obb);
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    // Two flat sheets resting on the desk may overlap in plan at different heights; SAT handles it.
    const r = overlap(vis[i], vis[j]);
    if (r.hit) issues.sheetPairs.push([f.t, vis[i].name, vis[j].name, +r.depth.toFixed(3)]);
  }
  for (const s of vis) {
    const dc = pointDist(f.cam, s); minCam = Math.min(minCam, dc);
    if (dc < .6) issues.camera.push([f.t, s.name, +dc.toFixed(3)]);
    // Fly body approximated as a sphere around the thorax, radius 1.5.
    const df = pointDist([f.body[0], f.body[1], f.body[2]], s) - 1.5; minFly = Math.min(minFly, df);
    if (df < 0 && !/form-under-fly/.test(s.name)) issues.fly.push([f.t, s.name, +df.toFixed(3)]);
    const low = s.c[1] - Math.abs(s.ax[0][1]) * s.h[0] - Math.abs(s.ax[1][1]) * s.h[1] - Math.abs(s.ax[2][1]) * s.h[2];
    if (low < -.002) issues.desk.push([f.t, s.name, +low.toFixed(3)]);
  }
  if (f.cam[1] < .3) issues.camera.push([f.t, 'camera-below-0.3', f.cam[1]]);
  const flight = bt.landing < 1;
  f.claws.forEach((c, i) => {
    const front = i === 0 || i === 3;
    const free = flight || (front && bt.groom > 0);
    if (free) return;
    if (Math.abs(c[1] - f.footY) > .02) issues.contact.push([f.t, i, +c[1].toFixed(4)]);
    if (prev && !(beats(prev.t).landing < 1) && !(front && beats(prev.t).groom > 0)) {
      const pc = prev.claws[i], dxz = Math.hypot(c[0] - pc[0], c[2] - pc[2]);
      maxSkate = Math.max(maxSkate, dxz);
      if (dxz > .01) issues.skate.push([f.t, i, +dxz.toFixed(4)]);
    }
  });
  maxIk = Math.max(maxIk, f.ik);
  if (f.ik > .02) issues.ik.push([f.t, +f.ik.toFixed(4)]);
  prev = f;
}
const summary = { frames: frames.length, from, to, step: +step.toFixed(4), minCameraToSheet: +minCam.toFixed(3), minFlyClearance: +minFly.toFixed(3), maxIkError: +maxIk.toFixed(5), maxPlantedClawSlip: +maxSkate.toFixed(5), counts: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])) };
console.log(JSON.stringify(summary, null, 1));
for (const [k, v] of Object.entries(issues)) {
  if (!v.length) continue;
  const groups = new Map();
  for (const row of v) {
    const key = row.slice(1, k === 'sheetPairs' ? 3 : 2).join(' x ');
    const g = groups.get(key) || { from: row[0], to: row[0], n: 0, worst: 0 };
    g.to = row[0]; g.n++; g.worst = Math.max(g.worst, Math.abs(row[row.length - 1]) || 0);
    groups.set(key, g);
  }
  console.log(k);
  for (const [key, g] of [...groups].slice(0, 40)) console.log('  ', key, g.from, '->', g.to, 'n', g.n, 'worst', g.worst);
}
process.exit(Object.values(issues).some(v => v.length) ? 1 : 0);
