import { createSpecimen } from './scene.js';
import { DURATION, CHAPTERS, MAIN_CAPTIONS, chapterIndex, captionAt, fillTokens, evidenceValues, activityFrame, stageLabel } from './timeline.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const letters = ['A', 'B', 'C', 'D'];
const quizIndices = [5, 3, 14];
const panel = $('#storyPanel');
const homeHTML = panel.innerHTML;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => matchMedia('(max-width: 760px)').matches;
const formatTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TOTAL = formatTime(DURATION);

let specimen, run, learning, study, control, values, gateRow, examRow, trainingRows = [], ready = false;
let screen = 'home', position = 0, playing = false, speed = 1, last = performance.now();
let stageKey = '', activityKey = '', captionKey = null, idleTime = 0, lastThought = -1, baseMood = 'confident', pokeUntil = 0, pokes = 0;
let quizIndex = 0, answers = [], quizScore = 0, soundOn = false, audioCtx, buzz, volume;
const thoughts = ['Is there a banana option?', 'How hard can 33 questions be?', 'I have never paid a tax.', 'I brought six pens. All legs.', 'Do they accept a fruit passport?'];
const selectedQuestions = () => quizIndices.map(i => run.records[i]);
const flyQuizScore = () => selectedQuestions().filter(q => q.correct).length;
const soundtrack = $('#soundtrack');

// ------------------------------------------------------------ helpers
function say(text) {
  const t = $('#thoughtText');
  if (t.textContent === text) return;
  t.textContent = text;
  $('#thought').classList.remove('bump'); void $('#thought').offsetWidth; $('#thought').classList.add('bump');
}
function mood(value) {
  baseMood = value;
  if (performance.now() > pokeUntil) specimen?.setMood(value);
}
function headline(main, sub) {
  const key = main + sub;
  if ($('#stageHeadline').dataset.key === key) return;
  $('#stageHeadline').dataset.key = key;
  $('#stageHeadline').innerHTML = main;
  $('#stageSubline').textContent = sub;
}
function page(html, key) {
  if (stageKey === key) return false;
  stageKey = key; panel.innerHTML = html;
  panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter');
  if (!phone()) $('#document').scrollTop = 0;
  return true;
}
function setPlaying(value) {
  playing = value;
  $('#playIcon').setAttribute('d', value ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
  $('#play').setAttribute('aria-label', value ? 'Pause story' : 'Play story');
  syncSoundtrack(true);
}
function focusPanel() {
  if (phone()) $('#document').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
}
function setActivity(frame, key) {
  if (key === activityKey) return;
  activityKey = key;
  specimen?.setActivity(frame);
}
function qualifier(fiction) {
  const q = $('#qualifier');
  q.classList.toggle('fiction', fiction);
  q.innerHTML = fiction ? 'Scripted satire<br>Not measured neural activity' : 'Scripted satire<br>+ recorded study results';
}
function signal(text, fiction) {
  $('#signalLabel').textContent = text;
  $('#signalLabel').parentElement.classList.toggle('fiction', Boolean(fiction));
}
function caption(t) {
  const box = $('#stageCaption');
  const c = screen === 'story' ? captionAt(MAIN_CAPTIONS, t) : null;
  const key = c ? c.text : '';
  if (key === captionKey) return;
  captionKey = key;
  box.innerHTML = c ? `<p class="line">${esc(fillTokens(c.text, values))}</p>${c.note ? `<p class="note">${esc(fillTokens(c.note, values))}</p>` : ''}` : '';
}

// -------------------------------------------------------------- marks
const marks = $('#marks');
marks.innerHTML = CHAPTERS.map((c, i) => `<li class="${c.id === 'reading' ? 'm-before' : c.id === 'paperwork' ? 'm-after' : ''}" style="left:${c.start / DURATION * 100}%"><button data-seek="${c.start}" aria-label="Chapter ${i + 1}: ${c.label}"><span>${c.label}</span></button></li>`).join('');
function updateTimeline(t) {
  const ch = chapterIndex(t);
  marks.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === ch));
  $('#progress').style.width = `${t / DURATION * 100}%`;
  $('#scrub').value = t;
  $('#scrub').setAttribute('aria-valuetext', `${formatTime(t)}, ${CHAPTERS[ch].label}`);
  $('#time').textContent = `${formatTime(t)} / ${TOTAL}`;
  $('#pageNumber').textContent = `0${ch + 1} / 05`;
  return ch;
}

