"""Full retained MaleCNS graph with an explicit, fixed pixel/answer interface.

Kernel is the MIT-licensed Doomfly all-edge LIF implementation; see licenses.
This is a connectome-based dynamics hypothesis, not a validated fly cognition model.
"""
from pathlib import Path
import ctypes as C
import json, math, time, subprocess, hashlib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

class Brain:
    def __init__(self):
        lib = ROOT/'data/cache/libneural.so'
        source = ROOT/'neural/kernel.cpp'
        if not lib.exists() or lib.stat().st_mtime < source.stat().st_mtime:
            subprocess.run(['g++','-O3','-std=c++17','-shared','-fPIC',str(source),'-o',str(lib)],check=True)
        self.lib = C.CDLL(str(lib))
        self.call = self.lib.neural_advance
        self.call.argtypes = [C.c_int]+[C.c_void_p]*11+[C.c_int,C.c_float]+[C.c_void_p]*5
        self.call.restype = None
        arrays = np.load(ROOT/'data/cache/graph.npz')
        for key in arrays.files: setattr(self,key,arrays[key])
        self.n = len(self.ids)
        self.groups = json.loads((ROOT/'data/cache/manifest.json').read_text())['groups']
        self.readouts = [self.groups['MBON'+str(i)] for i in (11,12,13,14)]
        self.dt = .1
        self.reset()

    def reset(self):
        n=self.n
        self.v=np.full(n,-52,dtype=np.float32)
        self.g=np.zeros(n,dtype=np.float32)
        self.refractory=np.zeros(n,dtype=np.int16)
        self.drive=np.zeros(n,dtype=np.float32)
        self.previous_drive=np.zeros(n,dtype=np.float32)
        self.queue=np.zeros((19,n),dtype=np.int32)
        self.queue_count=np.zeros(19,dtype=np.int32)
        self.clock=np.zeros(1,dtype=np.int64)
        self.counts=np.zeros(n,dtype=np.int32)
        self.active=np.zeros(n,dtype=np.int32)
        self.flags=np.zeros(n,dtype=np.uint8)
        initial=np.unique(np.r_[self.retina,self.lamina])
        self.active[:len(initial)]=initial;self.flags[initial]=1
        self.nactive=np.array([len(initial)],dtype=np.int32)
        self.last=np.full(n,-1,dtype=np.int64)
        self.luminance=np.zeros(len(self.retina),dtype=np.float32)

    def step(self,luminance,duration_ms=20):
        luminance=np.asarray(luminance,dtype=np.float32)
        if luminance.shape!=self.luminance.shape or not np.isfinite(luminance).all():
            raise ValueError('Retinal samples must be finite and match mapped receptors')
        steps=int(round(duration_ms/self.dt))
        if steps<1:raise ValueError('Positive duration required')
        self.luminance+=(1-math.exp(-steps*self.dt/10))*(np.clip(luminance,0,1)-self.luminance)
        self.drive.fill(0);self.drive[self.lamina]=12
        self.drive[self.retina]=30*self.luminance/(.02+self.luminance)
        self.counts.fill(0)
        arrays=[self.ptr,self.post,self.weight,self.v,self.g,self.refractory,self.drive,self.previous_drive,self.queue,self.queue_count,self.clock]
        start=time.perf_counter()
        self.call(self.n,*[a.ctypes.data for a in arrays],steps,self.dt,*[a.ctypes.data for a in (self.counts,self.active,self.flags,self.nactive,self.last)])
        return self.counts.copy(),time.perf_counter()-start

    def pixels(self,image):
        a=np.asarray(image,dtype=np.float32)/255.
        if a.ndim!=2:raise ValueError('Monochrome pixels required')
        h,w=a.shape
        x=np.minimum((self.uv[:,0]*(w-1)).astype(int),w-1)
        y=np.minimum((self.uv[:,1]*(h-1)).astype(int),h-1)
        return a[y,x]

    def answer(self,counts,duration_ms):
        rates=np.array([counts[g].mean()*1000/duration_ms for g in self.readouts])
        winners=np.flatnonzero(rates==rates.max())
        selected=int(winners[0]) if len(winners)==1 and rates.max()>0 else None
        return selected,rates.tolist()

    def digest(self):
        return hashlib.sha256(self.weight.tobytes()).hexdigest()

if __name__=='__main__':
    b=Brain()
    for k in range(4):
        b.reset()
        x,y=b.uv.T
        stimulus=((x>.5)==bool(k%2))&((y>.5)==bool(k//2))
        total=np.zeros(b.n,dtype=np.int32);wall=0
        for _ in range(10):
            c,t=b.step(stimulus,20);total+=c;wall+=t
        a,r=b.answer(total,200)
        print(json.dumps({'pattern':k,'spikes':int(total.sum()),'active_neurons':int((total>0).sum()),'kc_spikes':int(total[b.kc].sum()),'mbon_spikes':int(total[b.mbon].sum()),'answer':a,'rates_hz':r,'wall_seconds':round(wall,3)}),flush=True)
