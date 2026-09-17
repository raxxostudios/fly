import { beats, clamp, lerp, smooth, smoother, pulse, window01, noise1 } from './timeline.js';
import { LEGS } from './fly-rig.js';

// Authored acting and camera. Pure functions of story time: seeking,
// replaying and frame export all land on the same pose. Satire, not a
// neuromechanical model.

const Z5 = [0, 0, 0, 0, 0];
// Front legs folded up toward the head for grooming (coxa x, coxa y, femur y, tibia y, tarsus1 y).
const GROOM_FOLD = [0, -.55, -.9, -1.05, -.3];
// Legs trailing in flight: extended down and back.
const FLIGHT = { f: [0, .2, .35, .3, .2], m: [0, .25, .4, .35, .2], h: [0, .3, .35, .3, .25] };

// Grooming claw targets in native fly millimetres (x anterior, y left, z up),
// in front of the face, rubbing against each other.
export function groomTargets(t, side) {
  const rub = Math.sin(t * 9.5 + (side > 0 ? 0 : Math.PI));
  const lift = .03 * Math.sin(t * 4.8);
  return [1.02 + .05 * rub, side * (.1 + .045 * rub), .86 + lift];
}

function twitch(t, times, width = .28, amp = .35) {
  let v = 0;
  for (const s of times) v = Math.max(v, pulse(s, s + width, t) * amp);
  return v;
}

