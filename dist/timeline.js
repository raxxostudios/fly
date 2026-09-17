// Shared, pure story timeline. Every function here depends only on its
// arguments, so the website, the capture route and the caption exporter
// produce identical beats for the same story time.

export const DURATION = 68;
export const FPS = 30;

export const CHAPTERS = [
  { id: 'arrival', label: 'Arrival', title: 'The applicant', start: 0 },
  { id: 'learning', label: 'Learning', title: 'The learning control', start: 8 },
  { id: 'reading', label: 'Reading', title: 'The catch', start: 22 },
  { id: 'paperwork', label: 'Paperwork', title: 'The paperwork', start: 27 },
  { id: 'verdict', label: 'Verdict', title: 'The verdict', start: 56 }
];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const smoother = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
export const pulse = (a, b, t) => smooth(a, a + (b - a) * .35, t) * (1 - smooth(a + (b - a) * .35, b, t));
export const window01 = (a, b, fade, t) => smooth(a, a + fade, t) * (1 - smooth(b - fade, b, t));

// Deterministic hash noise in [0, 1). Seeded, history free.
export function hash(i, seed = 1) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Smooth 1D value noise in [-1, 1], used for tremor and drift.
export function noise1(x, seed = 1) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}

export function chapterIndex(t) {
  let index = 0;
  CHAPTERS.forEach((c, i) => { if (t >= c.start) index = i; });
  return index;
}

// Named envelopes for the authored performance. All values are 0..1.
export function beats(t) {
  return {
    flight: 1 - smooth(1.0, 1.25, t),
    landing: smooth(0.9, 1.2, t),
    reveal: smoother(4, 8, t) * (1 - smooth(8, 10, t)),
    groom: window01(8.6, 15.6, 1.1, t),
    celebrate: window01(17.2, 21.6, .8, t),
    stare: window01(22.2, 27, .6, t),
    confused: window01(24.4, 27.4, .7, t),
    stack: smooth(27, 31.8, t) * (1 - smooth(56.5, 62, t)),
    brace: smooth(29.5, 32, t) * (1 - smooth(57, 60.5, t)),
    storm: smooth(31.6, 34.5, t) * (1 - smooth(55.5, 61.5, t)),
    panic: window01(32, 40.5, 1, t),
    shell: window01(38.6, 58.2, 1.2, t),
    open: smoother(40.4, 43.2, t) * (1 - smoother(56.2, 58.8, t)),
    burst: smoother(40.8, 46.5, t) * (1 - smoother(55.6, 60.5, t)),
    stunned: window01(40.6, 56.4, .6, t),
    dive: smoother(48, 55.2, t) * (1 - smoother(55.6, 58.6, t)),
    boundary: window01(51.8, 56.4, .8, t),
    settle: smooth(56, 62.5, t),
    tired: smooth(57.5, 60, t),
    verdict: smooth(56.4, 57.4, t),
    form: smoother(63, 64.6, t),
    stamp: smooth(64.9, 65.05, t),
    cta: smooth(65.4, 66.2, t)
  };
}

// Which recorded model data may light the displayed skeletons at time t.
// Returns null when the neural view must show anatomy only.
export function activitySource(t) {
  if (t >= 22 && t < 27) return { kind: 'visual-gate', label: 'Recorded model spikes · FLY-001 visual gate', loop: 5 };
  if (t >= 27 && t < 31.6) return { kind: 'exam', label: 'Recorded model spikes · FLY-001 untrained exam', loop: 4.6 };
  return null;
}

// Recorded frame for the displayed skeletons, or null for anatomy only.
export function activityFrame(t, gateRow, examRow) {
  const src = activitySource(t);
  if (!src) return null;
  const row = src.kind === 'visual-gate' ? gateRow : examRow;
  const start = src.kind === 'visual-gate' ? 22 : 27;
  const i = Math.min(row.frames.length - 1, Math.floor(((t - start) % src.loop) / src.loop * row.frames.length));
  return row.frames[i].activity;
}

export function stageLabel(t) {
  if (t < 8) return 'Anatomy only · 630 of 166,700 neurons displayed, brain enlarged 4×';
  if (t < 22) return 'Direct stimulation · stimulated cells are not in the displayed sample';
  if (t < 31.6) return activitySource(t).label;
  if (t < 56) return 'Fictional VFX · not recorded neural activity';
  return 'Anatomy only · no active trial';
}

