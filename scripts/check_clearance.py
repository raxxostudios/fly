"""Sample wing/torso clearance across the authored stroke, excluding the hinge.
This checks the displayed geometry, not full biomechanical collision dynamics.
"""
import json,subprocess,numpy as np
from pathlib import Path
scene=json.loads(subprocess.check_output(['node',str(Path(__file__).with_name('check_anatomy.mjs'))]))
verts=np.concatenate([np.array(m['positions']).reshape(-1,3) for m in scene['body']])
lo=verts.min(0)[:2]-.03;hi=verts.max(0)[:2]+.03;step=.006
shape=np.ceil((hi-lo)/step).astype(int)+1
surface=np.full(shape,-np.inf)
for mesh in scene['body']:
 p=np.array(mesh['positions']).reshape(-1,3)
 for tri in p[np.array(mesh['indices']).reshape(-1,3)]:
  a,b,c=tri;v0=b[:2]-a[:2];v1=c[:2]-a[:2];det=v0[0]*v1[1]-v0[1]*v1[0]
  if abs(det)<1e-12:continue
  low=np.maximum(0,np.floor((tri.min(0)[:2]-lo)/step).astype(int));high=np.minimum(shape-1,np.ceil((tri.max(0)[:2]-lo)/step).astype(int))
  ix,iy=np.meshgrid(np.arange(low[0],high[0]+1),np.arange(low[1],high[1]+1),indexing='ij')
  x=lo[0]+ix*step-a[0];y=lo[1]+iy*step-a[1]
  u=(x*v1[1]-y*v1[0])/det;v=(v0[0]*y-v0[1]*x)/det
  mask=(u>=-1e-5)&(v>=-1e-5)&(u+v<=1+1e-5)
  z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])
  surface[ix[mask],iy[mask]]=np.maximum(surface[ix[mask],iy[mask]],z[mask])
for w in scene['wings']:
 p=np.unique(np.array(w['positions']).reshape(-1,3),axis=0)
 d=np.linalg.norm(p-np.array(w['hinge']),axis=1)
 ij=np.rint((p[:,:2]-lo)/step).astype(int);valid=(ij>=0).all(1)&(ij<shape).all(1)&(d>.35)
 p=p[valid];ij=ij[valid];delta=p[:,2]-surface[ij[:,0],ij[:,1]];finite=np.isfinite(delta)
 print(w['side'],w['fraction'],'over-body samples',finite.sum(),'minimum clearance mm',round(delta[finite].min(),4) if finite.any() else 'none','penetrations',int((delta<-.008).sum()))

 assert not (delta[finite]<0).any(), "Distal wing intersects the dorsal body surface"
