# FLY-001 · Methods and recorded result

This document preserves attempt 001. The later direct-stimulation learning
control and its replication are documented in [Lab note 002](lab.html),
[the source audit](SOURCE-ALIGNMENT.md) and [the prospective protocol](data/study-002/protocol.md).
They do not replace the failed visual-learning gate reported here.

This website presents an actual computational attempt, with an anatomical 3D
fly and real MaleCNS neuron skeletons. It is a recorded, untrained baseline.
It is not an official citizenship examination, an interactive hosted inference
service, or a claim that the published brain map passes a language test.

## Graph

MaleCNS v1.0 flat-connectome tables, minimum confidence 0.5. Retain entries with
an assigned, nonempty neuronal superclass; exclude explicit Glia. Sort by body
ID. Keep every source edge between retained neurons, including self-edges and
weight-one edges. Result: 166,700 neurons, 25,582,938 directed edges and
124,177,617 contacts, including 101 self-edges. The source table contains
151,856,684 rows before endpoint filtering.

The 166,700 count is the result of these exact retention criteria, not an attempt
to substitute a rounded publication count. This includes the retained brain
and ventral nerve cord. See `data/model.json` for the machine-readable manifest.

Acetylcholine is modeled as positive; GABA, glutamate and histamine as negative.
Ambiguous or unsupported transmitter assignments default to positive for 3,718
neurons. This crude sign model ignores receptor dependence, electrical
synapses and neuromodulatory complexity.

## Dynamics

The unchanged MIT-licensed Doomfly native kernel implements leaky integrate-and-
fire dynamics on the complete retained graph. Membrane time constant 20 ms;
synaptic constant 5 ms; resting voltage -52; threshold -45; refractory interval
2.2 ms; synaptic delay 1.8 ms; timestep 0.1 ms. Each connection's efficacy is
contact count × presynaptic sign × 0.275. Inactive neurons are skipped only via
lazy subthreshold integration; incoming edges are not pruned.

This is a declared coarse dynamics hypothesis, not a validated implementation
of fly language, ion channels, realistic phototransduction, or cognition.

## Pixels to neurons

Question text and four choices are rendered to a 960 × 720 grayscale image
using DejaVu Sans. No key, explanation or selected-answer marker is present.
The exact raster for each item is available under `data/retina/`.

3,335 of 3,377 R1–R6 receptors receive mapped pixel samples. Receptor coordinates
are inferred from the strongest aggregate connection to assigned L1/L2/L3
hex coordinates, then projected into overlapping left/right image fields.
Unmapped receptors remain in the graph. This is a fixed approximation, not a
reconstructed optical model. A 10 ms framewise luminance low-pass filter drives
retina current `30 L / (0.02 + L)`; L1/L2/L3/L5 receive tonic current 12.
Graded sensory cells are approximated with the same spiking model.

## Neurons to A/B/C/D

Before learning and inference, the decoder is fixed to:

| Choice | Population | Neurons |
|---|---|---:|
| A | MBON11 | 2 |
| B | MBON12 | 4 |
| C | MBON13 | 2 |
| D | MBON14 | 4 |

The unique highest mean population spike rate wins. Silence or equal maxima
produce an abstention. No forced answer, tie breaker, fallback, OCR, embedding,
language model, learned output classifier or answer lookup exists in inference.
The labels are an experimental interface, not biological meanings of these cells.

## Learning gate

The precursor task presents a bright patch in one of four image quadrants, with
fixed quadrant-to-choice targets. Patch center, size and brightness vary with
deterministic seed 90210. Each trial starts from reset dynamic state, retaining
current weights, and lasts 400 simulated milliseconds. Eight baseline trials,
32 feedback trials and 16 held-out trials are recorded in `data/learning.json`.

Plasticity is confined to existing KC→MBON11/12/13/14 edges. Eligibility is the
product of pre- and postsynaptic trial counts, each divided by 40 and capped at
one. Reward is +1 for a correct choice and -0.25 otherwise. Each eligible weight
changes by 0.05 × initial weight × reward × eligibility, bounded between 0.1 and
2 times its original efficacy. This is an experimental local rule, not a
validated reproduction of biological dopamine learning. It neither adds edges
nor trains an external classifier. No labels or feedback enter final inference.

The gate requires 12/16 held-out correct choices. Observed: 0/8 baseline, 0/32
training, 0/16 held out. Kenyon cells and MBONs did not spike. Zero candidate
weights changed. Citizenship training was therefore not started.

Separate calibration probes multiply all graph weights by 1, 2 or 4 and show
two opposite quadrant patterns for one second each. The baseline is silent at
the answer populations; higher gains cause high output rates and both patterns
select A. No higher-gain model is substituted into the exam. These six probes
are diagnostics, not a systematic calibration search or proof of impossibility.

