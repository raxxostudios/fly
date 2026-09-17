import * as THREE from 'three';

// A projection of the same research meshes when WebGL is unavailable.
// This is intentionally a reduced-detail renderer, not a replacement model.
export class SoftwareRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.context = this.domElement.getContext('2d');
    this.ratio = 1; this.width = 1; this.height = 1;
    this.lods = new WeakMap(); this.lastRender = 0;
    this.neuralCache = new WeakMap();
    this.isSoftwareRenderer = true;
  }
  setPixelRatio(r) { this.ratio = Math.min(r,1.3); }
  setClearColor() {}
  setSize(w,h) { this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio); }
  dispose() {}
  geometryLOD(g,detail=7) {
    if(this.lods.has(g)) return this.lods.get(g);
    g.computeBoundingBox(); const bounds=g.boundingBox, a=g.attributes.position, normal=g.attributes.normal;
    const groups=new Map(), map=new Uint32Array(a.count), positions=[],normals=[];
    const sx=Math.max(.00001,bounds.max.x-bounds.min.x),sy=Math.max(.00001,bounds.max.y-bounds.min.y),sz=Math.max(.00001,bounds.max.z-bounds.min.z);
    for(let i=0;i<a.count;i++) {
      const key=[Math.round((a.getX(i)-bounds.min.x)/sx*detail),Math.round((a.getY(i)-bounds.min.y)/sy*detail),Math.round((a.getZ(i)-bounds.min.z)/sz*detail)].join(',');
      let v=groups.get(key);
      if(!v){v={i:groups.size,n:0,p:[0,0,0],normal:[0,0,0]};groups.set(key,v);}
      v.n++;v.p[0]+=a.getX(i);v.p[1]+=a.getY(i);v.p[2]+=a.getZ(i);
      v.normal[0]+=normal.getX(i);v.normal[1]+=normal.getY(i);v.normal[2]+=normal.getZ(i);map[i]=v.i;
    }
    for(const v of groups.values()){positions.push(...v.p.map(x=>x/v.n));const l=Math.hypot(...v.normal)||1;normals.push(...v.normal.map(x=>x/l));}
    const original=g.index.array,indices=[];
    for(let i=0;i<original.length;i+=3){const a=map[original[i]],b=map[original[i+1]],c=map[original[i+2]];if(a!==b&&b!==c&&a!==c)indices.push(a,b,c);}
    const result={positions,normals,indices};this.lods.set(g,result);return result;
  }
  render(scene,camera) {
    const now=performance.now();if(now-this.lastRender<65)return;this.lastRender=now;
    const ctx=this.context,w=this.width,h=this.height;
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,w,h);
    scene.updateMatrixWorld();camera.updateMatrixWorld();
    const viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const objects=[];scene.traverseVisible(o=>{if(o.isMesh||o.isLineSegments||o.isPoints)objects.push(o);});
    const faces=[],after=[];
    const worldNormal=new THREE.Vector3(), normalMatrix=new THREE.Matrix3(), light=new THREE.Vector3(-.4,.8,1).normalize();
    function project(x,y,z,m){const d=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/d*w*.5+w*.5,-(m[1]*x+m[5]*y+m[9]*z+m[13])/d*h*.5+h*.5,(m[2]*x+m[6]*y+m[10]*z+m[14])/d];}
    for(const o of objects) {
      const m=new THREE.Matrix4().multiplyMatrices(viewProjection,o.matrixWorld).elements;
      if(!o.isMesh){after.push([o,m]);continue;}
      const g=this.geometryLOD(o.geometry,/eye|thorax|head|abdomen/.test(o.name)?11:7),p=g.positions,n=g.normals,ind=g.indices,screen=[];
      normalMatrix.getNormalMatrix(o.matrixWorld);
      for(let v=0;v<p.length;v+=3)screen.push(project(p[v],p[v+1],p[v+2],m));
      const color=o.material.color.clone();
      for(let k=0;k<ind.length;k+=3){
        const i=ind[k],j=ind[k+1],l=ind[k+2],a=screen[i],b=screen[j],c=screen[l];
        if(a[2]>1||b[2]>1||c[2]>1)continue;
        worldNormal.set(n[i*3]+n[j*3]+n[l*3],n[i*3+1]+n[j*3+1]+n[l*3+1],n[i*3+2]+n[j*3+2]+n[l*3+2]).applyMatrix3(normalMatrix).normalize();
        const lum=.45+Math.max(0,worldNormal.dot(light))*.8;
        const band=o.parent.name.includes('abdomen')&&p[i*3]<o.geometry.boundingBox.min.x+(o.geometry.boundingBox.max.x-o.geometry.boundingBox.min.x)*.22?.4:1;
        const rgb=color.clone().multiplyScalar(lum*band).convertLinearToSRGB();
        faces.push({a,b,c,z:(a[2]+b[2]+c[2])/3,color:`rgb(${Math.min(255,Math.round(rgb.r*255))} ${Math.min(255,Math.round(rgb.g*255))} ${Math.min(255,Math.round(rgb.b*255))})`,alpha:o.material.opacity??1});
      }
    }
    faces.sort((a,b)=>b.z-a.z);
    for(const f of faces){ctx.globalAlpha=f.alpha;ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.a[0],f.a[1]);ctx.lineTo(f.b[0],f.b[1]);ctx.lineTo(f.c[0],f.c[1]);ctx.closePath();ctx.fill();}
    ctx.globalAlpha=1;
    for(const [o,m] of after) {
      const g=o.geometry,p=g.attributes.position,c=g.attributes.color,s=g.attributes.strength;
      const brain=o.material.isShaderMaterial;
      const t=o.material.uniforms?.uTime?.value||0;
      if(o.isPoints && !brain){
        ctx.fillStyle='#e3fc02';ctx.globalAlpha=o.material.opacity;
        for(let i=0;i<p.count;i+=2){const v=project(p.getX(i),p.getY(i),p.getZ(i),m);if(v[2]<-1||v[2]>1)continue;ctx.fillRect(v[0],v[1],1.6,1.6);}
        continue;
      }
      if(brain){
        // Cache the actual skeleton projection. Joint animation can then keep
        // moving without reconstructing hundreds of thousands of line paths.
        const key=[w,h,...m.map(v=>v.toFixed(4))].join('|');
        let cache=this.neuralCache.get(o);
        if(!cache||cache.key!==key){
          if(o.isPoints){
            const projected=new Float32Array(p.count*3);
            for(let i=0;i<p.count;i++)projected.set(project(p.getX(i),p.getY(i),p.getZ(i),m),i*3);
            const canvas=document.createElement('canvas');canvas.width=this.domElement.width;canvas.height=this.domElement.height;
            const layer=canvas.getContext('2d');layer.scale(this.ratio,this.ratio);layer.globalAlpha=.32;
            const paths=new Map();
            for(let i=0;i<p.count;i++){
              if(projected[i*3+2]>1)continue;
              const color=`rgb(${Math.round(Math.pow(c.getX(i),1/2.2)*255)} ${Math.round(Math.pow(c.getY(i),1/2.2)*255)} ${Math.round(Math.pow(c.getZ(i),1/2.2)*255)})`;
              let path=paths.get(color);if(!path){path=new Path2D();paths.set(color,path);}
              path.rect(projected[i*3],projected[i*3+1],.8,.8);
            }
            for(const [color,path] of paths){layer.fillStyle=color;layer.fill(path);}
            cache={key,projected,particles:canvas};
          }else{
            const canvas=document.createElement('canvas');canvas.width=this.domElement.width;canvas.height=this.domElement.height;
            const layer=canvas.getContext('2d');layer.scale(this.ratio,this.ratio);layer.lineWidth=.55;layer.globalAlpha=.19;
            const paths=new Map();
            for(let i=0;i<p.count-1;i+=2){
              const a=project(p.getX(i),p.getY(i),p.getZ(i),m),b=project(p.getX(i+1),p.getY(i+1),p.getZ(i+1),m);
              if(a[2]>1||b[2]>1)continue;
              const color=`rgb(${Math.round(Math.pow(c.getX(i),1/2.2)*255)} ${Math.round(Math.pow(c.getY(i),1/2.2)*255)} ${Math.round(Math.pow(c.getZ(i),1/2.2)*255)})`;
              let path=paths.get(color);if(!path){path=new Path2D();paths.set(color,path);}path.moveTo(a[0],a[1]);path.lineTo(b[0],b[1]);
            }
            for(const [color,path] of paths){layer.strokeStyle=color;layer.stroke(path);}
            cache={key,canvas};
          }
          this.neuralCache.set(o,cache);
        }
        if(cache.canvas){ctx.globalAlpha=1;ctx.drawImage(cache.canvas,0,0,w,h);}
        else{
          ctx.globalAlpha=1;ctx.drawImage(cache.particles,0,0,w,h);
          ctx.fillStyle='#e3ff71';
          for(let i=0;i<p.count;i++){
            const strength=s.getX(i);if(!strength)continue;
            const level=strength;
            const x=cache.projected[i*3],y=cache.projected[i*3+1];if(cache.projected[i*3+2]>1)continue;
            ctx.globalAlpha=.07*level;ctx.beginPath();ctx.arc(x,y,1.5+level*2.5,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=.35+level*.4;ctx.beginPath();ctx.arc(x,y,.55+level*.75,0,Math.PI*2);ctx.fill();
          }
        }
        continue;
      }
      const paths=new Map();
      for(let i=0;i<p.count-1;i+=2){
        const a=project(p.getX(i),p.getY(i),p.getZ(i),m),b=project(p.getX(i+1),p.getY(i+1),p.getZ(i+1),m);
        if(a[2]>1||b[2]>1)continue;
        const strength=s?s.getX(i):0,phase=g.attributes.phase?.getX(i)||0;
        const pulse=Math.pow(Math.max(0,Math.sin(t*8+phase)),4)*strength;
        let color='#806b46',alpha=.6;
        if(brain){const hot=pulse>.12;color=hot?'#e3ff71':`rgb(${Math.round(Math.pow(c.getX(i),1/2.2)*255)} ${Math.round(Math.pow(c.getY(i),1/2.2)*255)} ${Math.round(Math.pow(c.getZ(i),1/2.2)*255)})`;alpha=hot?.9:.65;}
        const key=color+'|'+alpha;let path=paths.get(key);if(!path){path={p:new Path2D(),color,alpha};paths.set(key,path);}
        path.p.moveTo(a[0],a[1]);path.p.lineTo(b[0],b[1]);
        if(brain&&pulse>.12){ctx.globalAlpha=Math.min(1,pulse*2);ctx.fillStyle='#efffad';ctx.beginPath();ctx.arc(a[0],a[1],1.3+pulse*2,0,Math.PI*2);ctx.fill();}
      }
      for(const path of paths.values()){ctx.globalAlpha=path.alpha;ctx.strokeStyle=path.color;ctx.lineWidth=brain?.8:.6;ctx.stroke(path.p);}
    }
    ctx.globalAlpha=1;
  }
}
