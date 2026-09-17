"""Make the shareable figure directly from the recorded experiment JSON."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'dist'
OUT = PUBLIC / 'analysis'
OUT.mkdir(exist_ok=True)
def read(name):
    return json.loads((PUBLIC / 'data' / (name + '.json')).read_text())
run, learning, probes = read('run'), read('learning'), read('calibration')
bg, ink, muted, lime, blue, orange = '#090e10', '#eef1e7', '#9ba9a8', '#d8f85d', '#87b9ed', '#d79571'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'text.color':ink,
                     'axes.labelcolor':muted,'xtick.color':muted,'ytick.color':muted,
                     'axes.edgecolor':'#354344','axes.facecolor':bg,'figure.facecolor':bg,
                     'svg.fonttype':'none','axes.spines.top':False,'axes.spines.right':False})
fig, axs = plt.subplots(2, 2, figsize=(15, 10.5))
fig.subplots_adjust(left=.09,right=.965,bottom=.155,top=.755,wspace=.26,hspace=.75)
fig.text(.07,.94,'FLY / EXPERIMENT 001',fontfamily='monospace',fontsize=12,color=lime)
fig.text(.07,.885,'A fly-brain model meets the citizenship test.',fontsize=24,weight='bold')
fig.text(.07,.847,'166,700 retained neurons  ·  25.6M directed edges  ·  Connectome-only answer generation',fontsize=12,color=muted)

def title(ax, label, heading, subtitle):
    ax.text(0,1.28,label,transform=ax.transAxes,color=lime,fontsize=10,fontfamily='monospace')
    ax.set_title(heading,loc='left',pad=26,fontsize=15,weight='bold',color=ink)
    ax.text(0,1.06,subtitle,transform=ax.transAxes,color=muted,fontsize=9)
    ax.grid(axis='y',color='#293537',linewidth=.6)
    ax.set_axisbelow(True)

ax=axs[0,0]
title(ax,'A / SIGNAL','The visual system responds.','Mean spikes per 20 ms bin across 33 exam items; total population counts.')
t=np.array([f['ms'] for f in run['records'][0]['frames']])
for field,label,color in [('retina_spikes','Retina',blue),('lamina_spikes','Lamina (early vision)',lime)]:
    traces=np.array([[f[field] for f in q['frames']] for q in run['records']])
    ax.fill_between(t,traces.min(axis=0),traces.max(axis=0),alpha=.12,color=color)
    ax.plot(t,traces.mean(axis=0),color=color,lw=1.9,label=label)
ax.axhline(0,color=orange,lw=2,label='Kenyon cells + answer populations: 0')
ax.set_xlim(0,1000);ax.set_ylim(-500,14500);ax.set_yticks([0,5000,10000],['0','5k','10k'])
ax.set_xlabel('Simulated time (ms)');ax.set_ylabel('Spikes / bin')
ax.legend(loc='upper right',frameon=False,fontsize=8,labelcolor=ink)

ax=axs[0,1]
title(ax,'B / LEARNING','No demonstrated learning.','Four-quadrant visual task, before any citizenship training.')
groups=[[r for r in learning['records'] if r['phase']==phase] for phase in ['before','training','after']]
counts=[sum(r['correct'] for r in group) for group in groups]
ns=[len(group) for group in groups]
percent=np.array(counts)/ns*100
ax.set_ylim(-5,106);ax.set_yticks([0,25,50,75,100]);ax.set_ylabel('Correct trials (%)')
ax.set_xticks(range(3),['Before','Feedback trials','Held out'])
ax.scatter(range(3),percent,s=85,color=lime,zorder=3)
for i,(c,n) in enumerate(zip(counts,ns)):
    ax.text(i,9,f'{c}/{n}',ha='center',fontsize=15,weight='bold')
ax.axhline(learning['pass_threshold']/learning['held_out_trials']*100,ls='--',lw=1,color=orange)
ax.text(1.9,79,'Held-out gate: 12/16',color=orange,fontsize=9,ha='right')
ax.set_xlim(-.45,2.45)
ax.text(.02,.46,f"{learning['changed_weights']} / {learning['plastic_edges']:,} candidate synapses changed",transform=ax.transAxes,fontsize=11,color=muted)

ax=axs[1,0]
title(ax,'C / CALIBRATION','More activity is not a better answer.','Six diagnostic probes; reference weights, then global gain ×2 and ×4.')
for j,pattern in enumerate([0,3]):
    rows=[p for p in probes if p['pattern']==pattern]
    rates=[max(p['rates_hz']) for p in rows]
    ax.bar(np.arange(3)+(j-.5)*.30,rates,width=.27,color=[blue,lime][j],label=['Patch in A','Patch in D'][j])
    for i,(p,rate) in enumerate(zip(rows,rates)):
        ax.text(i+(j-.5)*.30,rate+9,'none' if p['answer'] is None else 'ABCD'[p['answer']],ha='center',fontsize=10)
ax.set_xticks(range(3),['1× (exam weights)','2×','4×']);ax.set_ylabel('Highest answer-population rate (Hz)')
ax.set_ylim(0,465);ax.set_yticks([0,100,200,300,400]);ax.legend(loc='upper left',frameon=False,fontsize=9,labelcolor=ink)

ax=axs[1,1]
title(ax,'D / FROZEN EXAM','33 questions. 33 abstentions.','Untrained baseline; 30 national + 3 Berlin text-only catalogue items.')
ax.set_xlim(0,33);ax.set_ylim(-.65,2.55);ax.set_yticks([2,1,0],['Model score','Uniform guess*','Pass threshold'])
ax.set_xticks([0,8,17,25,33]);ax.set_xlabel('Correct answers / 33')
for y,value,color in [(2,run['score'],lime),(1,33*.25,'#52666c'),(0,run['pass_threshold'],orange)]:
    ax.barh(y,value,height=.44,color=color)
    if value==0:ax.scatter([0],[y],s=70,color=color,zorder=3,clip_on=False)
    ax.text(value+.6,y,f'{value:g}',va='center',color=ink,weight='bold',fontsize=12)
ax.grid(axis='x',color='#293537',lw=.6);ax.grid(axis='y',visible=False)
ax.text(0,-.29,'*8.25 is a theoretical expectation, not a measured model result.',transform=ax.transAxes,fontsize=8,color=muted)

fig.text(.07,.07,'Reading this result',color=lime,fontfamily='monospace',fontsize=10)
fig.text(.07,.044,'The learning gate failed. Citizenship training was not started. This tests one coarse dynamics model, not the limits of fly intelligence.',fontsize=10,color=muted)
fig.text(.07,.018,'Data: run.json · learning.json · calibration.json  |  Shading in A: observed min–max, not a confidence interval.  |  Methods and source hashes on site.',fontsize=8,color=muted)
for ext in ['png','svg']:
    fig.savefig(OUT/f'FLY-001-analysis.{ext}',dpi=180,facecolor=bg)
print(OUT/'FLY-001-analysis.png')
