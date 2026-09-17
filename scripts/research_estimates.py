"""Compute transparent timing scenarios and idealized chance benchmarks."""
from pathlib import Path
import json, math, hashlib
ROOT=Path(__file__).resolve().parents[1];data=ROOT/'dist/data'
run=json.loads((data/'run.json').read_text());probes=json.loads((data/'calibration.json').read_text())
baseline=run['duration_wall_seconds']/len(run['records'])
busy=max(p['wall_seconds']/(p['duration_ms']/1000) for p in probes)
def chance(p):return sum(math.comb(33,k)*p**k*(1-p)**(33-k) for k in range(17,34))
report={'kind':'conditional arithmetic, not a measured training duration or time-to-pass forecast','quiet_seconds_per_example':baseline,'busy_seconds_per_simulated_second':busy,'example_simulated_seconds':1,'catalogue_target_questions':310,'current_eligible_questions':246,'baseline_wall_seconds':run['duration_wall_seconds'],'baseline_questions':33,'scenarios':[{'epochs':e,'examples':310*e,'quiet_forward_hours':310*e*baseline/3600,'busy_forward_hours':310*e*busy/3600} for e in [10,100,1000]],'pass_probability_model':'Independent identically distributed Bernoulli questions, 33 trials, threshold 17; real errors can be correlated.','pass_probabilities':[{'per_question_accuracy':p,'probability_of_at_least_17':chance(p)} for p in [.25,.5,.6,.7,.8]],'input_contrast':{'paper_luminance':238/255,'ink_luminance':18/255,'luminance_ratio':238/18,'paper_drive':30*(238/255)/(.02+238/255),'ink_drive':30*(18/255)/(.02+18/255)},'source_hashes':{n:hashlib.sha256((data/n).read_bytes()).hexdigest() for n in ['run.json','learning.json','calibration.json']}}
(data/'research-estimates.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'timing':report['scenarios'],'guess_pass_probability':chance(.25)},indent=2))
