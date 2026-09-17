import * as THREE from 'three';
import { wingPose } from './anatomy-pose.js';

// Pose application for the NeuroMechFly body meshes. Acting values come from
// choreography.js; this module turns them into joint rotations and keeps
// planted claws fixed on the desk with a small damped least-squares IK.
// It is display animation, not a neuromechanical controller.

export const LEGS = ['lf', 'lm', 'lh', 'rf', 'rm', 'rh'];
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
// coxa x, coxa y, femur y, tibia y, tarsus1 y
const DOF = [[0, 'x'], [0, 'y'], [1, 'y'], [2, 'y'], [3, 'y']];
const ITER = 12;

export function createRig(joints, body, tipLocal) {
  const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const legs = {};
  for (const l of LEGS) {
    const chain = ['coxa', 'trochanterfemur', 'tibia', 'tarsus1'].map(n => joints.get(`${l}_${n}`));
    // Tarsus 2 to 5 keep their rest rotations, so the claw is a fixed point
    // in the tarsus 1 frame.
    const fixed = new THREE.Matrix4();
    const m = new THREE.Matrix4();
    for (const n of ['tarsus2', 'tarsus3', 'tarsus4', 'tarsus5']) {
      const j = joints.get(`${l}_${n}`);
      fixed.multiply(m.compose(j.position, j.userData.rest, one));
    }
    const tip = tipLocal[l].clone().applyMatrix4(fixed);
    legs[l] = { chain, tip, side: l[0] === 'r' ? -1 : 1, target: new THREE.Vector3(), ankleHeight: 0, planted: true };
  }
  const thorax = joints.get('c_thorax');
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), rot = new THREE.Quaternion();
  const ankle = new THREE.Vector3(), tipW = new THREE.Vector3();

  function localRot(j, a, b, out) {
    out.copy(j.userData.rest);
    if (a) out.multiply(q.setFromAxisAngle(AX[b], a));
    return out;
  }
  function jointQuat(leg, k, theta, out) {
    out.copy(leg.chain[k].userData.rest);
    for (let d = 0; d < DOF.length; d++) if (DOF[d][0] === k && theta[d]) out.multiply(q.setFromAxisAngle(AX[DOF[d][1]], theta[d]));
    return out;
  }
  // Forward kinematics from the current thorax world matrix.
  function fk(leg, theta, base) {
    M.copy(base);
    for (let k = 0; k < 4; k++) {
      const j = leg.chain[k];
      M.multiply(L.compose(j.position, jointQuat(leg, k, theta, rot), one));
      if (k === 2) ankle.copy(leg.chain[3].position).applyMatrix4(M);
    }
    tipW.copy(leg.tip).applyMatrix4(M);
  }
  const J = Array.from({ length: 4 }, () => new Float64Array(5));
  const A = Array.from({ length: 5 }, () => new Float64Array(6));
  function solve(leg, authored, deskY, heightWeight, base, out) {
    const th = Float64Array.from(authored), e = new Float64Array(4), h = 1e-3;
    for (let it = 0; it < ITER; it++) {
      fk(leg, th, base);
      const tx = tipW.x, ty = tipW.y, tz = tipW.z, ay = ankle.y;
      e[0] = leg.target.x - tx; e[1] = leg.target.y - ty; e[2] = leg.target.z - tz;
      e[3] = heightWeight * (deskY + leg.ankleHeight - ay);
      if (Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[3]) < 2e-5) break;
      for (let d = 0; d < 5; d++) {
        th[d] += h; fk(leg, th, base); th[d] -= h;
        J[0][d] = (tipW.x - tx) / h; J[1][d] = (tipW.y - ty) / h; J[2][d] = (tipW.z - tz) / h; J[3][d] = heightWeight * (ankle.y - ay) / h;
      }
      // (JᵀJ + (λ² + μ) I) Δ = Jᵀe + μ (authored − θ)
      const lam = .0009, mu = .0004;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) { let s = 0; for (let k = 0; k < 4; k++) s += J[k][r] * J[k][c]; A[r][c] = s + (r === c ? lam + mu : 0); }
        let s = 0; for (let k = 0; k < 4; k++) s += J[k][r] * e[k];
        A[r][5] = s + mu * (authored[r] - th[r]);
      }
      for (let c = 0; c < 5; c++) {
        let p = c; for (let r = c + 1; r < 5; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        [A[c], A[p]] = [A[p], A[c]];
        for (let r = c + 1; r < 5; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < 6; k++) A[r][k] -= f * A[c][k]; }
      }
      const dx = new Float64Array(5);
      for (let r = 4; r >= 0; r--) { let s = A[r][5]; for (let k = r + 1; k < 5; k++) s -= A[r][k] * dx[k]; dx[r] = s / A[r][r]; }
      let n = 0; for (const v of dx) n = Math.max(n, Math.abs(v));
      const scale = n > .25 ? .25 / n : 1;
      for (let d = 0; d < 5; d++) th[d] += dx[d] * scale;
    }
    fk(leg, th, base);
    for (let d = 0; d < 5; d++) out[d] = th[d];
    return tipW.distanceTo(leg.target);
  }

  const theta = new Float64Array(5), blended = new Float64Array(5);
  const rig = {
    legs,
    // Record planted claw targets for a root pose. Called once per layout.
    calibrate(deskY) {
      body.updateMatrixWorld(true);
      for (const l of LEGS) {
        const leg = legs[l];
        fk(leg, [0, 0, 0, 0, 0], thorax.matrixWorld);
        leg.target.set(tipW.x, deskY, tipW.z);
        leg.ankleHeight = ankle.y - tipW.y;
        leg.rest = leg.target.clone();
      }
    },
    restClawMinY() {
      body.updateMatrixWorld(true);
      let min = Infinity;
      for (const l of LEGS) { fk(legs[l], [0, 0, 0, 0, 0], thorax.matrixWorld); min = Math.min(min, tipW.y); }
      return min;
    },
    // pose: { head:[yaw,pitch,roll], antenna:[yaw,pitch], wing, buzz, abdomen, proboscis,
    //         legs:{ lf:{ weight, height, authored:[5], target?:Vector3 } } }
    apply(pose, deskY, errors) {
      for (const [name, j] of joints) j.quaternion.copy(j.userData.rest);
      const head = joints.get('c_head');
      head.quaternion.multiply(q.setFromAxisAngle(AX.z, pose.head[0])).multiply(q.setFromAxisAngle(AX.y, pose.head[1])).multiply(q.setFromAxisAngle(AX.x, pose.head[2]));
      for (const s of ['l', 'r']) {
        const side = s === 'l' ? 1 : -1;
        const ped = joints.get(`${s}_pedicel`);
        ped.quaternion.multiply(q.setFromAxisAngle(AX.z, side * pose.antenna[0] + pose.antennaTurn * 1)).multiply(q.setFromAxisAngle(AX.y, pose.antenna[1]));
        joints.get(`${s}_arista`).quaternion.multiply(q.setFromAxisAngle(AX.z, side * pose.antenna[2]));
        const wing = joints.get(`${s}_wing`);
        wingPose(wing.userData.rest, side, Math.min(1, Math.max(0, pose.wing)), wing.quaternion);
      }
      ['c_abdomen3', 'c_abdomen4', 'c_abdomen5'].forEach((n, i) => joints.get(n).quaternion.multiply(q.setFromAxisAngle(AX.y, pose.abdomen * (1 - i * .25))));
      joints.get('c_rostrum').quaternion.multiply(q.setFromAxisAngle(AX.y, -pose.proboscis * .35));
      joints.get('c_haustellum').quaternion.multiply(q.setFromAxisAngle(AX.y, pose.proboscis * .5));
      body.updateMatrixWorld(true);
      const base = thorax.matrixWorld;
      let worst = 0;
      for (const l of LEGS) {
        const leg = legs[l], spec = pose.legs[l];
        if (spec.target) leg.target.copy(spec.target); else leg.target.copy(leg.rest);
        const authored = spec.authored;
        if (spec.weight > 0) {
          const err = solve(leg, authored, deskY, spec.height, base, theta);
          if (spec.weight >= 1 && spec.height > 0) worst = Math.max(worst, err);
          for (let d = 0; d < 5; d++) blended[d] = authored[d] + (theta[d] - authored[d]) * spec.weight;
        } else for (let d = 0; d < 5; d++) blended[d] = authored[d];
        for (let k = 0; k < 4; k++) jointQuat(leg, k, blended, leg.chain[k].quaternion);
      }
      if (errors) errors.ik = worst;
      body.updateMatrixWorld(true);
    },
    clawWorld(l, out = new THREE.Vector3()) {
      const leg = legs[l];
      return out.copy(leg.tip).applyMatrix4(leg.chain[3].matrixWorld);
    }
  };
  return rig;
}

// Ghost wing blades at spread stroke fractions: a motion-blur treatment for
// fast wingbeats that a 30 fps frame could not sample honestly.
export function createWingFan(joints, wingMaterial, count = 5) {
  const ghosts = [];
  for (const s of ['l', 'r']) {
    const wing = joints.get(`${s}_wing`);
    const mesh = wing.children.find(o => o.isMesh);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.position.copy(wing.position);
      const m = new THREE.Mesh(mesh.geometry, wingMaterial);
      m.scale.copy(mesh.scale);
      g.add(m); wing.parent.add(g);
      g.visible = false;
      ghosts.push({ g, side: s === 'l' ? 1 : -1, fraction: i / (count - 1), rest: wing.userData.rest });
    }
  }
  return {
    update(amount) {
      for (const k of ghosts) {
        k.g.visible = amount > .01;
        if (k.g.visible) wingPose(k.rest, k.side, k.fraction, k.g.quaternion);
      }
      wingMaterial.opacity = .09 * amount;
    }
  };
}
