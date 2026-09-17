import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import { wingPose } from '../dist/anatomy-pose.js';
const root=new URL('../',import.meta.url).pathname;
const data=JSON.parse(fs.readFileSync(root+'dist/data/fly.json'));
const a=JSON.parse(fs.readFileSync(root+'dist/data/alignment.json'));
const b=fs.readFileSync(root+'dist/data/fly.bin');
const joints=new Map(), scene=new T.Group(), body=[];
function points(p){const g=data.geometry[p.source];return new Float32Array(b.buffer,b.byteOffset+g.positionOffset,g.vertices*3);}
function indices(p){const g=data.geometry[p.source];return new Uint32Array(b.buffer,b.byteOffset+g.indexOffset,g.indices);}
for(const p of data.parts){const j=new T.Group();j.position.fromArray(p.pos);j.quaternion.fromArray(p.quaternion);(joints.get(p.parent)||scene).add(j);joints.set(p.name,j);}
scene.updateMatrixWorld(true);
for(const p of data.parts.filter(x=>/thorax|abdomen/.test(x.name))){const pos=points(p),m=joints.get(p.name).matrixWorld,coords=[];for(let i=0;i<pos.length;i+=3)coords.push(...new T.Vector3(pos[i],pos[i+1]*(p.mirror?-1:1),pos[i+2]).applyMatrix4(m).toArray());body.push({name:p.name,positions:coords,indices:[...indices(p)]});}
const wings=[];
for(const fraction of [0,.25,.5,.75,1])for(const side of ['l','r']){
 const p=data.parts.find(x=>x.name===side+'_wing'),j=joints.get(p.name);
 wingPose(new T.Quaternion().fromArray(p.quaternion),side==='l'?1:-1,fraction,j.quaternion);scene.updateMatrixWorld(true);
 const pos=points(p),coords=[];for(let i=0;i<pos.length;i+=3)coords.push(...new T.Vector3(pos[i],pos[i+1]*(p.mirror?-1:1),pos[i+2]).applyMatrix4(j.matrixWorld).toArray());
 wings.push({side,fraction,hinge:j.getWorldPosition(new T.Vector3()).toArray(),positions:coords});
}

const r=a.display_to_head_matrix,m=new T.Matrix4().set(...r[0],0,...r[1],0,...r[2],0,0,0,0,1);
const optical=new T.Vector3().fromArray(a.optic_centers.L).sub(new T.Vector3().fromArray(a.optic_centers.R)).applyMatrix4(m).multiplyScalar(a.scale_to_head);
const eyes=new T.Vector3().fromArray(a.eye_centers.l_eye).sub(new T.Vector3().fromArray(a.eye_centers.r_eye));
if(optical.distanceTo(eyes)>1e-9)throw Error('Eye/optic-axis alignment mismatch');
process.stdout.write(JSON.stringify({body,wings}));
