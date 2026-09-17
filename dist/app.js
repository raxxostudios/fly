import { createSpecimen } from './scene-lab.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const format = n => Number(n).toLocaleString('en-US');
const letters = ['A', 'B', 'C', 'D'];
const content = $('#paperContent');
const initialContent = content.innerHTML;
let specimen = null, run = null, model = null, learning = null, calibration = null, provenance = null;
let playing = false, position = 0, speed = 5, started = false, finished = false, lastIndex = -1, lastReveal = false, lastFrame = -1;
let mode='observe',trainingPosition=0,lastTraining=-1,lastTrainingReveal=false,previewPosition=0;
const trialSeconds=3;
const trainingDuration=()=>learning?learning.records.length*trialSeconds:168;
const secondsPerQuestion = 10;
const totalSeconds = 33 * secondsPerQuestion;
let previous = performance.now();
const sources = [
  ['Google Research · Mapping the male fruit fly nervous system', 'https://blog.google/innovation-and-ai/technology/research/male-fruit-fly-brain-map/'],
  ['Janelia · MaleCNS data and skeletons', 'https://male-cns.janelia.org/download/'],
  ['NeuroMechFly · The anatomical body model', 'https://github.com/NeLy-EPFL/flygym/'],
  ['German government · Official citizenship question catalogue', 'https://www.gesetze-im-internet.de/einbtestv/anlage_1.html'],
  ['German government · Citizenship test regulation', 'https://www.gesetze-im-internet.de/einbtestv/BJNR164900008.html'],
  ['Doomfly · Source of the full-graph neural kernel', 'https://github.com/nftechie/doomfly'],
  ['Question key transcription · Secondary source', 'https://github.com/leben-in-deutschland/leben-in-deutschland-scrapper']
];
function activate(name) { document.querySelectorAll('.phase').forEach(b => b.classList.toggle('active', b.dataset.phase === name)); }
function narrate(chapter, text) {
  $('#stageChapter').textContent=chapter;
  $('#stageNarration').textContent=text;
}
function openDialog(html) {
  if (playing) setPlaying(false);
  $('#dialogContent').innerHTML = html;
  if (!$('#detailsDialog').open) $('#detailsDialog').showModal();
  $('#detailsDialog').scrollTop=0;
}
function science() {
  openDialog(`<div class="paper-overline">PUBLISHED RESEARCH / WHAT WAS FOUND</div><h2>Wiring, cell types<br>and biological pathways.</h2>
  <p><a href="./research.html">Read the full research: could it learn, and how long would training take? ↗</a></p>
  <ol class="published-findings"><li><strong>A connected nervous-system map.</strong> The project reconstructed more than 166,000 neurons and roughly 125 million synaptic connections across the male fly’s brain and ventral nerve cord. <a href="https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/" target="_blank" rel="noopener noreferrer">Google Research ↗</a></li>
  <li><strong>A detailed cell catalogue.</strong> Experts classified 11,691 neuron types. Shape and connectivity allow researchers to identify and compare particular circuits. <a href="${sources[0][1]}" target="_blank" rel="noopener noreferrer">Research overview ↗</a></li>
  <li><strong>Differences between the sexes.</strong> Some cells are sex-specific; others exist in both sexes but connect differently. These comparisons help investigate courtship and other behavior. <a href="${sources[0][1]}" target="_blank" rel="noopener noreferrer">Comparison examples ↗</a></li>
  <li><strong>Routes from sensing to movement.</strong> The map traces visual input toward descending pathways that influence movement, including a male-specific intermediate cell type, LoVP92. Anatomical routes give scientists specific circuits to investigate. <a href="${sources[0][1]}" target="_blank" rel="noopener noreferrer">Visual pathway example ↗</a></li></ol>
  <h3>What this research did not establish</h3><p>The publication did not train a fly to understand German or pass a citizenship test. A wiring map is a structural resource. Producing a functioning model also requires assumptions about input, cell dynamics, learning and output.</p>
  <h3>Latest: a learning control reproduced</h3><p>FLY-002 learned four directly stimulated neural ensembles: 32/32 frozen evaluation trials, then 30/32 with new ensembles. This isolates learning from the unresolved visual pathway. It does not demonstrate reading or citizenship knowledge. <a href="./lab.html">Watch the study film and inspect the controls ↗</a></p>
  <h3>What attempt 001 found</h3><p>The custom model generated visual-system activity, but its designated memory and answer populations stayed silent. It scored 0/16 on the prerequisite held-out visual task and changed zero candidate connection weights. Citizenship training never started. The separate untrained exam replay contains 33 abstentions and a score of 0/33.</p>
  <p>These results diagnose this implementation. They do not establish the limits of a fly’s intelligence. Feeding text images to retinal receptors and assigning A–D labels to four neuron populations does not establish that a model can read or understand questions.</p>
  <h3>What you are looking at</h3><p>The brain view uses ${specimen?.visibleNeurons ?? 630} original neuron skeletons, selected deterministically for display. The neural simulation retains all ${format(model?.neurons ?? 166700)} neurons in our stated selection and ${format(model?.edges ?? 25582938)} directed edges. The reconstructed male nervous system includes the brain and ventral nerve cord; the displayed subset emphasizes brain anatomy.</p>
  <p>The fly body comes from NeuroMechFly’s anatomical meshes and joint hierarchy. The enlarged brain follows the head, with the optic-lobe axis aligned to the eyes. This is a display alignment between different source specimens, not an exact biological registration. Antenna movements, wing flicks and grooming gestures are illustrative animation.</p>
  <h3>How this custom model was connected to the test</h3><p>A fixed image renderer turns German questions into grayscale pixels. Those pixels drive 3,335 mapped retinal receptors through a declared sensory approximation. The complete retained graph runs a leaky integrate-and-fire model. Four fixed mushroom-body output populations · MBON11, MBON12, MBON13 and MBON14 · map to A, B, C and D. Silence or a tie gives an abstention.</p>
  <p>There is no language model, OCR system, text embedding, external classifier or answer lookup in the inference process. These input and output mappings, membrane parameters and learning rule are engineering hypotheses; they are not proof of biological cognition.</p>
  <h3>Recorded simulation, paced for watching</h3><p>The green highlights use logged model spike counts in 20 ms bins. They are not recordings of biological electrical activity. Color strength follows each bin; there is no added rhythmic firing signal. Rotation shows anatomy. Each exam item contains one second of neural simulation; the presentation stretches that sequence to ten seconds at 1× so the page is readable. Playback speed changes viewing pace, not the experiment or its score.</p>
  <h3>Sources</h3><ul>${sources.map(([title,url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a></li>`).join('')}</ul>`);
}
function evidence() {
  if (!run || !learning) return openDialog('<h2>The evidence is loading</h2><p>Please try again in a moment.</p>');
  const after = learning.records.filter(r => r.phase === 'after');
  const before = learning.records.filter(r => r.phase === 'before');
  openDialog(`<div class="paper-overline">EXPERIMENT ${esc(run.id)} / RECORDED EVIDENCE</div><h2>The result is ${run.score} out of 33.</h2>
  <p>This untrained baseline ${run.passed ? 'reached' : 'did not reach'} the 17-answer practice threshold. It produced ${run.abstentions} abstentions. ${run.abstentions === 33 ? 'The answer populations stayed silent on every question.' : 'Every selection is recorded below.'}</p>
  <figure class="analysis-figure"><a href="./analysis/FLY-001-analysis.png" target="_blank" rel="noopener"><img src="./analysis/FLY-001-analysis.png" alt="Four analysis panels: recorded visual activity, zero held-out learning accuracy, gain probes with nonselective A answers, and a baseline exam score of zero out of 33."></a><figcaption>Computed from the recorded trials. Open the figure for full resolution.</figcaption></figure>
  <div class="download-links"><a href="./analysis/FLY-001-analysis.png" download>Download analysis figure ↗</a><a href="./analysis/X-post.md" download>X post & scientific thread ↗</a></div>
  <table class="data-table"><tbody><tr><th>Before learning</th><td>${before.filter(r => r.correct).length} / ${before.length} simple visual trials</td></tr><tr><th>Learning attempt</th><td>${learning.training_trials} reward-feedback trials, confined to ${format(learning.plastic_edges)} existing synapses</td></tr><tr><th>Held-out visual gate</th><td>${after.filter(r => r.correct).length} / ${after.length}; ${learning.pass_threshold} required</td></tr><tr><th>Weights changed</th><td>${format(learning.changed_weights)}</td></tr><tr><th>Citizenship training</th><td>${learning.passed ? 'Gate passed; separate training required' : 'Not started: the basic learning gate failed'}</td></tr><tr><th>Recorded exam</th><td>Untrained baseline · 30 national + 3 Berlin text questions</td></tr><tr><th>Inference wall time</th><td>${run.duration_wall_seconds.toFixed(1)} seconds / 3,600 second limit</td></tr><tr><th>Weight integrity</th><td>${run.weights_before_sha256 === run.weights_after_sha256 ? 'Unchanged throughout blind inference' : 'Changed'}</td></tr></tbody></table>
  <p><a href="./lab.html">Latest study: direct-stimulation learning, replicated, with all controls ↗</a></p>
  <h3>Where the signal stopped in attempt 001</h3><p>The reference-strength model generated visual-system spikes, but no Kenyon-cell or mushroom-body output spikes in the basic assay. The tested local coincidence rule therefore had no activity from which to change its synapses. Higher global weight probes produced very high output rates and the same A selection on both probe patterns; they were not used to manufacture an exam score.</p>
  <h3>What this result means</h3><p>This implementation has not demonstrated even the prerequisite four-way visual learning. It does not establish what a better connectome model could learn, and it does not demonstrate that a fly understands German. Further work would need calibrated sensory dynamics and validated learning before a trained citizenship attempt.</p>
  <h3>Questions and scoring</h3><p>German wording and option order come from the official regulation. This sitting samples ${provenance.eligible_national_text_questions} national and ${provenance.eligible_berlin_text_questions} Berlin text-only items with matched secondary keys; image questions and unmatched keys were excluded. It is a reproducible practice selection, not a BAMF exam form or an official certificate. The answer key was opened by a separate grader after inference finished.</p>
  <div class="download-links"><a href="./data/run.json" download>Download the complete run ↗</a><a href="./data/learning.json" download>Learning trials ↗</a><a href="./data/calibration.json" download>Calibration probes ↗</a><a href="./data/question-provenance.json" download>Question provenance ↗</a><a href="./METHOD.md" download>Method & reproduction ↗</a><a href="./THIRD_PARTY.md" download>Research credits & licenses ↗</a></div>
  <h3>Frozen neural weights · SHA-256</h3><pre>${esc(run.weights_after_sha256)}</pre>
  <h3>Question-by-question result</h3><table class="data-table"><thead><tr><th>Item</th><th>Catalogue</th><th>Selected</th><th>Key</th></tr></thead><tbody>${run.records.map(q => `<tr><td>${q.number}</td><td>${esc(q.id)}</td><td>${q.selected === null ? 'Abstained' : letters[q.selected]}</td><td>${letters[q.correct_option]}</td></tr>`).join('')}</tbody></table>
  <p><a href="${sources[0][1]}" target="_blank" rel="noopener noreferrer">Read the research that inspired FLY ↗</a></p>`);
}
function setPlaying(value) {
  playing = value;
  specimen?.setSignalPlaying(value);
  if(value){specimen?.setMotion(true);$('#motionButton').textContent='Ⅱ';$('#motionButton').setAttribute('aria-label','Pause specimen animation');}
  $('#playButton').textContent = value ? 'Ⅱ' : '▶';
  $('#playButton').setAttribute('aria-label', value ? 'Pause recorded experiment' : 'Play recorded experiment');
}
function start(reset = false) {
  if (!run) return;
  if (reset || finished || !started){position = 0;trainingPosition=0;mode='training';lastTraining=-1;}
  started = true; finished = false; lastIndex = -1; lastFrame = -1;
  if(reset)selectView('both');
  activate(mode==='training'?'observe':'experiment'); setPlaying(true); update();
}
function startExam(){mode='exam';position=0;started=true;finished=false;lastIndex=-1;lastFrame=-1;activate('experiment');setPlaying(true);update();}
function observe() {
  setPlaying(false); started = false; finished = false; position = 0; lastIndex = -1;
  mode='observe';previewPosition=0;
  content.innerHTML = initialContent;
  $('.paper').scrollTop=0;
  $('#startButton').innerHTML = 'Replay attempt 001 <span>↗</span>';
  $('#findingsButton').addEventListener('click',science);
  $('#learnChapter').addEventListener('click',()=>start(true));
  $('#examChapter').addEventListener('click',startExam);
  $('#findingConclusion').textContent=`Attempt 001 · Learning gate not passed. The untrained test scored ${run.score}/33, with ${run.abstentions} abstentions. The challenge is still open.`;
  $('#runNote').textContent = 'About 100 seconds at 5× · Recorded simulation';
  $('#startButton').addEventListener('click', () => start(true));
  $('#paperState').textContent = 'PUBLISHED ANATOMY · EXPERIMENTAL DYNAMICS';
  $('#paperNumber').textContent = '001';
  $('#playbackMode').textContent = 'NEURAL PREVIEW';
  $('#progressControl').value = 0; $('#progressLabel').textContent = 'Learning → 33 questions → analysis';
  $('#anatomyLabel').textContent = 'RECORDED MODEL SPIKES · LOOP';
  specimen?.setSignalPlaying(true); activate('observe');
  narrate('THE CHALLENGE','A tiny fly. A very human test.');
  if(specimen)selectView('brain');
}
function traceSVG(values){
  const max=Math.max(...values,1),points=values.map((v,i)=>`${i/(values.length-1||1)*300},${51-v/max*45}`).join(' ');
  return `<svg class="signal-trace" viewBox="0 0 300 58" role="img" aria-label="Recorded neural spikes over time"><path d="M0 52H300" stroke="currentColor" opacity=".15"/><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.8"/><line class="trace-cursor" x1="0" x2="0" y1="3" y2="55" stroke="currentColor" stroke-width="1" opacity=".5"/><circle class="trace-point" cx="0" cy="51" r="3" fill="currentColor"/></svg>`;
}
function trainingMarkup(row,index,reveal){
  const stage=row.phase==='before'?'BASELINE':row.phase==='training'?'LEARNING':'HELD-OUT CHECK';
  const p=row.stimulus;
  return `<div class="question-topline"><span class="paper-overline">${stage} · TRIAL ${String(index+1).padStart(2,'0')} / ${learning.records.length}</span><span class="pill">4 CHOICES</span></div>
  <h2 class="training-title">First, teach it<br>where to look.</h2><p class="training-intro">Before language, a simpler challenge: recognize which quadrant contains light.</p>
  <div class="stimulus-and-answer"><div class="retinal-stimulus" role="img" aria-label="The actual training stimulus is a bright patch in quadrant ${letters[row.target]}"><span>A</span><span>B</span><span>C</span><span>D</span><div class="light-patch" style="left:${(p.cx-p.half_width)*100}%;top:${(p.cy-p.half_height)*100}%;width:${p.half_width*200}%;height:${p.half_height*200}%;opacity:${p.luminance}"></div></div><div class="training-readout"><span class="micro">NEURAL ANSWER</span><strong>${reveal?(row.selected===null?' · ':letters[row.selected]):'…'}</strong><span>${reveal?(row.selected===null?'No answer signal':'Selected '+letters[row.selected]):'Reading stimulus'}</span>${reveal&&row.phase==='training'?`<span class="feedback">Feedback ${row.feedback>0?'+':''}${row.feedback}</span>`:''}</div></div>
  <div class="signal-title"><span>RECORDED NEURAL RESPONSE</span><span>400 ms</span></div>${traceSVG(row.frames.map(f=>f.spikes))}
  <div class="learning-stats"><div><span>Synapses changed</span><strong>${format(row.changed_weights)}</strong></div><div><span>Memory spikes</span><strong>${format(row.kc_spikes)}</strong></div><div><span>Trial result</span><strong>${reveal?(row.correct?'Correct':'Abstained'):'Reading'}</strong></div></div>
  <div class="paper-actions"><button class="secondary-button" id="trainingMethod">Learning method ↗</button><button class="secondary-button next-question" id="skipTraining">Go to the exam →</button></div>`;
}
function updateTraining(){
  const i=Math.min(learning.records.length-1,Math.floor(trainingPosition/trialSeconds)),row=learning.records[i],within=trainingPosition%trialSeconds,reveal=within>trialSeconds*.72;
  if(trainingPosition>=trainingDuration()){mode='exam';position=0;lastIndex=-1;lastFrame=-1;activate('experiment');update();return;}
  $('#playbackMode').textContent='TRAINING REPLAY';
  $('#progressLabel').textContent=`Trial ${i+1} / ${learning.records.length}`;
  if(i!==lastTraining||reveal!==lastTrainingReveal){const newTrial=i!==lastTraining;content.innerHTML=trainingMarkup(row,i,reveal);if(newTrial)$('.paper').scrollTop=0;lastTraining=i;lastTrainingReveal=reveal;lastFrame=-1;
    $('#skipTraining').addEventListener('click',startExam);$('#trainingMethod').addEventListener('click',evidence);
    $('#paperState').textContent=row.phase==='training'?'REWARD FEEDBACK · EXISTING SYNAPSES ONLY':row.phase==='after'?'HELD-OUT STIMULI · FEEDBACK OFF':'BEFORE LEARNING · ORIGINAL WEIGHTS';$('#paperNumber').textContent=String(i+1).padStart(3,'0');
    narrate(row.phase==='before'?'01 / FIRST LIGHT':row.phase==='training'?'01 / LEARNING ATTEMPT':'01 / THE LEARNING CHECK',row.phase==='before'?'Show a patch of light. Watch the visual neurons respond.':row.phase==='training'?'Give feedback. Measure whether existing connections change.':'New stimuli. Feedback off. Does the learning transfer?');}
  const frame=Math.min(19,Math.floor(within/(trialSeconds*.72)*20));
  if(frame!==lastFrame){specimen?.setActivity(row.frames[frame].activity);lastFrame=frame;$('#anatomyLabel').textContent=`MODEL SPIKES · ${row.frames[frame].ms} / 400 ms`;updatePipeline(row.frames[frame]);
    const x=frame/(row.frames.length-1)*300,y=51-row.frames[frame].spikes/Math.max(1,...row.frames.map(f=>f.spikes))*45;
    $('.trace-cursor')?.setAttribute('x1',x);$('.trace-cursor')?.setAttribute('x2',x);$('.trace-point')?.setAttribute('cx',x);$('.trace-point')?.setAttribute('cy',y);}
}
function updatePipeline(frame){
  const values=frame?[(frame.retina_spikes??frame.spikes)>0,(frame.lamina_spikes??frame.spikes)>0,(frame.kc_spikes??0)>0,(frame.answer_spikes??0)>0]:[false,false,false,false];
  document.querySelectorAll('.pathway-node').forEach((el,i)=>{el.classList.toggle('firing',values[i]);el.classList.toggle('silent',i>1&&!values[i]);});
  const counts=frame?[frame.retina_spikes,frame.lamina_spikes,frame.kc_spikes,frame.answer_spikes]:[];
  document.querySelectorAll('.pathway-node span').forEach((el,i)=>{
    el.textContent=frame&&counts[i]!==undefined?`${format(counts[i])} spikes / 20 ms`:['pixel input','neural response','Kenyon cells','A / B / C / D'][i];
  });
}
function questionMarkup(q, reveal) {
  return `<div class="gate-note"><span>LEARNING GATE: ${learning.passed?'PASSED':'FAILED'}</span> Original weights frozen · untrained baseline</div><div class="question-topline"><span class="paper-overline">QUESTION ${String(q.number).padStart(2,'0')} / 33</span><span class="pill">${q.region === 'Berlin' ? 'BERLIN' : 'GERMANY'}</span></div>
    <h2 class="question-title" lang="de">${esc(q.question)}</h2>
    <div class="answers" lang="de">${q.options.map((answer,i) => `<div class="answer ${reveal && q.selected === i ? 'selected' : ''}"><span class="letter">${letters[i]}</span><span>${esc(answer)}</span>${reveal && q.selected === i ? '<span class="answer-mark">←</span>' : ''}</div>`).join('')}</div>
    <div class="outputs" aria-label="Recorded answer population rates">${q.readout_rates_hz.map((v,i) => `<div class="output"><span>${letters[i]} · MBON${11+i}</span><div class="output-track"><div class="output-fill" style="width:${Math.min(100,v/4)}%"></div></div><span>${v.toFixed(1)} Hz</span></div>`).join('')}</div>
    <p class="run-message" role="status">${reveal ? (q.selected === null ? '<strong>Abstained.</strong> No unique positive answer signal.' : `<strong>Selected ${letters[q.selected]}.</strong> Recorded neural output.`) : '<span class="thinking-dot"></span> Reading through retinal input…'} <span id="spikeCount"></span></p>
    <div class="paper-actions"><button class="secondary-button" id="previousQuestion" ${q.number === 1 ? 'disabled' : ''}>← Back</button><button class="secondary-button" id="inputButton">Fly’s view ↗</button><button class="secondary-button next-question" id="nextQuestion">${q.number === 33 ? 'Result' : 'Next'} →</button></div>`;
}
function showQuestion(index, reveal) {
  const q = run.records[index];
  content.innerHTML = questionMarkup(q,reveal);
  if(index!==lastIndex)$('.paper').scrollTop=0;
  $('#paperState').textContent = `CATALOGUE ${q.id} · RECORDED BASELINE`;
  $('#paperNumber').textContent = String(q.number).padStart(3,'0');
  narrate('02 / THE EINBÜRGERUNGSTEST',reveal?(q.selected===null?'The answer populations are silent. Record an abstention.':`The model selected ${letters[q.selected]}. The grader checks it separately.`):'Question pixels enter the retina. The neural model gets no answer key.');
  $('#previousQuestion').addEventListener('click', () => seekQuestion(index - 1));
  $('#nextQuestion').addEventListener('click', () => seekQuestion(index + 1));
  $('#inputButton').addEventListener('click', () => {
    setPlaying(false);
    openDialog(`<div class="paper-overline">THE ACTUAL INPUT / QUESTION ${q.number}</div><h2>Pixels in. Spikes out.</h2><p>This is the exact image supplied to the fixed retinal sampler. The model receives pixel luminance at 3,335 mapped receptor locations. It has no direct access to the words, option labels, question ID or answer key.</p><img class="retinal-image" src="./data/retina/${String(q.number).padStart(2,'0')}.png" alt="The exact German question image used for this neural run"><p>Image SHA-256</p><pre>${esc(q.raster_sha256)}</pre>`);
  });
}
function seekQuestion(index) {
  mode='exam';
  position = Math.max(0,Math.min(33,index)) * secondsPerQuestion;
  started = true; finished = false; lastIndex = -1; lastFrame = -1; update();
}
function result() {
  if (finished) return;
  finished = true; setPlaying(false); activate('evidence');
  mode='analysis';updatePipeline(null);
  selectView('brain');
  narrate('03 / THE FINDING','Visual activity reached the first stages. Learning has not been demonstrated.');
  specimen?.setActivity(null);
  $('#anatomyLabel').textContent = 'MALE CNS · ANATOMICAL VIEW';
  $('#playbackMode').textContent = 'RUN COMPLETE';
  content.innerHTML = `<div class="paper-overline">EXPERIMENT ${esc(run.id)} / VERDICT</div><h2>A small brain.<br>A very human test.</h2><div class="score">${run.score}<span> / 33</span></div><div class="result-chip ${run.passed ? '' : 'failed'}">${run.passed ? 'PRACTICE THRESHOLD REACHED' : 'BASELINE DID NOT PASS'}</div>
  <p class="paper-intro">${run.abstentions === 33 ? '33 questions. 33 abstentions. The visual neurons fired, but the answer neurons stayed silent.' : `${run.score} correct answers, with ${run.abstentions} abstentions. The practice threshold is 17.`}</p>
  <div class="item-list" aria-label="Inspect any question">${run.records.map((q,i) => `<button class="item-dot ${q.correct ? 'good' : 'bad'}" data-question="${i}" aria-label="Inspect question ${i+1}: ${q.correct ? 'correct' : q.selected === null ? 'abstained' : 'incorrect'}">${i+1}</button>`).join('')}</div>
  <p class="warning-note">This is the measured untrained baseline. The basic learning gate failed, so a trained citizenship attempt has not been demonstrated.</p>
  <button class="primary-button" id="resultEvidence">Open the scientific analysis <span>↗</span></button><div class="paper-actions"><button class="secondary-button" id="replayButton">↻ Watch again</button><button class="secondary-button" id="returnObserve">Back to the fly</button></div>`;
  $('#resultEvidence').addEventListener('click', evidence);
  $('#replayButton').addEventListener('click', () => start(true));
  $('#returnObserve').addEventListener('click', observe);
  document.querySelectorAll('[data-question]').forEach(b => b.addEventListener('click', () => { seekQuestion(Number(b.dataset.question)); activate('experiment'); }));
  $('#paperState').textContent = 'MEASURED RESULT · NO PASS CLAIM'; $('#paperNumber').textContent = '033';
  $('.paper').scrollTop=0;
}
function update() {
  if (!run || !started) return;
  $('#progressControl').value = Math.min(100,(mode==='training'?trainingPosition:trainingDuration()+position)/(trainingDuration()+totalSeconds)*100);
  if(mode==='training'){updateTraining();return;}
  const index = Math.min(32,Math.floor(position/secondsPerQuestion));
  $('#progressLabel').textContent = `${String(index+1).padStart(2,'0')} / 33`;
  if (position >= totalSeconds) { result(); return; }
  $('#playbackMode').textContent = 'RECORDED RUN';
  const q = run.records[index], within = position % secondsPerQuestion;
  const reveal = within >= 6.5;
  if (index !== lastIndex || reveal !== lastReveal) { showQuestion(index,reveal); lastIndex=index;lastReveal=reveal;lastFrame=-1; }
  const frame = Math.min(q.frames.length-1,Math.floor(within/6.5*q.frames.length));
  if (frame !== lastFrame) {
    specimen?.setActivity(q.frames[frame].activity); lastFrame=frame;
    updatePipeline(q.frames[frame]);
    const spikes=q.frames.slice(0,frame+1).reduce((n,f)=>n+f.spikes,0);
    $('#spikeCount').textContent = `${format(spikes)} neural spikes.`;
    $('#anatomyLabel').textContent = `MODEL SPIKES · ${q.frames[frame].ms} / 1,000 ms`;
  }
}
function tick(now) {
  const dt=Math.min(.1,(now-previous)/1000);previous=now;
  if (playing && !document.hidden) { if(mode==='training')trainingPosition+=dt*speed;else position=Math.min(totalSeconds,position+dt*speed);update(); }
  else if(mode==='observe'&&run&&specimen&&specimen.isMoving&&!document.hidden){previewPosition+=dt;const f=Math.floor(previewPosition*8)%50;if(f!==lastFrame){lastFrame=f;const frame=run.records[0].frames[f];specimen.setActivity(frame.activity);specimen.setSignalPlaying(true);updatePipeline(frame);}}
  requestAnimationFrame(tick);
}
$('#aboutButton').addEventListener('click', science);
$('#evidenceButton').addEventListener('click', evidence);
$('#closeDialog').addEventListener('click', () => $('#detailsDialog').close());
$('#detailsDialog').addEventListener('click', e => { if (e.target === $('#detailsDialog')) { const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close(); } });
$('#playButton').addEventListener('click', () => { if (!started || finished) start(finished); else setPlaying(!playing); });
$('#speedControl').addEventListener('change', e => { speed=Number(e.target.value); });
$('#progressControl').addEventListener('input', e => { if(!run)return;started=true;finished=false;const time=Number(e.target.value)/100*(trainingDuration()+totalSeconds);if(time<trainingDuration()){mode='training';trainingPosition=time;lastTraining=-1;}else{mode='exam';position=time-trainingDuration();}lastIndex=-1;lastFrame=-1;activate(mode==='training'?'observe':'experiment');update(); });
$('#motionButton').addEventListener('click', () => { const on=specimen?.toggleMotion();$('#motionButton').textContent=on?'Ⅱ':'▶';$('#motionButton').setAttribute('aria-label',on?'Pause specimen animation':'Animate specimen'); });
function selectView(value) {
  specimen?.setView(value);
  document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('selected',v.dataset.view===value));
  $('.specimen').classList.toggle('body-only',value==='fly');$('.specimen').classList.toggle('brain-only',value==='brain');
  $('#visualNote').textContent=value==='both'?'Brain ×4 · head-aligned · illustrative body motion':value==='brain'?'630 skeletons · recorded model activity':'NeuroMechFly · illustrative body motion';
  document.querySelectorAll('[data-camera]').forEach(v=>{v.classList.toggle('selected',v.dataset.camera==='front');v.setAttribute('aria-pressed',v.dataset.camera==='front');});
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',()=>selectView(b.dataset.view)));
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{
  specimen?.setCamera(b.dataset.camera);
  document.querySelectorAll('[data-camera]').forEach(v=>{v.classList.toggle('selected',v===b);v.setAttribute('aria-pressed',v===b);});
}));
document.querySelectorAll('.phase').forEach(b => b.addEventListener('click', () => {
  if(b.dataset.phase==='observe')start(true);else if(b.dataset.phase==='experiment')startExam();else if(run){mode='exam';started=true;position=totalSeconds;finished=false;update();}
}));
$('#startButton').disabled=true;
async function json(url) { const r=await fetch(url);if(!r.ok)throw new Error('Experiment data unavailable');return r.json(); }
const dataPromise=Promise.all(['model','run','learning','calibration','question-provenance'].map(name=>json(`./data/${name}.json`))).then(data=>{
  [model,run,learning,calibration,provenance]=data;
  $('#neuronCount').textContent=format(model.neurons);$('#edgeCount').textContent=(model.edges/1e6).toFixed(1)+'M';
  $('#modelStatus').textContent='Visual gate unmet';
  observe();
}).catch(error=>{
  content.innerHTML='<h2>The experiment could not load.</h2><p class="paper-intro">Check your connection and reload the page to access the recorded run.</p><button class="primary-button" id="retryLoad">Reload experiment ↻</button>';
  $('#retryLoad').addEventListener('click',()=>location.reload());
  $('#modelStatus').textContent='Load unavailable';
});
createSpecimen($('#scene')).then(value=>{specimen=value;lastFrame=-1;$('#motionButton').textContent=value.isMoving?'Ⅱ':'▶';$('#motionButton').setAttribute('aria-label',value.isMoving?'Pause specimen animation':'Animate specimen');if(started)update();else if(mode==='observe')selectView('brain');}).catch(error=>{
  $('#sceneLoading')?.remove();const warning=document.createElement('div');warning.className='scene-error';warning.textContent='The 3D view needs a browser with WebGL support and access to the model assets. You can still watch the recorded questions and inspect the evidence.';$('#scene').appendChild(warning);
});
requestAnimationFrame(tick);