// Caption copy is sourced from the reviewed story, share pack and article.
// Tokens in braces are filled from the recorded JSON at runtime.
export const MAIN_CAPTIONS = [
  { start: 0.4, end: 4, text: 'Six legs. Zero documents.', style: 'title' },
  { start: 4.2, end: 8, text: 'Could a fly-brain model pass Germany’s citizenship test before me?' },
  { start: 8.4, end: 15.8, text: 'First, a learning control: four directly stimulated neural patterns.', note: 'Direct stimulation. These are not citizenship questions.' },
  { start: 16, end: 21.8, text: 'It learned. {trained}/32 lab trials. Different ensembles: {replication}/32.', note: 'Lab control trials, not citizenship scores.' },
  { start: 22.2, end: 26.9, text: 'Then the reading part. Visual learning gate: {gate}/16.', note: 'The answer neurons stayed silent.' },
  { start: 27.2, end: 31.8, text: 'German paperwork has entered the chat.', note: 'Next: the separate untrained exam baseline.' },
  { start: 32.2, end: 39.8, text: 'The panic is scripted. The paperwork is fictional.' },
  { start: 40.4, end: 47.8, text: 'Authored overload. Not measured neural activity.' },
  { start: 48.2, end: 55.8, text: 'Learning four direct neural patterns does not establish reading.' },
  { start: 56.4, end: 62.8, text: 'Untrained practice exam: {score}/33. {abstentions} abstentions.', note: 'No citizenship pass.', style: 'verdict' },
  { start: 63.2, end: 64.95, text: 'Please come back with form BZZ-27.', style: 'verdict' }
];

// Edits map output time to story time. Speed-ramped segments stay
// deterministic because each output frame asks for one story instant.
export const EDITS = {
  main: {
    duration: 68, width: 1920, height: 1080,
    segments: [{ at: 0, from: 0, to: 68 }],
    captions: MAIN_CAPTIONS
  },
  teaser: {
    duration: 20, width: 1920, height: 1080,
    segments: [
      { at: 0, from: 0.2, to: 3.2 },
      { at: 3, from: 4.4, to: 7.4 },
      { at: 6, from: 16.4, to: 19.4 },
      { at: 9, from: 22.6, to: 24.6 },
      { at: 11, from: 31.5, to: 46.5 },
      { at: 16, from: 60.2, to: 63, hold: .8 }
    ],
    captions: [
      { start: 0.2, end: 3, text: 'Six legs. Zero documents.', style: 'title' },
      { start: 3.1, end: 6, text: 'Could a fly-brain model pass Germany’s citizenship test before me?' },
      { start: 6.1, end: 9, text: 'It learned four direct neural patterns: {trained}/32.', note: 'Lab control trials, not citizenship questions.' },
      { start: 9.1, end: 11, text: 'Reading: {gate}/16.', note: 'Recorded visual learning gate.' },
      { start: 11.2, end: 16, text: 'Then came the paperwork.', note: 'Fictional VFX. Not measured neural activity.' },
      { start: 16.1, end: 18.4, text: 'Untrained exam: {score}/33.', note: 'No citizenship pass.', style: 'closing' }
    ]
  },
  vertical: {
    duration: 30, width: 1080, height: 1920,
    segments: [
      { at: 0, from: 0, to: 4 },
      { at: 4, from: 4.2, to: 8 },
      { at: 7.8, from: 9.4, to: 14.4 },
      { at: 12.8, from: 16.2, to: 20.4 },
      { at: 17, from: 22.4, to: 25.6 },
      { at: 20.2, from: 31.6, to: 45.6 },
      { at: 26.2, from: 59.8, to: 63.2 }
    ],
    captions: [
      { start: 0.3, end: 4, text: 'Six legs. Zero documents.', style: 'title' },
      { start: 4.1, end: 7.8, text: 'Could a fly-brain model pass Germany’s citizenship test before me?' },
      { start: 7.9, end: 12.8, text: 'First, a learning control: four directly stimulated neural patterns.', note: 'Not citizenship questions.' },
      { start: 12.9, end: 17, text: 'It learned. {trained}/32 lab trials. Different ensembles: {replication}/32.', note: 'Lab control trials.' },
      { start: 17.1, end: 20.2, text: 'Reading: {gate}/16.', note: 'Recorded visual learning gate.' },
      { start: 20.3, end: 26.2, text: 'Then came the paperwork.', note: 'Fictional VFX. Not measured neural activity.' },
      { start: 26.3, end: 28.4, text: 'Untrained exam: {score}/33.', note: 'No citizenship pass.', style: 'closing' }
    ]
  }
};

export function storyTimeFor(edit, tOut) {
  const segs = edit.segments;
  let seg = segs[0];
  for (const s of segs) if (tOut >= s.at) seg = s;
  const index = segs.indexOf(seg);
  const end = index + 1 < segs.length ? segs[index + 1].at : edit.duration;
  const span = end - seg.at - (seg.hold || 0);
  const x = clamp((tOut - seg.at) / Math.max(1e-6, span));
  return lerp(seg.from, seg.to, x);
}

export function captionAt(list, t) {
  return list.find(c => t >= c.start && t < c.end) || null;
}

export function fillTokens(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`Missing caption value ${k}`);
    return String(values[k]);
  });
}

// Values come from the recorded study files; nothing is typed in by hand.
export function evidenceValues(run, study, learning) {
  const after = learning.records.filter(r => r.phase === 'after');
  return {
    trained: study.experiments[0].scores.trained,
    replication: study.experiments[1].scores.trained,
    untrained: study.experiments[0].scores.untrained,
    changed: study.experiments[0].changed_connections,
    gate: after.filter(r => r.correct).length,
    score: run.score,
    abstentions: run.abstentions
  };
}

const stamp = s => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
export function toSRT(list, values) {
  return list.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${fillTokens(c.text, values)}${c.note ? '\n' + fillTokens(c.note, values) : ''}\n`).join('\n');
}
