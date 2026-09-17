"""FLY-002: prospective signal calibration and learning on retained edges.

FLY-001 files and the original Brain implementation are left intact.
"""
import sys, json, time, math, hashlib, datetime
from pathlib import Path
import numpy as np
from model import Brain, ROOT
sys.path.insert(0, str(ROOT/'.venv/packages'))

OUT = ROOT/'data/cache/revision'
OUT.mkdir(exist_ok=True)

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def save(path, obj): Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2))

class RevisionBrain(Brain):
    def __init__(self, config):
        super().__init__()
        self.config = dict(config)
        self.base_weight = self.weight.copy()
        self.tonic_kc = self.kc
        if config.get('visual_interface'):
            import pyarrow.feather as feather
            nodes=feather.read_table(ROOT/'data/cache/nodes.feather').to_pandas()
            self.optic_indices=np.flatnonzero(nodes.superclass.eq('ol_intrinsic'))
            self.projection_indices=np.flatnonzero(nodes.superclass.eq('visual_projection'))
            self.readouts=[np.flatnonzero(nodes.type.eq(t)).tolist() for t in ['MBON09','MBON27','MBON05','MBON01']]
            self.tonic_kc=np.flatnonzero(nodes.type.eq('KCg-d'))
            if config.get('coverage')=='marginal_rank':
                for side in ['L','R']:
                    ix=np.flatnonzero(nodes.iloc[self.retina].rootSide.eq(side))
                    for axis in [0,1]:
                        values=self.uv[ix,axis]
                        _,inverse,counts=np.unique(values,return_inverse=True,return_counts=True)
                        ranks=(np.cumsum(counts)-counts/2)/len(ix)
                        mapped=ranks[inverse]
                        if axis==0:mapped=.6*mapped+(0 if side=='L' else .4)
                        self.uv[ix,axis]=mapped
        self.output_indices = np.unique(sum(self.readouts, []))
        pres=np.repeat(np.arange(self.n,dtype=np.int32),np.diff(self.ptr))
        is_pre_kc=np.isin(pres,self.kc)
        mask = np.isin(self.post, self.kc)
        if config.get('external_kc_gain_only'):mask &= ~is_pre_kc
        self.weight[mask] *= float(config.get('kc_input_gain', 1))
        recurrent=is_pre_kc & np.isin(self.post,self.kc)
        self.weight[recurrent] *= config.get('kc_recurrent_gain',1.)
        output_edges=is_pre_kc & np.isin(self.post,self.output_indices)
        self.weight[output_edges] *= config.get('output_input_gain',1.)
        self.initial_weight = self.weight.copy()
        candidates = self.plastic_edges
        m = np.isin(self.post[candidates], self.output_indices)
        self.learn_edges = candidates[m]
        self.learn_pre = self.plastic_pre[m]
        self.learn_post = self.post[self.learn_edges]
        self.learn_class = np.array([next(i for i,g in enumerate(self.readouts) if p in g) for p in self.learn_post])
        self.learn_initial = self.weight[self.learn_edges].copy()
        self.silence_kc = False

    def step(self, luminance, duration_ms=20):
        x = np.asarray(luminance, np.float32)
        if x.shape != self.luminance.shape or not np.isfinite(x).all():
            raise ValueError('Retinal samples must be finite and match mapped receptors')
        steps = int(round(duration_ms/self.dt))
        if steps < 1: raise ValueError('Positive duration required')
        self.luminance += (1-math.exp(-steps*self.dt/10))*(np.clip(x,0,1)-self.luminance)
        self.drive.fill(0)
        if self.config.get('visual_interface'):
            self.drive[self.optic_indices]=self.config.get('optic_tonic',0.)
            self.drive[self.projection_indices]=self.config.get('projection_tonic',0.)
        self.drive[self.lamina] = self.config.get('lamina_tonic',12.)
        if self.config.get('sensor','linear') == 'legacy':
            self.drive[self.retina] = 30*self.luminance/(.02+self.luminance)
        else:
            self.drive[self.retina] = 30*self.luminance
        self.drive[self.tonic_kc] = self.config.get('kc_tonic',0.)
        self.drive[self.output_indices] = self.config.get('output_tonic',0.)
        if self.silence_kc:
            self.drive[self.kc] = -1000.
        self.counts.fill(0)
        arrays=[self.ptr,self.post,self.weight,self.v,self.g,self.refractory,self.drive,self.previous_drive,self.queue,self.queue_count,self.clock]
        start=time.perf_counter()
        self.call(self.n,*[a.ctypes.data for a in arrays],steps,self.dt,*[a.ctypes.data for a in (self.counts,self.active,self.flags,self.nactive,self.last)])
        return self.counts.copy(),time.perf_counter()-start

