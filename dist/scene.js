import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SoftwareRenderer } from './software-renderer.js';
import { createStage, createOverload, overloadUniforms, EXPLODE_GLSL } from './stage.js';
import { createRig, createWingFan, LEGS } from './fly-rig.js';
import { storyPose, idlePose, storyCamera, idleCamera } from './choreography.js';
import { beats, smooth } from './timeline.js';

// Cinematic specimen for the story page and the film capture route.
// Anatomy meshes and sampled skeletons are research geometry. Body acting,
// paper and overload effects are authored satire and labelled as such.

const CLASS_INDEX = { ol_sensory: 0, ol_intrinsic: 1, visual_projection: 2, visual_centrifugal: 2, cb_intrinsic: 3 };
const CLASS_COLORS = [0x4fe3ea, 0x58c6ff, 0x7be0d0, 0xb57cff];
const STANCE_YAW = -.2;
const BODY_SCALE = 1.22;
const FOOT_Y = .018;

const fetchChecked = async (url, kind = 'json') => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response[kind]();
};

const NOISE_GLSL = `
  float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
  float fn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(fh(i),fh(i+vec3(1,0,0)),f.x),mix(fh(i+vec3(0,1,0)),fh(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(fh(i+vec3(0,0,1)),fh(i+vec3(1,0,1)),f.x),mix(fh(i+vec3(0,1,1)),fh(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ return fn(p)*.55 + fn(p*2.1)*.3 + fn(p*4.3)*.15; }`;

function cuticle(color, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: opts.roughness ?? .5, metalness: 0, clearcoat: opts.clearcoat ?? .35, clearcoatRoughness: .35, sheen: .55, sheenColor: new THREE.Color(0xc0823e), sheenRoughness: .45, envMapIntensity: .7 });
  m.onBeforeCompile = s => {
    s.uniforms.partMin = { value: opts.band ? opts.band.min : 0 };
    s.uniforms.partLength = { value: opts.band ? opts.band.length : 1 };
    s.vertexShader = 'varying vec3 vLocal;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    s.fragmentShader = `varying vec3 vLocal; uniform float partMin; uniform float partLength;\n${NOISE_GLSL}\n` + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cn = fbm(vLocal*34.);
        diffuseColor.rgb *= mix(.74, 1.12, cn);
        // Darker mottling and bristle sockets break up the flat colour.
        float mottle = smoothstep(.45, .8, fbm(vLocal*9. + 3.1)) * ${(opts.mottle || 0).toFixed(2)};
        diffuseColor.rgb *= 1. - mottle * .38;
        float socket = smoothstep(.86, .93, fn(vLocal*160.));
        diffuseColor.rgb *= 1. - socket * .45;
        ${opts.band ? 'float band = smoothstep(.10,.24,(vLocal.x-partMin)/partLength); diffuseColor.rgb *= mix(vec3(.24,.18,.13),vec3(1.06,.9,.7),band);' : ''}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (fbm(vLocal*61.)-.5)*.42, .12, 1.);');
  };
  m.customProgramCacheKey = () => 'cuticle' + (opts.band ? '-band' : '') + (opts.mottle || 0);
  return m;
}

function eyeMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x9a1e14, roughness: .32, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.3 });
  m.onBeforeCompile = s => {
    s.vertexShader = 'varying vec3 vObjN;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjN = normalize(normal);');
    // Hexagonal facets on a spherical parameterisation of the eye.
    s.fragmentShader = `varying vec3 vObjN;
      vec3 hexCell(vec2 p){ vec2 r = vec2(1.,1.7320508); vec2 h = r*.5;
        vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h;
        vec2 g = dot(a,a) < dot(b,b) ? a : b; vec2 id = p - g;
        float e = max(abs(g.x)*.8660254 + abs(g.y)*.5, abs(g.y));
        return vec3(e, fract(sin(dot(id, vec2(12.9,78.2)))*43758.5), 0.); }\n` + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 on = normalize(vObjN);
        vec2 sp = vec2(atan(on.x, on.z) * 1.1, acos(clamp(on.y,-1.,1.))) * 26.;
        vec3 hc = hexCell(sp);
        float rim = smoothstep(.36, .5, hc.x);
        diffuseColor.rgb *= mix(1.06 + hc.y*.12, .32, rim);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + (vec3(hc.y, fract(hc.y*7.3), fract(hc.y*3.1)) - .5) * .16);`);
  };
  m.customProgramCacheKey = () => 'faceted-eye';
  return m;
}

function wingMaterial(axisInfo) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xe4ece8, roughness: .2, metalness: 0, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [160, 680], envMapIntensity: 1.0, specularIntensity: .55 });
  m.onBeforeCompile = s => {
    s.uniforms.wLong = { value: axisInfo.long };
    s.uniforms.wChord = { value: axisInfo.chord };
    s.vertexShader = 'varying vec3 vLocal;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    s.fragmentShader = `varying vec3 vLocal; uniform vec4 wLong; uniform vec4 wChord;\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float L = clamp((dot(vLocal, wLong.xyz) - wLong.w) , 0., 1.);
      float Cc = dot(vLocal, wChord.xyz) - wChord.w;
      float vein = 0.;
      for (int i = 0; i < 5; i++) {
        float c0 = (float(i) - 2.) * .19 * (.25 + .75*L);
        vein = max(vein, 1. - smoothstep(.004, .011, abs(Cc - c0)));
      }
      vein = max(vein, (1. - smoothstep(.004, .012, abs(L - .38))) * step(abs(Cc), .2));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24,.18,.11), vein*.85);
      diffuseColor.a = mix(diffuseColor.a, .5, vein);`);
  };
  m.customProgramCacheKey = () => 'veined-wing';
  return m;
}

export async function createSpecimen(host, options = {}) {
  const capture = Boolean(options.capture);
  const reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality = options.quality || (capture ? 'high' : (matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high'));
  let renderer;
  // Probe first so a device without WebGL goes straight to the fallback
  // instead of logging context-creation errors.
  const probe = document.createElement('canvas');
  const webgl = !options.forceSoftware && Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  try {
    if (!webgl) throw new Error('WebGL unavailable');
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
  } catch { renderer = new SoftwareRenderer(); }
  const software = Boolean(renderer.isSoftwareRenderer);
  const pixelRatio = options.pixelRatio ?? Math.min(devicePixelRatio, quality === 'low' ? 1.25 : 1.6);
  renderer.setPixelRatio(pixelRatio);
  if (!software) {
    renderer.setClearColor(0x07090a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.domElement.setAttribute('aria-label', 'Animated fruit fly on a desk with its enlarged, head-aligned neural anatomy');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (!software) scene.background = new THREE.Color(0x07090a);
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 400);
  const controls = capture ? null : new OrbitControls(camera, renderer.domElement);
  if (controls) { controls.enableDamping = !reduced; controls.enablePan = false; controls.minDistance = 4; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * .49; }

  const [flyData, flyBytes, brainData, brainBytes, alignment] = await Promise.all([
    fetchChecked('./data/fly.json'), fetchChecked('./data/fly.bin', 'arrayBuffer'),
    fetchChecked('./data/brain.json'), fetchChecked('./data/brain.bin', 'arrayBuffer'),
    fetchChecked('./data/alignment.json')
  ]);

  // ------------------------------------------------------------- body
  const body = new THREE.Group(); body.name = 'fly-root'; body.rotation.order = 'YZX';
  const anatomy = new THREE.Group(); anatomy.name = 'enlarged-anatomy';
  scene.add(body, anatomy);
  const nativeBody = new THREE.Group(); nativeBody.rotation.x = -Math.PI / 2; body.add(nativeBody);
  const geometryCache = new Map(), joints = new Map(), tipLocal = {};
  let randomState = 27;
  const random = () => ((randomState = (1664525 * randomState + 1013904223) >>> 0) / 4294967296);
  const bristleMat = new THREE.LineBasicMaterial({ color: 0x2b1f12, transparent: true, opacity: .8 });
  function bristles(geometry, count, len = 1) {
    const a = geometry.attributes.position, n = geometry.attributes.normal, p = [];
    for (let k = 0; k < count; k++) {
      const i = Math.floor(random() * a.count), length = (.02 + random() * .06) * len;
      const bend = (random() - .5) * .4;
      p.push(a.getX(i), a.getY(i), a.getZ(i), a.getX(i) + (n.getX(i) + bend) * length, a.getY(i) + n.getY(i) * length, a.getZ(i) + (n.getZ(i) - .3) * length);
    }
    return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)), bristleMat);
  }
  const mats = {
    thorax: cuticle(0xa4784c, { roughness: .46, mottle: 1 }),
    head: cuticle(0xab7f52, { roughness: .5, mottle: .7 }),
    leg: cuticle(0x9a7349, { roughness: .52, clearcoat: .2 }),
    dark: cuticle(0x3a2716, { roughness: .6 }),
    eye: eyeMaterial()
  };
  let wingAxis = null, wingMat = null;
  for (const part of flyData.parts) {
    let geometry = geometryCache.get(part.source);
    if (!geometry) {
      const g = flyData.geometry[part.source];
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flyBytes, g.positionOffset, g.vertices * 3), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(flyBytes, g.normalOffset, g.vertices * 3), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(flyBytes, g.indexOffset, g.indices), 1));
      geometry.computeBoundingBox();
      geometryCache.set(part.source, geometry);
    }
    const joint = new THREE.Group();
    joint.name = part.name; joint.position.fromArray(part.pos); joint.quaternion.fromArray(part.quaternion);
    joint.userData.rest = joint.quaternion.clone();
    joint.userData.restPosition = joint.position.clone();
    let material = mats.thorax;
    if (/eye/.test(part.name)) material = mats.eye;
    else if (/wing/.test(part.name)) {
      if (!wingMat) {
        const box = geometry.boundingBox, size = box.getSize(new THREE.Vector3());
        const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
        const order = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
        const li = order[0], ci = order[1];
        const pos = geometry.attributes.position;
        // Hinge end is the extreme closest to the joint origin.
        const minL = box.min.getComponent(li), maxL = box.max.getComponent(li);
        const near = Math.abs(minL) < Math.abs(maxL) ? minL : maxL, sign = near === minL ? 1 : -1;
        const long = new THREE.Vector4(...axes[li].clone().multiplyScalar(sign / size.getComponent(li)).toArray(), sign * near / size.getComponent(li));
        const cMid = (box.min.getComponent(ci) + box.max.getComponent(ci)) / 2;
        const chord = new THREE.Vector4(...axes[ci].clone().multiplyScalar(1 / size.getComponent(ci)).toArray(), cMid / size.getComponent(ci));
        wingAxis = { long, chord }; wingMat = wingMaterial(wingAxis);
        void pos;
      }
      material = wingMat;
    }
    else if (/arista|abdomen6|haustellum/.test(part.name)) material = mats.dark;
    else if (/coxa|tibia|tarsus|trochanter|femur/.test(part.name)) material = mats.leg;
    else if (/head|rostrum|pedicel|funiculus/.test(part.name)) material = mats.head;
    if (/abdomen/.test(part.name) && !part.name.endsWith('6')) {
      const bound = geometry.boundingBox;
      material = cuticle(0xb07a40, { roughness: .42, band: { min: bound.min.x, length: bound.max.x - bound.min.x } });
    }
    const mesh = new THREE.Mesh(geometry, material); mesh.name = part.name;
    mesh.castShadow = !/wing/.test(part.name);
    if (part.mirror) mesh.scale.y = -1;
    joint.add(mesh);
    const hairy = /thorax|head/.test(part.name) ? 320 : /abdomen/.test(part.name) ? 70 : /tibia|trochanter|femur/.test(part.name) ? 60 : 0;
    if (hairy) {
      const hair = bristles(geometry, hairy, /thorax|head/.test(part.name) ? 1.1 : .7);
      if (part.mirror) hair.scale.y = -1;
      joint.add(hair);
    }
    if (/tarsus5/.test(part.name)) {
      const pos = geometry.attributes.position; let best = -1;
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (d > best) { best = d; tipLocal[part.name.slice(0, 2)] = new THREE.Vector3(pos.getX(i), pos.getY(i) * (part.mirror ? -1 : 1), pos.getZ(i)); }
      }
    }
    (joints.get(part.parent) || nativeBody).add(joint);
    joints.set(part.name, joint);
  }
  const bodyCenter = new THREE.Box3().setFromObject(nativeBody).getCenter(new THREE.Vector3());
  nativeBody.position.sub(bodyCenter);
  body.scale.setScalar(BODY_SCALE);
  body.rotation.y = STANCE_YAW;
  const rig = createRig(joints, body, tipLocal);
  const fanMat = wingMat.clone(); fanMat.opacity = 0;
  const fan = createWingFan(joints, fanMat, 5);
  // Stance root: the lowest resting claw sits on the form.
  body.position.set(0, 0, 0);
  const stanceY = FOOT_Y - rig.restClawMinY();
  const stance = new THREE.Vector3(0, stanceY, 0);
  body.position.copy(stance);
  rig.calibrate(FOOT_Y);
  const stanceNative = nativeBody.matrixWorld.clone();
  const brainFront = new THREE.Quaternion();
  {
    const hq = joints.get('c_head').getWorldQuaternion(new THREE.Quaternion());
    const anterior = new THREE.Vector3(1, 0, 0).applyQuaternion(hq); anterior.y = 0; anterior.normalize();
    brainFront.setFromUnitVectors(anterior, new THREE.Vector3(0, 0, 1)).multiply(hq);
  }

  // ---------------------------------------------------------- anatomy
  const raw = brainData.encoding === 'int16' ? new Int16Array(brainBytes) : new Float32Array(brainBytes);
  const positions = brainData.encoding === 'int16' ? Float32Array.from(raw, x => x * brainData.coordinate_scale) : raw;
  const vertices = positions.length / 3;
  const colors = new Float32Array(vertices * 3), strengths = new Float32Array(vertices), nseed = new Float32Array(vertices), cls = new Float32Array(vertices);
  const pointPositions = [], pointColors = [], pointNeuron = [], pointSeed = [], pointCls = [];
  const ranges = new Map(), c = new THREE.Color(), hsl = {};
  const classSums = [0, 0, 0, 0].map(() => ({ p: new THREE.Vector3(), n: 0 }));
  for (const n of brainData.neurons) {
    const k = CLASS_INDEX[n.class] ?? 3;
    c.setHex(CLASS_COLORS[k]).getHSL(hsl);
    c.setHSL(hsl.h + ((n.index * 0.61803) % 1 - .5) * .05, hsl.s, hsl.l * (.85 + ((n.index * .377) % 1) * .3));
    const first = n.offset * 2, end = first + n.segments * 2;
    const s = ((n.id * 2654435761) >>> 0) / 4294967296;
    for (let v = first; v < end; v++) { colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b; }
    nseed.fill(s, first, end); cls.fill(k, first, end);
    ranges.set(n.index, [first, end]);
    for (let v = first; v < end; v += 18) {
      pointPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      pointColors.push(c.r, c.g, c.b); pointNeuron.push(n.index); pointSeed.push(s); pointCls.push(k);
      classSums[k].p.add(new THREE.Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2])); classSums[k].n++;
    }
  }
  const center = new THREE.Vector3().fromArray(alignment.brain_pivot);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  lineGeo.setAttribute('strength', new THREE.BufferAttribute(strengths, 1).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute('nseed', new THREE.BufferAttribute(nseed, 1));
  lineGeo.setAttribute('cls', new THREE.BufferAttribute(cls, 1));
  lineGeo.translate(-center.x, -center.y, -center.z);
  const explode = overloadUniforms();
  const lineUniforms = { ...explode, uLine: { value: 1 } };
  // Normal alpha compositing keeps dark separation between branches; only
  // actively spiking segments are pushed above the bloom threshold.
  const lineMat = new THREE.ShaderMaterial({
    uniforms: lineUniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `${EXPLODE_GLSL}
      uniform float uLine; attribute vec3 color; attribute float strength; varying vec3 vColor; varying float vStrength; varying float vPeel; varying float vDepth;
      void main(){ vColor = color; vStrength = strength; vPeel = peelOf(nseed); vec4 mv = modelViewMatrix*vec4(explode(position, nseed, 0.),1.); vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uLine; varying vec3 vColor; varying float vStrength; varying float vPeel; varying float vDepth;
      void main(){ vec3 base = vColor*(.62 + vPeel*.6); vec3 hot = vec3(1.,.96,.58)*2.2; float s = min(1., vStrength);
        gl_FragColor = vec4(mix(base, hot, s), (.05 + s*.6 + vPeel*.07) * uLine * mix(1., smoothstep(1., 4.5, vDepth), vPeel)); }`
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; anatomy.add(lines);
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeo.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  const pointStrength = new Float32Array(pointNeuron.length);
  pointGeo.setAttribute('strength', new THREE.BufferAttribute(pointStrength, 1).setUsage(THREE.DynamicDrawUsage));
  pointGeo.setAttribute('nseed', new THREE.Float32BufferAttribute(pointSeed, 1));
  pointGeo.setAttribute('cls', new THREE.Float32BufferAttribute(pointCls, 1));
  pointGeo.translate(-center.x, -center.y, -center.z);
  const pointMat = new THREE.ShaderMaterial({
    uniforms: lineUniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `${EXPLODE_GLSL}
      uniform float uLine; attribute vec3 color; attribute float strength; varying float level; varying vec3 tint;
      void main(){ level = strength; tint = color; vec4 mv = modelViewMatrix*vec4(explode(position, nseed, 0.),1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = uPixel * clamp((1.1 + level*3.4) * 9. / -mv.z, 1., 6.); }`,
    fragmentShader: `uniform float uLine; varying float level; varying vec3 tint;
      void main(){ float d = length(gl_PointCoord-.5)*2.; if(d>1.) discard; vec3 col = mix(tint*1.1, vec3(1.,.96,.58)*2.4, level); gl_FragColor = vec4(col, (.16 + level*.7)*(1.-d*d)*uLine); }`
  });
  const points = new THREE.Points(pointGeo, pointMat); points.frustumCulled = false; anatomy.add(points);
  const brainBox = new THREE.Box3().setFromBufferAttribute(pointGeo.attributes.position);
  const classCentroid = classSums.map(s => s.n ? s.p.divideScalar(s.n).sub(center) : new THREE.Vector3());

  const r = alignment.display_to_head_matrix;
  const registration = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(...r[0], 0, ...r[1], 0, ...r[2], 0, 0, 0, 0, 1));
  const head = joints.get('c_head');
  const headAnchor = new THREE.Vector3().fromArray(alignment.head_anchor);
  const headRotation = new THREE.Quaternion(), headScale = new THREE.Vector3(), headDorsal = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const magnification = 4;

  // ------------------------------------------------------------ stage
  let stage = null, overload = null;
  if (!software) {
    stage = createStage(scene, renderer, { quality, reducedMotion: reduced });
    overload = createOverload(lineGeo, nseed, cls, quality);
    overload.uniforms.uTime = explode.uTime; overload.uniforms.uBurst = explode.uBurst; overload.uniforms.uUp = explode.uUp; overload.uniforms.uSpread = explode.uSpread;
    overload.uniforms.uPixel.value = pixelRatio;
    anatomy.add(overload.points);
    const size = brainBox.getSize(new THREE.Vector3()), mid = brainBox.getCenter(new THREE.Vector3());
    stage.shell.position.copy(mid);
    stage.shell.scale.set(size.x * .56, size.y * .64, size.z * .64);
    anatomy.add(stage.shell);
  }
  explode.uPixel.value = pixelRatio;

  // ------------------------------------------------------- post stack
  let composer = null, bloom = null, grade = null, sanitize = null;
  if (!software) {
    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: quality === 'low' ? 2 : 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    // Clamp non-finite and extreme HDR samples before bloom; a single bad
    // specular sample would otherwise smear into a black block.
    sanitize = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uShowBad: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uShowBad; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          bool bad = any(isnan(c)) || any(isinf(c));
          if (uShowBad > .5) { gl_FragColor = bad ? vec4(20.,0.,20.,1.) : c; return; }
          gl_FragColor = bad ? vec4(0.,0.,0.,1.) : vec4(min(c.rgb, vec3(64.)), c.a); }`
    });
    composer.addPass(sanitize);
    bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .55, .62, .92);
    composer.addPass(bloom);
    grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uGrain: { value: .035 }, uVignette: { value: .42 }, uRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uFrame; uniform float uGrain; uniform float uVignette; uniform vec2 uRes; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uFrame*.6180339)*43758.5453); }
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = (vUv-.5)*vec2(1.,.82);
          float v = smoothstep(.78, .18, length(d)); c.rgb *= mix(1.-uVignette, 1., v);
          c.rgb = max(c.rgb + (h(floor(vUv*uRes)) - .5) * uGrain * (.25 + c.rgb), 0.);
          c.rgb *= vec3(1.02, 1., .97);
          gl_FragColor = c; }`
    });
    composer.addPass(grade);
    composer.addPass(new OutputPass());
  }
  // Debug switches for visual QA only: ?nobloom, ?hide=name,name
  const debug = new URLSearchParams(location.search);
  if (bloom && debug.has('nobloom')) bloom.enabled = false;
  if (sanitize && debug.has('showbad')) sanitize.uniforms.uShowBad.value = 1;
  const debugCam = debug.get('cam') ? debug.get('cam').split(',').map(Number) : null;
  for (const name of (debug.get('hide') || '').split(',').filter(Boolean)) {
    scene.traverse(o => { if (o.name && o.name.includes(name)) o.visible = false; });
    if (name === 'material-eye') joints.forEach(j => j.children.forEach(m => { if (m.material === mats.eye) m.visible = false; }));
    if (name === 'material-cuticle') joints.forEach(j => j.children.forEach(m => { if (m.isMesh && m.material !== mats.eye && m.material !== wingMat) m.visible = false; }));
    if (name === 'material-wing') joints.forEach(j => j.children.forEach(m => { if (m.material === wingMat) m.visible = false; }));
  }

  // ------------------------------------------------------- state
  let moving = !reduced, signalPlaying = true, view = 'both', clock = 0, last = performance.now();
  let mood = 'confident', reactionStarted = -100, storyTime = null, width = 1, height = 1, frameSeed = 1;
  let activity = null;
  const metrics = { ik: 0 };
  const camTarget = new THREE.Vector3();
  const rootWorld = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), invQ = new THREE.Quaternion();

  function nativeToWorld(p, out) { return out.set(p[0], p[1], p[2]).applyMatrix4(stanceNative); }

  function alignBrain() {
    head.getWorldQuaternion(headRotation);
    head.getWorldScale(headScale);
    anatomy.quaternion.copy(headRotation).multiply(registration);
    if (view === 'brain') {
      anatomy.position.set(0, 3.9, 0);
      // Frontal view: the stance head orientation turned so the fly's anterior faces the camera.
      anatomy.quaternion.copy(brainFront).multiply(registration);
      anatomy.scale.setScalar(alignment.scale_to_head * BODY_SCALE * 5.2);
    } else {
      anatomy.position.copy(headAnchor);
      head.localToWorld(anatomy.position);
      headDorsal.set(0, 0, 1).applyQuaternion(headRotation);
      anatomy.position.addScaledVector(headDorsal, 1.85 * headScale.x);
      anatomy.scale.setScalar(alignment.scale_to_head * headScale.x * magnification);
    }
    // Everything downstream reads world matrices this frame, never last frame's.
    anatomy.updateMatrixWorld(true);
  }

  const groom = new THREE.Vector3();
  function applyPose(pose) {
    const rt = pose.root;
    body.position.set(stance.x + rt.x, stance.y + rt.y, stance.z + rt.z);
    body.rotation.set(rt.roll, STANCE_YAW + rt.yaw, rt.pitch);
    if (software) { body.position.copy(stance); body.rotation.set(0, STANCE_YAW, 0); pose.head = [0, 0, 0]; }
    for (const l of LEGS) {
      const spec = pose.legs[l];
      if (spec.native) {
        nativeToWorld(spec.native, groom);
        const rest = rig.legs[l].rest, k = spec.lift;
        spec.target = rest.clone().lerp(groom, k);
        spec.target.y += Math.sin(k * Math.PI) * .45;
      }
    }
    rig.apply(pose, FOOT_Y, metrics);
    fan.update(pose.buzz || 0);
    alignBrain();
  }

  function setStrengths(frame) {
    strengths.fill(0);
    if (frame) for (const [index, count] of Object.entries(frame)) {
      const rg = ranges.get(Number(index)); if (!rg) continue;
      strengths.fill(Math.min(1, count / 2), rg[0], rg[1]);
    }
    lineGeo.attributes.strength.needsUpdate = true;
    for (let i = 0; i < pointNeuron.length; i++) pointStrength[i] = frame ? Math.min(1, (frame[pointNeuron[i]] || 0) / 2) : 0;
    pointGeo.attributes.strength.needsUpdate = true;
  }

  const diveFocus = new THREE.Vector3();
  // JS replica of the shader expansion for one representative point, used to
  // aim the dive at the visual-route / central-brain boundary.
  const hz = new THREE.Vector3();
  function explodedLocal(p, ns, burst, t, cls, out) {
    const peel = smooth(ns * .62, ns * .62 + .38, burst);
    const u = tmp.copy(explode.uUp.value).normalize();
    const rr = p.length();
    out.copy(p).multiplyScalar(1 + peel * (2.1 + ns * 2.4));
    out.addScaledVector(u, peel * (1.6 + rr * .9 + ns * 3));
    const ang = peel * (ns - .5) * 1.6 + peel * .25 * Math.sin(t * .3 + ns * 6);
    out.applyAxisAngle(u, ang);
    if (cls > 2.5) out.addScaledVector(u, peel * 2.8);
    else { hz.copy(out).addScaledVector(u, -out.dot(u)).normalize(); out.addScaledVector(hz, peel * 1.4).addScaledVector(u, -peel * .8); }
    return out;
  }
  const leftOptic = new THREE.Vector3().fromArray(alignment.optic_centers.L).sub(center);
  const focusVisual = new THREE.Vector3(), focusCentral = new THREE.Vector3(), anchorVisual = new THREE.Vector3(), diveSide = new THREE.Vector3();

  function applyStory(t) {
    const b = beats(t);
    const pose = storyPose(t, { reducedMotion: reduced });
    applyPose(pose);
    const burst = reduced ? 0 : b.burst;
    explode.uTime.value = t;
    explode.uBurst.value = burst;
    anatomy.getWorldQuaternion(invQ).invert();
    explode.uUp.value.copy(up).applyQuaternion(invQ);
    lineUniforms.uLine.value = view === 'fly' ? 0 : 1;
    if (stage) {
      stage.update(t);
      stage.setVisible(view !== 'brain');
      overload.points.visible = burst > .002 && view !== 'fly';
      overload.uniforms.uAmount.value = burst * (1 - .45 * b.dive);
      const shellOn = reduced ? 0 : b.shell;
      stage.shell.visible = shellOn > .01 && view === 'both';
      stage.shellUniforms.uOpacity.value = shellOn * (1 - .6 * b.burst);
      stage.shellUniforms.uTime.value = t;
      stage.upperHinge.rotation.x = -b.open * 1.7;
      stage.lowerHinge.rotation.x = b.open * .45;
      stage.upperHinge.position.set(0, 0, 0);
      head.getWorldPosition(headWorld);
      const open = reduced ? 0 : b.open;
      stage.flare.visible = open > .01 && view === 'both';
      stage.flare.position.copy(headWorld).addScaledVector(headDorsal, .45 * BODY_SCALE);
      stage.flare.scale.setScalar(.4 + open * .9 + .1 * Math.sin(t * 7));
      stage.flare.material.opacity = open * .45;
      stage.foreheadLight.position.copy(stage.flare.position);
      stage.foreheadLight.intensity = open * 3;
      stage.stream.visible = open > .01 && view === 'both';
      stage.streamUniforms.uA.value.copy(stage.flare.position);
      stage.streamUniforms.uB.value.copy(anatomy.position);
      stage.streamUniforms.uTime.value = t;
      stage.streamUniforms.uAmount.value = open * .55 * (1 - .6 * b.dive);
      stage.streamUniforms.uWidth.value = .5 + burst * 1.6;
      stage.streamUniforms.uPixel.value = pixelRatio;
      stage.neuralLight.position.copy(anatomy.position);
      // Practical lights dip while the overload is the main light source.
      const dim = 1 - .62 * burst;
      stage.key.intensity = 520 * dim; stage.fill.intensity = .55 * dim; stage.hemi.intensity = .35 * dim; stage.rim.intensity = .75 * (1 - .4 * burst);
      scene.environmentIntensity = .55 * (1 - .45 * burst);
      stage.neuralLight.intensity = burst * 5 + open * 2;
      // Aim point for the dive: between the visual projection and central
      // brain centroids after expansion.
      // Dive target: the gap between the lifted central brain and the
      // spread visual route, viewed from the side the camera arrives on.
      anatomy.localToWorld(explodedLocal(classCentroid[2], .5, 1, t, 2, focusVisual));
      anatomy.localToWorld(explodedLocal(classCentroid[3], .5, 1, t, 3, focusCentral));
      anatomy.localToWorld(explodedLocal(leftOptic, .5, burst, t, 1, anchorVisual));
      diveFocus.copy(focusVisual).lerp(focusCentral, .55);
      diveSide.set(Math.cos(-.2), 0, Math.sin(-.2));
    }
    if (bloom) {
      bloom.strength = .45 + burst * .35 + b.open * .15;
      grade.uniforms.uFrame.value = Math.round(t * 30) + frameSeed * 1000;
    }
    if (!capture && controls) controls.enabled = false;
    // The brain-only view keeps its own framing; fly and combined views follow the story camera.
    const shot = view === 'brain' ? idleCamera('brain', width / height) : storyCamera(t, { aspect: width / height, diveFocus, diveSide, reducedMotion: reduced });
    camera.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
    camTarget.set(shot.target.x, shot.target.y, shot.target.z);
    camera.lookAt(camTarget);
    if (camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
    if (debugCam) { camera.position.set(debugCam[0], debugCam[1], debugCam[2]); camera.lookAt(debugCam[3], debugCam[4], debugCam[5]); camera.fov = debugCam[6]; camera.updateProjectionMatrix(); }
  }

  let idleCamKey = '';
  function applyIdle(dt) {
    if (moving) clock += dt;
    const reaction = Math.max(0, Math.sin(Math.min(1, (clock - reactionStarted) / 2.1) * Math.PI)) * (clock - reactionStarted < 2.1 ? 1 : 0);
    applyPose(idlePose(clock, mood, reaction, reduced || !moving));
    explode.uBurst.value = 0;
    lineUniforms.uLine.value = view === 'fly' ? 0 : 1;
    if (stage) {
      stage.update(-1);
      stage.setVisible(view !== 'brain');
      overload.points.visible = false; stage.shell.visible = false; stage.flare.visible = false; stage.stream.visible = false;
      stage.neuralLight.intensity = 0; stage.foreheadLight.intensity = 0;
      if (signalPlaying && moving) stage.neuralLight.intensity = 0;
    }
    if (bloom) bloom.strength = .45;
    const key = `${view}|${(width / height).toFixed(2)}`;
    if (key !== idleCamKey && controls) {
      idleCamKey = key;
      const shot = idleCamera(view, width / height);
      camera.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
      controls.target.set(shot.target.x, shot.target.y, shot.target.z);
      camera.fov = shot.fov; camera.updateProjectionMatrix();
    }
    if (controls) { controls.enabled = true; controls.update(); }
  }

  function render() {
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function resize(w, h) {
    width = Math.max(1, Math.round(w)); height = Math.max(1, Math.round(h));
    renderer.setSize(width, height, !capture);
    camera.aspect = width / height;
    // Website only: shift the projection so the subject clears the headline.
    const shift = options.viewShift ? options.viewShift() : null;
    if (shift) camera.setViewOffset(width, height, -shift[0] * width, -shift[1] * height, width, height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      grade.uniforms.uRes.value.set(width * pixelRatio, height * pixelRatio);
    }
    idleCamKey = '';
  }
  if (capture) resize(options.width || host.clientWidth, options.height || host.clientHeight);
  else { new ResizeObserver(() => resize(host.clientWidth, host.clientHeight)).observe(host); resize(host.clientWidth, host.clientHeight); }

  let disposed = false, wasStory = false;
  function animate(now) {
    if (disposed) return;
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, .06); last = now;
    if (document.hidden) return;
    if (storyTime !== null) { applyStory(storyTime); wasStory = true; }
    else { if (wasStory) { idleCamKey = ''; wasStory = false; } applyIdle(dt); }
    render();
  }
  if (!capture) requestAnimationFrame(animate);
  document.getElementById('sceneLoading')?.remove();

  return {
    get isMoving() { return moving; },
    get mood() { return mood; },
    visibleNeurons: brainData.neurons.length,
    rendererType: software ? 'software' : 'webgl',
    quality,
    canvas: renderer.domElement,
    setMotion(value) { moving = value; return moving; },
    // Story time drives every authored element; null returns to idle.
    setStoryTime(value) { storyTime = value; },
    setTime(seconds, seed = 1) { frameSeed = seed; storyTime = seconds; applyStory(seconds); },
    renderFrame() { render(); },
    renderAt(seconds, seed = 1) { frameSeed = seed; storyTime = seconds; applyStory(seconds); render(); },
    resize,
    setMood(value) { mood = value; },
    react() { reactionStarted = clock; },
    setSignalPlaying(value) { signalPlaying = value; },
    toggleMotion() { moving = !moving; return moving; },
    setView(value) {
      view = value; body.visible = value !== 'brain'; anatomy.visible = value !== 'fly';
      idleCamKey = '';
    },
    setCamera() { idleCamKey = ''; },
    setActivity(frame) { activity = frame; setStrengths(frame); },
    // Normalised screen positions of the two lobes during the overload.
    anchors() {
      const v = focusCentral.clone().project(camera), w = anchorVisual.clone().project(camera);
      return { central: [(v.x + 1) / 2, (1 - v.y) / 2, v.z], visual: [(w.x + 1) / 2, (1 - w.y) / 2, w.z] };
    },
    // Measurements for automated checks. No effect on rendering.
    probe() {
      body.updateMatrixWorld(true);
      const claws = LEGS.map(l => rig.clawWorld(l).toArray());
      const cam = camera.position.toArray();
      if (stage) stage.root.updateMatrixWorld(true);
      const sheets = stage ? [...stage.sheets.map(s => ({ name: s.mesh.name, visible: s.mesh.visible, matrix: s.mesh.matrixWorld.toArray(), curl: s.curl, flutter: s.flutter })), ...[stage.baseForm, stage.verdict].map(m => ({ name: m.name, visible: m.visible, matrix: m.matrixWorld.toArray(), curl: 0, flutter: 0 }))] : [];
      const eyes = ['l_eye', 'r_eye'].map(n => joints.get(n).getWorldPosition(new THREE.Vector3()).toArray());
      return { ik: metrics.ik, claws, footY: FOOT_Y, cam, sheets, eyes, body: body.getWorldPosition(new THREE.Vector3()).toArray(), anatomy: anatomy.getWorldPosition(new THREE.Vector3()).toArray(), activity: Boolean(activity) };
    },
    dispose() { disposed = true; controls?.dispose(); composer?.dispose?.(); renderer.dispose(); }
  };
}