## Blind baseline sitting

Thirty national and three Berlin text-only items are selected with seed 260914
from the official regulation's wording. Eligibility requires a correct-answer
text match to a secondary key transcription. There are 239 eligible national
and 7 eligible Berlin text items. Image questions and unmatched keys are
excluded. This is a reproducible practice selection, not an official BAMF form
or representative sample of the entire catalogue.

Each item runs one simulated second with original reference weights and reset
dynamic state. The key is absent from `exam-input.json`. The inference process
loads only this key-free input, the graph and display-neuron indices. It writes
the blind run and exits. A separate process opens the key and grades afterwards.
This is auditable process separation, not OS-level access enforcement.

Before/after weight hashes are equal. The recorded baseline abstains on all 33
questions, so the practice score is 0/33, independent of any answer-key error.
The usual practice pass threshold is 17. Recorded wall time, timing limit,
source/input/raster/kernel hashes, outputs, and frame counts are in `data/run.json`.

## 3D visualization and playback

The brain uses a deterministic sample of original SWC skeletons emphasizing
optic and central-brain neurons, including every designated answer population.
Continuous branches are simplified at 0.48 µm RDP tolerance while retaining
branch endpoints, yielding 324,594 segments across 630 neurons. Coordinates
are quantized to 80 nm for transfer; per-neuron colors are assigned
deterministically for legibility, not as neurotransmitter or activation classifications.
Neither display sampling nor quantization affects the full neural simulation.

On the original replay page (`attempt.html`, `scene-lab.js`) per-neuron colors are
assigned deterministically for legibility. The story page and film (`scene.js`)
color skeletons by their anatomical class in `data/brain.json`: optic-lobe
sensory, optic-lobe intrinsic and visual projection or centrifugal neurons in a
cyan-to-teal family (the visual route), central-brain intrinsic neurons in violet.
Neither palette encodes neurotransmitter or activation.

Brightening is tied to recorded 20 ms spike bins at the matching neural indices.
The renderer normalizes brightness by two spikes per bin and caps at one.
Alpha-composited color and small markers make active cells legible. Brightness
follows the count in each bin directly; no extra rhythmic pulse is added.
These are recorded model spikes, not biological electrical recordings.
Neuron particles mark real sampled skeleton positions. Slow rotation is a camera
presentation of anatomy, not activity. It is not a measurement of propagation
speed along axons or an intracellular movie.

The combined view is a 4× enlarged, head-aligned display. Median optic-lobe
landmarks are matched to the body eye-center axis, then offset dorsally from
the head. The brain follows the same head transforms through animation and
camera rotation. The two sources are different specimens, so this is a rigid
display alignment, not a biological registration or anatomical size claim.
`data/alignment.json` records the landmarks, matrix, scale and source hashes.
The EM export B=(raw X, -raw Z, raw Y) maps approximately to the native fly's
(anterior, left, dorsal)=(B.y, B.x, -B.z), with a landmark-based tilt correction.

The fly has 69 articulated parts exported from NeuroMechFly's anatomical meshes,
rigging and neutral pose. Added materials and fine bristles are visual styling.
Antenna movement, wing flicks, head motion and foreleg motion are presentation
animation, not a simulated biomechanical controller or decoded motor behavior.
The export preserves FlyGym’s axis convention: yaw X, pitch Y, roll Z.

WebGL draws the full exported meshes. If unavailable, a software renderer
projects the fly and skeletons (without desk, paper or effects on the story
page) with clustered mesh vertices, continuous simplified
skeleton branches, and markers at actual sampled neural positions. Its cached
brain view rotates on user input; automatic limb animation remains enabled.
In the software path, automatic head/body sway is disabled to preserve the
cache and maintain identical head/brain orientation. WebGL animates both.

Each one-second question trace is presented across 6.5 seconds at the default
story pace of 1×, then its recorded selection is shown for 3.5 seconds. The
56-trial learning replay presents each 400 ms trace over 2.16 seconds,
then feedback over 0.84 seconds. The initial 5× setting presents the learning
replay and 33-item exam in approximately 100 seconds on a responsive device.
Slower renderers can lengthen the display; recorded simulation times do not change.
Speed, pause and scrubbing change only display time. The full neural model does
not execute in the browser. No presented score is computed from animation.

## Story scene and film export (16 September 2026)

The 68-second story and the exported films share one deterministic timeline.
`timeline.js` defines beats, captions, edits and which recorded data may light
the skeletons. `choreography.js` turns story time into body, head, antenna,
wing and camera values. `scene.js` exposes `setTime(seconds, seed)`: every pose,
paper sheet, particle and camera position is a function of that time, never of
playback history. `tools/determinism.mjs` renders eight instants in order and
again after arbitrary seeks; all frame hashes match.