// --------------------------------------------------------------- home
function home() {
  specimen?.setStoryTime(null);
  document.body.classList.remove('active-experiment');
  screen = 'home'; position = 0; stageKey = ''; activityKey = ''; captionKey = null; setPlaying(false);
  panel.innerHTML = homeHTML;
  $('#startStory').disabled = !ready; $('#startQuiz').disabled = !ready;
  $('#startStory').onclick = () => startStory(); $('#startQuiz').onclick = () => startQuiz();
  updateTimeline(0); caption(0);
  headline('Six legs.<br>Zero documents.', 'Unreasonable confidence.');
  qualifier(false);
  $('#thought').classList.remove('hidden');
  mood('confident'); say(thoughts[0]);
}
function startStory(at = 0) {
  if (!ready) return;
  document.body.classList.add('active-experiment');
  screen = 'story'; position = at; stageKey = ''; activityKey = ''; captionKey = null;
  setPlaying(true); renderStory(); focusPanel();
}

// -------------------------------------------------------------- story
function storyQuestion(q, reveal, order) {
  return `<p class="eyebrow">04 / The paperwork · excerpt ${order + 1} of 3</p><h2 class="section-title">German bureaucracy has entered the chat.</h2><p class="fine">Separate FLY-001 untrained baseline. These are not the trained control’s answers.</p>
  <h3 class="paper-question" lang="de">${esc(q.question)}</h3><div class="choices" lang="de">${q.options.map((s, i) => `<div class="choice ${reveal && q.correct_option === i ? 'correct' : ''}"><span>${letters[i]}</span><span>${esc(s)}</span></div>`).join('')}</div>
  <p class="answer-status">${reveal ? 'Fly: abstained. <span>Correct answer highlighted by the separate grader.</span>' : 'Question pixels in. Waiting for an answer…'}</p><p class="receipt">Catalogue ${esc(q.id)} · Frozen original weights<br>Answer populations: ${q.readout_rates_hz.map(x => x.toFixed(1)).join(' / ')} Hz</p>`;
}
function renderStory() {
  const t = position;
  specimen?.setStoryTime(t);
  const ch = updateTimeline(t);
  caption(t);
  const fiction = t >= 31.6 && t < 56;
  qualifier(fiction);
  signal(stageLabel(t), fiction);
  const frame = activityFrame(t, gateRow, examRow);
  setActivity(frame, frame ? `${t < 27 ? 'g' : 'e'}${Math.floor(t * 10)}` : 'none');
  $('#thought').classList.toggle('hidden', t >= 40 && t < 56);
  if (ch === 0) {
    headline('Six legs.<br>Zero documents.', 'Unreasonable confidence.');
    page(`<p class="eyebrow">01 / The applicant</p><h2 class="section-title">Six legs. Zero documents. Unreasonable confidence.</h2><p class="caption">The plan: train a fly-brain model to pass Germany’s citizenship test before its human.</p><div class="rules"><span><b>33</b>questions</span><span><b>17</b>to pass</span><span><b>60</b>minutes</span></div><div class="stamp">Challenge accepted?</div><p class="fine">The fly’s thoughts are fictional. The model measurements are recorded.</p>`, 'arrival');
    mood('confident'); say(t < 4 ? 'I have a brain. I qualify.' : 'How do I spell Einbürgerung?');
  } else if (ch === 1) {
    const exp = study.experiments[0], block = Math.min(7, Math.floor((t - 8) / 14 * 8));
    headline('It learned<br>something.', 'Four neural patterns. Direct stimulation.');
    const changed = page(`<p class="eyebrow">02 / The learning control · FLY-002</p><h2 class="section-title">It actually learned something.</h2><p class="caption">Four neural patterns. Direct stimulation. 128 training presentations.</p><div class="study-chart" aria-label="Recorded correct answers per block of 16 training trials">${exp.training_blocks.map((v, i) => `<div class="study-bar" data-block="${i}" style="height:0"><span></span></div>`).join('')}</div><div class="study-ticks"><span>Block 1</span><span>16 trials per block</span><span>Block 8</span></div><div class="signal-dots" aria-label="Four stimulation groups">${letters.map(l => `<span>${l}</span>`).join('')}</div><div class="study-metrics"><div><b>${exp.scores.trained}/${exp.trials_per_condition}</b>trained lab trials</div><div><b>${study.experiments[1].scores.trained}/32</b>different ensembles</div><div><b>${exp.changed_connections}</b>connections changed</div><div><b>${exp.scores.untrained}/32</b>untrained control</div></div><p class="warning">These are directly stimulated neural patterns. They are not citizenship questions. The stimulated cells are not in the displayed skeleton sample.</p>`, 'learning');
    void changed;
    document.querySelectorAll('[data-block]').forEach((el, i) => { el.style.height = i <= block ? exp.training_blocks[i] / 16 * 100 + '%' : '0'; el.classList.toggle('active', i === block); el.firstElementChild.textContent = i <= block ? exp.training_blocks[i] : ''; });
    const trialIndex = Math.min(trainingRows.length - 1, Math.floor((t - 8) / 14 * trainingRows.length));
    const trial = trainingRows[trialIndex];
    document.querySelectorAll('.signal-dots span').forEach((el, i) => el.classList.toggle('active', i === trial.stimulus));
    signal(`Control trial ${trialIndex + 1}: ${trial.kc_spikes} Kenyon-cell spikes · not shown spatially`);
    mood(block < 4 ? 'studying' : 'celebrate'); say(block < 3 ? 'I am basically a professor.' : block < 6 ? 'Four patterns. This is going well.' : 'Surely German is just pattern five.');
  } else if (ch === 2) {
    headline('Reading?<br>Problem.', `Visual learning gate: ${values.gate}/16.`);
    page(`<p class="eyebrow">03 / A small administrative detail</p><h2 class="section-title">Patterns? Yes. Reading? We have a problem.</h2><p class="caption">Direct stimulation bypassed vision. The visual learning gate still failed.</p><div class="stamp">${values.gate} / 16</div><p class="caption">Held-out visual trials correct. The answer neurons stayed silent.</p><p class="warning">That blocks a trained citizenship attempt. Next comes the separate untrained baseline.</p><a href="attempt.html" class="quiet-link">Inspect the original visual trials</a>`, 'catch');
    mood('confused'); say(t < 24.5 ? 'Wait. The questions are written?' : 'Can you ask them as fruit?');
  } else if (ch === 3) {
    headline('German<br>paperwork.', t < 31.6 ? 'Separate untrained baseline.' : 'Fictional storm. Recorded abstentions.');
    if (t < 32) {
      page(`<p class="eyebrow">04 / The paperwork</p><h2 class="section-title">German bureaucracy has entered the chat.</h2><p class="caption">Next: three excerpts from the separate untrained citizenship baseline, FLY-001. The storm around the fly is authored satire.</p><p class="warning">The trained learning control never saw these questions.</p>`, 'paper-intro');
      mood('confused'); say('That is a lot of forms.');
    } else {
      const order = Math.min(2, Math.floor((t - 32) / 8)), within = (t - 32) % 8, reveal = within >= 5;
      page(storyQuestion(selectedQuestions()[order], reveal, order), `exam-${order}-${reveal}`);
      mood('panic');
      const comments = [['EU? Extremely Unripe?', 'I would like to phone a banana.'], ['Is marriage a kind of swarm?', 'I did not bring my birth certificate.'], ['I know the bins.', 'My district is Kitchen.']];
      say(comments[order][Number(reveal)]);
    }
  } else {
    headline('Form<br>BZZ-27.', `Untrained exam: ${values.score}/33.`);
    if (page(`<p class="eyebrow">05 / The measured baseline</p><h2 class="section-title">Please come back with form BZZ-27.</h2><div class="score-big">${run.score}<small> / 33</small></div><div class="stamp">Wiedervorlage</div><p class="caption">${run.abstentions} abstentions. This model did not pass the citizenship challenge.</p><div class="breakdown"><div><span>Direct neural learning control</span><b>${study.experiments[0].scores.trained}/32</b></div><div><span>Visual learning gate</span><b>${values.gate}/16</b></div><div><span>Untrained exam baseline</span><b>${run.score}/33</b></div></div><p class="fine">The satire is the applicant. The finding is a working direct-stimulation control with an unresolved visual route.</p><button class="primary" id="verdictQuiz">Think you can do better?</button><button class="secondary" id="verdictShare">Share the experiment</button><a class="secondary" href="lab.html">Inspect the real training</a>`, 'verdict')) {
      $('#verdictQuiz').onclick = () => startQuiz(); $('#verdictShare').onclick = () => openShare();
    }
    mood(t < 60 ? 'panic' : 'tired'); say(t < 61 ? 'I demand to speak to the banana.' : 'At least I did not pay the fee.');
  }
  if (t >= DURATION) setPlaying(false);
}

