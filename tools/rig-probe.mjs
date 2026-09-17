import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
const root = new URL('../', import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + 'dist/data/fly.json'));
const bin = fs.readFileSync(root + 'dist/data/fly.bin');
const joints = new Map(), body = new T.Group(), native = new T.Group();
native.rotation.x = -Math.PI / 2; body.add(native);
const tips = {};
for (const p of data.parts) {
  const j = new T.Group(); j.position.fromArray(p.pos); j.quaternion.fromArray(p.quaternion);
  j.userData.rest = j.quaternion.clone(); (joints.get(p.parent) || native).add(j); joints.set(p.name, j);
  if (/tarsus5/.test(p.name)) {
    const g = data.geometry[p.source]; const pos = new Float32Array(bin.buffer, bin.byteOffset + g.positionOffset, g.vertices * 3);
    let best = 0, v = null; for (let i = 0; i < pos.length; i += 3) { const d = Math.hypot(pos[i], pos[i + 1], pos[i + 2]); if (d > best) { best = d; v = [pos[i], pos[i + 1] * (p.mirror ? -1 : 1), pos[i + 2]]; } }
    tips[p.name] = new T.Vector3(...v);
  }
}
body.updateMatrixWorld(true);
const box = new T.Box3().setFromObject(native);
console.log('native bounds', box.min.toArray().map(x => x.toFixed(3)), box.max.toArray().map(x => x.toFixed(3)));
const legs = ['lf', 'lm', 'lh', 'rf', 'rm', 'rh'];
const claw = l => joints.get(l + '_tarsus5').localToWorld(tips[l + '_tarsus5'].clone());
for (const l of legs) console.log(l, 'claw', claw(l).toArray().map(x => x.toFixed(3)), 'ankle', joints.get(l + '_tarsus1').getWorldPosition(new T.Vector3()).toArray().map(x => x.toFixed(3)), 'tipLocal', tips[l + '_tarsus5'].toArray().map(x => x.toFixed(3)));
console.log('head', joints.get('c_head').getWorldPosition(new T.Vector3()).toArray().map(x => x.toFixed(3)));
// Sign probes: world delta of the lf and rf claws for +0.2 rad on each DOF.
const axes = { X: new T.Vector3(1, 0, 0), Y: new T.Vector3(0, 1, 0), Z: new T.Vector3(0, 0, 1) };
for (const l of ['lf', 'rf', 'lm', 'lh']) for (const [jn, ax] of [['coxa', 'X'], ['coxa', 'Y'], ['coxa', 'Z'], ['trochanterfemur', 'Y'], ['tibia', 'Y'], ['tarsus1', 'Y']]) {
  const j = joints.get(`${l}_${jn}`); const before = claw(l);
  j.quaternion.copy(j.userData.rest).multiply(new T.Quaternion().setFromAxisAngle(axes[ax], .2)); body.updateMatrixWorld(true);
  const d = claw(l).sub(before); j.quaternion.copy(j.userData.rest); body.updateMatrixWorld(true);
  console.log(l, jn, ax, 'd(world x,y,z)=', d.toArray().map(x => x.toFixed(3)).join(' '));
}
const h = joints.get('c_head');
for (const [ax, v] of Object.entries(axes)) { const eye = joints.get('l_eye'); const b = eye.getWorldPosition(new T.Vector3()); h.quaternion.setFromAxisAngle(v, .2); body.updateMatrixWorld(true); console.log('head', ax, eye.getWorldPosition(new T.Vector3()).sub(b).toArray().map(x => x.toFixed(3))); h.quaternion.identity(); body.updateMatrixWorld(true); }
