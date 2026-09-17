"""A study-design diagram. Arrows are experimental branches, not neural tracts."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

root=Path(__file__).resolve().parents[1];out=root/'dist/analysis'
bg='#070b0d';ink='#f2f4ed';muted='#aebfc2';acid='#ecff00';line='#5b737b'
fig=plt.figure(figsize=(15,10),dpi=128,facecolor=bg)
ax=fig.add_axes([0,0,1,1]);ax.set(xlim=(0,1),ylim=(0,1));ax.axis('off')
fig.text(.055,.93,'FLY / THE EVIDENCE MAP',fontsize=13,color=acid,family='monospace')
fig.text(.055,.86,'From a published map to a testable claim.',fontsize=28,color=ink,weight='bold')
fig.text(.055,.815,'Arrows show the experiment’s design. They do not represent biological signal paths.',fontsize=13,color=muted)

def node(x,y,w,h,tag,title,sub,accent=line):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.006,rounding_size=0.004',facecolor='#0c1418',edgecolor=accent,lw=1.2))
    ax.text(x+.02,y+h-.029,tag,fontsize=9,color=accent if accent!=line else muted,family='monospace',va='top')
    ax.text(x+.02,y+h-.065,title,fontsize=18,color=ink,va='center',weight='bold')
    ax.text(x+.02,y+.023,sub,fontsize=10,color=muted,va='bottom')
def arrow(a,b):ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=12,color=line,lw=1.2))
node(.34,.64,.32,.12,'PUBLISHED ANATOMY','MaleCNS connectome','Google / Janelia / collaborators',accent='#87bacc')
arrow((.5,.634),(.5,.603))
node(.34,.47,.32,.13,'OUR ASSUMPTIONS','Computational model','Custom dynamics, gains and fixed outputs')
ax.plot([.5,.5],[.465,.437],color=line,lw=1.2)
ax.plot([.265,.735],[.437,.437],color=line,lw=1.2)
arrow((.265,.437),(.265,.393));arrow((.735,.437),(.735,.393))
node(.075,.26,.38,.13,'VISUAL ROUTE','Retinal input','22 calibration configurations / 110 trials')
node(.545,.26,.38,.13,'ISOLATED CONTROL','Direct neural stimulation','4 groups of 16 visual Kenyon cells')
arrow((.265,.254),(.265,.213));arrow((.735,.254),(.735,.213))
node(.075,.08,.38,.13,'UNRESOLVED','Visual gate unmet','Citizenship training has not started.',accent='#dfb87c')
node(.545,.08,.38,.13,'MEASURED IN THE MODEL','Learning reproduced','32/32 then 30/32 lab trials. Controls published.',accent=acid)
fig.text(.055,.033,'REAL TEST: 33 QUESTIONS. OUR UNTRAINED PRACTICE BASELINE: 0/33.',fontsize=12,color=acid,weight='bold')
for ext in ['png','svg']:fig.savefig(out/f'FLY-evidence-map.{ext}',facecolor=bg)
print('Evidence map exported from the declared study design.')