// --------------------------------------------------------------- quiz
function startQuiz() {
  if (!ready) return;
  specimen?.setStoryTime(null);
  document.body.classList.add('active-experiment');
  setPlaying(false); screen = 'quiz'; quizIndex = 0; answers = []; quizScore = 0; stageKey = ''; captionKey = null;
  caption(0); renderQuiz(); focusPanel();
}
function renderQuiz() {
  const q = selectedQuestions()[quizIndex], answered = answers[quizIndex] !== undefined;
  headline('Your turn,<br>big brain.', 'Three real catalogue questions.');
  qualifier(false);
  $('#thought').classList.remove('hidden');
  $('#pageNumber').textContent = `0${quizIndex + 1} / 03`;
  panel.innerHTML = `<p class="eyebrow">You vs. the fly · ${quizIndex + 1} of 3</p><h2 class="section-title">Your turn, big brain.</h2><div class="contest-score"><span>You <b>${quizScore}</b></span><span>Fly <b>${selectedQuestions().slice(0, quizIndex + (answered ? 1 : 0)).filter(r => r.correct).length}</b></span></div><h3 class="paper-question" lang="de">${esc(q.question)}</h3><div class="choices" lang="de">${q.options.map((s, i) => `<button class="choice ${answered && i === q.correct_option ? 'correct' : ''} ${answered && i === answers[quizIndex] && i !== q.correct_option ? 'wrong' : ''}" data-answer="${i}" ${answered ? 'disabled' : ''}><span>${letters[i]}</span><span>${esc(s)}</span></button>`).join('')}</div><p class="answer-status" role="status">${answered ? (answers[quizIndex] === q.correct_option ? 'Correct. The fly is filing a complaint.' : 'Not this one. Green shows the correct answer.') : 'Choose your answer.'}</p>${answered ? `<button class="primary" id="nextQuiz">${quizIndex === 2 ? 'Issue my extremely unofficial result' : 'Next question'}</button>` : ''}<p class="fine">Three text-only catalogue questions. Fly choices are replayed from the untrained FLY-001 run. This mini challenge is not the official exam. <a href="data/question-provenance.json">Question provenance</a></p><button class="secondary" id="quitQuiz">Back to the story</button>`;
  if (!phone()) $('#document').scrollTop = 0;
  document.querySelectorAll('[data-answer]').forEach(b => b.onclick = () => {
    if (answers[quizIndex] !== undefined) return;
    const chosen = Number(b.dataset.answer); answers[quizIndex] = chosen;
    const correct = chosen === q.correct_option; if (correct) quizScore++;
    renderQuiz(); mood(correct ? 'panic' : 'confident'); say(correct ? 'That was clearly an easy question.' : 'The committee notes your answer.'); tone(correct ? 660 : 180, .12);
  });
  $('#quitQuiz').onclick = home;
  if (answered) { $('#nextQuiz').onclick = () => { if (quizIndex === 2) quizResult(); else { quizIndex++; renderQuiz(); } }; $('#nextQuiz').focus({ preventScroll: true }); }
  else { mood('studying'); say(['Please do not embarrass me.', 'I have never had a wedding.', 'I live in the kitchen. Does that count?'][quizIndex]); $('[data-answer]')?.focus({ preventScroll: true }); }
  signal('Same recorded baseline · no new model inference');
}
function quizResult() {
  screen = 'quiz-result'; setPlaying(false); setActivity(null, 'none');
  const fly = flyQuizScore(), won = quizScore > fly;
  panel.innerHTML = `<p class="eyebrow">Extremely unofficial result</p><h2 class="section-title">${won ? 'Humanity is safe. For now.' : 'The fly requests a rematch.'}</h2><div class="score-big">${quizScore}<small> / 3</small></div><div class="stamp">${won ? 'Bigger brain confirmed*' : 'Shared confusion'}</div><p class="caption">You: ${quizScore}/3. Recorded fly baseline: ${fly}/3.${won ? ' The applicant disputes these findings.' : ' The paperwork wins this round.'}</p><p class="fine">*A joke, not an intelligence measurement. Three practice questions cannot establish an official pass. The full untrained model run was ${run.score}/33.</p><button class="primary" id="shareQuiz">Share my result</button><button class="secondary" id="againQuiz">Try the same three questions again</button><button class="secondary" id="quizHome">Back to the fly</button><a class="secondary" href="lab.html">What did the model actually learn?</a>`;
  $('#shareQuiz').onclick = () => openShare(); $('#againQuiz').onclick = startQuiz; $('#quizHome').onclick = home;
  if (!phone()) $('#document').scrollTop = 0;
  $('#pageNumber').textContent = 'Result'; signal('Anatomical view · no active trial');
  mood(won ? 'tired' : 'celebrate'); say(won ? 'I am more of a practical learner.' : 'A draw. Basically a doctorate.');
}

