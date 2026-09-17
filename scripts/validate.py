"""Static asset and recorded-evidence checks; no browser or synthetic QA score."""
from pathlib import Path
import json,re,hashlib,subprocess
import numpy as np
ROOT=Path(__file__).resolve().parents[1];public=ROOT/'dist'
def read(name):return json.loads((public/'data'/name).read_text())
run=read('run.json');learning=read('learning.json');model=read('model.json')
assert len(run['records'])==33
assert sum(q['region']=='Berlin' for q in run['records'])==3
assert run['weights_before_sha256']==run['weights_after_sha256']
assert run['kernel_sha256']==hashlib.sha256((ROOT/'neural/kernel.cpp').read_bytes()).hexdigest()
assert run['score']==sum(q['correct'] for q in run['records'])
assert run['abstentions']==sum(q['selected'] is None for q in run['records'])
assert run['passed']==(run['score']>=17 and run['duration_wall_seconds']<=3600)
for q in run['records']:
    assert len(q['options'])==4 and len(q['readout_rates_hz'])==4
    assert q['correct']==(q['selected']==q['correct_option'])
    rates=np.array(q['readout_rates_hz']);win=np.flatnonzero(rates==max(rates))
    expected=int(win[0]) if len(win)==1 and max(rates)>0 else None
    assert q['selected']==expected
    assert len(q['frames'])==50 and q['frames'][-1]['ms']==1000
    assert q['total_spikes']==sum(f['spikes'] for f in q['frames'])
    assert (public/'data/retina'/f'{q["number"]:02d}.png').is_file()
after=[r for r in learning['records'] if r['phase']=='after']
assert len(after)==16
for row in learning['records']:
    assert len(row['frames'])==20 and row['frames'][-1]['ms']==400
    assert sum(f['spikes'] for f in row['frames'])==row['total_spikes']
    for field in ['retina_spikes','lamina_spikes','kc_spikes']:
        assert sum(f[field] for f in row['frames'])==row[field]
    assert all(f['answer_spikes']==0 for f in row['frames'])
assert (public/'analysis/FLY-001-analysis.png').is_file()
assert (public/'analysis/X-post.md').is_file()
assert learning['passed']==(sum(r['correct'] for r in after)>=learning['pass_threshold'])
brain=read('brain.json');raw=np.fromfile(public/'data/brain.bin',dtype='<i2')
assert raw.size==brain['segments']*6
assert sum(n['segments'] for n in brain['neurons'])==brain['segments']
offset=0
for n in brain['neurons']:
    assert n['offset']==offset;offset+=n['segments']
    assert 0<=n['index']<model['neurons']
assert len({n['id'] for n in brain['neurons']})==len(brain['neurons'])
fly=read('fly.json');binary=(public/'data/fly.bin').read_bytes();seen=set()
for part in fly['parts']:
    assert part['parent'] is None or part['parent'] in seen
    assert abs(np.linalg.norm(part['quaternion'])-1)<1e-5
    seen.add(part['name'])
for g in fly['geometry'].values():
    points=np.frombuffer(binary,dtype='<f4',count=g['vertices']*3,offset=g['positionOffset'])
    indices=np.frombuffer(binary,dtype='<u4',count=g['indices'],offset=g['indexOffset'])
    assert np.isfinite(points).all() and indices.max()<g['vertices']
for filename in ['app.js','scene.js','scene-lab.js','software-renderer.js','anatomy-pose.js','research.js','story.js','film.js','timeline.js','choreography.js','fly-rig.js','stage.js','lab.js']:
    subprocess.run(['node','--check',str(public/filename)],check=True)
    s=(public/filename).read_text()
    for source in re.findall(r"from ['\"](\.[^'\"]+)['\"]",s):assert (public/source).is_file()
for filename in ['index.html','story.css','film.html','film.css','fonts.css','fonts/OFL.txt','style.css','METHOD.md','vendor/three.module.js','vendor/three.core.js','vendor/addons/controls/OrbitControls.js','vendor/addons/postprocessing/EffectComposer.js','vendor/addons/postprocessing/UnrealBloomPass.js','vendor/addons/postprocessing/OutputPass.js','downloads/FLY-study-source.zip']:
    assert (public/filename).is_file()
assert all(p.stat().st_size<25*1024*1024 for p in public.rglob('*') if p.is_file())
print(json.dumps({'evidence':'consistent','questions':len(run['records']),'score':run['score'],'abstentions':run['abstentions'],'gate_correct':sum(r['correct'] for r in after),'wall_seconds':run['duration_wall_seconds'],'display_neurons':len(brain['neurons']),'body_parts':len(fly['parts']),'largest_asset_bytes':max(p.stat().st_size for p in public.rglob('*') if p.is_file())},indent=2))

alignment=read('alignment.json')
assert alignment['brain_sha256']==hashlib.sha256((public/'data/brain.bin').read_bytes()).hexdigest()
assert alignment['fly_sha256']==hashlib.sha256((public/'data/fly.json').read_bytes()).hexdigest()
r=np.array(alignment['display_to_head_matrix']);assert np.allclose(r@r.T,np.eye(3)) and np.linalg.det(r)>.999
estimates=read('research-estimates.json')
for name,digest in estimates['source_hashes'].items():assert hashlib.sha256((public/'data'/name).read_bytes()).hexdigest()==digest
for file in ['index.html','research.html','lab.html','attempt.html','film.html']:
    for link in re.findall(r'(?:href|src)="([^"#]+)(?:#[^"]*)?"',(public/file).read_text()):
        if not re.match(r'https?:|data:|mailto:',link):assert (public/link).exists(), link
assert abs(estimates['scenarios'][1]['quiet_forward_hours']-14.900353535353535)<1e-8
print('Alignment, research estimates and local links: consistent')

# Shipped copy never uses em dashes; media promised by the page must exist.
dash = [str(p.relative_to(public)) for p in public.rglob('*') if p.is_file() and p.suffix in {'.html','.js','.css','.md','.json','.srt','.vtt','.txt'} and 'vendor' not in p.parts and '\u2014' in p.read_text(errors='ignore')]
assert not dash, f'em dash in {dash}'
for media in ['media/FLY-main-68s.mp4','media/FLY-main-68s.vtt','media/FLY-poster.jpg','media/FLY-og.jpg','media/FLY-soundtrack.m4a']:
    assert (public/media).is_file(), media
values = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import('./dist/timeline.js').then(async m=>{const fs=await import('node:fs');const r=f=>JSON.parse(fs.readFileSync('dist/data/'+f));console.log(JSON.stringify(m.evidenceValues(r('run.json'),r('study-002/summary.json'),r('learning.json'))))})"],cwd=ROOT))
study=read('study-002/summary.json')
assert values=={'trained':study['experiments'][0]['scores']['trained'],'replication':study['experiments'][1]['scores']['trained'],'untrained':study['experiments'][0]['scores']['untrained'],'changed':study['experiments'][0]['changed_connections'],'gate':sum(r['correct'] for r in after),'score':run['score'],'abstentions':run['abstentions']}, values
print('Caption values, media and copy: consistent', json.dumps(values))