export function storyPose(t, opts = {}) {
  const b = beats(t);
  const reduced = Boolean(opts.reducedMotion);
  const pose = { root: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }, head: [0, 0, 0], antenna: [0, 0, 0], antennaTurn: 0, wing: 0, buzz: 0, abdomen: 0, proboscis: 0, legs: {} };

  // Arrival flight: from upper left and behind, easing onto the form.
  const fx = clamp(t / 1.15), fe = 1 - Math.pow(1 - fx, 3);
  const air = reduced ? 0 : 1 - fe;
  pose.root.x = -5.2 * air;
  pose.root.y = 3.4 * air * air + .06 * Math.sin(t * 17) * air;
  pose.root.z = 3.2 * air;
  pose.root.yaw = .55 * air + .05 * Math.sin(t * 5) * air;
  pose.root.pitch = -.22 * air;
  pose.root.roll = .18 * Math.sin(t * 3.2) * air;
  // Legs absorb the touchdown: a damped dip, feet stay planted.
  if (!reduced && t > 1.15) pose.root.y += -.2 * Math.exp(-(t - 1.15) * 4.2) * Math.sin((t - 1.15) * 7.5);
  // Brace, panic tremor, tired sag.
  pose.root.y -= .16 * b.brace + .08 * b.tired;
  pose.root.pitch += .05 * b.brace + .06 * b.tired - .05 * b.stunned;
  const tremor = reduced ? 0 : b.panic * .6 + b.stunned * .12;
  pose.root.x += .035 * tremor * noise1(t * 13, 3);
  pose.root.z += .035 * tremor * noise1(t * 13, 4);
  pose.root.roll += .03 * tremor * noise1(t * 11, 5);

  // Head and antennae: antennae lead, the head follows about 0.3 s later.
  const lookCam = smoother(4.35, 5, t) * (1 - smooth(8.2, 9, t));
  const antLead = smoother(4, 4.35, t) * (1 - smooth(8, 8.6, t));
  let yaw = -.34 * lookCam + .05 * Math.sin(t * .9) * (1 - b.stare);
  let pitch = -.12 * lookCam;
  let roll = 0;
  pose.antennaTurn = -.25 * antLead;
  // Study pose while grooming: head dips, nods with the rubbing.
  pitch += b.groom * (.16 + .03 * Math.sin(t * 9.5));
  yaw += b.groom * .04 * Math.sin(t * 1.3);
  // Celebration: head up, small wiggle.
  pitch -= b.celebrate * .14;
  yaw += b.celebrate * .1 * Math.sin(t * 5.5);
  // Stare at the text: complete stillness, then a confused tilt.
  pitch += b.stare * .2;
  yaw = lerp(yaw, 0, b.stare);
  roll += b.confused * (.34 * smoother(24.4, 25.4, t) - .5 * smoother(26, 26.8, t));
  // Glances at arriving paper, antenna first.
  const glanceA = window01(27.6, 29, .35, t), glanceB = window01(29.4, 30.8, .35, t);
  pose.antennaTurn += .3 * window01(27.4, 28.8, .3, t) - .3 * window01(29.2, 30.6, .3, t);
  yaw += .4 * glanceA - .3 * glanceB;
  // Panic: darting head with held poses between jumps.
  if (!reduced) {
    const step = Math.floor(t * 2.6), frac = t * 2.6 - step;
    const dart = lerp(noise1(step, 17), noise1(step + 1, 17), smoother(0, .35, frac));
    yaw += b.panic * .42 * dart;
    pitch += b.panic * .1 * noise1(t * 3, 18);
  }
  // Stunned: looking up at the overload, frozen.
  pitch = lerp(pitch, -.26, b.stunned);
  yaw = lerp(yaw, -.08, b.stunned);
  roll = lerp(roll, 0, b.stunned);
  // Tired verdict, then a deadpan turn toward form BZZ-27.
  pitch = lerp(pitch, .14, b.tired * (1 - b.stunned));
  roll += .06 * b.tired;
  yaw = lerp(yaw, -.3, b.form);
  pitch = lerp(pitch, .1, b.form);
  pose.head = [yaw, pitch, roll];

  pose.antenna[0] = .05 * Math.sin(t * 2.2) + .22 * b.stunned + .08 * b.panic * noise1(t * 9, 21);
  pose.antenna[1] = -.08 * b.stare + .12 * b.groom * Math.sin(t * 9.5) - .1 * b.stunned;
  pose.antenna[2] = .12 * Math.sin(t * 6.3) + .2 * b.panic * noise1(t * 14, 22);

  // Wings: fold after landing, small twitches before larger stress motions.
  let wing = .55 * air + .45 * Math.exp(-Math.max(0, t - 1.15) * 3.6) * (t > 1.15 ? 1 : 0);
  wing = Math.max(wing, twitch(t, [3.1, 12.6, 26.1], .26, .22));
  wing = Math.max(wing, twitch(t, [18.3, 19.5, 20.7], .5, .6));
  wing = Math.max(wing, twitch(t, [28.2, 29.3, 30.6, 31.3], .3, .3 + .1 * b.brace));
  if (!reduced) {
    const beat = .5 + .5 * Math.sin(t * 29);
    wing = Math.max(wing, b.panic * (.2 + .25 * Math.pow(beat, 6)));
  }
  wing = lerp(wing, .38, b.stunned);
  wing *= 1 - .8 * b.tired * (1 - b.stunned);
  pose.wing = clamp(wing, 0, 1);
  const bursts = reduced ? 0 : Math.max(window01(33.1, 33.9, .12, t), window01(35.5, 36.2, .12, t), window01(37.7, 38.6, .12, t));
  pose.buzz = reduced ? 0 : Math.max(air > .02 ? 1 : smooth(1.25, .95, t), bursts);
  if (pose.buzz > .02) pose.wing = clamp(.5 + .5 * Math.sin(t * 31), 0, 1);

  pose.abdomen = .035 * Math.sin(t * (b.panic > .2 ? 12 : 4.2)) - .04 * b.tired;
  pose.proboscis = window01(5.3, 6.8, .25, t) + .5 * window01(64.2, 65.4, .2, t);

  // Legs.
  const landing = reduced ? 1 : b.landing;
  for (const l of LEGS) {
    const kind = l[1];
    const flight = FLIGHT[kind];
    const authored = flight.map(v => v * air);
    const spec = { weight: landing, height: 1, authored };
    if (kind === 'f' && b.groom > 0 && !reduced) {
      const side = l[0] === 'l' ? 1 : -1;
      spec.authored = GROOM_FOLD.map((v, i) => v * b.groom + authored[i] * (1 - b.groom));
      spec.native = groomTargets(t, side);
      spec.lift = smoother(0, 1, b.groom);
      spec.height = 1 - smooth(0, .15, b.groom);
    }
    // Brace: middle and hind claws stay planted; knees take the load.
    pose.legs[l] = spec;
  }
  return pose;
}