// -------------------------------------------------------------- sound
function tone(frequency, length = .1) {
  if (!soundOn || !audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = frequency; g.gain.setValueAtTime(.05, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + length);
  o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + length);
}
function syncSoundtrack(force) {
  if (!soundOn || screen !== 'story') { if (!soundtrack.paused) soundtrack.pause(); return; }
  soundtrack.playbackRate = speed;
  if (!playing) { if (!soundtrack.paused) soundtrack.pause(); return; }
  if (force || Math.abs(soundtrack.currentTime - position) > .25) soundtrack.currentTime = Math.min(position, DURATION - .05);
  if (soundtrack.paused) soundtrack.play().catch(() => {});
}
async function toggleSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  try {
    if (Ctx && !audioCtx) {
      audioCtx = new Ctx(); buzz = audioCtx.createOscillator(); volume = audioCtx.createGain();
      buzz.type = 'sawtooth'; buzz.frequency.value = 170; volume.gain.value = 0;
      const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
      buzz.connect(filter).connect(volume).connect(audioCtx.destination); buzz.start();
    }
    await audioCtx?.resume();
    soundOn = !soundOn;
    $('#sound').textContent = soundOn ? 'Sound on' : 'Sound off';
    $('#sound').setAttribute('aria-pressed', String(soundOn));
    if (soundOn) soundtrack.preload = 'auto';
    syncSoundtrack(true);
  } catch { $('#sound').textContent = 'Audio unavailable'; soundOn = false; }
}

