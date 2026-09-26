# Lab-log entry

Copy of the template from `templates/LAB-LOG.md`, completed for L0-01. Compare with your own after you've tried the exercise.

## L0-01 activity-feed — 2026-09-21

#### Prediction
Something quadratic, given "one simple operation per item". Each time I double the item count I expect about 4× the time. Going from 60k to 240k items: 16×.

#### Baseline
177 ms / 4.0 MB allocated   (budget 15 ref-ms ≈ 15 ms on this machine → FAIL; allocation 4.0 of 8 MB → PASS)

#### Profiler + mode
`--cpu-prof` (V8 sampling profiler), via `npm run lab -- profile L0-01 --cpu-prof`

#### What I saw
98% of self time in `buildFeed`. Nothing else in my code has meaningful self time.
Line-level analysis of the same .cpuprofile (`npm run lab -- lines`): the `feed.unshift(...)` line holds about 97% of all samples. Allocation is small and constant: not a memory problem.

#### Hypothesis
`unshift` moves all existing elements every call, so total work grows as n². The fix is to stop inserting at the front.

#### Change made
`push` in arrival order and a single `reverse()` at the end.

#### Result
0.6 ms / 4.1 MB → PASS

#### Surprise
Allocation didn't move (4.0 v. 4.1 MB) although time dropped 300x. I had half expected that a "fast" version would also allocate less. It doesn't: the same 60,000 objects get built either way.
Also: I first looked for `unshift` as a frame in the flame chart and couldn't find it. `npm run lab -- lines` is where it shows up.

#### Hints used
0

#### Could I explain it to someone else in 2 minutes?
Yes: an array is one contiguous block; inserting at the front moves everything; 60,000 times moves 1.8 billion slots.

#### Where would this bite in a real system?
Any "newest first" structure that grows without a cap: notification lists, chat history, undo stacks, log tails. It is invisible at 100 items and a wall at 100,000.

#### Break my own fix
Wrong when readers need the feed between inserts; other data structure is needed.

#### Extra-credit check
On the slow version (warmed up, `gc()` before each run): 60k → 180 ms, 120k → 709 ms (3.9×, as predicted), 240k → 4,832 ms. That is 27× from 60k, not the 16× my pure-n² prediction gave.
Prediction was right in kind (quadratic), wrong in size: log that. Why the extra 1.7×? My guess is the 1.9 MB backing store stops fitting in cache, but I have **not** checked that. It's a hypothesis, not a finding.
