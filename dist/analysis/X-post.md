# FLY / X post and scientific thread

Suggested attachment: `FLY-001-analysis.png`. This is a draft; nothing has been posted.

## Opening post

I gave a fly-brain model Germany’s citizenship test.

166,700 neurons. No LLM answering.

First, a visual learning attempt; then 33 questions with frozen weights.

The result: 33 abstentions.

Here’s where the signal stopped. 🧵

## Thread

2/ The starting point: the MaleCNS wiring map, built by Google Research and collaborators. I retained 166,700 neurons and 25.6M directed edges, including ventral nerve cord neurons. The map is real data. The coarse spiking dynamics are a modeling hypothesis.

3/ Input: grayscale pixels mapped to retinal receptors. Output: four fixed MBON populations mapped to A/B/C/D. No LLM, OCR, answer lookup or external classifier selects an answer. Silence and ties produce an abstention.

4/ Before language, a simpler task: locate a bright patch in one of four quadrants. Eight baseline trials, 32 feedback trials, 16 held out. Learning could change only existing KC→MBON connections through a declared local coincidence rule.

5/ The gate failed: 0/16 held out. Visual neurons fired, but Kenyon cells and the answer populations stayed silent. The learning rule changed 0 of 12,420 candidate synapses. Citizenship training never started.

6/ A diagnostic: doubling or quadrupling all weights activated the outputs, but both opposite patch locations selected A at high rates. More spikes did not demonstrate better discrimination. Those gains were not used in the exam.

7/ The separate untrained baseline received 30 national + 3 Berlin text-only catalogue questions. Weights stayed frozen; a separate process graded afterwards. All 33 answers were abstentions. Score: 0/33. This was a practice selection, not an official exam.

8/ What this shows: this particular input mapping, dynamics and learning rule did not establish basic visual learning. It does not show that every connectome model must fail, or that fly intelligence has been measured by a language test.

9/ The demo exposes the training stimuli, recorded spike bins, exact exam inputs and analysis. The animated body is presentation; the green neural highlights follow recorded model spikes. Next scientific milestone: demonstrate reliable held-out visual learning.

## References for the thread

- [Research article](https://blog.google/innovation-and-ai/technology/research/male-fruit-fly-brain-map/)
- [MaleCNS data](https://male-cns.janelia.org/download/)
- [Body geometry: NeuroMechFly / FlyGym](https://github.com/NeLy-EPFL/flygym/)
- [Full-graph kernel: Doomfly](https://github.com/nftechie/doomfly)
- [Official question catalogue](https://www.gesetze-im-internet.de/einbtestv/anlage_1.html)
- Local downloadable evidence: `../data/run.json`, `../data/learning.json`, `../data/calibration.json`, `../METHOD.md`.

The demonstration has not established that a trained fly-brain model passes the citizenship test. Use the recorded result when describing this experiment.