// Idle website acting. Uses its own clock; the story and film never do.
export function idlePose(clock, mood, reaction, reduced) {
  const t = reduced ? 0 : clock;
  const pose = { root: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }, head: [0, 0, 0], antenna: [0, 0, 0], antennaTurn: 0, wing: 0, buzz: 0, abdomen: 0, proboscis: 0, legs: {} };
  const nervous = mood === 'panic' || reaction > 0;
  const tempo = nervous ? 9 : mood === 'studying' ? 4 : mood === 'tired' ? .9 : 2.4;
  pose.head = [
    mood === 'confused' ? 0 : .12 * Math.sin(t * .7) + (nervous ? .2 * noise1(t * 3, 2) : 0),
    mood === 'studying' ? .14 + .03 * Math.sin(t * 4) : mood === 'tired' ? .14 : mood === 'celebrate' ? -.12 : -.04,
    mood === 'confused' ? .3 * Math.sin(t * 1.2) : 0
  ];
  pose.antenna = [.05 * Math.sin(t * tempo), .06 * Math.sin(t * tempo * .7), .1 * Math.sin(t * tempo * 1.6)];
  const flick = Math.pow(Math.max(0, Math.sin(t * (mood === 'celebrate' ? 3 : 1.1))), 8);
  pose.wing = clamp((mood === 'tired' ? 0 : flick * (mood === 'celebrate' ? .7 : .25)) + (nervous ? .2 + .2 * Math.abs(Math.sin(t * 19)) : 0) + reaction * .5);
  pose.abdomen = .03 * Math.sin(t * (nervous ? 10 : 3.4));
  pose.root.y = -.05 * reaction - (mood === 'tired' ? .06 : 0);
  pose.root.x = nervous ? .02 * noise1(t * 12, 7) : 0;
  const grooming = mood === 'studying' ? 1 : 0;
  for (const l of LEGS) {
    const spec = { weight: 1, height: 1, authored: Z5 };
    if (l[1] === 'f' && grooming && !reduced) {
      const side = l[0] === 'l' ? 1 : -1;
      spec.authored = GROOM_FOLD; spec.native = groomTargets(t, side); spec.lift = 1; spec.height = 0;
    }
    pose.legs[l] = spec;
  }
  return pose;
}

// ------------------------------------------------------------------ camera
const V = (x, y, z) => ({ x, y, z });
const mix3 = (a, b, k) => V(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
const C = V(.25, 0, .35);
function orbit(angle, r, y) { return V(C.x + Math.cos(angle) * r, y, C.z + Math.sin(angle) * r); }

// Shots are functions of time; neighbours cross-blend over their overlap.
const SHOTS = [
  { a: 0, b: 4.4, f: t => ({ pos: mix3(V(5.4, 1.35, 6.9), V(4.7, 1.2, 6.1), smooth(0, 4.4, t)), target: V(.35, lerp(1.6, 1.05, smooth(0, 1.6, t)), .2), fov: 27 }) },
  { a: 4.2, b: 8.4, f: t => ({ pos: mix3(V(4.7, 1.2, 6.1), V(11.5, 5.8, 18.5), smoother(4.3, 8.2, t)), target: mix3(V(.35, 1.05, .2), V(-.3, 2.3, 0), smoother(4.3, 8.2, t)), fov: lerp(27, 34, smoother(4.3, 8.2, t)) }) },
  { a: 8, b: 16.4, f: t => { const k = smoother(8, 10, t); return { pos: mix3(V(11.5, 5.8, 18.5), orbit(.98 + .05 * Math.sin(t * .2), 11.3, 3.2), k), target: mix3(V(-.3, 2.3, 0), V(.3, 2.2, .1), k), fov: lerp(34, 30, k) }; } },
  { a: 16, b: 22.4, f: t => ({ pos: orbit(.95 + .02 * (t - 16), 12.4, 3.4), target: V(2.4, 2.3, .8), fov: 31 }) },
  { a: 22, b: 27.4, f: t => ({ pos: mix3(V(9.2, 2.3, 5.4), V(7.9, 2.1, 4.6), smooth(22, 27.4, t)), target: V(1.4, 2.25, .3), fov: 33 }) },
  { a: 27, b: 32.4, f: t => ({ pos: mix3(V(7.9, 2.1, 4.6), V(5.6, 2.9, 3.9), smoother(27, 29.5, t)), target: mix3(V(1.4, 2.25, .3), V(-2.5, 1.2, .8), smoother(27, 29.5, t)), fov: lerp(33, 38, smoother(27, 29.5, t)) }) },
  { a: 32, b: 40.4, f: t => { const k = smoother(32, 40.4, t); const ang = lerp(.62, -.42, k); return { pos: orbit(ang, lerp(6.5, 6.9, k), lerp(2.1, 1.05, k)), target: V(.3, lerp(1.6, 2.8, k), .35), fov: lerp(38, 42, k) }; } },
  { a: 40, b: 48.4, f: t => { const k = smoother(40, 48.4, t); return { pos: orbit(lerp(-.42, -.2, k), lerp(6.9, 7.4, k), lerp(1.05, .75, k)), target: V(.3, lerp(2.8, 3.7, k), .35), fov: lerp(42, 50, k) }; } },
  { a: 48, b: 56.4, dive: true },
  { a: 56, b: 63.4, f: (t, ctx) => { const k = smoother(55.8, 60.6, t); const d = diveShot(55.8, ctx); const e = { pos: orbit(.92, 10.4, 3.2), target: V(.5, 1.5, .6), fov: 31 }; return { pos: mix3(d.pos, e.pos, k), target: mix3(d.target, e.target, k), fov: lerp(d.fov, e.fov, k) }; } },
  { a: 63, b: 68.1, f: t => { const k = smoother(63, 65, t); return { pos: mix3(orbit(.92, 10.4, 3.2), V(10.6, 6.2, 11.6), k), target: mix3(V(.5, 1.5, .6), V(3, .5, 2.4), k), fov: lerp(31, 36, k) }; } }
];

export function storyCamera(t, ctx) {
  const eval1 = s => s.dive ? diveShot(t, ctx) : s.f(t, ctx);
  let result = null;
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    if (t < s.a || t > s.b) continue;
    const cur = eval1(s);
    if (!result) { result = cur; continue; }
    // Overlap with the previous shot: blend across it.
    const prev = SHOTS[i - 1];
    const k = smoother(s.a, prev.b, t);
    result = { pos: mix3(result.pos, cur.pos, k), target: mix3(result.target, cur.target, k), fov: lerp(result.fov, cur.fov, k) };
  }
  if (!result) result = eval1(SHOTS[SHOTS.length - 1]);
  if (ctx?.reducedMotion) {
    // Reduced motion: hold three calm framings, no orbit or rush.
    const calm = t < 22 ? SHOTS[2].f(12) : t < 56 ? SHOTS[3].f(18) : SHOTS[9].f(62);
    result = calm;
  }
  return adaptFormat(result, ctx);
}

