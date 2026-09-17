# FLY · fidelity to the Google/Janelia research

This independent experiment uses the released MaleCNS v1.0 anatomical resource.
It is not a Google experiment, a validated digital animal or an official exam.

## What the source research established

Google's 3 September 2026 research article describes a collaboration led by HHMI
Janelia that reconstructed the male fly's brain and ventral nerve cord. It reports
over 166,000 neurons and roughly 125 million synaptic connections. Human experts
proofread and annotated the reconstruction. The map supports investigation of
sensory-to-motor pathways, sexual dimorphism and variation across individuals.

The article's discussion of a mechanistic learning model in a vertebrate refers
to a separate elephantnose-fish study. It must not be attributed to this fly
citizenship experiment or treated as a demonstration that the fly map learns text.

Sources: [Google Research](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/),
[MaleCNS project](https://male-cns.janelia.org/),
[associated Cell paper](https://doi.org/10.1016/j.cell.2026.08.015).
The detailed source-paper claims used here come from the accessible official
project pages; full Cell text was unavailable during this review.

## What is reproduced or derived

| Component | Implementation | Boundary |
|---|---|---|
| Dataset | MaleCNS v1.0 flat-connectome tables, minimum confidence 0.5 | URLs, byte counts and SHA-256 hashes in source-lock.json |
| Retention | Assigned neuronal superclass; explicit Glia excluded | 166,700 cells retained by stated criteria |
| Connectivity | Every source edge between retained cells; includes self-edges and single-contact edges | 25,582,938 directed pairs aggregate 124,177,617 contacts |
| Transmitter annotation | Released consensus assignments | Coarse sign proxy; receptor dependence and modulatory chemistry are not validated |
| Display anatomy | 630 original SWC skeletons, simplified continuous branches | Display subset does not reduce the simulation graph |
| Visual-memory interface | Existing KCg-d cells and anatomically ranked MBON outputs | A/B/C/D meanings are experimental labels |
| Body | NeuroMechFly meshes and joint hierarchy | Separate source specimen; authored motion is illustrative |

## What the source does not supply

The paper does not supply the text-to-retina projection, a citizenship training
set, A/B/C/D output labels, our LIF membrane parameters, efficacy multiplier,
tonic currents, gain changes or local supervised learning rule. Every one is
an experimental addition. Connection contact counts alone do not determine
physiological efficacy, activity or learning dynamics.

FLY-001 uses the declared Doomfly-derived LIF proxy. FLY-002 retains its kernel
and tests revised sensory/decoder interfaces and explicit population-level gain
and tonic-current assumptions. These changes are logged prospectively. They
are not fitted to biological recordings and do not establish biological fidelity.

## What FLY-002 establishes so far

The direct-stimulation positive control learns a mapping from four familiar
neural ensembles to four measured output populations. It reaches 32/32 held-out
amplitude trials, then 30/32 in a replication using different ensembles. Reset
and silencing controls support a causal role for the learned weights and input
pathway in that particular model assay. No external learned classifier answers.

It does not establish vision, word recognition, German comprehension or civic
knowledge. All 22 tested retinal-calibration configurations failed their stated
admission criteria. The visual-learning gate and citizenship training remain
unpassed/unstarted. The old 0/33 sitting remains an unchanged untrained baseline.

## Next fidelity requirement

Calibrate the visual pathway against published physiological responses, rather
than treating arbitrary extra activity as improvement. Test sensitivity to
transmitter-sign assumptions, sensory cell modeling and recurrent dynamics.
Then repeat the visual learning task with frozen evaluation, label controls
and causal interventions before any question-bank pilot.

See [the prospective protocol](data/study-002/protocol.md),
[complete results and hashes](data/study-002/summary.json), and
[the deeper literature review](research.html).
