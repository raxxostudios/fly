"""Prepare the full retained MaleCNS graph; never crop neural circuits.

Retention, transmitter proxy and inferred retina follow Doomfly revision
71ecf53d78eaffaf1a57ed7b0ccf5d458abc9f33 (MIT). See THIRD_PARTY.md.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.venv/packages'))
import json
import numpy as np
import pyarrow as pa
import pyarrow.feather as feather
import pyarrow.ipc as ipc

def prepare():
    raw=ROOT/'data/raw'; cache=ROOT/'data/cache'; cache.mkdir(exist_ok=True)
    a=feather.read_table(raw/'annotations.feather').to_pandas()
    nt=feather.read_table(raw/'neurotransmitters.feather').to_pandas().set_index('body')
    keep=a.superclass.notna() & a.superclass.astype(str).ne('') & ~a.status.eq('Glia')
    a=a.loc[keep].sort_values('bodyId').reset_index(drop=True)
    ids=a.bodyId.to_numpy(np.int64); n=len(a)
    assert np.all(ids[1:]>ids[:-1])
    nts=a.bodyId.map(nt.consensus_nt)
    signs=[]; unknown=0
    for value in nts:
        tokens=set(str(value).lower().split(','))
        sign=({1} if 'acetylcholine' in tokens else set()) | ({-1} if tokens & {'gaba','glutamate','histamine'} else set())
        unknown+=len(sign)!=1
        signs.append(next(iter(sign)) if len(sign)==1 else 1)
    signs=np.array(signs,np.float32)
    pre_chunks=[]; post_chunks=[]; count_chunks=[]; rows=0
    reader=ipc.open_file(pa.memory_map(str(raw/'edges.feather'),'r'))
    for bi in range(reader.num_record_batches):
        b=reader.get_batch(bi)
        pre,post,w=[b.column(b.schema.get_field_index(k)).to_numpy(zero_copy_only=False) for k in ['body_pre','body_post','weight']]
        rows+=len(pre)
        i=np.searchsorted(ids,pre); j=np.searchsorted(ids,post)
        mask=(i<n)&(j<n)
        mask &= ids[np.minimum(i,n-1)]==pre
        mask &= ids[np.minimum(j,n-1)]==post
        pre_chunks.append(i[mask].astype(np.int32));post_chunks.append(j[mask].astype(np.int32));count_chunks.append(w[mask].astype(np.int32))
    pre=np.concatenate(pre_chunks);post=np.concatenate(post_chunks);counts=np.concatenate(count_chunks)
    del pre_chunks,post_chunks,count_chunks
    print(f'Retained {n} neurons and {len(pre)} edges of {rows} source rows',flush=True)
    order=np.argsort(pre,kind='stable')
    ptr=np.r_[0,np.cumsum(np.bincount(pre,minlength=n))].astype(np.int64)
    posts=post[order].astype(np.int32)
    weights=(counts[order].astype(np.float32)*signs[pre[order]]*.275).astype(np.float32)
    receptors=a.type.eq('R1-R6').to_numpy()
    anchors=a.type.isin(['L1','L2','L3']).to_numpy()&a.assignedOlHex1.notna().to_numpy()
    mask=receptors[pre]&anchors[post]
    cols={}
    for i,j,w in zip(pre[mask],post[mask],counts[mask]):
        key=(float(a.assignedOlHex1.iloc[j]),float(a.assignedOlHex2.iloc[j]))
        d=cols.setdefault(int(i),{});d[key]=d.get(key,0)+int(w)
    retina=[];xy=[]
    for i,d in sorted(cols.items()):
        h=max(d,key=d.get);retina.append(i);xy.append((h[0]-.5*h[1],np.sqrt(3)/2*h[1]))
    retina=np.array(retina,np.int32);xy=np.array(xy);uv=np.zeros_like(xy)
    sides=a.rootSide.to_numpy()[retina]
    for side in ['L','R']:
        mask=sides==side;z=xy[mask];z=(z-z.min(0))/(z.max(0)-z.min(0))
        uv[mask,0]=.60*z[:,0] if side=='L' else .40+.60*(1-z[:,0]);uv[mask,1]=1-z[:,1]
    types=a.type.fillna('').astype(str).to_numpy()
    groups={}
    for typ in ['MBON11','MBON12','MBON13','MBON14','MBON01','MBON02','MBON03','MBON04','DNp20','DNpe017','PPL101','PAM11']:
        groups[typ]=np.flatnonzero(types==typ).tolist()
    kc=a['class'].eq('KC').fillna(False).to_numpy() | np.char.startswith(types.astype(str),'KC')
    mbon=a['class'].eq('MBON').fillna(False).to_numpy() | np.char.startswith(types.astype(str),'MBON')
    ordered_pre=pre[order]
    plastic_mask=kc[ordered_pre]&mbon[posts]
    plastic_edges=np.flatnonzero(plastic_mask).astype(np.int32)
    plastic_pre=ordered_pre[plastic_edges].astype(np.int32)
    np.savez(cache/'graph.npz',ptr=ptr,post=posts,weight=weights,ids=ids,retina=retina,uv=uv.astype(np.float32),
             lamina=np.flatnonzero(a.type.isin(['L1','L2','L3','L5']).to_numpy()).astype(np.int32),
             kc=np.flatnonzero(kc).astype(np.int32),mbon=np.flatnonzero(mbon).astype(np.int32),
             plastic_edges=plastic_edges,plastic_pre=plastic_pre)
    feather.write_feather(a,cache/'nodes.feather')
    report={'dataset':'MaleCNS v1.0','neurons':n,'edges':len(pre),'synaptic_contacts':int(counts.sum(dtype=np.int64)),
            'source_edge_rows':rows,'excluded_edge_rows':rows-len(pre),'self_edges':int((pre==post).sum()),
            'retina_mapped':len(retina),'retina_total':int(receptors.sum()),'unknown_transmitter_sign_neurons':unknown,
            'plastic_candidate_edges':len(plastic_edges),'groups':groups,
            'retention':'Assigned neuronal superclass; exclude explicit Glia; all edges between retained entries, including self and weight-one edges.',
            'dynamics':'Leaky integrate-and-fire proxy; not biological validation.',
            'source':'https://male-cns.janelia.org/download/','license':'CC-BY-4.0',
            'reference_revision':'71ecf53d78eaffaf1a57ed7b0ccf5d458abc9f33'}
    (cache/'manifest.json').write_text(json.dumps(report,indent=2))
    (ROOT/'dist/data').mkdir(parents=True,exist_ok=True)
    (ROOT/'dist/data/model.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)

if __name__=='__main__':prepare()