function diveShot(t, ctx) {
  const start = SHOTS[7].f(48.4);
  const k = smoother(48.2, 55.6, t);
  const focus = ctx?.diveFocus || V(.3, 7, .35);
  const side = ctx?.diveSide || V(.7, 0, .7);
  // Crane up over the cloud, then dive toward the lobe boundary at a
  // steep but never vertical angle, so screen up stays readable.
  const high = V(focus.x + side.x * 10.5, focus.y + 14, focus.z + side.z * 10.5);
  const end = V(focus.x + side.x * 6.2, focus.y + 9.2, focus.z + side.z * 6.2);
  const rise = smoother(48.2, 51.8, t), fall = smoother(51.2, 55.6, t);
  const p = mix3(mix3(start.pos, high, rise), end, fall);
  return { pos: p, target: mix3(start.target, focus, smoother(48.2, 51.5, t)), fov: lerp(lerp(50, 46, rise), 42, fall) };
}

// Keep horizontal coverage sensible on any aspect ratio.
export function adaptFormat(shot, ctx) {
  const aspect = ctx?.aspect || 16 / 9;
  if (Math.abs(aspect - 16 / 9) < .01) return shot;
  const tanV = Math.tan(shot.fov * Math.PI / 360);
  const tanH = tanV * 16 / 9 * (aspect < 1 ? .74 : 1);
  let fov = Math.atan(tanH / aspect) * 360 / Math.PI;
  if (aspect > 16 / 9) fov = shot.fov;
  const target = { ...shot.target };
  const pos = { ...shot.pos };
  if (aspect < 1) {
    // Portrait: lift the aim so the fly sits low and the neural view above.
    target.y += .9;
    pos.y += .5;
  }
  return { pos, target, fov: Math.min(fov, 78) };
}

export function idleCamera(view, aspect) {
  const base = view === 'fly' ? { pos: V(5.8, 2.1, 7.9), target: V(.35, .95, .2), fov: 30 }
    : view === 'brain' ? { pos: V(0, 4.1, 11.2), target: V(0, 3.9, 0), fov: 30 }
    : { pos: V(7.8, 3.4, 11.9), target: V(.2, 2.15, .15), fov: 30 };
  return adaptFormat(base, { aspect });
}