Recorded model spikes appear only in two windows. From 22 to 27 s the display
replays the last held-out visual-gate trial of FLY-001 (trial 15, 143,185 total
spikes, no answer spikes). From 27 to 31.6 s it replays question 6 of the
untrained 33-question run. The direct-stimulation chapter (8 to 22 s) shows no
spatial highlight: its stimulated KCg-d cells are not in the displayed sample,
so recorded population totals are printed instead. Everything from 31.6 to 56 s
is labelled fictional: the paper storm, the holographic shell, the light stream
and the overload. The overload displaces the real sampled skeleton segments in a
shader, peeling whole neurons in a seeded order, lifting the central brain and
spreading the visual route. It is a visual metaphor, not measured activity.

The fly stands on the desk through a damped least-squares solver on coxa, femur,
tibia and first tarsus. Planted claws keep fixed desk positions while the body
dips, braces and trembles. `tools/check-scene.mjs` samples the timeline and
reports claw height, claw slip between frames, solver error, paper-to-paper
intersections (oriented-box separating-axis tests with bend thickness), paper
to camera and fly clearance and desk penetration. Paper separation is authored:
sheets in one ring rotate rigidly, change height only while flat in unique
lanes or while upright on transit radii no ring uses. It is not a physics
simulation. Wing strokes stay inside the checked 0 to 1 pose envelope; fast
wingbeats are drawn as five translucent blades across that envelope, a motion
blur treatment rather than a sampled wingbeat.

`film.html` is a capture route for the same scene with captions and evidence
cards filled from the recorded JSON. `tools/render-film.mjs` renders one frame
per output instant and pipes PNG frames into FFmpeg. The soundtrack is original
synthesis from `tools/soundtrack.py`, keyed to story time. Learning blips take
their pitch from the recorded training-block scores. No samples or licensed
audio are used.

## Reproduction and sources

The Site source contains the complete Python preparation, local learning assay,
native kernel, blind inference and grading code. Raw large connectome tables
are omitted; versioned source URLs and hashes are retained.

1. Fetch and verify the public sources with `scripts/fetch_sources.py`.
2. Run `neural/prepare.py` to reconstruct the retained graph.
3. Export anatomy with `scripts/export_anatomy.py`, preserve continuous branches
   with `scripts/simplify_skeletons.py`, then derive landmarks with
   `scripts/export_alignment.py`. The simplifier retains every branch endpoint
   and applies 0.48 µm RDP tolerance before 0.08 µm display quantization.
4. Prepare key-free questions with `scripts/prepare_questions.py`.
5. Run `neural/experiment.py calibrate`, then `gate`, then `infer`.
6. After inference exits, run `neural/experiment.py grade`.
7. Run `scripts/analyze.py` to regenerate the PNG/SVG analysis figures.

The instrumented repeat run records retinal, lamina, Kenyon-cell and answer
population counts in each 20 ms frame. All 33 total spike counts, all choices,
and the weight hash match the first baseline run. Wall time differs between runs.

The analysis figure is derived directly from the JSON records. Min–max shading
shows the observed range across exam items, not a confidence interval. The 8.25
guess comparison is the analytic expectation for uniform independent choices;
it is not an empirical control run. Calibration probes are not trained models.

Full source details and licenses are in `THIRD_PARTY.md` and `licenses/`.

- Research article: https://blog.google/innovation-and-ai/technology/research/male-fruit-fly-brain-map/
- Data: https://male-cns.janelia.org/download/
- Body: https://github.com/NeLy-EPFL/flygym/
- Native kernel: https://github.com/nftechie/doomfly
- Official catalogue: https://www.gesetze-im-internet.de/einbtestv/anlage_1.html
- Regulation: https://www.gesetze-im-internet.de/einbtestv/BJNR164900008.html
- Secondary keys: https://github.com/leben-in-deutschland/leben-in-deutschland-scrapper

## Display correction and research scenarios

Wing motion is applied in the thorax coordinate frame before the source folded
rest orientation. Both wings lift dorsally and spread outward from their actual
hinges. `scripts/check_clearance.py` samples five points in the authored stroke
against the upper thorax/abdomen surface, excluding a 0.35 mm hinge neighborhood.
It is a displayed-geometry check, not a physical collision or flight validation.

`research.html` distinguishes catalogue recognition from comprehension and
specifies a proposed learning program. `scripts/research_estimates.py` derives
conditional compute budgets and idealized binomial comparisons from the saved
records. These are not new learning measurements or time-to-pass predictions.
The recorded neural model, question selections, weights and scores are unchanged.