// -------------------------------------------------------------- share
function openShare() {
  setPlaying(false);
  const link = location.origin + location.pathname;
  const draft = screen === 'quiz-result'
    ? `I scored ${quizScore}/3 against a fly-brain model’s recorded ${flyQuizScore()}/3. Humanity remains cautiously optimistic.\n\nA satirical mini quiz with real experiment records. Not an official citizenship test.\n${link}`
    : `Can a fly-brain model pass Germany’s citizenship test before me?\n\nIt learned 4 directly stimulated neural patterns. Reading was the problem. The separate untrained exam baseline scored ${run.score}/33.\n\nTiny brain. Big paperwork.\n${link}`;
  $('#shareText').value = draft; $('#shareStatus').textContent = ''; $('#shareDialog').showModal();
}
async function copyShare() {
  try {
    await Promise.race([navigator.clipboard.writeText($('#shareText').value), new Promise((_, reject) => setTimeout(() => reject(Error('Timeout')), 1500))]);
    $('#shareStatus').textContent = 'Copied. Attach your card or the film.';
  } catch { $('#shareText').focus(); $('#shareText').select(); $('#shareStatus').textContent = 'Post selected. Use Copy on your device.'; }
}
function downloadCard() {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 675; const c = canvas.getContext('2d');
  const quiz = screen === 'quiz-result';
  c.fillStyle = '#090c0d'; c.fillRect(0, 0, 1200, 675);
  c.fillStyle = '#e3fc02'; c.font = '56px Anton, Impact, sans-serif'; c.fillText('FLY.', 60, 96);
  c.fillStyle = '#f0eee4'; c.font = '500 18px "IBM Plex Mono", monospace'; c.fillText('TINY BRAIN. BIG PAPERWORK.', 820, 90);
  c.font = '84px Anton, Impact, sans-serif';
  (quiz ? (quizScore > flyQuizScore() ? ['HUMANITY IS SAFE.', 'FOR NOW.'] : ['SHARED CONFUSION.', 'PAPERWORK WINS.']) : ['SIX LEGS.', 'ZERO DOCUMENTS.']).forEach((l, i) => c.fillText(l, 60, 220 + i * 92));
  c.fillStyle = '#e3fc02'; c.font = '150px Anton, Impact, sans-serif'; c.fillText(quiz ? `${quizScore}/3` : `${run.score}/33`, 60, 500);
  c.fillStyle = '#f0eee4'; c.font = '26px "DM Sans", sans-serif'; c.fillText(quiz ? `You vs. recorded fly baseline: ${flyQuizScore()}/3` : 'Recorded untrained citizenship baseline', 420, 470);
  c.fillStyle = '#a9b3ae'; c.font = '22px "DM Sans", sans-serif';
  c.fillText('Learned four directly stimulated patterns. Visual learning unresolved.', 60, 560);
  c.fillText('Independent model experiment. Scripted satire. No official exam pass.', 60, 594);
  c.fillStyle = '#e3fc02'; c.font = '500 22px "IBM Plex Mono", monospace'; c.fillText(location.host, 60, 640);
  canvas.toBlob(blob => {
    if (!blob) { $('#shareStatus').textContent = 'Could not create the card. The post text is available above.'; return; }
    const a = document.createElement('a'); a.download = 'FLY-paperwork-result.png'; a.href = URL.createObjectURL(blob); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); $('#shareStatus').textContent = 'Card download requested.';
  }, 'image/png');
}

