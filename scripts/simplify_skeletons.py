"""Simplify complete SWC branches without dropping disconnected edge samples.

All branch endpoints survive. RDP tolerance is 60 source voxels = 0.48 microns.
This is a display operation; neural dynamics and recorded neuron IDs are unchanged.
"""
from pathlib import Path
import sys,json,concurrent.futures,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
TOLERANCE=60.

def simplify(points):
    keep={0,len(points)-1};stack=[(0,len(points)-1)]
    while stack:
        lo,hi=stack.pop()
        if hi-lo<2:continue
        a=points[lo];v=points[hi]-a;vv=np.dot(v,v);d=points[lo+1:hi]-a
        t=np.clip(d@v/max(vv,1e-20),0,1)
        distance=np.sum((d-t[:,None]*v)**2,axis=1)
        at=int(np.argmax(distance))
        if distance[at]>TOLERANCE**2:
            at+=lo+1;keep.add(at);stack.extend([(lo,at),(at,hi)])
    return points[sorted(keep)]

def process(neuron):
    path=ROOT/'data/skeletons'/f"{neuron['id']}.swc"
    raw=path.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==neuron['sha256']
    rows=np.loadtxt(path,comments='#');lookup={int(n):i for i,n in enumerate(rows[:,0])}
    parents=np.array([lookup.get(int(n),-1) for n in rows[:,6]])
    valid=parents>=0;child_count=np.bincount(parents[valid],minlength=len(rows))
    boundary=(child_count!=1)|(~valid)
    segments=[]
    for end in np.flatnonzero(boundary&valid):
        chain=[end];p=parents[end]
        while p>=0:
            chain.append(p)
            if boundary[p]:break
            p=parents[p]
        points=simplify(rows[chain,2:5])
        segments.append(np.stack([points[:-1],points[1:]],axis=1))
    xyz=np.concatenate(segments).astype(np.float32)
    return neuron,xyz

if __name__=='__main__':
    path=ROOT/'dist/data/brain.json';info=json.loads(path.read_text())
    old=info['segments'];arrays=[];offset=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for k,(neuron,xyz) in enumerate(pool.map(process,info['neurons'])):
            neuron['offset']=offset;neuron['segments']=len(xyz);offset+=len(xyz);arrays.append(xyz)
            if (k+1)%100==0:print('Continuous branches',k+1,flush=True)
    xyz=(np.concatenate(arrays)-np.array(info['source_center']))/10000
    xyz=xyz[:,:,[0,2,1]];xyz[:,:,1]*=-1
    out=np.rint(xyz/info['coordinate_scale']).astype('<i2')
    assert np.max(np.abs(xyz-out.astype(np.float32)*info['coordinate_scale']))<.001
    (ROOT/'dist/data/brain.bin').write_bytes(out.tobytes())
    info['segments']=offset
    info['display_simplification']={'method':'Ramer-Douglas-Peucker on complete branch-to-branch SWC paths','tolerance_source_voxels':TOLERANCE,'tolerance_microns':.48,'preserves_branch_endpoints':True}
    path.write_text(json.dumps(info,separators=(',',':')))
    print(json.dumps({'old_disconnected_segments':old,'continuous_segments':offset,'neurons':len(info['neurons']),'bytes':len(out.tobytes())}),flush=True)
