// Frame-exact film export: one FILM.render(t) per output frame, piped as PNG
// into FFmpeg (H.264 High, yuv420p, AAC, fast start).
// node tools/render-film.mjs <edit> <out.mp4> [audio.wav] [--frames dir] [--stills t1,t2]
import { launch } from './browser.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const [edit, out, audio] = args;
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FPS = 30;
const ffmpeg = process.env.FFMPEG || `${process.env.HOME}/bin/ffmpeg`;
const b = await launch();
const probe = await b.newPage();
await probe.goto(`${process.env.FLY_BASE || 'http://127.0.0.1:5178'}/film.html?edit=${edit}&w=64&h=36`);
await probe.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90000 });
const { duration, width, height } = await probe.evaluate(() => { const e = window.FILM.edit; return e; });
await probe.close();
const W = Number(opt('--w')) || (edit === 'vertical' ? 1080 : 1920), H = Number(opt('--h')) || (edit === 'vertical' ? 1920 : 1080);
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${process.env.FLY_BASE || 'http://127.0.0.1:5178'}/film.html?edit=${edit}&w=${W}&h=${H}`);
await p.waitForFunction(() => document.body.dataset.ready === '1' || document.body.dataset.error, undefined, { timeout: 90000 });
const frames = Math.round(duration * FPS);
const ffArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
if (audio) ffArgs.push('-i', audio);
ffArgs.push('-map', '0:v:0');
if (audio) ffArgs.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.2', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart', '-t', String(duration), out);
const ff = spawn(ffmpeg, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const stills = (opt('--stills') || '').split(',').filter(Boolean).map(Number);
const frameDir = opt('--frames');
if (frameDir) fs.mkdirSync(frameDir, { recursive: true });
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const t = i / FPS;
  await p.evaluate(x => window.FILM.render(x), t);
  const png = await p.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (frameDir && stills.some(s => Math.round(s * FPS) === i)) fs.writeFileSync(path.join(frameDir, `${edit}-${t.toFixed(2).padStart(5, '0')}.png`), png);
  if (i % 150 === 0) process.stderr.write(`${edit} frame ${i}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
}
ff.stdin.end();
const code = await new Promise(r => ff.on('close', r));
await b.close();
console.log(JSON.stringify({ edit, out, frames, width: W, height: H, seconds: (Date.now() - t0) / 1000, ffmpeg: code, pageErrors: errors.slice(0, 5) }));
process.exit(code || errors.length ? 1 : 0);
