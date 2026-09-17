import * as THREE from 'three';
import { beats, clamp, lerp, smooth, smoother, hash, noise1 } from './timeline.js';

// Everything in this module is authored stage craft: props, paper and VFX.
// None of it is a neural recording. Measured highlights live in scene.js.

export const SHEET_W = 5.2, SHEET_H = 7.35;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "Menlo, 'Courier New', monospace";
const SANS = "'Helvetica Neue', Helvetica, sans-serif";

const FORMS = [
  { title: 'Antrag auf Einbürgerung', sub: 'für Antragstellende mit sechs Beinen', code: 'BZZ-26',
    fields: [['Name', 'Fliege, D. melanogaster'], ['Anzahl der Beine', '6'], ['Wohnsitz', 'Obstschale, Küche'], ['Deutschkenntnisse', '☐ ja   ☐ nein   ☒ summ'], ['Beigefügte Unterlagen', 'keine']] },
  { title: 'Anlage BZZ-27', sub: 'Nachweis der Flugfähigkeit', code: 'BZZ-27',
    fields: [['Flugstunden', 'unbekannt'], ['Landungen', 'viele'], ['Absturzursache', 'Fensterscheibe'], ['Bestätigt durch', '']] },
  { title: 'Meldebescheinigung', sub: 'Wohnsitz: Obstschale', code: 'MB-3',
    fields: [['Straße', 'Neben der Banane'], ['Etage', 'Tischplatte'], ['Mitbewohnende', 'Fruchtfliegen (ca. 40)'], ['Einzug', 'heute']] },
  { title: 'Erklärung zur Beinanzahl', sub: 'Bitte jedes Bein einzeln bestätigen', code: 'BN-6',
    fields: [['Bein 1', '☒'], ['Bein 2', '☒'], ['Bein 3', '☒'], ['Bein 4', '☒'], ['Bein 5', '☒'], ['Bein 6', '☒ (juckt)']] },
  { title: 'Übungsbogen', sub: 'Einbürgerungstest · 33 Fragen · 60 Minuten', code: 'ÜB-33',
    fields: [['Frage', '1 von 33'], ['A', '☐'], ['B', '☐'], ['C', '☐'], ['D', '☐'], ['Antwort', 'Enthaltung']] },
  { title: 'Fehlende Unterlagen', sub: 'Eilt. Bitte nachreichen.', code: 'EILT', acid: true,
    fields: [['Pass', 'fehlt'], ['Geburtsurkunde', 'fehlt'], ['Passfoto', 'unscharf (Flügel)'], ['Gebühr', 'eine Rosine']] },
  { title: 'Wartemarke', sub: 'Bitte Platz nehmen. Oder schweben.', code: 'W-0815',
    fields: [['Ihre Nummer', '0815'], ['Aufgerufen', '9999'], ['Geschätzte Wartezeit', 'ein Fliegenleben']] }
];
export const VERDICT_FORM = { title: 'Formular BZZ-27', sub: 'Bitte vollständig ausfüllen und erneut einreichen', code: 'BZZ-27', verdict: true,
  fields: [['Übungsprüfung', 'Enthaltung ×33'], ['Lesen', 'noch nicht'], ['Bemerkung', 'Bitte mit Formular BZZ-27 wiederkommen']] };

function drawForm(form, seed) {
  const W = 768, H = 1086, c = canvas(W, H), x = c.getContext('2d');
  const paper = form.acid ? '#e3fc02' : form.verdict ? '#f6f2df' : '#f0eee4';
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  // Fibre and tone variation so sheets never read as flat quads.
  for (let i = 0; i < 2600; i++) {
    const a = hash(i, seed) * W, b = hash(i + 7919, seed) * H;
    x.fillStyle = `rgba(90,80,60,${.018 + hash(i + 31, seed) * .03})`;
    x.fillRect(a, b, 1 + hash(i + 3, seed) * 3, 1);
  }
  const g = x.createRadialGradient(W * .5, H * .45, H * .2, W * .5, H * .5, H * .8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,45,20,.12)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const ink = '#1d241c', soft = '#5b6153';
  x.fillStyle = ink; x.font = `600 21px ${SANS}`; x.letterSpacing = '3px';
  x.fillText('AMT FÜR FLIEGENANGELEGENHEITEN', 58, 78);
  x.letterSpacing = '0px'; x.font = `500 20px ${MONO}`; x.textAlign = 'right';
  x.fillText(form.code, W - 58, 78); x.textAlign = 'left';
  x.fillRect(58, 98, W - 116, 3);
  x.font = `500 ${form.title.length > 20 ? 50 : 58}px ${SERIF}`; x.fillText(form.title, 58, 186);
  x.font = `italic 27px ${SERIF}`; x.fillStyle = soft; x.fillText(form.sub, 58, 232);
  let y = 312;
  for (const [label, value] of form.fields) {
    x.fillStyle = soft; x.font = `500 17px ${MONO}`; x.fillText(label.toUpperCase(), 58, y);
    x.strokeStyle = '#9aa092'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(58, y + 50); x.lineTo(W - 58, y + 50); x.stroke();
    x.fillStyle = '#23407a'; x.font = `italic 30px ${SERIF}`; x.fillText(value, 70, y + 40);
    y += 96;
  }
  // Signature scribble, deterministic per sheet.
  x.strokeStyle = '#23407a'; x.lineWidth = 2.4; x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const px = 70 + i * 7, py = H - 190 + Math.sin(i * .9 + seed) * 14 * hash(i, seed + 5);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  x.fillStyle = soft; x.font = `500 15px ${MONO}`;
  x.fillText('UNTERSCHRIFT (ODER FUSSABDRUCK)', 58, H - 150);
  x.fillRect(58, H - 112, W - 116, 1.5);
  x.fillText('FIKTIVES FORMULAR · SATIRE · KEIN AMTLICHES DOKUMENT', 58, H - 76);
  if (form.verdict) {
    x.save(); x.translate(W * .56, H * .6); x.rotate(-.21);
    x.strokeStyle = 'rgba(173,44,30,.88)'; x.fillStyle = 'rgba(173,44,30,.88)'; x.lineWidth = 7;
    x.strokeRect(-250, -64, 500, 128); x.lineWidth = 2.5; x.strokeRect(-238, -52, 476, 104);
    x.font = `700 58px ${SANS}`; x.textAlign = 'center'; x.fillText('WIEDERVORLAGE', 0, 20);
    x.restore();
  }
  return c;
}

