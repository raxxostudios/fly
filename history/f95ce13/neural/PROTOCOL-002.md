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
