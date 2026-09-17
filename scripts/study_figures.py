"""Source-derived study figures and an optional recorded-data video."""
from pathlib import Path
import json,sys,math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.animation import FFMpegWriter
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'dist';OUT=PUBLIC/'analysis';OUT.mkdir(exist_ok=True)
summary=json.loads((PUBLIC/'data/study-002/summary.json').read_text())
control=json.loads((PUBLIC/'data/study-002/plasticity-control.json').read_text())
bg='#070b0d';ink='#f2f4ed';muted='#a4b4b8';acid='#ecff00';blue='#8aa7ff';line='#34434a'
plt.rcParams.update({'font.family':'DejaVu Sans','text.color':ink,'axes.labelcolor':muted,'xtick.color':muted,'ytick.color':muted,'axes.facecolor':bg,'figure.facecolor':bg,'axes.edgecolor':line,'axes.spines.top':False,'axes.spines.right':False,'font.size':11,'svg.fonttype':'none'})

def brain_plot(ax):
    meta=json.loads((PUBLIC/'data/brain.json').read_text())
    xyz=np.fromfile(PUBLIC/'data/brain.bin',dtype=np.int16).reshape(-1,3)*meta['coordinate_scale']
    # Frontal display projection of the actual exported coordinates: left/right, dorsal.
    xy=xyz[:,[0,2]]*np.array([1,-1]);segments=xy.reshape(-1,2,2)
    palette=np.array([[.32,.78,.86],[.51,.59,.94],[.7,.40,.79],[.66,.73,.65],[.35,.69,.60]])
    colors=np.empty((len(segments),4));centers=[];indices=[]
    for i,n in enumerate(meta['neurons']):
        # Export offsets count line segments, not bytes (same convention as scene.js).
        start=n['offset'];length=n['segments'];colors[start:start+length,:3]=palette[i%len(palette)];colors[start:start+length,3]=.19
        centers.append(segments[start:start+length].mean(axis=(0,1)));indices.append(n['index'])
    ax.add_collection(LineCollection(segments,colors=colors,linewidths=.34,rasterized=True))
    lo=np.quantile(xy,.001,axis=0);hi=np.quantile(xy,.999,axis=0);pad=(hi-lo)*.06
    ax.set_xlim(lo[0]-pad[0],hi[0]+pad[0]);ax.set_ylim(lo[1]-pad[1],hi[1]+pad[1]);ax.set_aspect('equal');ax.axis('off')
    return np.array(centers),indices

