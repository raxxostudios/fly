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
        self.output_indices = np.unique(sum(self.readouts, []))
        mask = np.isin(self.post, self.kc)
        self.weight[mask] *= float(config.get('kc_input_gain', 1))
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
        self.drive[self.lamina] = self.config.get('lamina_tonic',12.)
        if self.config.get('sensor','linear') == 'legacy':
            self.drive[self.retina] = 30*self.luminance/(.02+self.luminance)
        else:
            self.drive[self.retina] = 30*self.luminance
        self.drive[self.kc] = self.config.get('kc_tonic',0.)
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

if __name__=='__main__':
    {'audit':audit}[sys.argv[1]]()