function drawWood() {
  const W = 1024, H = 1024, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#231710'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) {
    const y0 = hash(i, 71) * H, amp = 6 + hash(i, 72) * 30, f = .002 + hash(i, 73) * .006;
    x.strokeStyle = `rgba(${hash(i, 74) > .5 ? '120,74,40' : '12,8,6'},${.05 + hash(i, 75) * .16})`;
    x.lineWidth = .6 + hash(i, 76) * 2.6; x.beginPath();
    for (let px = 0; px <= W; px += 16) { const py = y0 + Math.sin(px * f + i) * amp + Math.sin(px * f * 3.1) * amp * .2; px ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  }
  return c;
}
function drawRoughness() {
  const W = 512, H = 512, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${hash(i, 9) > .5 ? '255,255,255' : '0,0,0'},${.04 + hash(i, 10) * .1})`;
    x.beginPath(); x.ellipse(hash(i, 11) * W, hash(i, 12) * H, 4 + hash(i, 13) * 40, 1 + hash(i, 14) * 5, hash(i, 15) * 3, 0, TAU); x.fill();
  }
  return c;
}
function drawLabel(lines, opts = {}) {
  const W = opts.w || 512, H = opts.h || 256, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = opts.bg || '#e9e2cf'; x.fillRect(0, 0, W, H);
  x.fillStyle = opts.ink || '#2a2419'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = opts.font || `600 64px ${SERIF}`;
  lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * (opts.lead || 76)));
  return c;
}
function drawGlow(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.25, inner.replace(/[\d.]+\)$/, '.35)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}

// ------------------------------------------------------------ environment
function environmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x07090a);
  const box = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x0c0d0e, side: THREE.BackSide }));
  room.add(box);
  const add = (geo, color, pos, look) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })); m.position.set(...pos); if (look) m.lookAt(0, 0, 0); room.add(m); };
  add(new THREE.SphereGeometry(1.6, 16, 12), new THREE.Color(9, 6.2, 3.4), [12, 7, -8]);
  add(new THREE.PlaneGeometry(14, 5), new THREE.Color(.16, .22, .3), [-14, 5, -12], true);
  add(new THREE.PlaneGeometry(10, 2), new THREE.Color(.9, .66, .42), [4, 9.5, 10], true);
  add(new THREE.PlaneGeometry(6, 6), new THREE.Color(.25, .2, .45), [-10, 3, 14], true);
  const env = pmrem.fromScene(room, .03).texture;
  pmrem.dispose();
  return env;
}

function paperGeometry(segX = 8, segY = 11) {
  const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H, segX, segY);
  g.userData.base = Float32Array.from(g.attributes.position.array);
  return g;
}
// CPU bend: curl across the width, a travelling flutter along the height.
function bendSheet(g, curl, flutter, phase, lift) {
  const base = g.userData.base, p = g.attributes.position.array;
  let changed = false;
  for (let i = 0; i < p.length; i += 3) {
    const u = base[i] / (SHEET_W * .5), v = base[i + 1] / (SHEET_H * .5);
    const z = curl * u * u * .9 + flutter * Math.sin(v * 2.4 + phase) * (.35 + .65 * Math.abs(v)) + lift * Math.max(0, v) * Math.max(0, v) * .6;
    if (Math.abs(p[i + 2] - z) > 1e-5) { p[i + 2] = z; changed = true; }
  }
  if (changed) { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); }
}

function paperMaterial(map, back = 0xebe7da) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: .86, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .35 });
  m.onBeforeCompile = s => {
    s.uniforms.backTint = { value: new THREE.Color(back) };
    s.fragmentShader = 'uniform vec3 backTint;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nif(!gl_FrontFacing) diffuseColor.rgb = backTint * .94;');
  };
  m.customProgramCacheKey = () => 'paper-backside';
  return m;
}

// Build a stack of sheets as one box plus a textured top so props read as
// real paper with thickness, not planes.
function paperStack(count, topMap, seed) {
  const g = new THREE.Group(), h = count * .03;
  const side = canvas(64, 256), x = side.getContext('2d');
  x.fillStyle = '#e7e1cf'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 256; i += 3) { x.fillStyle = `rgba(80,70,50,${.08 + hash(i, seed) * .2})`; x.fillRect(0, i, 64, 1); }
  const sideMat = new THREE.MeshStandardMaterial({ map: texture(side), roughness: .9 });
  const topMat = paperMaterial(topMap);
  const box = new THREE.Mesh(new THREE.BoxGeometry(SHEET_W, h, SHEET_H), [sideMat, sideMat, new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: .9 }), sideMat, sideMat, sideMat]);
  box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), topMat);
  top.rotation.x = -Math.PI / 2; top.position.y = h + .004; top.receiveShadow = true; g.add(top);
  for (let i = 0; i < 5; i++) {
    const loose = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), topMat);
    loose.rotation.set(-Math.PI / 2, 0, (hash(i, seed) - .5) * .35);
    loose.position.set((hash(i + 9, seed) - .5) * .6, h * (i / 5) + .01, (hash(i + 19, seed) - .5) * .6);
    loose.receiveShadow = true; g.add(loose);
  }
  return g;
}

export function createStage(scene, renderer, opts = {}) {
  const quality = opts.quality || 'high';
  const reduced = Boolean(opts.reducedMotion);
  const root = new THREE.Group(); root.name = 'authored-stage'; scene.add(root);
  const env = environmentMap(renderer);
  scene.environment = env;
  scene.environmentIntensity = .55;
  scene.fog = new THREE.FogExp2(0x07090a, .0105);

  // Desk: polished dark walnut, mirror-like enough to catch the lamp.
  const wood = texture(drawWood(), [3, 2]);
  const rough = new THREE.CanvasTexture(drawRoughness()); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(6, 4);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.MeshPhysicalMaterial({
    map: wood, roughness: .62, roughnessMap: rough, metalness: 0, clearcoat: .22, clearcoatRoughness: .3, envMapIntensity: .3
  }));
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; desk.name = 'desk'; root.add(desk);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(220, 90), new THREE.MeshStandardMaterial({ color: 0x0d0f0f, roughness: .95 }));
  back.position.set(0, 30, -62); root.add(back);

  const forms = FORMS.map((f, i) => texture(drawForm(f, 11 + i)));
  const verdictMap = texture(drawForm(VERDICT_FORM, 97));

  // Background props. Positions keep them out of every authored camera path.
  const stacks = [
    [-15, -10, 60, 0, .3], [11, -13, 110, 2, -.2], [16.5, -6, 40, 3, .5], [-21, 2, 90, 4, -.4], [23, 4, 70, 6, .1]
  ];
  for (const [x, z, n, map, ry] of stacks) { const s = paperStack(n, forms[map], n); s.position.set(x, 0, z); s.rotation.y = ry; root.add(s); }
  const binderLabels = ['Anträge', 'Nachweise', 'Formulare', 'Integration', 'Warten'];
  binderLabels.forEach((label, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1e1c, roughness: .55 });
    const spine = texture(drawLabel([label], { w: 512, h: 128, font: `600 58px ${SERIF}`, bg: '#e6dfcb' }));
    const labelMat = new THREE.MeshStandardMaterial({ map: spine, roughness: .8 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 6.5), [mat, labelMat, mat, mat, mat, mat]);
    b.position.set(-27 + (hash(i, 3) - .5) * .6, 1.1 + i * 2.25, -18 + (hash(i, 4) - .5) * .8);
    b.rotation.y = .5 + (hash(i, 5) - .5) * .12; b.castShadow = b.receiveShadow = true; root.add(b);
  });
  // Brass lamp.
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc89a55, metalness: 1, roughness: .22, clearcoat: .3 });
  const lamp = new THREE.Group(); lamp.position.set(20, 0, -20); root.add(lamp);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, .7, 48), brass); base.position.y = .35; lamp.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, 17, 16), brass); pole.position.y = 8.8; lamp.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, 9, 16), brass); arm.position.set(-3.6, 17, 1.8); arm.rotation.z = 1.1; arm.rotation.y = -.45; lamp.add(arm);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 4.2, 4.2, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x1d3a2a, metalness: .6, roughness: .3, side: THREE.DoubleSide, clearcoat: 1 }));
  shade.position.set(-7.4, 17.2, 3.6); shade.rotation.z = .55; shade.rotation.x = -.3; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.2) }));
  bulb.position.set(-8.1, 15.9, 4); lamp.add(bulb);
  // Plain mug with a thin brass band; no invented slogans.
  const mugText = texture(drawLabel([''], { w: 1024, h: 512, bg: '#15191a' }));
  { const g = mugText.image.getContext('2d'); g.fillStyle = '#b8924e'; g.fillRect(0, 60, 1024, 10); g.fillRect(0, 442, 1024, 4); mugText.needsUpdate = true; }
  mugText.wrapS = THREE.RepeatWrapping;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 7.4, 64, 1, true), new THREE.MeshPhysicalMaterial({ map: mugText, roughness: .25, clearcoat: 1, clearcoatRoughness: .08 }));
  mug.position.set(-24, 3.7, -15); mug.rotation.y = 1.9; mug.castShadow = true; root.add(mug);
  const mugTop = new THREE.Mesh(new THREE.CircleGeometry(2.85, 48), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: .1 }));
  mugTop.rotation.x = -Math.PI / 2; mugTop.position.set(-24, 6.6, -15); root.add(mugTop);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.6, .38, 16, 32), mug.material); handle.position.set(-26.8, 3.8, -14.2); handle.rotation.y = 1.9; root.add(handle);
  // Fountain pen.
  const pen = new THREE.Group(); pen.position.set(9, .42, 7.5); pen.rotation.y = -.35; root.add(pen);
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0c, roughness: .38, clearcoat: .35, clearcoatRoughness: .3 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.42, .38, 11, 32), lacquer); barrel.rotation.z = Math.PI / 2; barrel.castShadow = true; pen.add(barrel);
  for (const x of [-2.6, -2.2, 3.4]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .18, 32), brass); ring.rotation.z = Math.PI / 2; ring.position.x = x; pen.add(ring); }
  const nib = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.6, 32), brass); nib.rotation.z = Math.PI / 2; nib.position.x = 6.3; pen.add(nib);
  // Wall sign, soft and far: reviewed fictional office name only.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshStandardMaterial({ map: texture(drawLabel(['AMT FÜR FLIEGENANGELEGENHEITEN'], { w: 1024, h: 256, bg: '#101312', ink: '#b99b62', font: `500 60px ${SERIF}` })), roughness: .7 }));
  sign.position.set(-6, 26, -60); root.add(sign);
  // Bokeh.
  const glow = texture(drawGlow('rgba(255,214,150,1)'));
  const bokeh = new THREE.Group(); root.add(bokeh);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i % 5 === 0 ? 0x7fb7d8 : 0xffc98a, transparent: true, opacity: .1 + hash(i, 41) * .16, depthWrite: false, fog: false }));
    s.position.set((hash(i, 42) - .5) * 180, 6 + hash(i, 43) * 40, -52 - hash(i, 44) * 6);
    s.scale.setScalar(3 + hash(i, 45) * 8); bokeh.add(s);
  }

  // Lights.
  const hemi = new THREE.HemisphereLight(0x9fb4c0, 0x2a1c10, .35); root.add(hemi);
  const key = new THREE.SpotLight(0xffc587, 520, 90, .5, .7, 1.6);
  key.position.set(12.5, 16, -16); key.target.position.set(0, 1, 0);
  key.castShadow = true; key.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048);
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 4; key.shadow.camera.near = 8; key.shadow.camera.far = 60;
  root.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fcfff, .75); rim.position.set(-10, 22, -26); root.add(rim);
  const fill = new THREE.DirectionalLight(0xffe6c7, .55); fill.position.set(6, 5, 16); root.add(fill);
  const neuralLight = new THREE.PointLight(0x7fd8ff, 0, 40, 1.4); root.add(neuralLight);
  const foreheadLight = new THREE.PointLight(0xfff1b0, 0, 8, 1.5); root.add(foreheadLight);

  // ----------------------------------------------------------- the paper
  // Authored separation, not a physics solver. Rules that keep sheets apart:
  // sheets that share a ring rotate rigidly together; air sheets change
  // height only while flat and inside unique height lanes, or while upright
  // on a transit radius that no ring uses; rings sit at different heights.
  const count = quality === 'low' ? 16 : 36;
  const baseForm = new THREE.Mesh(paperGeometry(1, 1), paperMaterial(forms[0]));
  // Page top points along the fly's heading so the title sits in front of it.
  baseForm.rotation.x = -Math.PI / 2; baseForm.rotation.z = -1.37; baseForm.position.set(.55, .012, -.2);
  baseForm.receiveShadow = true; baseForm.name = 'form-under-fly'; root.add(baseForm);
  const verdict = new THREE.Mesh(paperGeometry(1, 1), paperMaterial(verdictMap));
  verdict.rotation.x = -Math.PI / 2; verdict.receiveShadow = true; verdict.name = 'form-bzz-27'; root.add(verdict);

  const center = new THREE.Vector3(.25, 0, .35);
  const AIR_R = 11.5, LAYERS = [8.6, 17.2], TRANSIT = [20, 24], ROTATE_Y = [6, 7.5], SLOTS = 10;
  const DESK = [{ r: 14.5, y: .012, slots: 10 }, { r: 30, y: .014, slots: 20 }];
  const STACK_ANGLE = 2.95, STACK_R = 6.5, PILE_R = 21, PILE_ANGLES = [2.2, 3.6, 4.6];
  const stackPos = new THREE.Vector3(center.x + Math.cos(STACK_ANGLE) * STACK_R, 0, center.z + Math.sin(STACK_ANGLE) * STACK_R);
  const nAir = quality === 'low' ? 10 : 20, nCatch = 3, nDesk = count - nAir;
  const perLayer0 = Math.round(nAir / 2);
  const sheets = [];
  // Air sheets: layer 0 = catch sheets + top of stack; layer 1 = bottom of stack.
  const stackSheets = [];
  for (let a = 0; a < nAir; a++) {
    const layer = a < perLayer0 ? 0 : 1;
    const inLayer = layer === 0 ? a : a - perLayer0;
    const layerCount = layer === 0 ? perLayer0 : nAir - perLayer0;
    sheets.push({ kind: 'air', layer, catch: layer === 0 && inLayer < nCatch, slotAngle: Math.round(inLayer * SLOTS / layerCount) / SLOTS * TAU + layer * Math.PI / SLOTS });
  }
  // Stack order bottom to top: layer 1 first, then the non-catch layer 0 sheets.
  for (const s of sheets) if (!s.catch && s.layer === 1) stackSheets.push(s);
  for (const s of sheets) if (!s.catch && s.layer === 0) stackSheets.push(s);
  const S = stackSheets.length;
  stackSheets.forEach((s, k) => {
    s.stackIndex = k;
    s.slotY = .03 + k * .034;
    s.arrive = 27.1 + k * (4.2 / S);
    const q = S - 1 - k;                      // lift order, top first
    s.lift = 32 + q * .25;
    s.lane = .03 + (S - 1) * .034 + .3 + (S - q) * .04;
    s.fromAngle = STACK_ANGLE + (k % 2 ? 1 : -1) * (.5 + hash(k, 3) * .4);
  });
  let c = 0;
  for (const s of sheets) if (s.catch) { s.arrive = 30.3 + c * .35; c++; }
  // Desk sheets skim flat on two rings.
  for (let d = 0; d < nDesk; d++) {
    const ring = d % 2;
    const k = Math.floor(d / 2);
    sheets.push({ kind: 'desk', ring, slotAngle: (k + .5) * TAU / Math.ceil(nDesk / 2) + ring * .3, arrive: 29.4 + d * (3.4 / nDesk), deskY: DESK[ring].y + (k % 2) * .002 });
  }
  // Landing order: layer 0 first, then layer 1, each piles in turn.
  const air = sheets.filter(s => s.kind === 'air');
  const pileCount = [0, 0, 0];
  air.forEach((s, i) => {
    s.land = (s.layer === 0 ? 56 : 58.8) + (s.layer === 0 ? i : i - perLayer0) * .14;
    s.settleLane = 1 + i * .14;
    s.pile = i % 3;
    s.pileOrder = pileCount[s.pile]++;
  });
  sheets.forEach((s, i) => {
    const variant = 1 + (i % (forms.length - 1));
    s.geo = paperGeometry();
    s.mesh = new THREE.Mesh(s.geo, paperMaterial(forms[variant]));
    s.mesh.castShadow = true; s.mesh.receiveShadow = true; s.mesh.name = 'fictional-paperwork-' + i;
    root.add(s.mesh);
    s.phase = hash(i, 6) * TAU;
    s.flutterAmp = .12 + hash(i, 7) * .1;
    s.lean = .18 + hash(i, 8) * .1;
    s.yaw = (hash(i, 4) - .5) * .3;
    s.curl = 0; s.flutter = 0;
  });

  // Integral of the authored spin rate, closed form so any time can be sampled.
  const spinKeys = [[31.5, 0], [34, .45], [38, .8], [41, 1.2], [47, 1.2], [50, .6], [56, .45], [61, 0]];
  function spin(t) {
    let angle = 0;
    for (let i = 0; i < spinKeys.length - 1; i++) {
      const [t0, w0] = spinKeys[i], [t1, w1] = spinKeys[i + 1];
      if (t <= t0) break;
      const e = Math.min(t, t1), f = (e - t0) / (t1 - t0), we = lerp(w0, w1, f);
      angle += (w0 + we) * .5 * (e - t0);
    }
    return angle;
  }

  const tmpQ = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const flatQuat = (yaw, out) => out.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, yaw, 'XYZ'));
  // Tangential upright orientation at polar angle a.
  function wallQuat(a, lean, wobble, out) {
    Z.set(Math.cos(a), 0, Math.sin(a));
    X.set(-Math.sin(a), 0, Math.cos(a));
    Y.set(0, 1, 0).addScaledVector(Z, -lean).normalize();
    Z.crossVectors(X, Y).normalize();
    out.setFromRotationMatrix(m4.makeBasis(X, Y, Z));
    return out.premultiply(tmpQ.setFromAxisAngle(Z, wobble));
  }
  // Flat orientation whose page top points along the tangent at angle a.
  const flatAt = (a, yaw, out) => flatQuat(-a + yaw, out);
  const polar = (r, a, y, out) => out.set(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r);
  const angleLerp = (a, b, k) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; };
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), rm = new THREE.Matrix4();
  // Half height of a bent sheet's bounding slab for a given orientation.
  function verticalExtent(q, curl, flutter) {
    const e = rm.makeRotationFromQuaternion(q).elements;
    return Math.abs(e[1]) * SHEET_W / 2 + Math.abs(e[5]) * SHEET_H / 2 + Math.abs(e[9]) * (.9 * Math.abs(curl) + Math.abs(flutter) + .004);
  }

  function airPose(s, t, b) {
    const m = s.mesh, expand = 1 + .16 * b.burst + .42 * b.dive;
    const ringA = s.slotAngle + spin(t);
    const ringR = AIR_R * expand;
    const ringY = LAYERS[s.layer] + (s.layer ? 1.6 : .6) * b.burst + (s.layer ? 1.2 : .9) * b.dive + Math.sin(t * .6 + s.layer * 2) * .2;
    const wobble = Math.sin(t * 2.1 + s.phase) * .1;
    const wallCurl = .3 + .2 * Math.sin(t * 1.7 + s.phase);
    const wallFlutter = s.flutterAmp * (.6 + .4 * Math.sin(t * 3 + s.phase));
    const TR = TRANSIT[s.layer], RY = ROTATE_Y[s.layer];
    const stackTopY = s.slotY;
    let curl = 0, flutter = 0;
    if (s.catch) {
      // Straight down onto its slot from above; nothing else is up there yet.
      const k = smoother(s.arrive, s.arrive + 1.4, t);
      polar(ringR, ringA, lerp(28, ringY, k), m.position);
      wallQuat(ringA, s.lean, wobble, m.quaternion);
      curl = wallCurl; flutter = wallFlutter;
    } else if (t < s.lift) {
      // Falling onto the stack from alternating sides, then resting on it.
      const x = clamp((t - s.arrive) / .95), e = 1 - Math.pow(1 - x, 3);
      const tilt = (1 - x) * (1 - x) * .9;
      const a = lerp(s.fromAngle, STACK_ANGLE, e), r = lerp(STACK_R + 3, STACK_R, e);
      polar(r, a, lerp(10, s.slotY, e), m.position);
      flatQuat(s.yaw + (1 - e) * 1.6, m.quaternion).multiply(tmpQ.setFromEuler(new THREE.Euler(Math.sin(x * 6) * tilt, tilt * .7, 0)));
      curl = .4 * (1 - x); flutter = .2 * (1 - x);
      // Never below the sheet underneath: its top plus our own lower half.
      const ext = verticalExtent(m.quaternion, curl, flutter);
      const below = s.stackIndex > 0 ? stackSheets[s.stackIndex - 1] : null;
      const floor = below ? below.fallY + below.fallExt : .016;
      m.position.y = Math.max(m.position.y, floor + ext + .012);
      s.fallY = m.position.y; s.fallExt = ext;
    } else if (t < s.land) {
      const u = t - s.lift;
      if (u < .8) {
        // Slide flat out of the stack along its own radius, lifting to a lane.
        polar(lerp(STACK_R, TR, smoother(0, .8, u)), STACK_ANGLE, lerp(stackTopY, s.lane, smooth(0, .2, u)), m.position);
        flatQuat(s.yaw, m.quaternion);
      } else if (u < 2) {
        // Travel around the transit radius to the ring slot, still flat.
        const k = smoother(.8, 2, u);
        polar(TR, angleLerp(STACK_ANGLE, ringA, k), s.lane, m.position);
        flatQuat(s.yaw, qa); flatAt(ringA, 0, qb);
        m.quaternion.slerpQuaternions(qa, qb, k);
      } else if (u < 2.6) {
        polar(TR, ringA, lerp(s.lane, RY, smoother(2, 2.6, u)), m.position);
        flatAt(ringA, 0, m.quaternion);
      } else if (u < 3.3) {
        // Stand up above every lane.
        const k = smoother(2.6, 3.3, u);
        polar(TR, ringA, RY, m.position);
        flatAt(ringA, 0, qa); wallQuat(ringA, s.lean, wobble, qb);
        m.quaternion.slerpQuaternions(qa, qb, k);
        curl = wallCurl * k; flutter = wallFlutter * k;
      } else if (u < 4) {
        polar(TR, ringA, lerp(RY, ringY, smoother(3.3, 4, u)), m.position);
        wallQuat(ringA, s.lean, wobble, m.quaternion);
        curl = wallCurl; flutter = wallFlutter;
      } else {
        polar(lerp(TR, ringR, smoother(4, 5, u)), ringA, ringY, m.position);
        wallQuat(ringA, s.lean, wobble, m.quaternion);
        curl = wallCurl; flutter = wallFlutter;
      }
    }
    if (t >= s.land) {
      const u = t - s.land;
      curl = 0; flutter = 0;
      const pileA = PILE_ANGLES[s.pile] + s.pileOrder * .05;
      if (u < .8) {
        polar(lerp(ringR, TR, smoother(0, .8, u)), ringA, ringY, m.position);
        wallQuat(ringA, s.lean, wobble, m.quaternion);
        curl = wallCurl; flutter = wallFlutter;
      } else if (u < 1.2) {
        polar(TR, ringA, lerp(ringY, RY, smoother(.8, 1.2, u)), m.position);
        wallQuat(ringA, s.lean, wobble, m.quaternion);
        curl = wallCurl; flutter = wallFlutter;
      } else if (u < 1.8) {
        const k = smoother(1.2, 1.8, u);
        polar(TR, ringA, RY, m.position);
        wallQuat(ringA, s.lean, wobble, qa); flatAt(ringA, 0, qb);
        m.quaternion.slerpQuaternions(qa, qb, k);
        curl = wallCurl * (1 - k); flutter = wallFlutter * (1 - k);
      } else if (u < 2.3) {
        polar(TR, ringA, lerp(RY, s.settleLane, smoother(1.8, 2.3, u)), m.position);
        flatAt(ringA, 0, m.quaternion);
      } else if (u < 3.2) {
        const k = smoother(2.3, 3.2, u);
        polar(lerp(TR, PILE_R, k), angleLerp(ringA, pileA, k), s.settleLane, m.position);
        flatAt(ringA, 0, qa); flatQuat(-pileA + .4 + s.yaw, qb);
        m.quaternion.slerpQuaternions(qa, qb, k);
      } else {
        const k = smoother(3.2, 3.6, u);
        polar(PILE_R, pileA, lerp(s.settleLane, .03 + s.pileOrder * .034, k), m.position);
        flatQuat(-pileA + .4 + s.yaw, m.quaternion);
      }
    }
    s.curl = curl; s.flutter = flutter;
  }

  function deskPose(s, t, b) {
    const m = s.mesh, ring = DESK[s.ring];
    const a = s.slotAngle + spin(t) * (s.ring ? .35 : .55);
    const k = smoother(s.arrive, s.arrive + 1.2, t);
    // Skims in from far out, above both rings, then settles onto its ring.
    polar(lerp(44, ring.r, k), a - (1 - k) * .6, lerp(.34, s.deskY, smooth(s.arrive + 1.2, s.arrive + 1.5, t)), m.position);
    flatAt(a, s.yaw, m.quaternion);
    s.curl = 0; s.flutter = 0;
  }

  const ordered = [...stackSheets, ...sheets.filter(s => !stackSheets.includes(s))];
  function updatePaper(t) {
    const b = beats(t);
    for (const s of stackSheets) { s.fallY = s.slotY; s.fallExt = .004; }
    for (const s of ordered) {
      const m = s.mesh;
      let visible = t >= s.arrive - .02;
      if (reduced) {
        // Reduced motion: a calm static stack, no vortex.
        visible = s.kind === 'air' && !s.catch && t >= 27 && t < 63;
        if (visible) { m.position.set(stackPos.x, s.slotY, stackPos.z); flatQuat(s.yaw, m.quaternion); }
        s.curl = s.flutter = 0;
      } else if (visible) {
        if (s.kind === 'air') airPose(s, t, b); else deskPose(s, t, b);
      }
      m.visible = visible;
      if (visible) bendSheet(s.geo, s.curl, s.flutter, t * 4 + s.phase, 0);
    }
    // Verdict form glides in low and flat, clear of the feet on the base form.
    verdict.visible = t >= 62.9;
    const f = b.form;
    verdict.position.set(lerp(24, 6.2, f), .026, lerp(12, 4.9, f));
    verdict.rotation.z = lerp(1.2, .22, f);
  }


  // --------------------------------------------------- holographic shell
  const shellUniforms = { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0x6fe7ff) } };
  const shellMat = new THREE.ShaderMaterial({
    uniforms: shellUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uOpacity; uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.-abs(dot(vN,vV)), 2.4); float lat = smoothstep(.93,1.,abs(sin(vP.y*9.))); float lon = smoothstep(.96,1.,abs(sin(atan(vP.z,vP.x)*12.))); float scan = smoothstep(.0,.08,abs(fract(vP.y*.35 - uTime*.25)-.5)); float a = (f*.32 + (lat+lon)*.16 + (1.-scan)*.1) * uOpacity; gl_FragColor = vec4(uColor*(.7+f), a); }'
  });
  const shell = new THREE.Group(); shell.name = 'holographic-shell-fictional';
  const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI / 2), shellMat);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, TAU, Math.PI / 2, Math.PI / 2), shellMat);
  const upperHinge = new THREE.Group(), lowerHinge = new THREE.Group();
  upperHinge.add(upper); lowerHinge.add(lower); shell.add(upperHinge, lowerHinge);
  shell.visible = false;

  // Forehead light and head-to-cloud light stream (fictional).
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(drawGlow('rgba(255,248,210,1)')), color: 0xfff3c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flare.visible = false; root.add(flare);
  const streamCount = quality === 'low' ? 1500 : 6000;
  const streamSeed = new Float32Array(streamCount), streamLane = new Float32Array(streamCount * 2);
  for (let i = 0; i < streamCount; i++) { streamSeed[i] = hash(i, 801); streamLane[i * 2] = hash(i, 802) * 2 - 1; streamLane[i * 2 + 1] = hash(i, 803) * 2 - 1; }
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(streamCount * 3), 3));
  streamGeo.setAttribute('seed', new THREE.BufferAttribute(streamSeed, 1));
  streamGeo.setAttribute('lane', new THREE.BufferAttribute(streamLane, 2));
  const streamUniforms = { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uSide: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 }, uAmount: { value: 0 }, uWidth: { value: 1 }, uPixel: { value: 1 } };
  const stream = new THREE.Points(streamGeo, new THREE.ShaderMaterial({
    uniforms: streamUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform vec3 uA; uniform vec3 uB; uniform vec3 uSide; uniform float uTime; uniform float uAmount; uniform float uWidth; uniform float uPixel;
      attribute float seed; attribute vec2 lane; varying float vA; varying float vS;
      void main(){ float s = fract(seed*13.7 + uTime*(.35+seed*.5)); vec3 d = uB-uA; vec3 up = normalize(d); vec3 side = normalize(uSide - up*dot(uSide,up)); vec3 fw = cross(up, side);
        float spread = uWidth * (.08 + s*s*1.1);
        vec3 p = uA + d*s + side*lane.x*spread + fw*lane.y*spread*.6 + side*sin(s*9.+seed*20.)*.06*uWidth;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        vA = uAmount * smoothstep(0.,.08,s) * (1.-smoothstep(.85,1.,s)) * step(seed, uAmount*1.2); vS = seed;
        gl_PointSize = uPixel * (1.2 + seed*1.8) * 14. / -mv.z; }`,
    fragmentShader: 'varying float vA; varying float vS; void main(){ float d = length(gl_PointCoord-.5)*2.; if(d>1.) discard; vec3 c = mix(vec3(.45,.92,1.), vec3(1.,.95,.55), step(.82,vS)); gl_FragColor = vec4(c*1.2, vA*(1.-d)*.3); }'
  }));
  stream.frustumCulled = false; stream.visible = false; root.add(stream);

  return {
    root, desk, baseForm, verdict, sheets, hemi, fill, rim, shell, upperHinge, lowerHinge, shellUniforms, neuralLight, foreheadLight, flare, key,
    stream, streamUniforms, env,
    update(t) { updatePaper(t); },
    setVisible(v) { root.visible = v; },
    // Rectangles of paper lying on the desk at time t, for contact checks.
    footprints() { return [baseForm, verdict, ...sheets.map(s => s.mesh)].filter(m => m.visible); }
  };
}