def figures():
    fig=plt.figure(figsize=(16,10),dpi=120)
    fig.text(.05,.935,'FLY  /  LAB NOTE 002',fontsize=14,fontfamily='monospace',color=acid)
    fig.text(.05,.852,'FIRST, IT LEARNED\nFOUR NEURAL SIGNALS.',fontsize=35,weight='bold',linespacing=1.06,va='top')
    fig.text(.05,.688,'Direct stimulation of a computational fly-brain model.',fontsize=17,color=muted)
    ax=fig.add_axes([.02,.14,.51,.5]);brain_plot(ax)
    fig.text(.06,.142,'Real anatomy · 630 displayed skeletons',fontsize=12,color=muted)
    ax=fig.add_axes([.60,.28,.34,.32]);labels=['Untrained','Trained','Shuffled labels'];x=np.arange(3)
    for j,study in enumerate(summary['experiments']):
        vals=[study['scores'][k] for k in ['untrained','trained','shuffled_labels']]
        ax.bar(x+(j-.5)*.32,vals,width=.28,color=[acid,blue][j],label=['First ensembles','New ensembles'][j])
        for xx,v in zip(x+(j-.5)*.32,vals):ax.text(xx,v+1,str(v),ha='center',fontsize=16,weight='bold')
    ax.set_xticks(x,labels);ax.set_ylim(0,37);ax.set_yticks([0,8,16,24,32]);ax.set_ylabel('Correct / 32 frozen evaluation trials')
    fig.text(.60,.207,'● First ensembles',fontsize=11,color=acid)
    fig.text(.77,.207,'● New ensembles',fontsize=11,color=blue)
    fig.text(.60,.64,'32/32 → 30/32 on replication',fontsize=22,color=ink,weight='bold')
    fig.text(.60,.135,'178 and 244 existing connection weights changed.\nFresh drive amplitudes; four familiar ensembles per run.',fontsize=11,color=muted,linespacing=1.7)
    fig.text(.05,.075,'GERMAN CITIZENSHIP TRAINING HAS NOT STARTED.',fontsize=17,color=acid,weight='bold')
    fig.text(.05,.04,'Visual learning remains unresolved. This control does not demonstrate reading, civic knowledge or biological fidelity.',fontsize=12,color=muted)
    for ext in ['png','svg']:fig.savefig(OUT/f'FLY-002-result.{ext}',facecolor=bg)
    plt.close(fig)

    fig,axes=plt.subplots(1,2,figsize=(16,8),dpi=120);fig.subplots_adjust(left=.07,right=.96,top=.66,bottom=.22,wspace=.29)
    fig.text(.06,.935,'FLY / THE EVIDENCE',fontsize=14,fontfamily='monospace',color=acid)
    fig.text(.06,.775,'The improvement survives replication.\nReset the learned weights, and it disappears.',fontsize=27,weight='bold',linespacing=1.25)
    ax=axes[0]
    for i,study in enumerate(summary['experiments']):ax.plot(np.arange(1,9)*16,np.array(study['training_blocks'])/16*100,'o-',color=[acid,blue][i],lw=2,label=['First ensembles','New ensembles'][i])
    ax.set(xlim=(12,132),ylim=(0,105),xlabel='Training presentations',ylabel='Correct in each 16-trial block (%)');ax.set_xticks([16,32,64,96,128]);ax.grid(axis='y',color=line,alpha=.7);ax.legend(frameon=False,labelcolor=ink,loc='lower right')
    ax=axes[1];vals=[r['score'] for r in summary['interventions']];names=['Saved weights\nreloaded','Learned weights\nreset','Kenyon cells\nsilenced']
    ax.bar(np.arange(3),vals,color=[acid,'#81959e',blue],width=.58)
    for i,v in enumerate(vals):ax.text(i,v+1,f'{v}/32',ha='center',fontsize=17,weight='bold')
    ax.set_xticks(range(3),names);ax.set_ylim(0,37);ax.set_yticks([0,8,16,24,32]);ax.set_ylabel('Correct frozen evaluation trials')
    fig.text(.06,.112,'A: Online training blocks, not held-out accuracy.  B: First-ensemble checkpoint and interventions.',fontsize=11,color=muted)
    fig.text(.06,.075,'The checkpoint reproduced every evaluated total spike count, output rate and choice.',fontsize=11,color=muted)
    fig.text(.06,.04,'All measurements belong to the direct-stimulation control. The visual learning gate remains unpassed.',fontsize=11,color=muted)
    for ext in ['png','svg']:fig.savefig(OUT/f'FLY-002-controls.{ext}',facecolor=bg)
    plt.close(fig)
    print('Study figures exported',flush=True)

