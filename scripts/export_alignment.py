"""Derive display registration landmarks from the already exported anatomy."""
from pathlib import Path
import sys, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.venv/packages'))
import numpy as np
import pandas as pd
from scipy.spatial.transform import Rotation

public=ROOT/'dist/data'
brain=json.loads((public/'brain.json').read_text())
fly=json.loads((public/'fly.json').read_text())
nodes=pd.read_feather(ROOT/'data/cache/nodes.feather')
xyz=np.fromfile(public/'brain.bin',dtype='<i2').reshape(-1,3)*brain['coordinate_scale']
lobes={}; counts={}
for side in ['L','R']:
    centers=[np.median(xyz[n['offset']*2:(n['offset']+n['segments'])*2],axis=0)
             for n in brain['neurons'] if n['class']=='ol_intrinsic'
             and nodes.iloc[n['index']].somaSide==side]
    lobes[side]=np.median(centers,axis=0);counts[side]=len(centers)
left=lobes['L']-lobes['R']; span=np.linalg.norm(left);left/=span
# Exported B=(raw X, -raw Z, raw Y). In this EM volume increasing X
# follows the annotated left side, Z runs toward posterior VNC segments,
# and Y is approximately ventral. Correct the earlier display-axis mixup.
dorsal=np.array([0.,0.,-1.]);dorsal-=left*np.dot(left,dorsal);dorsal/=np.linalg.norm(dorsal)
anterior=np.cross(left,dorsal)
matrix=np.stack([anterior,left,dorsal])
raw=(public/'fly.bin').read_bytes();eyes={}
for part in fly['parts']:
    if part['name'] not in ['l_eye','r_eye']:continue
    g=fly['geometry'][part['source']]
    v=np.frombuffer(raw,dtype='<f4',count=g['vertices']*3,offset=g['positionOffset']).reshape(-1,3)
    center=(v.min(axis=0)+v.max(axis=0))/2
    if part['mirror']:center[1]*=-1
    eyes[part['name']]=Rotation.from_quat(part['quaternion']).apply(center)+part['pos']
eye_midpoint=(eyes['l_eye']+eyes['r_eye'])/2
result={
    'kind':'rigid landmark display alignment; not a biological specimen registration',
    'display_to_head_matrix':matrix.tolist(),
    'brain_pivot':((lobes['L']+lobes['R'])/2).tolist(),
    'optic_centers':{k:v.tolist() for k,v in lobes.items()},
    'optic_neuron_counts':counts,
    'head_anchor':eye_midpoint.tolist(),
    'eye_centers':{k:v.tolist() for k,v in eyes.items()},
    'scale_to_head':float(np.linalg.norm(eyes['l_eye']-eyes['r_eye'])/span),
    'axis_notes':{'source_x':'left, verified against somaSide labels',
                  'source_y':'approximately ventral','source_z':'posterior, toward T1–T3 nerve-cord segments',
                  'head_x':'anterior','head_y':'left','head_z':'dorsal'},
    'brain_sha256':hashlib.sha256((public/'brain.bin').read_bytes()).hexdigest(),
    'fly_sha256':hashlib.sha256((public/'fly.json').read_bytes()).hexdigest()
}
assert np.allclose(matrix@matrix.T,np.eye(3)) and np.linalg.det(matrix)>.999
(public/'alignment.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'optic_neurons':counts,'scale_to_head':result['scale_to_head'],'head_anchor':result['head_anchor']}))
