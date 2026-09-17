"""Reproducible gates and blind baseline. No key is loaded by inference.

Run: python3 neural/experiment.py gate | infer | grade
The grader is a separate process invoked only after inference exits.
"""
import sys,json,time,hashlib,datetime
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from model import Brain,ROOT

def dump(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def stimulus(brain,category,rng):
    x,y=brain.uv.T
    cx=.25+.5*(category%2);cy=.25+.5*(category//2)
    cx+=rng.uniform(-.035,.035);cy+=rng.uniform(-.035,.035)
    width=rng.uniform(.16,.22);height=rng.uniform(.16,.22);level=rng.uniform(.7,1)
    return ((abs(x-cx)<width)&(abs(y-cy)<height)).astype(np.float32)*level,{'cx':cx,'cy':cy,'half_width':width,'half_height':height,'luminance':level}

def gate():
    brain=Brain();rng=np.random.default_rng(90210);before=brain.digest()
    # Plasticity is confined to retained KC -> the four designated MBON groups.
    candidates=brain.plastic_edges
    selected_posts=set(sum(brain.readouts,[]))
    mask=np.array([int(brain.post[e]) in selected_posts for e in candidates])
    edges=candidates[mask];pre=brain.plastic_pre[mask];post=brain.post[edges]
    initial=brain.weight[edges].copy();records=[]
    visual=json.loads((ROOT/'dist/data/brain.json').read_text())
    visible_indices=np.array([n['index'] for n in visual['neurons']],dtype=np.int32)
    for phase,trials in [('before',8),('training',32),('after',16)]:
        categories=np.arange(trials)%4;rng.shuffle(categories)
        for trial,category in enumerate(categories):
            brain.reset();v,patch=stimulus(brain,int(category),rng);counts=np.zeros(brain.n,np.int32);frames=[]
            for frame in range(20):
                c,_=brain.step(v,20);counts+=c
                frames.append({'ms':(frame+1)*20,'spikes':int(c.sum()),'activity':{str(int(j)):int(c[j]) for j in visible_indices if c[j]>0},'retina_spikes':int(c[brain.retina].sum()),'lamina_spikes':int(c[brain.lamina].sum()),'kc_spikes':int(c[brain.kc].sum()),'answer_spikes':int(sum(c[g].sum() for g in brain.readouts))})
            answer,rates=brain.answer(counts,400)
            reward=1. if answer==category else -.25
            if phase=='training':
                # Hypothetical reward-modulated local coincidence rule; no new edges.
                eligibility=np.minimum(counts[pre]/40.,1.)*np.minimum(counts[post]/40.,1.)
                brain.weight[edges]=np.clip(brain.weight[edges]+initial*.05*reward*eligibility,initial*.1,initial*2.)
            row={'phase':phase,'trial':trial,'target':int(category),'selected':answer,'rates_hz':rates,'kc_spikes':int(counts[brain.kc].sum()),'total_spikes':int(counts.sum()),'correct':answer==category,'stimulus':patch,'frames':frames,'retina_spikes':int(counts[brain.retina].sum()),'lamina_spikes':int(counts[brain.lamina].sum()),'changed_weights':int(np.count_nonzero(brain.weight[edges]!=initial)),'feedback':reward if phase=='training' else None}
            records.append(row)
        print(phase,'correct',sum(r['correct'] for r in records if r['phase']==phase),'/',trials,flush=True)
    after=[r for r in records if r['phase']=='after'];passed=sum(r['correct'] for r in after)>=12
    result={'protocol':'FLY four-quadrant feasibility assay v1','training_trials':32,'held_out_trials':16,'pass_threshold':12,'passed':passed,'before_sha256':before,'after_sha256':brain.digest(),'changed_weights':int(np.count_nonzero(brain.weight[edges]!=initial)),'plastic_edges':len(edges),'rule':'Reward-modulated pre/post spike coincidence; learning rate 0.05; reward +1 correct, -0.25 otherwise; weights clipped to 0.1–2 times initial efficacy. Only existing KC→MBON11/12/13/14 edges may change.','records':records,'decision':'Citizenship training is not started unless this gate passes. The separately recorded exam is an untrained baseline, not a trained final.'}
    dump(ROOT/'dist/data/learning.json',result)

def wrapped(draw,text,font,width):
    lines=[];line=''
    for word in text.split():
        candidate=(line+' '+word).strip()
        if draw.textlength(candidate,font=font)>width and line:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    return lines

def render_question(q):
    im=Image.new('L',(960,720),238);d=ImageDraw.Draw(im)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
    small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21)
    y=46
    d.text((45,y),'EINBÜRGERUNGSTEST · BERLIN',font=small,fill=25);y+=64
    for line in wrapped(d,q['question'],font,850):d.text((45,y),line,font=font,fill=18);y+=42
    y+=30
    for i,option in enumerate(q['options']):
        d.rectangle((45,y+4,65,y+24),outline=40,width=2)
        for line in wrapped(d,option,font,810):d.text((90,y),line,font=font,fill=18);y+=40
        y+=20
    if y>710:raise ValueError('Question raster overflow: '+q['id'])
    return im

def infer():
    # This path reads no answers, correct-option fields, or learning feedback.
    questions=json.loads((ROOT/'data/cache/exam-input.json').read_text())
    assert all('correct' not in q for q in questions)
    assert len(questions)==33 and sum(q['region']=='Berlin' for q in questions)==3
    brain=Brain();digest=brain.digest();start=time.perf_counter()
    visual=json.loads((ROOT/'dist/data/brain.json').read_text())
    visual_indices=np.array([n['index'] for n in visual['neurons']],dtype=np.int32)
    records=[];retina_dir=ROOT/'dist/data/retina';retina_dir.mkdir(exist_ok=True)
    for i,q in enumerate(questions):
        brain.reset();im=render_question(q);im.save(retina_dir/f'{i+1:02d}.png');pixels=brain.pixels(im)
        counts=np.zeros(brain.n,np.int32);frames=[];wall=0
        for frame in range(50):
            c,t=brain.step(pixels,20);counts+=c;wall+=t
            visible={str(int(j)):int(c[j]) for j in visual_indices if c[j]>0}
            frames.append({'ms':(frame+1)*20,'spikes':int(c.sum()),'activity':visible,'retina_spikes':int(c[brain.retina].sum()),'lamina_spikes':int(c[brain.lamina].sum()),'kc_spikes':int(c[brain.kc].sum()),'answer_spikes':int(sum(c[g].sum() for g in brain.readouts))})
        answer,rates=brain.answer(counts,1000)
        record={'number':i+1,**q,'selected':answer,'readout_rates_hz':rates,'reason':'unique_maximum' if answer is not None else 'no_unique_positive_readout','total_spikes':int(counts.sum()),'active_neurons':int(np.count_nonzero(counts)),'simulated_ms':1000,'wall_seconds':round(wall,4),'raster_sha256':hashlib.sha256(im.tobytes()).hexdigest(),'retinal_sha256':hashlib.sha256(pixels.tobytes()).hexdigest(),'frames':frames}
        records.append(record);print(i+1,q['id'],'answer',answer,'spikes',int(counts.sum()),flush=True)
    assert brain.digest()==digest,'Frozen weights changed'
    result={'id':'FLY-001','kind':'untrained_baseline','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'input_sha256':hashlib.sha256((ROOT/'data/cache/exam-input.json').read_bytes()).hexdigest(),'kernel_sha256':hashlib.sha256((ROOT/'neural/kernel.cpp').read_bytes()).hexdigest(),'weights_before_sha256':digest,'weights_after_sha256':brain.digest(),'duration_wall_seconds':round(time.perf_counter()-start,3),'time_limit_seconds':3600,'answer_mapping':['MBON11','MBON12','MBON13','MBON14'],'decoder':'Highest mean spike rate across the fixed population. Silence or ties yield an abstention. No tie breaker, fallback or language model.','records':records}
    dump(ROOT/'data/cache/blind-run.json',result)
    print('Blind inference complete; key was not opened.',flush=True)

def grade():
    raw=(ROOT/'data/cache/blind-run.json').read_bytes();run=json.loads(raw)
    key=json.loads((ROOT/'data/cache/answer-key.json').read_text())
    assert len(run['records'])==33
    for q in run['records']:q['correct_option']=key[q['id']];q['correct']=q['selected']==key[q['id']]
    score=sum(q['correct'] for q in run['records']);abstentions=sum(q['selected'] is None for q in run['records'])
    run.update({'score':score,'abstentions':abstentions,'pass_threshold':17,'passed':score>=17 and run['duration_wall_seconds']<=3600,'blind_run_sha256':hashlib.sha256(raw).hexdigest(),'grading_note':'Scoring is applied in a separate process after blind inference. This is a baseline using official text-only catalogue items, with secondary matched answer keys; not an official exam or validated cognitive model.'})
    dump(ROOT/'dist/data/run.json',run)
    print('BASELINE RESULT',score,'/33; abstentions',abstentions,flush=True)

def calibrate():
    brain=Brain();base=brain.weight.copy();report=[]
    for gain in [1,2,4]:
        brain.weight[:]=base*gain
        for k in [0,3]:
            brain.reset();x,y=brain.uv.T
            v=((x>.5)==bool(k%2))&((y>.5)==bool(k//2))
            total=np.zeros(brain.n,np.int32);wall=0
            for _ in range(50):c,t=brain.step(v,20);total+=c;wall+=t
            a,r=brain.answer(total,1000)
            row={'weight_multiplier':gain,'pattern':k,'duration_ms':1000,'total_spikes':int(total.sum()),'active_neurons':int((total>0).sum()),'kc_spikes':int(total[brain.kc].sum()),'mbon_spikes':int(total[brain.mbon].sum()),'answer':a,'rates_hz':r,'wall_seconds':round(wall,3)}
            report.append(row);print(json.dumps(row),flush=True)
    dump(ROOT/'dist/data/calibration.json',report)

if __name__=='__main__':
    {'gate':gate,'infer':infer,'grade':grade,'calibrate':calibrate}[sys.argv[1]]()
