// Original FLY-001 replay scene, used by attempt.html. The cinematic story
// and film use scene.js; this file keeps the recorded replay unchanged.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SoftwareRenderer } from './software-renderer.js';
import { wingPose } from './anatomy-pose.js';

const palette = [0x65ded9, 0x8299f5, 0xd979d8, 0xeaae60, 0x9bda82];
const fetchChecked = async (url, kind = 'json') => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response[kind]();
};

export async function createSpecimen(host, options = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { renderer = new SoftwareRenderer(); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setClearColor(0x090c0d, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-label', 'Rotatable research model of a fruit fly and its neural anatomy');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(0, 1.8, 13.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .8, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * .85;
  const composition = new THREE.Group();
  scene.add(composition);
  scene.add(new THREE.HemisphereLight(0xdbe3df, 0x443d30, 1.4));
  function light(color, power, x, y, z) {
    const l = new THREE.DirectionalLight(color, power);
    l.position.set(x, y, z); scene.add(l);
  }
  light(0xffedcf, 2.4, -3, 6, 5);
  light(0xc1dbea, 1.4, 5, 3, -3);
  light(0xc78639, .65, -4, -2, -2);
  const body = new THREE.Group();
  const anatomy = new THREE.Group();
  composition.add(body, anatomy);
  let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let signalPlaying=true,signalClock=0;
  let view = 'both', clock = 0, last = performance.now(), activity = null;
  let mood = 'confident', reactionStarted = -100;
  const theatrical = Boolean(options.theatrical);
  let storyTime = null;
  const joints = new Map();

  const [flyData, flyBytes, brainData, brainBytes, alignment] = await Promise.all([
    fetchChecked('./data/fly.json'), fetchChecked('./data/fly.bin', 'arrayBuffer'),
    fetchChecked('./data/brain.json'), fetchChecked('./data/brain.bin', 'arrayBuffer'),
    fetchChecked('./data/alignment.json')
  ]);
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: 0x86603b, roughness: .68, metalness: .04 }),
    leg: new THREE.MeshStandardMaterial({ color: 0xa17b4a, roughness: .65, metalness: .03 }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x9e2e1d, roughness: .29, metalness: .1, clearcoat: .48, clearcoatRoughness: .2, flatShading: true }),
    wing: new THREE.MeshPhysicalMaterial({ color: 0xc8c8b1, roughness: .21, metalness: .18, transparent: true, opacity: .31, side: THREE.DoubleSide, depthWrite: false, iridescence: .7 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x40301e, roughness: .6, metalness: .05 })
  };
  const geometryCache = new Map();
  const nativeBody = new THREE.Group();
  nativeBody.rotation.x = -Math.PI / 2;
  body.add(nativeBody);
  let randomState = 27;
  const random = () => ((randomState = (1664525 * randomState + 1013904223) >>> 0) / 4294967296);
  function bristles(geometry, count) {
    const a = geometry.attributes.position, n = geometry.attributes.normal, p = [];
    for (let k = 0; k < count; k++) {
      const i = Math.floor(random() * a.count), length = .015 + random() * .055;
      p.push(a.getX(i), a.getY(i), a.getZ(i), a.getX(i) + n.getX(i) * length, a.getY(i) + n.getY(i) * length, a.getZ(i) + n.getZ(i) * length);
    }
    return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)), new THREE.LineBasicMaterial({ color: 0x392c1b, transparent: true, opacity: .72 }));
  }
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
    let material = materials.body;
    if (/eye/.test(part.name)) material = materials.eye;
    else if (/wing/.test(part.name)) material = materials.wing;
    else if (/arista|abdomen6/.test(part.name)) material = materials.dark;
    else if (/coxa|tibia|tarsus|trochanter/.test(part.name)) material = materials.leg;
    if (/abdomen/.test(part.name) && !part.name.endsWith('6')) {
      material = materials.body.clone();
      const bound = geometry.boundingBox;
      material.onBeforeCompile = shader => {
        shader.uniforms.partMin = { value: bound.min.x };
        shader.uniforms.partLength = { value: bound.max.x - bound.min.x };
        shader.vertexShader = 'varying vec3 localPoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nlocalPoint = position;');
        shader.fragmentShader = 'varying vec3 localPoint; uniform float partMin; uniform float partLength;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat band = smoothstep(.10,.24,(localPoint.x-partMin)/partLength); diffuseColor.rgb *= mix(vec3(.25,.20,.15),vec3(1.08,.91,.69),band);');
      };
      material.customProgramCacheKey = () => 'abdomen-banding';
    }
    const mesh = new THREE.Mesh(geometry, material); mesh.name=part.name;
    if (part.mirror) mesh.scale.y = -1;
    joint.add(mesh);
    if (/thorax|head|abdomen|tibia|trochanter/.test(part.name)) {
      const hair = bristles(geometry, /thorax|head/.test(part.name) ? 220 : 45);
      if (part.mirror) hair.scale.y = -1;
      joint.add(hair);
    }
    (joints.get(part.parent) || nativeBody).add(joint);
    joints.set(part.name, joint);
  }
  const bodyBox = new THREE.Box3().setFromObject(nativeBody);
  const bodyCenter = bodyBox.getCenter(new THREE.Vector3());
  nativeBody.position.sub(bodyCenter);
  body.rotation.y = -.9;
  body.rotation.z = -.04;
  for (const side of ['l', 'r']) {
    const wing = joints.get(`${side}_wing`);
    wingPose(wing.userData.rest, side === 'l' ? 1 : -1, 0, wing.quaternion);
  }

  const raw = brainData.encoding === 'int16' ? new Int16Array(brainBytes) : new Float32Array(brainBytes);
  const positions = brainData.encoding === 'int16' ? Float32Array.from(raw, x => x * brainData.coordinate_scale) : raw;
  const vertices = positions.length / 3;
  const colors = new Float32Array(vertices * 3), strengths = new Float32Array(vertices), phases=new Float32Array(vertices);
  const pointPositions = [], pointColors = [], pointNeuron = [];
  const ranges = new Map();
  const c = new THREE.Color();
  for (const n of brainData.neurons) {
    c.setHex(palette[n.index % palette.length]);
    const first = n.offset * 2, end = first + n.segments * 2;
    for (let v = first; v < end; v++) { colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b; }
    ranges.set(n.index, [first, end]);
    phases.fill((n.index%101)*.618,first,end);
    for (let v = first; v < end; v += 18) {
      pointPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      pointColors.push(c.r, c.g, c.b); pointNeuron.push(n.index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('strength', new THREE.BufferAttribute(strengths, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases,1));
  const material = new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    // Alpha compositing preserves color in dense overlaps. Additive blending
    // had saturated hundreds of thousands of overlapping segments to white.
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: 'attribute vec3 color; attribute float strength; varying vec3 vColor; varying float vStrength; void main(){vColor=color;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vColor; varying float vStrength; void main(){gl_FragColor=vec4(mix(pow(vColor,vec3(1./2.2))*.85,vec3(.84,.95,.44),min(1.,vStrength)),.045+vStrength*.45);}'
  });
  anatomy.add(new THREE.LineSegments(geometry, material));
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  const pointStrength=new Float32Array(pointNeuron.length),pointPhase=Float32Array.from(pointNeuron,n=>(n%101)*.618);
  pointGeometry.setAttribute('strength',new THREE.BufferAttribute(pointStrength,1).setUsage(THREE.DynamicDrawUsage));
  pointGeometry.setAttribute('phase',new THREE.BufferAttribute(pointPhase,1));
  const pointMaterial=new THREE.ShaderMaterial({uniforms:material.uniforms,transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    vertexShader:'uniform float uTime;attribute float phase;attribute vec3 color;attribute float strength;varying float level;varying vec3 tint;void main(){level=strength;tint=color;float pulse=.85+.15*sin(uTime*8.+phase);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.25+level*3.2*pulse)*13./-mv.z,1.,5.);}',
    fragmentShader:'varying float level;varying vec3 tint;void main(){float d=length(gl_PointCoord-vec2(.5))*2.;if(d>1.)discard;vec3 color=mix(pow(tint,vec3(1./2.2)),vec3(.86,.96,.47),level);gl_FragColor=vec4(color,(.28+level*.62)*pow(1.-d,1.2));}'});
  const points = new THREE.Points(pointGeometry, pointMaterial);
  anatomy.add(points);
  const center = new THREE.Vector3().fromArray(alignment.brain_pivot);
  geometry.translate(-center.x, -center.y, -center.z); pointGeometry.translate(-center.x, -center.y, -center.z);
  const r = alignment.display_to_head_matrix;
  const registration = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(
    ...r[0], 0, ...r[1], 0, ...r[2], 0, 0, 0, 0, 1
  ));
  const head = joints.get('c_head');
  const headMesh = head.children.find(o => o.isMesh);
  headMesh.material = headMesh.material.clone();
  headMesh.material.transparent = true;
  const headAnchor = new THREE.Vector3().fromArray(alignment.head_anchor);
  const headRotation = new THREE.Quaternion(), headScale = new THREE.Vector3();
  const headDorsal = new THREE.Vector3();
  const magnification = 4;
  const target = { bodyX: -.65, bodyY: -.1, bodyScale: 1.22 };
  body.position.set(target.bodyX, target.bodyY, 0); body.scale.setScalar(target.bodyScale);
  function alignBrain() {
    body.updateMatrixWorld(true);
    head.getWorldQuaternion(headRotation);
    head.getWorldScale(headScale);
    anatomy.quaternion.copy(headRotation).multiply(registration);
    if (view === 'brain') {
      anatomy.position.set(0, 1, 0);
      anatomy.scale.setScalar(alignment.scale_to_head * 7.1);
    } else {
      anatomy.position.copy(headAnchor);
      head.localToWorld(anatomy.position);
      // An exploded head view: the optic-lobe axis follows the eyes, and
      // enlargement is offset along the head's dorsal axis, not screen-up.
      headDorsal.set(0, 0, 1).applyQuaternion(headRotation);
      anatomy.position.addScaledVector(headDorsal, 1.85 * headScale.x);
      anatomy.scale.setScalar(alignment.scale_to_head * headScale.x * magnification);
    }
  }
  alignBrain();
  const theatre = null;
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  let disposed = false;
  const q = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1),pitchAxis=new THREE.Vector3(0,1,0);
  function animate(now) {
    if (disposed) return;
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, .06); last = now;
    if (moving && !document.hidden) clock += dt;
    if(moving&&signalPlaying&&!document.hidden)signalClock+=dt;
    material.uniforms.uTime.value=signalClock;
    let hover = 0;
    if (moving) {
      const breath = Math.sin(clock * 1.25);
      const isReacting = theatrical && clock - reactionStarted < 2.1;
      const acting = isReacting ? 'startled' : mood;
      const nervous = theatrical && ['panic','startled'].includes(acting);
      const studying = theatrical && acting === 'studying';
      const proud = theatrical && ['confident','celebrate'].includes(acting);
      const tired = theatrical && acting === 'tired';
      const confused = theatrical && acting === 'confused';
      const tempo = nervous ? 10 : studying ? 4.2 : tired ? .9 : 2.6;
      const gait = Math.sin(clock * tempo);
      if(theatrical && !renderer.isSoftwareRenderer){
        hover = isReacting ? Math.max(0,Math.sin((clock-reactionStarted)/2.1*Math.PI))*.8 : acting==='celebrate' ? Math.max(0,Math.sin(clock*3.5))*.16 : nervous ? Math.abs(gait)*.12 : 0;
      }
      // Keep the expensive projected skeleton cache stable in the fallback;
      // all limb animation and manual camera rotation still work there.
      body.rotation.y = (view === 'brain' ? -Math.PI/2 : -.9) + (renderer.isSoftwareRenderer ? 0 : Math.sin(clock * (theatrical?.65:.24)) * (proud?.15:.07));
      body.rotation.z = -.04 + (renderer.isSoftwareRenderer ? 0 : nervous?gait*.045:breath * (theatrical?.015:.006));
      for (const [name, joint] of joints) {
        joint.quaternion.copy(joint.userData.rest);
        const side = name[0] === 'r' ? -1 : 1;
        let angle = 0;
        if (name.includes('pedicel')) angle = side * Math.sin(clock * tempo + side*.5) * (nervous?.38:tired?.06:.23);
        if (theatrical && name.includes('funiculus')) angle = side * Math.sin(clock*tempo*1.6) * .14;
        if (theatrical && name.includes('arista')) angle = side * Math.sin(clock*tempo*2+side) * .10;
        if (name.includes('wing')) {
          // Every authored performance stays in the checked 0..1 wing envelope.
          const stroke = theatrical ? nervous ? .2+.8*(.5+.5*Math.sin(clock*24)) : acting==='celebrate' ? .1+.9*Math.pow(Math.max(0,Math.sin(clock*13)),2) : tired ? .03 : Math.pow(Math.max(0, Math.sin(clock * 2)), 4)*.75 : Math.pow(Math.max(0, Math.sin(clock * 1.3)), 6);
          wingPose(joint.userData.rest, side, stroke, joint.quaternion);
          continue;
        }
        if (name === 'c_head' && !renderer.isSoftwareRenderer) angle = theatrical ? tired ? -.10 : confused ? Math.sin(clock*2.5)*.17 : studying ? -.06+Math.sin(clock*2)*.055 : gait*.09 : Math.sin(clock * 1.3) * .045;
        const groom = Math.pow(Math.max(0,Math.sin(clock*(studying?4:1.7)+side*.3)),2);
        if (/^[lr]f_tibia/.test(name)) angle = groom*(theatrical?.6:.28)+(nervous?.1*gait:0);
        if (/^[lr]f_trochanter/.test(name)) angle = -groom*(theatrical?.32:.18);
        if (theatrical && /^[lr]f_tarsus1/.test(name)) angle = groom*.3;
        if (theatrical && /^[lr][mh]_tibia/.test(name)) angle = Math.sin(clock*(nervous?8:2.2)+side*1.4)*(nervous?.28:.05);
        if (theatrical && /^[lr][mh]_coxa/.test(name)) angle = Math.sin(clock*(nervous?8:2.2)+side)*(nervous?.13:.025);
        if(theatrical && name==='c_haustellum')angle=Math.pow(Math.max(0,Math.sin(clock*1.5)),4)*.12;
        if (angle) joint.quaternion.multiply(q.setFromAxisAngle(/tibia|trochanter/.test(name)?pitchAxis:axis, angle));
      }
    }
    const stage = theatre?.update(storyTime, clock, moving) || {burst:0, landing:0, shake:0};
    body.position.x = THREE.MathUtils.damp(body.position.x, target.bodyX + Math.sin(clock*21)*stage.shake*.06, 7, dt);
    body.position.y = THREE.MathUtils.damp(body.position.y, target.bodyY + hover + stage.landing, 7, dt);
    body.scale.setScalar(THREE.MathUtils.damp(body.scale.x, target.bodyScale, 7, dt));
    headMesh.material.opacity = 1-stage.burst*.96;
    for(const side of ['l','r']) {
      const eye=joints.get(`${side}_eye`);
      if(eye) {eye.position.copy(eye.userData.restPosition);eye.position.y+=(side==='l'?1:-1)*stage.burst*.5;}
    }
    alignBrain();
    anatomy.scale.multiplyScalar(1+stage.burst*.8);
    anatomy.position.y+=stage.burst*.5;
    anatomy.children[0].visible=stage.burst<.65;
    points.visible=stage.burst<.8;
    if(storyTime===null) controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  document.getElementById('sceneLoading')?.remove();
  return {
    get isMoving() { return moving; },
    get mood() { return mood; },
    visibleNeurons: brainData.neurons.length,
    rendererType:renderer.isSoftwareRenderer?'software':'webgl',
    setMotion(value) { moving = value; return moving; },
    setStoryTime(value) { storyTime = value; },
    setMood(value) { mood = value; },
    react() { reactionStarted = clock; },
    setSignalPlaying(value) { signalPlaying=value; },
    toggleMotion() { moving = !moving; return moving; },
    setView(value) {
      view = value; body.visible = value !== 'brain'; anatomy.visible = value !== 'fly';
      body.rotation.y = value === 'brain' ? -Math.PI/2 : -.9;
      Object.assign(target, value === 'fly' ? { bodyX: 0, bodyY: .65, bodyScale: 1.7 } : { bodyX: -.65, bodyY: -.1, bodyScale: 1.22 });
      camera.position.set(0, 1.8, 13.5); controls.target.set(0, .8, 0);
    },
    setCamera(value) {
      controls.target.set(0, .8, 0);
      if (value === 'side') camera.position.set(-10, 2.7, 9);
      else if (value === 'top') camera.position.set(0, 13.8, .1);
      else camera.position.set(0, 1.8, 13.5);
      controls.update();
    },
    setActivity(frame) {
      activity = frame; strengths.fill(0);
      if (frame) for (const [index, count] of Object.entries(frame)) {
        const r = ranges.get(Number(index)); if (!r) continue;
        strengths.fill(Math.min(1, count / 2), r[0], r[1]);
      }
      geometry.attributes.strength.needsUpdate = true;
      for(let i=0;i<pointNeuron.length;i++)pointStrength[i]=frame?Math.min(1,(frame[pointNeuron[i]]||0)/2):0;
      pointGeometry.attributes.strength.needsUpdate=true;
    },
    dispose() { disposed = true; theatre?.dispose(); controls.dispose(); renderer.dispose(); }
  };
}