def video():
    fps=15;nframes=330
    fig=plt.figure(figsize=(12.8,7.2),dpi=100)
    fig.text(.04,.94,'FLY  /  CAN IT LEARN?',fontsize=13,fontfamily='monospace',color=acid)
    fig.text(.04,.865,'A tiny brain. A very human ambition.',fontsize=26,weight='bold')
    fig.text(.04,.806,'The goal: Germany’s citizenship test. The first step: four neural signals.',fontsize=13,color=muted)
    bax=fig.add_axes([.015,.14,.55,.61]);centers,indices=brain_plot(bax)
    # Cache source anatomy only; dynamic markers below use the recorded spike bins.
    fig.canvas.draw();bbox=bax.get_window_extent().transformed(fig.dpi_scale_trans.inverted())
    anatomy_path=ROOT/'tmp/study-anatomy.png';anatomy_path.parent.mkdir(exist_ok=True)
    fig.savefig(anatomy_path,bbox_inches=bbox,pad_inches=0,dpi=100,facecolor=bg)
    lim=(bax.get_xlim(),bax.get_ylim());bax.clear();bax.imshow(plt.imread(anatomy_path),extent=[*lim[0],*lim[1]],origin='upper');bax.set(xlim=lim[0],ylim=lim[1]);bax.axis('off')
    points=bax.scatter(centers[:,0],centers[:,1],s=np.zeros(len(indices)),color=acid,alpha=.75)
    fig.text(.045,.143,'630 source skeletons · markers follow recorded model spikes',fontsize=9,color=muted)
    phase=fig.text(.59,.723,'DIRECT NEURAL STIMULATION',fontsize=11,color=acid,fontfamily='monospace')
    main=fig.text(.59,.612,'4 SIGNALS',fontsize=39,weight='bold')
    detail=fig.text(.59,.553,'Four groups of 16 Kenyon cells.',fontsize=13,color=muted)
    cue=fig.text(.59,.487,'No question text enters this control.',fontsize=12,color=muted)
    cax=fig.add_axes([.62,.23,.32,.17]);cax.set(xlim=(0,128),ylim=(0,105));cax.set_xticks([0,64,128]);cax.set_yticks([0,50,100]);cax.tick_params(labelsize=9);cax.set_xlabel('Training presentations',fontsize=10);cax.set_ylabel('Block correct (%)',fontsize=10);trace,=cax.plot([],[],color=acid,lw=2)
    foot=fig.text(.045,.073,'POSITIVE CONTROL · custom dynamics and learning on the MaleCNS connectome',fontsize=11,color=muted)
    fig.text(.045,.035,'German citizenship training has not started. Visual learning remains unresolved.',fontsize=11,color=acid)
    rows=[r for r in control['records'] if r['condition']=='trained' and r['phase']=='training']
    writer=FFMpegWriter(fps=fps,codec='libx264',bitrate=2300,extra_args=['-pix_fmt','yuv420p','-movflags','+faststart'])
    with writer.saving(fig,OUT/'FLY-002-study.mp4',100):
        for f in range(nframes):
            if 45<=f<270:
                progress=(f-45)/225*len(rows);i=min(127,int(progress));r=rows[i];bin_index=min(19,int((progress-i)*20));frame=r['frames'][bin_index]
                points.set_sizes([min(frame['activity'].get(str(j),0),4)*13 for j in indices])
                phase.set_text(f'LEARNING / TRIAL {i+1:03d} OF 128')
                main.set_text('SIGNAL '+chr(65+r['stimulus']))
                detail.set_text('Neural choice: '+('abstained' if r['selected'] is None else chr(65+r['selected'])))
                cue.set_text(f'{r["changed_weights"]} connection weights changed')
                blocks=(i+1)//16;trace.set_data(np.arange(1,blocks+1)*16,np.array(summary['experiments'][0]['training_blocks'][:blocks])/16*100)
            elif f>=270:
                points.set_sizes(np.zeros(len(indices)));phase.set_text('FROZEN EVALUATION / DIRECT STIMULATION');main.set_text('32 / 32');detail.set_text('Replication with new ensembles: 30/32.');cue.set_text('Untrained: 9/32. Shuffled labels: 8/32.')
                trace.set_data(np.arange(1,9)*16,np.array(summary['experiments'][0]['training_blocks'])/16*100)
            writer.grab_frame(facecolor=bg)
            if f%75==0:print('video frame',f,'/',nframes,flush=True)
    plt.close(fig)
    print(OUT/'FLY-002-study.mp4',flush=True)

if __name__=='__main__':video() if '--video' in sys.argv else figures()