// --------------------------------------------------------------- loop
function tick(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!document.hidden) {
    if (ready && screen === 'story' && playing) { position = Math.min(DURATION, position + dt * speed); renderStory(); syncSoundtrack(false); }
    else if (ready && (screen === 'home' || screen === 'quiz') && specimen?.isMoving) {
      idleTime += dt;
      const q = screen === 'home' ? run.records[quizIndices[0]] : selectedQuestions()[quizIndex];
      const i = Math.min(q.frames.length - 1, Math.floor((idleTime % 5) / 5 * q.frames.length));
      setActivity(q.frames[i].activity, `${q.id}-${i}`);
      if (screen === 'home') {
        signal('Recorded FLY-001 baseline spikes · loop');
        const k = Math.floor(idleTime / 6) % thoughts.length;
        if (k !== lastThought && now > pokeUntil) { say(thoughts[k]); lastThought = k; }
      }
    }
    if (pokeUntil && now > pokeUntil) { pokeUntil = 0; specimen?.setMood(baseMood); }
    if (audioCtx && volume) {
      const idleBuzz = soundOn && screen !== 'story' && specimen?.isMoving;
      buzz.frequency.setTargetAtTime((baseMood === 'panic' ? 250 : 170) + Math.sin(now * .014) * 22, audioCtx.currentTime, .05);
      volume.gain.setTargetAtTime(idleBuzz ? .01 : 0, audioCtx.currentTime, .05);
    }
  }
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------- wiring
$('#poke').onclick = () => { if (!specimen) return; pokes++; pokeUntil = performance.now() + 2100; specimen.react(); say(['I am trying to become a citizen.', 'Please respect office hours.', 'That is not a valid document.', 'Six legs. Zero personal space.', 'I am calling insect resources.'][pokes % 5]); tone(330, .17); };
$('#motion').onclick = () => { if (!specimen) return; const on = specimen.toggleMotion(); $('#motion').textContent = on ? 'Pause' : 'Move'; $('#motion').setAttribute('aria-label', on ? 'Pause fly animation' : 'Resume fly animation'); };
$('#sound').onclick = toggleSound;
$('#play').onclick = () => { if (!ready) return; if (screen !== 'story' || position >= DURATION) startStory(); else setPlaying(!playing); };
$('#speed').onchange = e => { speed = Number(e.target.value); syncSoundtrack(true); };
$('#scrub').oninput = e => { if (!ready) return; if (screen !== 'story') { document.body.classList.add('active-experiment'); screen = 'story'; setPlaying(false); } position = Number(e.target.value); stageKey = ''; renderStory(); syncSoundtrack(true); };
marks.addEventListener('click', e => { const b = e.target.closest('[data-seek]'); if (b) startStory(Number(b.dataset.seek)); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { specimen?.setView(b.dataset.view); document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el === b))); });
$('#navExperiment').onclick = e => { e.preventDefault(); home(); $('#experience').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' }); };
$('#navQuiz').onclick = e => { e.preventDefault(); startQuiz(); };
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON|A|VIDEO/.test(document.activeElement.tagName) && !$('#shareDialog').open) { e.preventDefault(); $('#play').click(); }
});
$('#share').onclick = openShare; $('#closeShare').onclick = () => $('#shareDialog').close(); $('#copyShare').onclick = copyShare; $('#downloadCard').onclick = downloadCard;
document.addEventListener('visibilitychange', () => { if (document.hidden && !soundtrack.paused) soundtrack.pause(); else syncSoundtrack(true); });