def patch(brain, category, rng, jitter=True):
    x,y=brain.uv.T
    cx=.25+.5*(category%2); cy=.25+.5*(category//2)
    if jitter: cx+=rng.uniform(-.035,.035);cy+=rng.uniform(-.035,.035)
    w=rng.uniform(.16,.22) if jitter else .19
    h=rng.uniform(.16,.22) if jitter else .19
    level=rng.uniform(.7,1) if jitter else .85
    p={'cx':cx,'cy':cy,'half_width':w,'half_height':h,'luminance':level}
    return ((abs(x-cx)<w)&(abs(y-cy)<h)).astype(np.float32)*level,p

def trial(brain, pixels, duration=400, record=False):
    brain.reset()
    total=np.zeros(brain.n,np.int32);frames=[];wall=0
    vmax=np.full(brain.n,-np.inf,np.float32);gmax=np.zeros(brain.n,np.float32)
    visible=np.array([x['index'] for x in json.loads((ROOT/'dist/data/brain.json').read_text())['neurons']],np.int32) if record else []
    for frame in range(duration//20):
        c,t=brain.step(pixels,20); total+=c;wall+=t
        vmax=np.maximum(vmax,brain.v);gmax=np.maximum(gmax,brain.g)
        if record:
            frames.append({'ms':(frame+1)*20,'spikes':int(c.sum()),'activity':{str(int(i)):int(c[i]) for i in visible if c[i]},'retina_spikes':int(c[brain.retina].sum()),'lamina_spikes':int(c[brain.lamina].sum()),'kc_spikes':int(c[brain.kc].sum()),'answer_spikes':int(c[brain.output_indices].sum())})
    answer,rates=brain.answer(total,duration)
    row={'selected':answer,'rates_hz':rates,'total_spikes':int(total.sum()),'active_neurons':int(np.count_nonzero(total)),'kc_spikes':int(total[brain.kc].sum()),'kc_active':int(np.count_nonzero(total[brain.kc])),'answer_spikes':int(total[brain.output_indices].sum()),'wall_seconds':round(wall,5),'simulated_ms':duration}
    if record:row['frames']=frames
    return row,total,vmax,gmax

def audit():
    import pyarrow.feather as feather
    nodes=feather.read_table(ROOT/'data/cache/nodes.feather').to_pandas()
    configs=[
        {'id':'legacy','sensor':'legacy'},
        {'id':'linear','sensor':'linear'},
        {'id':'tonic6','sensor':'linear','kc_tonic':6.,'output_tonic':6.},
        {'id':'tonic6_gain4','sensor':'linear','kc_tonic':6.,'output_tonic':6.,'kc_input_gain':4.},
    ]
    report={'id':'FLY-002-sensory-audit','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_sha256':sha(__file__),'protocol_sha256':sha(ROOT/'neural/PROTOCOL-002.md'),'configs':configs,'records':[]}
    rng=np.random.default_rng(914200)
    for cfg in configs:
        b=RevisionBrain(cfg)
        grouped={'retina':b.retina,'lamina':b.lamina,'visual_projection':np.flatnonzero(nodes.superclass.eq('visual_projection')),'kc':b.kc,'output':b.output_indices}
        for label in ['blank',0,1,2,3]:
            v=np.zeros(len(b.retina),np.float32) if label=='blank' else patch(b,label,rng,jitter=False)[0]
            row,total,vmax,gmax=trial(b,v)
            row.update({'config':cfg['id'],'stimulus':label,'groups':{name:{'count':len(ix),'spikes':int(total[ix].sum()),'active':int(np.count_nonzero(total[ix])),'max_observed_voltage':float(vmax[ix].max()),'max_observed_conductance':float(gmax[ix].max())} for name,ix in grouped.items()}})
            report['records'].append(row)
            np.savez_compressed(OUT/f'audit-{cfg["id"]}-{label}.npz',counts=total,vmax=vmax,gmax=gmax)
            save(OUT/'audit.json',report)
            print(json.dumps({k:row[k] for k in ['config','stimulus','kc_spikes','kc_active','answer_spikes','selected','rates_hz','wall_seconds']}),flush=True)
        del b

def interface_audit(kind='interface'):
    shared={'sensor':'linear','visual_interface':True,'coverage':'marginal_rank','kc_recurrent_gain':.1,'output_input_gain':.1,'external_kc_gain_only':True,'output_tonic':6.5}
    configs=[dict(shared,id=f'visual_kc{tonic}_gain{gain}',kc_tonic=tonic,kc_input_gain=gain) for tonic,gain in [(6.,1.),(6.,4.),(6.8,1.),(6.8,4.)]]
    if kind=='relay':
        configs=[dict(shared,id=f'relay_optic{optic}_gain{gain}',kc_tonic=6.8,kc_input_gain=gain,projection_tonic=6.,optic_tonic=optic) for optic,gain in [(0.,1.),(0.,4.),(3.,1.),(3.,4.),(5.,1.),(5.,4.)]]
    filename=OUT/f'{kind}-audit.json'
    report={'id':f'FLY-002-{kind}-audit','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_sha256':sha(__file__),'protocol_sha256':sha(ROOT/'neural/PROTOCOL-002.md'),'configs':configs,'records':[],'selected_config':None}
    rng=np.random.default_rng(914201)
    for cfg in configs:
        b=RevisionBrain(cfg);vectors=[];rows=[]
        for label in ['blank',0,1,2,3]:
            v=np.zeros(len(b.retina),np.float32) if label=='blank' else patch(b,label,rng,jitter=False)[0]
            row,total,vmax,gmax=trial(b,v)
            row.update(config=cfg['id'],stimulus=label,retinal_active=int(np.count_nonzero(v)))
            vectors.append(total[b.kc]);rows.append(row);report['records'].append(row)
            np.savez_compressed(OUT/f'{kind}-{cfg["id"]}-{label}.npz',counts=total,vmax=vmax,gmax=gmax)
            save(filename,report)
            print(json.dumps({k:row[k] for k in ['config','stimulus','retinal_active','kc_spikes','kc_active','answer_spikes','selected','rates_hz','wall_seconds']}),flush=True)
        pairwise=[int(np.abs(vectors[i].astype(float)-vectors[j]).sum()) for i in range(1,5) for j in range(i+1,5)]
        qualifies=rows[0]['kc_active']<=int(.01*len(b.kc)) and all(0<r['kc_active']<=int(.25*len(b.kc)) for r in rows[1:]) and min(pairwise)>=5 and max(max(r['rates_hz']) for r in rows)<=100
        if qualifies and report['selected_config'] is None:report['selected_config']=cfg
        report.setdefault('selection_checks',[]).append({'config':cfg['id'],'minimum_pairwise_KC_L1':min(pairwise),'qualifies':qualifies})
        save(filename,report)
        del b
    print('SELECTED',report['selected_config'],flush=True)

if __name__=='__main__':
    {'audit':audit,'interface-audit':interface_audit,'relay-audit':lambda:interface_audit('relay')}[sys.argv[1]]()
