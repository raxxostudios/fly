"""Original, deterministic sound design for the FLY film edits.

Every layer is synthesised here from story time, so the teaser and vertical
edits get sound that follows their own time remapping. No samples, no
third-party audio. Usage: python3 tools/soundtrack.py <edit> <out.wav>
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
edit_name, out_path = sys.argv[1], sys.argv[2]
EDITS = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import('./dist/timeline.js').then(m=>console.log(JSON.stringify(m.EDITS)))"], cwd=ROOT))
edit = EDITS[edit_name]
summary = json.loads((ROOT / 'dist/data/study-002/summary.json').read_text())
blocks = summary['experiments'][0]['training_blocks']
rng = np.random.default_rng(20260916)

dur = edit['duration']
n = int(dur * SR)
to = np.arange(n) / SR
segs = edit['segments']

def story_of(t):
    ts = np.empty_like(t)
    for i, s in enumerate(segs):
        end = segs[i + 1]['at'] if i + 1 < len(segs) else dur
        span = end - s['at'] - s.get('hold', 0)
        m = (t >= s['at']) & (t < end) if i + 1 < len(segs) else (t >= s['at'])
        x = np.clip((t[m] - s['at']) / max(span, 1e-6), 0, 1)
        ts[m] = s['from'] + (s['to'] - s['from']) * x
    return ts

ts = story_of(to)

def out_times(t_story):
    """All output instants where the edit plays story time t_story."""
    res = []
    for i, s in enumerate(segs):
        end = segs[i + 1]['at'] if i + 1 < len(segs) else dur
        span = end - s['at'] - s.get('hold', 0)
        lo, hi = min(s['from'], s['to']), max(s['from'], s['to'])
        if lo <= t_story <= hi and s['to'] != s['from']:
            res.append(s['at'] + (t_story - s['from']) / (s['to'] - s['from']) * span)
    return res

def smooth(a, b, x):
    y = np.clip((x - a) / (b - a), 0, 1)
    return y * y * (3 - 2 * y)

def window(a, b, fade, x):
    return smooth(a, a + fade, x) * (1 - smooth(b - fade, b, x))

try:
    from scipy.signal import lfilter, butter
except ImportError:
    sys.exit('scipy required')

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)

def bandpass(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band')
    return lfilter(b, a, x)

L = np.zeros(n); R = np.zeros(n)
def add(sig, pan=0.0, gain=1.0):
    global L, R
    L += sig * gain * np.sqrt((1 - pan) / 2)
    R += sig * gain * np.sqrt((1 + pan) / 2)

def place(event, t_story, pan=0.0, gain=1.0):
    for t0 in out_times(t_story):
        i0 = int(t0 * SR)
        if i0 >= n: continue
        seg = event[: n - i0]
        L[i0:i0 + len(seg)] += seg * gain * np.sqrt((1 - pan) / 2)
        R[i0:i0 + len(seg)] += seg * gain * np.sqrt((1 + pan) / 2)

# 1. Room tone.
white = rng.standard_normal(n)
room = lowpass(lowpass(white, 400), 400)
add(room / np.max(np.abs(room)) * 0.018)

# 2. Low drone, rising with the paperwork and the overload.
drone_env = 0.02 + 0.05 * smooth(27, 33, ts) * (1 - smooth(56, 62, ts)) + 0.06 * window(40.4, 56, 2, ts)
phase = 2 * np.pi * np.cumsum(np.full(n, 55.0)) / SR
drone = np.sin(phase) + 0.6 * np.sin(phase * 1.498) + 0.25 * np.sin(phase * 2.003)
add(lowpass(drone, 300) * drone_env * 0.8)

# 3. Wing buzz: flight and panic bursts, with wingbeat modulation.
buzz_env = (1 - smooth(1.0, 1.3, ts)) + window(33.1, 33.9, .12, ts) + window(35.5, 36.2, .12, ts) + window(37.7, 38.6, .12, ts)
f0 = 190 + 25 * np.sin(2 * np.pi * 0.7 * to)
ph = 2 * np.pi * np.cumsum(f0) / SR
saw = sum(np.sin(ph * k) / k for k in range(1, 9))
am = 0.6 + 0.4 * np.sin(2 * np.pi * 31 * to)
buzz = bandpass(saw * am, 120, 2400)
add(buzz / np.max(np.abs(buzz)) * np.clip(buzz_env, 0, 1) * 0.16, pan=-0.2)

def env(length, attack, decay):
    t = np.arange(int(length * SR)) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)

def noise_burst(length, lo, hi, attack=.004, decay=.06):
    e = env(length, attack, decay)
    return bandpass(rng.standard_normal(len(e)), lo, hi) * e

def tone(freq, length, attack=.005, decay=.25, harmonics=(1, .3, .1)):
    t = np.arange(int(length * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
    return s * env(length, attack, decay)

def mixsum(*parts):
    out = np.zeros(max(len(p) for p in parts))
    for p in parts: out[:len(p)] += p
    return out

# 4. Landing tap.
place(mixsum(noise_burst(.25, 80, 900, decay=.05) * 1.6, tone(95, .3, decay=.08)), 1.15, gain=.5)

# 5. Grooming scratch, soft and rhythmic.
scratch = bandpass(rng.standard_normal(n), 2500, 7000)
groom_env = window(8.6, 15.6, 1.1, ts) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.5 * ts)) ** 3
add(scratch * groom_env * 0.035, pan=.25)

# 6. Learning blips: one per recorded training block, pitch from its score.
for i, v in enumerate(blocks):
    freq = 330 * 2 ** ((v - 6) / 10)
    place(tone(freq, .45, decay=.18, harmonics=(1, .2)), 8.4 + i * 7.2 / 8, pan=-.3 + .6 * i / 7, gain=.18)
# Result chime at 16 s.
for k, f in enumerate([523.25, 659.25, 783.99]):
    place(tone(f, 1.6, decay=.7, harmonics=(1, .15)), 16.05 + k * .08, pan=(k - 1) * .4, gain=.09)

# 7. Visual gate: a dull descending pair, then a questioning rise for the tilt.
place(tone(220, .5, decay=.3), 22.35, gain=.12)
place(tone(164.8, .7, decay=.35), 22.7, gain=.12)
place(tone(392, .25, decay=.12, harmonics=(1,)) , 24.6, gain=.06)
place(tone(466, .3, decay=.15, harmonics=(1,)), 24.8, gain=.06)

# 8. Paper: stack landings, desk skims, then the vortex wind.
for k in range(17):
    place(noise_burst(.3, 900, 5200, decay=.07), 27.1 + k * (4.2 / 17) + .9, pan=float(rng.uniform(-.7, .1)), gain=.22)
for k in range(16):
    sw = noise_burst(1.2, 600, 3800, attack=.35, decay=.4)
    place(sw, 29.4 + k * (3.4 / 16), pan=float(rng.uniform(-.8, .8)), gain=.06)
spin_keys = [(31.5, 0), (34, .45), (38, .8), (41, 1.2), (47, 1.2), (50, .6), (56, .45), (61, 0)]
spin_rate = np.interp(ts, [k[0] for k in spin_keys], [k[1] for k in spin_keys], left=0, right=0)
wind = bandpass(rng.standard_normal(n), 250, 3200)
flutter = 0.7 + 0.3 * np.sin(2 * np.pi * (1.3 + spin_rate) * to)
add(wind * spin_rate * flutter * 0.07, pan=-.35)
add(bandpass(rng.standard_normal(n), 400, 5000) * spin_rate * (1.3 - flutter) * 0.05, pan=.35)
# Individual sheet flaps inside the storm.
for k in range(46):
    place(noise_burst(.18, 1500, 6500, decay=.035), 32.2 + k * .5 + float(rng.uniform(0, .3)), pan=float(rng.uniform(-.9, .9)), gain=.08)

# 9. Overload: sub boom at the shell opening, shimmer that follows the burst.
place(mixsum(tone(38, 2.2, attack=.01, decay=.7, harmonics=(1, .4)), noise_burst(.6, 40, 300, decay=.2)), 40.9, gain=.55)
burst = smooth(40.8, 46.5, ts) * (1 - smooth(55.6, 60.5, ts))
shimmer = np.zeros(n)
for k in range(14):
    f = 880 * 2 ** (rng.choice([0, 2, 4, 7, 9, 12, 14, 16, 19]) / 12) * (1 + rng.uniform(-.003, .003))
    shimmer += np.sin(2 * np.pi * f * to + rng.uniform(0, 6.28)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(.1, .4) * to + rng.uniform(0, 6.28)))
add(shimmer / 14 * burst * 0.07, pan=-.5)
add(np.roll(shimmer, 2400) / 14 * burst * 0.07, pan=.5)

# 10. Dive: slow falling filtered tone.
dive = window(48, 56, 1.5, ts)
dive_f = 400 - 180 * smooth(48, 56, ts)
add(np.sin(2 * np.pi * np.cumsum(dive_f) / SR) * dive * 0.035)

# 11. Reassembly: reversed whoosh into a cut, then a deflating tone.
t_r = np.arange(int(1.4 * SR)) / SR
rev = bandpass(rng.standard_normal(len(t_r)), 300, 6000) * (t_r / 1.4) ** 3
place(rev, 55.9, gain=.22)
t_d = np.arange(int(1.6 * SR)) / SR
deflate = np.sin(2 * np.pi * np.cumsum(260 - 120 * t_d / 1.6) / SR) * np.exp(-t_d / .7)
place(deflate, 57.4, gain=.08)

# 12. Form BZZ-27 slides in; stamp; final chord.
place(noise_burst(1.3, 300, 2500, attack=.5, decay=.5), 63.1, pan=.4, gain=.16)
place(mixsum(tone(70, .6, attack=.002, decay=.12, harmonics=(1, .5)), noise_burst(.12, 500, 5000, attack=.001, decay=.02) * 1.5), 64.98, gain=.7)
for k, f in enumerate([392.0, 493.88, 587.33, 739.99]):
    place(tone(f, 3.2, attack=.02, decay=1.4, harmonics=(1, .12)), 65.3 + k * .05, pan=(k - 1.5) * .3, gain=.06)

# Short edits: resolve on the same chord at their closing card.
if edit_name != 'main':
    for k, f in enumerate([392.0, 493.88, 587.33, 739.99]):
        c = tone(f, 1.6, attack=.02, decay=.8, harmonics=(1, .12))
        i0 = int((dur - 1.6) * SR); c = c[: n - i0]
        L[i0:i0 + len(c)] += c * .06; R[i0:i0 + len(c)] += c * .06

# Fades, gentle limiter, level.
fade = np.minimum(1, np.minimum(to / .05, (dur - to) / .4))
mix = np.stack([L, R]) * fade
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.3) / np.tanh(1.3)
rms = np.sqrt(np.mean(mix ** 2))
mix *= min(10 ** (-18 / 20) / rms, 0.95 / np.max(np.abs(mix)))
pcm = (np.clip(mix, -1, 1).T * 32767).astype('<i2')
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(json.dumps({'edit': edit_name, 'seconds': dur, 'rms_dbfs': round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 2), 'peak_dbfs': round(20 * np.log10(np.max(np.abs(mix))), 2)}))