const json = async url => { const r = await fetch(url); if (!r.ok) throw Error('Data unavailable'); return r.json(); };
Promise.all(['run.json', 'learning.json', 'study-002/summary.json', 'study-002/plasticity-control.json'].map(f => json('./data/' + f))).then(data => {
  [run, learning, study, control] = data;
  values = evidenceValues(run, study, learning);
  trainingRows = control.records.filter(r => r.condition === 'trained' && r.phase === 'training');
  gateRow = learning.records[learning.records.length - 1];
  examRow = run.records[5];
  $('#rTrained').textContent = `${values.trained}/32`; $('#rRep').textContent = `${values.replication}/32`;
  $('#rGate').textContent = `${values.gate}/16`; $('#rExam').textContent = `${values.score}/33`;
  ready = true; $('#play').disabled = false; $('#scrub').disabled = false; home();
  const deep = location.hash.match(/^#t=(\d+(?:\.\d+)?)$/);
  if (deep) { startStory(Math.min(DURATION, Number(deep[1]))); setPlaying(false); }
}).catch(() => { panel.innerHTML = '<h2 class="section-title">The files are on a coffee break.</h2><p class="caption">The recorded evidence could not load. Reload to try again.</p><button class="primary" id="retry">Reload the experiment</button>'; $('#retry').onclick = () => location.reload(); });

createSpecimen($('#scene'), { viewShift: () => phone() ? [0, .06] : [.11, .02] }).then(s => {
  specimen = s; s.setView('both'); s.setMood(baseMood); s.setStoryTime(screen === 'story' ? position : null);
  $('#motion').textContent = s.isMoving ? 'Pause' : 'Move';
  activityKey = '';
  document.body.dataset.renderer = s.rendererType;
}).catch(() => {
  $('#sceneLoading')?.remove();
  const img = document.createElement('img'); img.className = 'scene-fallback'; img.src = 'media/FLY-poster.jpg'; img.alt = 'Still frame from the FLY film: the fly on its form under the enlarged neural anatomy.';
  const note = document.createElement('p'); note.className = 'scene-error'; note.textContent = 'The 3D fly could not load on this device. The story, film and quiz remain available.';
  $('#scene').append(img, note);
  document.body.dataset.renderer = 'none';
});
requestAnimationFrame(tick);
