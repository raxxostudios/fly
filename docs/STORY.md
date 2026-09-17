<!-- The long-form write-up behind the site and the film. Published as an X article on 16 September 2026; this is the source text. -->

# Can a fly-brain model survive German bureaucracy?

*An independent computational experiment, a real learning control, and an insect with entirely fictional confidence.*

A fly has no passport and absolutely no reason to understand German constitutional law.

So of course I wanted to know if a model built from its nervous system could pass Germany's citizenship test before I do.

It has six legs and I have an internet connection. Neither of us likes paperwork, which felt like enough common ground to call it a research project.

Then Google and HHMI Janelia, together with collaborators, released a reconstruction of the male fruit fly nervous system, and suddenly the joke had a dataset behind it.

My plan was to take a model built on that released wiring and see if it could learn at all. The citizenship questions were supposed to come after that.

The part that matters, before anything else: **the saved model has not passed the citizenship test.** In a separate control experiment it did learn four directly stimulated neural patterns. Those results are not the same thing, and everything below depends on keeping them apart.

The animated fly would like me to stop repeating this. It has already ordered a graduation hat.

## Start with the wiring map, it's the real achievement

The male-CNS reconstruction was published on September 3, 2026. It covers the brain and the ventral nerve cord, with more than 166,000 neurons and roughly 125 million synaptic connections, and it gives researchers anatomical detail on cell types, sensory pathways, movement and the differences between male and female circuits. Google wrote a [short overview](https://blog.google/innovation-and-ai/technology/research/male-fruit-fly-brain-map/) and a [detailed research account](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/), and the data itself lives at [MaleCNS](https://male-cns.janelia.org/).

Having the whole nervous system in one map means sensory circuits and the ventral nerve cord can be studied together. [Google's visual overview](https://blog.google/innovation-and-ai/technology/research/male-fruit-fly-brain-map/) describes 11,691 cell types and points to companion work on things like vision and social behavior. That's anatomy and circuit research. It is not evidence that this fly can read.

Another easy mix-up: the learning model mentioned later in the [Google Research](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/) article comes from a separate study on elephantnose fish. It doesn't show the male fly map learning German.

The graph I kept for simulation has 166,700 neurons and 25,582,938 directed cell-to-cell edges. Several anatomical contacts can feed into a single edge, which is why the edge count doesn't match the reported synaptic-contact count.

The wiring constrains the model, but it doesn't specify everything you need to simulate one. I still had to choose neural dynamics, sensory encoding, connection strengths, learning and how to interpret the output. The retained simulation runs on a Doomfly-derived leaky integrate-and-fire kernel. That kernel is an assumption layered on top of the anatomy, and so is my sensory and learning setup (the project's methods and source audit document both).

This is my own independent experiment on released anatomy. Google and Janelia published that anatomy, and neither ran this citizenship challenge or validated my model.

The fictional applicant remains deeply impressed with its own credentials.

## German wasn't even the first problem

Before any citizenship questions, I tried something much simpler. The model had to say which of four quadrants contained a bright patch.

That gate failed with a held-out score of 0/16. The populations meant to hold the memory and give the answer stayed silent, and the learning rule didn't change any candidate weights.

Separately, an untrained practice baseline got 33 citizenship questions and abstained on all of them, for a score of 0/33.

Those abstentions matter. The model wasn't picking a string of funny wrong answers, because its output never met the stated rule for choosing an answer. Anything funny in the demo is my commentary, not an invented neural response.

I also logged 110 calibration trials across 22 configurations, and none met the declared visual admission criteria. That gave me an implementation problem to investigate, not permission to put a passing score on screen.

To be fair to the fly, it never lost a debate about constitutional law. I just hadn't built a visual learning route that worked.

## So I asked a smaller question

Could the model learn if I bypassed the sensory route I hadn't fixed?

I declared a positive control based on direct neural stimulation. Four disjoint groups of 16 visual Kenyon cells served as four input patterns, and each trial stimulated one group directly.

No citizenship question went into this experiment, so there was no German to decode. It was a controlled test of association learning within the stated neural model.

Across 128 training presentations, a supervised local learning rule changed existing connections from Kenyon cells to designated output populations. Those populations had fixed A, B, C and D labels. The graph topology stayed fixed too.

Training used target labels to update the weights. In the frozen evaluation, the stimulus drove the model and its output firing rates determined the choice. No hidden language model was picking the control's response, and no OCR system or answer lookup was either.

That still leaves explicit engineering choices. Fixed output labels are already an interpretation layer, and the sensory and learning assumptions are part of what has to be evaluated.

## What "only the fly brain" actually means here

There's no living insect sitting this exam. There's a numerical model, and its retained connectivity comes from a fly reconstruction.

A question image doesn't turn itself into input currents, and output neurons don't arrive with meanings attached. Those interfaces are authored engineering, same as the rule for how weights change during training. Hiding them would make the experiment less informative, so here's the original visual attempt.

The question text and answer options were rendered into a grayscale image, and a fixed approximation projected the pixel values onto mapped visual receptors. Four designated output populations stood for A, B, C and D. A unique highest firing rate selected an answer. Silence or a tie meant abstention.

A separate grader knew the answer key. That key was never drawn into the question image or used to select an answer during frozen inference. Training a supervised control does use target labels, but that's not the same as secretly handing the model test answers at inference.

So the setup asks what the declared model can do through those interfaces. It doesn't recreate what a fly experiences, and it doesn't establish that a fly understands a single word on the page.

The bureaucracy here is simulated, which has not made it any less of a headache.

## This part worked

Each evaluation condition had 32 lab trials.

| Condition | First ensemble set | Different ensemble set |
|---|---:|---:|
| Untrained | 9/32 | 8/32 |
| Trained | 32/32 | 30/32 |
| Shuffled training labels | 8/32 | 0/32 |
| Existing connection weights changed | 178 | 244 |

These evaluations varied stimulation strength across four familiar neural patterns. The second experiment used different ensembles and fresh seeds, which makes it a computational replication inside the model, not a second biological animal.

That's encouraging, narrowly. The trained model behaved differently, and shuffling the training labels didn't reproduce the change.

The applicant reads this as proof that it is broadly qualified for public office.

The methods section disagrees.

## A perfect score isn't the end of the experiment

The 32 evaluation trials were not 32 new concepts. They revisited four familiar neural patterns at varied stimulation strengths, and a model can do well on that controlled task without learning a general procedure for reading, let alone citizenship.

There are also only two reported ensemble configurations. Repeated trials inside one model are not independent biological animals, and two configurations can't establish broad reliability across every initialization or parameter set.

The shuffled-label scores, 8/32 and 0/32, need care too. Those are measured outcomes under those particular conditions, not proof that every shuffled run should sit at some theoretical chance level. A system that can abstain doesn't necessarily behave like a uniform random guesser with four options.

I'm not claiming statistical significance from these counts. The stronger evidence here is changed performance next to recorded weight changes, plus the targeted interventions below.

## Then I changed the model back

Reloading the saved learned weights reproduced 32/32 lab trials. Resetting those weights returned the score to 9/32, and silencing Kenyon cells took it down to 0/32.

That supports the idea that the learned connections mattered for performance on this control.

What it doesn't show is German comprehension, or a model you could call a complete biological fly.

The topology question is separate. Nothing here establishes that the exact anatomical wiring was necessary. A matched alternative-topology control would address that, and that's a different question.

## Why 32 in one place and 33 in another?

Because they're different experiments.

The official German citizenship test has 33 questions, three of them about the relevant federal state. You get 60 minutes, and you need 17 correct answers to pass (see the [official test regulation](https://www.gesetze-im-internet.de/einbtestv/__1.html)).

My neural-pattern control used 32 evaluation trials per condition. A 32/32 there is not a near-perfect citizenship-test result, however hard the fly lobbies for that reading.

The saved citizenship run was an untrained practice selection of text-only catalogue questions. It was not an official examination. It scored 0/33 with 33 abstentions, and the correct choices were checked separately against the documented question-key transcription.

That's also why the human challenge on the website is only a three-question mini quiz. Beat the recorded baseline and you get a joke and a share card. No certificate.

## How long would training take?

I don't know. There's no measured time-to-pass for the citizenship challenge.

The first direct-stimulation training control had 128 presentations of 400 simulated milliseconds each, which adds up to 51.2 simulated seconds. Its recorded training kernel time on that particular workload was 1.78 seconds. The replication logged 3.943 seconds of training kernel time.

Those numbers describe that control and its implementation. Don't read them as biological learning times or universal hardware benchmarks. And since no end-to-end citizenship training process has been demonstrated, they aren't an estimate for mastering the citizenship test either.

The next real milestone is a visual route that works and passes a frozen learning check. After that, a citizenship experiment would need its training and evaluation splits and its controls declared up front, and it would have to hold up when the wording changes or the answers move.

Recognizing familiar study pages would already be an interesting engineering result. Generalizing to new language is a different claim.

## What would make a future success claim convincing?

I'd start by fixing the visual route and evaluating it on a small declared task. That means tracing where stimulus-dependent activity reaches the relevant populations and checking that competing stimuli stay distinguishable, with weights frozen whenever learning gets measured.

Then the citizenship task, defined before any training. Reusing a fixed catalogue tests recognition of familiar items. Holding out question families, or rewording prompts and changing the typography, tests progressively stronger generalization. Report those separately.

Answer position needs its own check. If the correct text moves from A to D and the model still picks A, it hasn't shown that it reliably selects the correct answer text. Changing answer positions is a useful test, but passing it doesn't prove language comprehension by itself.

For comparisons, I'd want the untrained model, shuffled training labels, weight resets and a simpler baseline. A matched topology control could ask whether the anatomical wiring contributes anything beyond broad properties like connection count. It would have to preserve the properties being compared, because beating an arbitrarily broken competitor proves very little.

Before advertising any result, I'd preserve the trial-level predictions, abstentions, training settings, input images, evaluation rules and checkpoints. Every planned condition gets reported, the disappointing ones included. No tuning on the final held-out test while still calling it unseen.

None of that is completed work. It's a proposed protocol for the next stage, and it's how the joke could grow into a stronger computational finding, if the visual route ever cooperates.

## The website is where the joke gets its legs

I turned the saved studies into a 68-second story. An animated fly and an enlarged anatomical brain turn up at a fictional office for fly affairs.

The latest packaged sequence gives the fly an entrance, a growing storm of forms, a panic performance and a particle-brain explosion with a camera dive. The joke is that bureaucracy overwhelms the applicant. The explosion is authored visual satire, not a measured neural event. That updated sequence still needs its final deployed check and a recorded video before it can serve as the article’s main film.

The fly's body performance is scripted, not a validated neural motor controller. During the original baseline replays, the sampled neural highlights do follow recorded model spikes. The displayed 630 skeletons are a subset of the anatomy, not the full simulation graph, and the body mesh comes from a different source specimen than the brain. Aligning it with an enlarged brain was a presentation choice.

In the direct-stimulation chapter, the stimulated cells aren't in the displayed skeleton sample, so the view shows the actual population totals instead of pretending to locate those spikes in space.

Visitors can also answer three real catalogue questions against the same recorded untrained baseline. The fly is allowed to protest the outcome. It is not allowed to change it.

## A note about the available record

A workspace reset wiped the source and checkpoints for my later, unpublished experiments, and the individual records went with them. I'm not promoting their reported aggregate scores as reproducible findings. This release uses the recoverable FLY-001 and FLY-002 records.

Whether a model constrained by fly anatomy can eventually learn this task is still open in this project.

## Inspect the evidence

On the deployed demo, open these pages and files:

- `lab.html`: the direct-stimulation study with its controls, plus the existing recorded-data film.
- `attempt.html`: the original visual-learning attempt, with the full untrained practice replay.
- `data/study-002/summary.json`: control scores and interventions, along with file hashes.
- `data/study-002/plasticity-control.json`: individual control trial records.
- `data/study-002/plasticity-control-replication.json`: replication records.
- `data/run.json`: the 33-question baseline.
- `research.html`: broader scientific context and source links.

The current demo address is https://fly-navy.vercel.app/. The latest cinematic update has not yet been verified on that deployment. The study files listed above also ship in the downloadable project package.

Nobody has peer-reviewed this as a citizenship-learning result, and Google and Janelia had no part in it beyond publishing the anatomy. If you can point to a specific assumption I got wrong, or a control I skipped, I'd like to hear it.

The applicant has requested that all further questions be submitted on a banana. I'll risk plain text for mine.

If you've ever fed rendered images into a connectome-based model: when the memory and answer populations stay silent, where do you look first?
