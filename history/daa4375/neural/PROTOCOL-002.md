# FLY-002 · prospective learning revision

Written on 14 September 2026 before executing the revised calibration.
This is a new model hypothesis. FLY-001 and its recorded failures remain intact.

## Fixed boundaries

Retain all 166,700 neurons and 25,582,938 directed edges. Use the existing LIF
kernel, retinal positions and fixed MBON11/12/13/14-to-A/B/C/D decoder.
No added classifier, text model, OCR, answer lookup, direct quadrant-to-output
drive or new neural edges. Supervised targets may enter training weight updates
only. They must be absent from held-out inference. Labels are interface choices,
not biological meanings assigned by the source research.

## Signal audit before learning

Compare the legacy saturating retinal current with `30 × luminance`. The latter
retains image contrast; it remains a coarse engineering approximation of sensory
transduction. Present blank and four centered bright patches for 400 ms each.

Inspect a fixed sequence of four configurations: legacy; linear input; linear
input with uniform tonic current 6 in KCs and selected MBONs; that same tonic
current with all existing incoming KC weights multiplied by 4. The resting-to-
threshold difference is 7, so the tonic current alone is subthreshold. Gain
and tonic changes are declared calibration parameters, not known physiology.
Keep signed edges signed. Record spikes and observed voltage/conductance at
20 ms intervals. Report all configurations, including saturation or silence.

Choose the first configuration with stimulus-dependent KC spikes, no blank
KC response, and no output population above 100 Hz. If none meets these criteria,
stop before training and diagnose signal propagation. Any further calibration
must be specified as a new prospective amendment before it executes; held-out
learning trials cannot be used to select these settings.

## Learning rule and evaluation

After signal calibration, attempt supervised local updates on existing positive
KC-to-selected-MBON synapses. Eligibility uses presynaptic spikes alone, allowing
silent postsynaptic cells to learn. On an incorrect or abstained training trial,
increase eligible efficacy into the target population and decrease it into a
selected wrong population. Specify the learning rate, bounds and trial count
before that training run. No label-dependent drive is allowed.

Use separate seeds for training, fresh-render validation and replication. Freeze
all weights before each evaluation. Require at least 12/16 held-out correct
choices on two independently generated evaluation sets. Record every attempt,
untrained and label-shuffled controls, and a KC-silencing intervention. Do not
claim biological learning from this engineering assay. The gate is necessary,
not sufficient, for citizenship training.

Citizenship training remains blocked unless this gate passes. Then preregister
a small balanced question-bank pilot, option-order tests and separate grading
before expanding the task. No passing score or convergence time is promised.

## Amendment A · after the first signal audit, before further trials

The four initial configurations did not satisfy signal criteria. Uniform KC
tonic drive triggered strong recurrent responses for the upper patches, while
the lower patches matched the blank. Fourfold gain activated all 4,064 KCs.
No training or held-out learning test was performed in that audit.

An anatomical and input-coverage inspection identified two interface defects.
The original UV mapping places 1,070 / 1,487 / 78 / 700 receptors in its four
quadrants. MBON13 and MBON14 have no direct input from the visual KCg-d subtype.
Therefore amend the interface prospectively, retaining every neural edge:

- Apply within-eye marginal empirical rank normalization to the original UV
  coordinates; preserve coordinate order and overlapping left/right fields.
  This is a label-independent display-to-retina encoding, not an optical claim.
- Fix the decoder to MBON09 / MBON27 / MBON05 / MBON01 for A/B/C/D. These are the
  four types with the largest summed KCg-d input efficacy in this graph, chosen
  anatomically before training. Their respective type sizes are 4 / 2 / 2 / 2.
- Apply tonic current only to the 206 KCg-d cells, rather than all KCs; apply
  output tonic current 6.5 equally. Scale KC-to-KC recurrent efficacies by 0.1
  and KC-to-designated-output efficacies by 0.1 to test a sparser regime.
  These are modeling assumptions requiring validation, not measured physiology.
- Compare `(KC tonic, external KC input gain)` in this order: `(6,1)`, `(6,4)`,
  `(6.8,1)`, `(6.8,4)`. External gain excludes KC-to-KC edges. Retain signs.

Run blank and the same four centered patches for each configuration, without
training. Choose the first with at most 1% of KCs active on blank, 1–25% active
on each patch, at least five spikes of L1 count-vector difference between
every pair of patches, and output rates at most 100 Hz. Background activity
below this bound is admitted explicitly; absence of all spontaneous activity
is not a biological requirement. Report all candidates. These are calibration
criteria, not the held-out learning gate, whose 12/16 × two-set criterion remains.

## Amendment B · relay excitability, before further calibration

Amendment A produced at most three KC spikes per trial, with no candidate meeting
the distinct-response criterion. Its four configurations are retained in the log.
The anatomical audit finds 200 visual-projection neurons directly connected to
KCg-d, but only 7–10 total spikes from these afferents in the unmodified model's
400 ms calibration trials. Test subthreshold relay excitability without labels.

Retain Amendment A's interface and gains, set KC tonic to 6.8 and visual-projection
tonic to 6.0. Compare `(optic-intrinsic tonic, external KC input gain)` in order:
`(0,1)`, `(0,4)`, `(3,1)`, `(3,4)`, `(5,1)`, `(5,4)`. Lamina tonic stays 12.
Use the same blank/four-patch protocol and eligibility criteria. These uniform
population drives are explicit coarse assumptions, not parameters supplied by
Google or Janelia. No target-dependent activation or neuronal edge is introduced.