// ---------------------------------------------------- overload particles
// Particles ride along the real sampled skeleton segments, so the burst keeps
// the branching structure. The expansion itself is authored satire.
export function createOverload(brainGeometry, neuronSeed, classIndex, quality = 'high') {
  const src = brainGeometry.attributes.position.array;
  const segments = src.length / 6, step = quality === 'low' ? 13 : 5;
  const n = Math.floor(segments / step);
  const a = new Float32Array(n * 3), b = new Float32Array(n * 3), seed = new Float32Array(n), nseed = new Float32Array(n), cls = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * step, v = s * 2;
    a.set(src.subarray(v * 3, v * 3 + 3), i * 3);
    b.set(src.subarray((v + 1) * 3, (v + 1) * 3 + 3), i * 3);
    seed[i] = hash(i, 911); nseed[i] = neuronSeed[v]; cls[i] = classIndex[v];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  g.setAttribute('b', new THREE.BufferAttribute(b, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('nseed', new THREE.BufferAttribute(nseed, 1));
  g.setAttribute('cls', new THREE.BufferAttribute(cls, 1));
  const uniforms = overloadUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `${EXPLODE_GLSL}
      attribute vec3 b; attribute float seed; varying float vA; varying vec3 vC;
      void main(){
        float f = fract(seed*17.3 + uTime*(.18 + seed*.32));
        vec3 p = mix(position, b, f);
        vec3 q = explode(p, nseed, seed);
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        float spark = step(.93, seed);
        vC = mix(clsColor(cls), vec3(1.,.96,.62), spark*.85);
        float peel = peelOf(nseed);
        vA = uAmount * (.1 + peel*.36 + spark*.4) * (.55 + .45*sin(uTime*3.1 + seed*40.));
        vA *= smoothstep(1.5, 5.5, -mv.z);
        gl_PointSize = min(uPixel * 4.5, uPixel * (.8 + spark*1.6 + peel*.9) * 10. / -mv.z);
      }`,
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord-.5)*2.; if(d>1.) discard; gl_FragColor = vec4(vC*1.25, vA*(1.-d*d)); }'
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false; points.visible = false; points.name = 'overload-particles-fictional';
  return { points, uniforms };
}

