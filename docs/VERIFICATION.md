# Verification log

What was checked, how, and what it found, in date order. Nothing here is a synthetic quality score.

## Repair verification · 2026-09-14

The managed browser preview was used to inspect the repaired anatomical pose,
idle joint movement, recorded neural glow, the actual four-quadrant stimulus,
training playback and pause, the frozen-baseline exam banner, next-question
navigation, exact retinal input inspection, final score and scientific analysis.
The analysis image loaded at its full 2700 × 1890 resolution. Download controls
point to the figure, X draft, trial data, methods and attribution files.

The cloud browser has WebGL disabled. Visual inspection therefore covered the
software projection of the same Three.js scene. Full GPU shader execution was
not verified in that environment. The software path uses reduced mesh detail;
the production WebGL path retains all exported geometry. Browser extension
metadata errors were unrelated to the site. The expected WebGL context failure
was handled by the fallback renderer.

`python3 scripts/validate.py` passed: 33 exam records, 56 learning records,
recorded-frame totals, fixed output decoder, unchanged weight hash, geometry
bounds and hierarchy, JavaScript syntax, and deployment asset size limits.
The instrumented repeat matches the first blind run on all 33 total spike
counts, selections and final weight hash. Its archive SHA-256 matches the
public graded run. `git diff --check` passed.

The analysis figure was rendered and visually inspected. It is calculated from
the recorded JSON, with observed-range shading and the theoretical guessing
comparison explicitly identified. X copy is a draft; no social post was sent.

## Findings and rendering correction

The user-supplied GPU screenshot showed white saturation from additive blending.
The neural line and point materials now use normal alpha compositing. Inactive
point markers are discarded, and the extra time-based pulse envelope is removed.
Body exposure and metallic response were reduced. The biological data and all
measured results remain unchanged.

The updated home page exposes the published findings separately from the model
result, with an explicit enlarged-brain and illustrative-motion label. Its
findings dialog and source links were checked in the managed browser. The
software renderer remains the only available cloud preview, so the GPU change
was verified in source against the supplied screenshot's blending defect, not
by a new GPU screenshot.

## Research and particle-design revision · 2026-09-14

The preferred concept images and all supplied X references were inspected.
The headline, black stage, acid-yellow controls, cream exam paper and enlarged
particle anatomy now follow that visual direction. The original challenge
remains the goal; the unchanged failed baseline is not a successful training run.

The managed preview covered the home screen, front/side/top body inspection,
training playback and pause, exam navigation, final score, and the research
notebook. A 390-pixel iframe (375-pixel content width with its scrollbar)
confirmed equal document/client widths after repairing the playback bar.
The mobile training CTA and pause control worked. The scientific calculator
changed from 14.9 hours at its defaults to 6.0 hours for 32 examples × 10 passes
× 22.347 seconds × an explicitly hypothetical 3× overhead.

The same WebGL restriction applies: visual inspection used the software
projection, not the full GPU shaders. Side and top views showed the revised
wing pose. `scripts/check_clearance.py` additionally sampled both distal wing
blades at five stroke fractions against the upper thorax/abdomen surface.
All sampled phases cleared the body; the minimum sampled rest clearance was
about 0.016 mm. This is a geometry check, not a collision-physics guarantee.
The brain registration uses optic landmarks and follows the head transform;
it is an enlarged display alignment of different source specimens.

The neural export preserves complete branch chains with endpoint-preserving
RDP simplification. It contains 324,594 continuous segments from the same
630 source skeletons, instead of 837,332 disconnected sampled segments.
Recorded spikes, model weights, and experiment outcomes were not changed.

The research notebook includes primary papers, official project documentation,
the official test format, source limitations, an audited failure diagnosis,
a staged training protocol, and conditional compute calculations. Its runtime
and probability JSON is reproducible from the recorded experiment files.
`scripts/validate.py` now also checks registration transforms and asset hashes,
research input hashes, scenario arithmetic and local research links.

## Cinematic rebuild and film export · 2026-09-16

Rendered on an Apple M3 Pro through headless Chrome for Testing with the Metal
backend, so real GPU shaders ran this time, unlike the software-only checks above.

- `python3 scripts/validate.py`: passed, including the new module list, local
  links on five pages, media presence, caption values recomputed from the
  records and a sweep for em dashes in shipped text.
- `python3 scripts/check_clearance.py`: passed, minimum rest clearance 0.0158 mm.
- `STEP=0.0333 node tools/check-scene.mjs`: 2,041 story instants, zero paper
  intersections, zero desk penetrations, zero claw contact or slip violations.
  Camera never closer than 2.51 units to paper. Maximum IK error 0.00027,
  maximum planted claw slip 0.00007 per frame (world units).
- `node tools/determinism.mjs`: eight instants render to identical PNG hashes
  in order and after arbitrary seeks.
- `node tools/site-qa.mjs`: 1920x1080, 1440x900 at 2x, 1366x768, 390x844 phone
  emulation, reduced motion and WebGL disabled. Playback, pause, chapter jump,
  seeking backwards, replay from the end, view toggles, the full three-question
  quiz, share dialog, no horizontal overflow, qualifiers visible, sound off by
  default. No console errors or failed requests in any configuration.
- Headless frame rate during story playback: about 120 fps at 1920x1080 and
  106 to 114 fps at 1440x900 with device pixel ratio 2. This is a desktop GPU;
  the phone emulation ran on the same GPU and is not a phone measurement.
- Films: frame counts 2040, 600 and 900 exactly; audio length matches;
  integrated loudness -16.3, -15.9 and -16.0 LUFS; moov atom before mdat.
  Audio onsets for the landing, the shell boom and the stamp sit within 18 ms
  of their story times. The main film was reviewed at one frame per second.
- Not verified: real phones and tablets, Safari and Firefox rendering, and
  frame rate on mid-range mobile hardware.
