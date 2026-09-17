"""Publish immutable observations from FLY-002, plus calculated summaries."""
from pathlib import Path
import json,hashlib,shutil,zipfile,subprocess
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data/cache/revision';OUT=ROOT/'dist/data/study-002';OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text())
files=['audit.json','interface-audit.json','relay-audit.json','relay-fine-audit.json','plasticity-control.json','plasticity-control-replication.json','verification.json','plasticity-control-weights.npz','plasticity-control-replication-weights.npz']
for name in files:shutil.copyfile(RAW/name,OUT/name)
reports=[read(OUT/name) for name in files[:4]]
controls=[read(OUT/'plasticity-control.json'),read(OUT/'plasticity-control-replication.json')]
verification=read(OUT/'verification.json')
assert all(r['selected_config'] is None for r in reports[1:])
experiments=[]
for run in controls:
    train=[r for r in run['records'] if r['condition']=='trained' and r['phase']=='training']
    assert len(train)==128 and run['visual_gate_passed'] is False
    conditions={r['condition']:r for r in run['conditions']}
    experiments.append({'id':run['id'],'scores':{k:sum(v['scores']) for k,v in conditions.items()},'scores_per_set':{k:v['scores'] for k,v in conditions.items()},'trials_per_condition':32,'changed_connections':conditions['trained']['changed_weights'],'trained_weight_sha256':conditions['trained']['weight_sha256'],'training_kernel_seconds':round(sum(r['wall_seconds'] for r in train),3),'training_blocks':[sum(r['correct'] for r in train[i:i+16]) for i in range(0,128,16)],'passed_positive_control':run['positive_control_passed']})
assert verification['replayed_exact_spike_counts']
summary={'id':'FLY-002','kind':'direct_neural_stimulation_learning_control','visual_gate_passed':False,'citizenship_training_started':False,'calibration_configurations':sum(len(r['configs']) for r in reports),'calibration_trials':sum(len(r['records']) for r in reports),'experiments':experiments,'interventions':[{k:v for k,v in r.items() if k!='records'} for r in verification['results']],'source_scope':'Google/Janelia MaleCNS anatomy; custom LIF dynamics, sensory encoding, decoder, calibration and supervised local plasticity. No biological-fidelity validation.','evaluation_scope':'Four familiar neural ensembles, fresh drive amplitudes. Replication uses different ensembles. These are not visual, language or citizenship trials.','files':[{'path':name,'sha256':sha(OUT/name),'bytes':(OUT/name).stat().st_size} for name in files]}
(OUT/'summary.json').write_text(json.dumps(summary,indent=2))
shutil.copyfile(ROOT/'neural/PROTOCOL-002.md',OUT/'protocol.md')
shutil.copyfile(ROOT/'data/source-lock.json',OUT/'source-lock.json')
source=ROOT/'dist/downloads/FLY-study-source.zip';source.parent.mkdir(exist_ok=True)
paths=['README.md','THIRD_PARTY.md','data/source-lock.json','dist/SOURCE-ALIGNMENT.md','dist/METHOD.md','dist/research.html','dist/data/brain.json','dist/data/brain.bin']
paths += [str(p.relative_to(ROOT)) for folder in ['neural','scripts'] for p in (ROOT/folder).iterdir() if p.is_file() and p.suffix in ['.py','.cpp','.md']]
paths += [str(p.relative_to(ROOT)) for p in OUT.iterdir() if p.is_file()]
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
    for name in paths:z.write(ROOT/name,name)
    for p in (ROOT/'licenses').glob('*'):z.write(p,p.relative_to(ROOT))
    # Exact historical versions make every prospective protocol/source hash recoverable.
    for rev in ['f95ce13','0d328ac','daa4375','b52fd29','4760b53','3079eed']:
        for name in ['neural/revision.py','neural/PROTOCOL-002.md']:
            try:
                blob=subprocess.check_output(['git','show',rev+':'+name],cwd=ROOT,stderr=subprocess.DEVNULL)
            except subprocess.CalledProcessError:
                # A downloaded source archive has snapshots but no Git repository.
                blob=(ROOT/'history'/rev/name).read_bytes()
            z.writestr('history/'+rev+'/'+name,blob)
print(json.dumps({'configurations':summary['calibration_configurations'],'calibration_trials':summary['calibration_trials'],'experiments':experiments,'interventions':[(x['condition'],x['score']) for x in summary['interventions']]},indent=2))
