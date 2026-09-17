import { createSpecimen } from './scene.js';
import { EDITS, CHAPTERS, beats, chapterIndex, captionAt, fillTokens, evidenceValues, storyTimeFor, activityFrame, stageLabel, clamp, smooth } from './timeline.js';

// Deterministic capture route. Shares scene.js and the recorded data with the
// website. The export tool calls FILM.render(outputSeconds) once per frame.

const params = new URLSearchParams(location.search);
const edit = EDITS[params.get('edit') || 'main'] || EDITS.main;
const W = Number(params.get('w')) || edit.width, H = Number(params.get('h')) || edit.height;
const seed = Number(params.get('seed')) || 1;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
document.documentElement.style.setProperty('--w', W + 'px');
document.documentElement.style.setProperty('--h', H + 'px');
document.documentElement.style.setProperty('--u', (Math.min(W, H * 16 / 9) / 1920) + 'px');
document.body.classList.toggle('portrait', H > W);

const json = async u => { const r = await fetch(u); if (!r.ok) throw Error(u); return r.json(); };
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

async function boot() {
  await Promise.all(['58px Anton', '500 22px "IBM Plex Mono"', '400 20px "DM Sans"', '500 20px "DM Sans"', '400 34px "Source Serif 4"'].map(f => document.fonts.load(f, 'Aä0/')));
  await document.fonts.ready;
  const [run, learning, study, control] = await Promise.all(['run.json', 'learning.json', 'study-002/summary.json', 'study-002/plasticity-control.json'].map(f => json('./data/' + f)));
  const values = evidenceValues(run, study, learning);
  const training = control.records.filter(r => r.condition === 'trained' && r.phase === 'training');
  const gateRow = learning.records[learning.records.length - 1];
  const examRow = run.records[5];
  const specimen = await createSpecimen($('#stage'), { capture: true, width: W, height: H, pixelRatio: 1, quality: 'high', reducedMotion: false });
  const exp = study.experiments[0], rep = study.experiments[1];

  const activityAt = t => activityFrame(t, gateRow, examRow);

  const hud = $('#hud');
  let hudKey = '';
  function card(t, closing) {
    if (closing) {
      if (hudKey === 'end') return; hudKey = 'end';
      hud.className = 'hud end show';
      hud.innerHTML = `<p class="logo">FLY<span>.</span></p><h2>Tiny brain.<br>Big paperwork.</h2><p class="cta">Read the evidence. Try the three-question challenge.</p><p class="url">fly-navy.vercel.app</p>`;
    } else if (t >= 8 && t < 22) {
      const block = clamp(Math.floor((t - 8.4) / 7.2 * 8), -1, 7);
      const trial = training[clamp(Math.floor((t - 8) / 14 * training.length), 0, training.length - 1)];
      const results = t >= 15.6;
      const key = `learn-${block}-${trial.stimulus}-${results}`;
      if (key === hudKey) return;
      hudKey = key;
      hud.className = 'hud card learn show';
      hud.innerHTML = `<p class="kicker">Learning control · FLY-002</p>
        <h3>Four directly stimulated neural patterns</h3>
        <div class="dots">${['A', 'B', 'C', 'D'].map((l, i) => `<span class="${i === trial.stimulus && !results ? 'on' : ''}">${l}</span>`).join('')}</div>
        <div class="bars">${exp.training_blocks.map((v, i) => `<i style="height:${i <= block ? v / 16 * 100 : 0}%" class="${i === block ? 'now' : ''}"><b>${i <= block ? v : ''}</b></i>`).join('')}</div>
        <p class="axis"><span>Block 1</span><span>16 training trials per block</span><span>Block 8</span></p>
        ${results ? `<div class="scores"><div><b>${exp.scores.trained}/32</b>trained lab trials</div><div><b>${rep.scores.trained}/32</b>different ensembles</div><div><b>${exp.scores.untrained}/32</b>untrained</div><div><b>${exp.scores.shuffled_labels}/32</b>shuffled labels</div></div>`
          : `<p class="trial">Recorded training trial ${training.indexOf(trial) + 1} of ${training.length}: ${trial.kc_spikes} Kenyon-cell spikes</p>`}
        <p class="warn">Stimulated cells are not in the displayed skeleton sample. Not citizenship questions.</p>`;
    } else if (t >= 22.3 && t < 27) {
      if (hudKey === 'gate') return; hudKey = 'gate';
      hud.className = 'hud card gate show';
      hud.innerHTML = `<p class="kicker">Visual learning gate · FLY-001</p><div class="big">${values.gate}<small>/16</small></div><p>Held-out visual trials correct. ${learning.changed_weights} candidate weights changed.</p><p class="warn">Citizenship training did not start.</p>`;
    } else if (t >= 27.4 && t < 31.6) {
      if (hudKey === 'exam') return; hudKey = 'exam';
      hud.className = 'hud card exam show';
      hud.innerHTML = `<p class="kicker">Separate untrained baseline · question ${examRow.number} of 33</p><h3 lang="de">${esc(examRow.question)}</h3><ol lang="de">${examRow.options.map((o, i) => `<li><span>${'ABCD'[i]}</span>${esc(o)}</li>`).join('')}</ol><p class="warn">Fly: abstained. Answer populations ${examRow.readout_rates_hz.map(x => x.toFixed(1)).join(' / ')} Hz.</p>`;
    } else if (t >= 51.6 && t < 56.2) {
      if (hudKey !== 'boundary') {
        hudKey = 'boundary';
        hud.className = 'hud boundary show';
        hud.innerHTML = `<svg class="leaders" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><line class="lv"/><line class="lc"/><circle class="dv" r="${Math.max(4, W / 320)}"/><circle class="dc" r="${Math.max(4, W / 320)}"/></svg><div class="side visual"><p class="kicker">Visual route</p><h3>Eye, optic lobe, projection</h3><p>Learning gate ${values.gate}/16. Unresolved.</p></div><div class="side direct"><p class="kicker">Central brain</p><h3>Direct stimulation began at Kenyon cells</h3><p>${values.trained}/32 lab trials. Not reading. Stimulated cells not in this sample.</p></div>`;
      }
      // Fixed tags with leader lines to the projected lobes.
      const an = specimen.anchors();
      const link = (tag, line, dot, p) => {
        const r = hud.querySelector(tag).getBoundingClientRect();
        const x = Math.min(.97, Math.max(.03, p[0])) * W, y = Math.min(.97, Math.max(.03, p[1])) * H;
        const ex = x < r.left ? r.left : x > r.right ? r.right : x, ey = y < r.top ? r.top : y > r.bottom ? r.bottom : y;
        const l = hud.querySelector(line), d = hud.querySelector(dot);
        l.setAttribute('x1', ex); l.setAttribute('y1', ey); l.setAttribute('x2', x); l.setAttribute('y2', y);
        d.setAttribute('cx', x); d.setAttribute('cy', y);
      };
      link('.visual', '.lv', '.dv', an.visual);
      link('.direct', '.lc', '.dc', an.central);
    } else if (t >= 57 && t < 63) {
      if (hudKey === 'verdict') return; hudKey = 'verdict';
      hud.className = 'hud card verdict show';
      hud.innerHTML = `<p class="kicker">Untrained practice exam · FLY-001</p><div class="big">${values.score}<small>/33</small></div><p>${values.abstentions} abstentions. No citizenship pass.</p><div class="rows"><div><span>Direct neural learning control</span><b>${values.trained}/32</b></div><div><span>Visual learning gate</span><b>${values.gate}/16</b></div><div><span>Untrained exam baseline</span><b>${values.score}/33</b></div></div>`;
    } else if (t >= 65) {
      if (hudKey === 'end') return; hudKey = 'end';
      hud.className = 'hud end show';
      hud.innerHTML = `<p class="logo">FLY<span>.</span></p><h2>Tiny brain.<br>Big paperwork.</h2><p class="cta">Read the evidence. Try the three-question challenge.</p><p class="url">fly-navy.vercel.app</p>`;
    } else if (hudKey !== '') { hudKey = ''; hud.className = 'hud'; hud.innerHTML = ''; }
  }

  function overlay(tOut, t) {
    const ch = chapterIndex(t);
    $('#chapter').textContent = `${String(ch + 1).padStart(2, '0')} · ${CHAPTERS[ch].label}`;
    $('#label').textContent = stageLabel(t);
    $('#label').closest('.bottom').classList.toggle('fiction', t >= 31.6 && t < 56);
    const cap = captionAt(edit.captions, tOut);
    const box = $('#caption');
    if (cap) {
      const html = `<p class="line">${esc(fillTokens(cap.text, values))}</p>${cap.note ? `<p class="note">${esc(fillTokens(cap.note, values))}</p>` : ''}`;
      if (box.dataset.key !== cap.text) { box.innerHTML = html; box.dataset.key = cap.text; box.className = 'caption ' + (cap.style || ''); }
      const a = smooth(cap.start, cap.start + .25, tOut) * (1 - smooth(cap.end - .25, cap.end, tOut));
      box.style.opacity = a.toFixed(3);
      box.style.transform = `translate(-50%, ${((1 - a) * 12).toFixed(2)}px)`;
    } else box.style.opacity = '0';
    card(t, edit !== EDITS.main && tOut >= edit.duration - 1.6);
    const b = beats(t);
    document.body.classList.toggle('stamped', b.stamp > .5);
    $('#flash').style.opacity = (Math.max(0, 1 - Math.abs(t - 64.98) / .12) * .35).toFixed(3);
  }

  window.FILM = {
    edit: { name: params.get('edit') || 'main', duration: edit.duration, width: W, height: H },
    values,
    async render(tOut) {
      const t = storyTimeFor(edit, tOut);
      specimen.setActivity(activityAt(t));
      specimen.renderAt(t, seed);
      overlay(tOut, t);
      await nextFrame();
      return { story: t, probe: params.has('probe') ? specimen.probe() : undefined };
    },
    probe(t) { specimen.setTime(t, seed); return specimen.probe(); }
  };
  document.body.dataset.ready = '1';
  const start = Number(params.get('t'));
  if (params.has('t')) await window.FILM.render(start);
}
boot().catch(e => { document.body.dataset.error = e.message; console.error(e); });
