"""Export research meshes and a deterministic subset of original MaleCNS SWCs."""
from pathlib import Path
import sys,json,concurrent.futures,urllib.request,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.venv/packages'))
import numpy as np,pandas as pd,yaml,trimesh
from scipy.spatial.transform import Rotation

def export_body():
    base=ROOT.parent/'research/flygym/src/flygym/assets/model/neuromechfly'
    rig=yaml.safe_load((base/'rigging.yaml').read_text())
    angles=yaml.safe_load((base/'pose/neutral/yaw_pitch_roll.yaml').read_text())['joint_angles']
    parents={'c_thorax':None,'c_head':'c_thorax','c_rostrum':'c_head','c_haustellum':'c_rostrum'}
    prev='c_thorax'
    for a in ['12','3','4','5','6']:parents['c_abdomen'+a]=prev;prev='c_abdomen'+a
    for s in ['l','r']:
        parents[s+'_eye']='c_head';parents[s+'_wing']='c_thorax';parents[s+'_haltere']='c_thorax'
        prev='c_head'
        for a in ['pedicel','funiculus','arista']:parents[s+'_'+a]=prev;prev=s+'_'+a
        for leg in ['f','m','h']:
            prev='c_thorax'
            for a in ['coxa','trochanterfemur','tibia','tarsus1','tarsus2','tarsus3','tarsus4','tarsus5']:
                name=s+leg+'_'+a;parents[name]=prev;prev=name
    out=[];blob=bytearray();geometry={}
    for name,parent in parents.items():
        source='l'+name[1:] if name.startswith('r') else name
        mirror=name.startswith('r')
        if source not in geometry:
            mesh=trimesh.load(str(base/'meshes/simplified_max2000faces'/f'{source}.stl'),process=True)
            positions=np.asarray(mesh.vertices*1000,dtype='<f4')
            normals=np.asarray(mesh.vertex_normals,dtype='<f4')
            faces=np.asarray(mesh.faces,dtype='<u4').ravel()
            g={'positionOffset':len(blob),'vertices':len(positions)};blob.extend(positions.tobytes())
            g['normalOffset']=len(blob);blob.extend(normals.tobytes())
            g['indexOffset']=len(blob);g['indices']=len(faces);blob.extend(faces.tobytes());geometry[source]=g
        r=rig[name];q=Rotation.from_quat(np.roll(np.array(r['quat']),-1))
        leftparent=('l'+parent[1:]) if parent and parent.startswith('r') else parent
        # FlyGym's anatomical convention is yaw=X, pitch=Y, roll=Z.
        # It intentionally differs from the usual world-frame Euler naming.
        for axis,vec in [('yaw',[1,0,0]),('pitch',[0,1,0]),('roll',[0,0,1])]:
            a=angles.get(f'{leftparent}-{source}-{axis}',0)
            if mirror and axis in ('roll','yaw'):a=-a
            q=q*Rotation.from_rotvec(np.array(vec)*np.deg2rad(a))
        out.append({'name':name,'parent':parent,'source':source,'mirror':mirror,'pos':r['pos'],'quaternion':q.as_quat().tolist()})
    (ROOT/'dist/data/fly.bin').write_bytes(blob)
    (ROOT/'dist/data/fly.json').write_text(json.dumps({'parts':out,'geometry':geometry,'source':'NeuroMechFly / FlyGym','license':'Apache-2.0','units':'millimetres','source_commit':'38c8ec61034cd59bc5ba0de20688d4a3c0000d60'}))
    print('body',len(out),'parts',len(blob),'bytes',flush=True)

def export_neurons():
    n=pd.read_feather(ROOT/'data/cache/nodes.feather');rng=np.random.default_rng(260903)
    selected=set()
    quota={'ol_intrinsic':320,'visual_projection':90,'cb_intrinsic':120,'ol_sensory':50,'visual_centrifugal':30}
    for category,num in quota.items():
        ids=n.index[n.superclass==category].to_numpy();selected.update(rng.choice(ids,min(num,len(ids)),replace=False).tolist())
    selected.update(n.index[n.type.isin(['MBON11','MBON12','MBON13','MBON14','MBON01','MBON02','MBON03','MBON04'])].tolist())
    cache=ROOT/'data/skeletons';cache.mkdir(exist_ok=True)
    def fetch(i):
        body=int(n.bodyId.iloc[i]);p=cache/f'{body}.swc'
        if not p.exists():
            try:p.write_bytes(urllib.request.urlopen(f'https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{body}.swc',timeout=40).read())
            except Exception as e:return (i,None,str(e))
        try:
            a=np.loadtxt(p,comments='#');lookup={int(v):k for k,v in enumerate(a[:,0])}
            valid=np.array([k for k,parent in enumerate(a[:,6]) if int(parent) in lookup])
            parent=np.array([lookup[int(a[k,6])] for k in valid])
            # A deterministic line decimation only affects visualization, never dynamics.
            if len(valid)>3500:
                keep=np.linspace(0,len(valid)-1,3500,dtype=int);valid=valid[keep];parent=parent[keep]
            return i,np.stack([a[valid,2:5],a[parent,2:5]],axis=1).astype('<f4'),hashlib.sha256(p.read_bytes()).hexdigest()
        except Exception as e:return (i,None,str(e))
    arrays=[];meta=[];failed=[];offset=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=14) as pool:
        for num,(i,a,digest) in enumerate(pool.map(fetch,sorted(selected))):
            if a is None:failed.append({'id':int(n.bodyId.iloc[i]),'error':digest});continue
            arrays.append(a);meta.append({'id':int(n.bodyId.iloc[i]),'index':i,'type':str(n.type.iloc[i]),'class':str(n.superclass.iloc[i]),'offset':offset,'segments':len(a),'sha256':digest});offset+=len(a)
            if num%100==0:print('neurons',num+1,'/',len(selected),flush=True)
    xyz=np.concatenate(arrays)
    low,high=np.quantile(xyz.reshape(-1,3),[.01,.99],axis=0)
    center=(low+high)/2
    xyz=(xyz-center)/10000
    # Export B=(raw X, -raw Z, raw Y); display registration is derived separately.
    xyz=xyz[:,:,[0,2,1]];xyz[:,:,1]*=-1
    quantized=np.rint(xyz/.001).astype('<i2')
    assert np.max(abs(xyz-quantized.astype(np.float32)*.001))<.001
    (ROOT/'dist/data/brain.bin').write_bytes(quantized.tobytes())
    info={'neurons':meta,'segments':len(xyz),'source':'MaleCNS v1.0 skeletons','license':'CC-BY-4.0','display_only_subsample':True,'source_center':center.tolist(),'source_units_nm':8,'display_units_source_voxels':10000,'encoding':'int16','coordinate_scale':.001,'failed':failed}
    (ROOT/'dist/data/brain.json').write_text(json.dumps(info,separators=(',',':')))
    print('brain',len(meta),'neurons',len(xyz),'segments','failed',len(failed),flush=True)

if __name__=='__main__':
    export_body();export_neurons()
