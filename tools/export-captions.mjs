// Writes SRT and WebVTT caption files for every edit from the shared timeline
// and the recorded study values.
import fs from 'node:fs';
import { EDITS, toSRT, evidenceValues } from '../dist/timeline.js';
const root = new URL('../', import.meta.url).pathname;
const read = f => JSON.parse(fs.readFileSync(root + 'dist/data/' + f));
const values = evidenceValues(read('run.json'), read('study-002/summary.json'), read('learning.json'));
const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });
const names = { main: 'FLY-main-68s', teaser: 'FLY-teaser-20s', vertical: 'FLY-vertical-30s' };
for (const [k, e] of Object.entries(EDITS)) {
  const srt = toSRT(e.captions, values);
  fs.writeFileSync(`${outDir}/${names[k]}.srt`, srt, 'utf8');
  const vtt = 'WEBVTT\n\n' + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  fs.writeFileSync(`${outDir}/${names[k]}.vtt`, vtt, 'utf8');
}
console.log(JSON.stringify(values));
