# The film pipeline

FLY's films are rendered from the same code that runs the website. There is no
screen recording anywhere in the chain. This note explains the moving parts so
a rebuild produces the same frames.

## One timeline, three edits

`dist/timeline.js` is the single source of truth for story time: beats,
chapters, captions, edit points and activity windows. The 68-second main film,
the 20-second teaser and the 30-second vertical edit are three edit lists over
that one timeline. Captions export to SRT and VTT from the same table
(`tools/export-captions.mjs`), which is why the cue timings always match the
picture.

## Story time in, frame out

`dist/choreography.js` maps story time to acting and camera values as pure
functions. `dist/fly-rig.js` turns those values into joint poses; its damped
least-squares IK keeps planted claws fixed on the desk while the body moves,
and it fans a translucent wing copy as motion blur for fast strokes.
`dist/stage.js` builds the set: desk, props, the fictional German forms
(labelled as fictional on the sheet), the paper vortex with authored
separation, the holographic shell, the forehead light stream and the overload
particles that ride the sampled skeleton segments.

`dist/scene.js` renders all of it: cuticle noise and sockets, faceted eyes,
veined thin-film wings, class-coloured anatomy, bloom with a sanitising pass
that keeps NaN out of the pyramid.

The contract is `createSpecimen(...).setTime(seconds, seed)`. It poses the
whole scene from story time alone. Seeking to 41.2 s produces the same frame
whether you played through or jumped there, and `tools/determinism.mjs`
verifies it by rendering the same times in different orders and diffing the
pixels.

## Capture route

`dist/film.html` is the capture page. It loads the scene at 1920 x 1080 (or
1080 x 1920 for the vertical edit), steps story time frame by frame at 30 fps
and fills the evidence cards from the recorded JSON in `dist/data/`, so the
numbers in the film are read from the same files the website reads.

`tools/render-film.mjs` drives a headless Chromium through Playwright with the
GPU enabled (`tools/browser.mjs`), grabs every frame, and hands the sequence to
FFmpeg. `tools/render-all.sh` runs the whole set:

1. `tools/soundtrack.py` synthesizes the soundtrack for each edit from the
   timeline (original synthesis, no samples), mastered to -16 LUFS integrated.
   The landing (1.15 s), the shell boom (40.9 s) and the stamp (64.98 s) are
   keyed to story time and land within 2 ms in the delivered files.
2. `tools/render-film.mjs` renders CRF 16 masters for main, teaser and
   vertical, plus labelled stills at fixed story times.
3. FFmpeg makes the delivery encodes (H.264 High 4.2, yuv420p, AAC 48 kHz)
   and a two-pass 2.6 Mbps web encode, which is what `dist/media/` carries.
4. Poster, social card and a ten-frame contact sheet come from the same
   renders.

Render times on an Apple M3 Pro: about 600 s for the main film, 190 s for the
teaser, 280 s for the vertical edit.

## Checks that run before anything ships

- `tools/check-scene.mjs`: geometry at 30 fps over the whole story. No paper
  intersections, no desk penetration, no claw slip, camera never inside a
  sheet.
- `tools/determinism.mjs`: identical frames after arbitrary seeks.
- `tools/site-qa.mjs`: the website in six configurations including phone
  width, reduced motion and no WebGL, with playback, pause, backwards seeking,
  replay, view toggles, the full quiz and the share dialog. Zero console
  errors is the bar.
- `tools/verify-live.sh`: every file on the production deployment compared
  byte for byte against `dist/`.
- `scripts/validate.py`: the recorded evidence files are unchanged and
  internally consistent.

The verification log with dates and findings is in
[VERIFICATION.md](VERIFICATION.md).