export function overloadUniforms() {
  return { uTime: { value: 0 }, uBurst: { value: 0 }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uAmount: { value: 0 }, uPixel: { value: 1 }, uSpread: { value: 1 } };
}

// Shared by lines and particles: whole neurons peel away in seeded order,
// expand and rise, and return in reverse as uBurst falls back to zero.
export const EXPLODE_GLSL = `
  uniform float uTime; uniform float uBurst; uniform vec3 uUp; uniform float uAmount; uniform float uPixel; uniform float uSpread;
  attribute float nseed; attribute float cls;
  float peelOf(float ns){ return smoothstep(ns*.62, ns*.62 + .38, uBurst); }
  vec3 clsColor(float c){
    if(c < .5) return vec3(.31,.89,.92);
    if(c < 1.5) return vec3(.35,.78,1.);
    if(c < 2.5) return vec3(.48,.88,.82);
    return vec3(.71,.49,1.);
  }
  vec3 explode(vec3 p, float ns, float s){
    float peel = peelOf(ns);
    if(peel <= 0.) return p;
    vec3 up = normalize(uUp);
    float r = length(p);
    float scale = 1. + peel * (2.1 + ns*2.4) * uSpread;
    vec3 q = p * scale;
    q += up * peel * (1.6 + r*.9 + ns*3.) * uSpread;
    float ang = peel * (ns - .5) * 1.6 + peel * .25 * sin(uTime*.3 + ns*6.);
    vec3 k = up; float c = cos(ang), sn = sin(ang);
    q = q*c + cross(k,q)*sn + k*dot(k,q)*(1.-c);
    // Central brain lifts away; the visual route spreads into a lower ring.
    float central = step(2.5, cls);
    vec3 hz = q - up*dot(q, up);
    q += up * peel * central * 2.8 * uSpread;
    q += normalize(hz + vec3(1e-4, 0., 0.)) * peel * (1. - central) * 1.4 * uSpread - up * peel * (1. - central) * .8 * uSpread;
    q += vec3(sin(uTime*.7+ns*31.), cos(uTime*.5+ns*17.), sin(uTime*.6+ns*11.)) * peel * .18;
    return q;
  }`;
