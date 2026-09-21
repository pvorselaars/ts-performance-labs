# Level 0 — a worked example, every template filled in

Use this once, before Level 1, to see the *shape* of a finished attempt — what "done" actually looks like, before you're the one trying to produce it. It uses the exercise
[`levels/L00-start-here/exercises/L0-01-activity-feed`](../../levels/L00-start-here/exercises/L0-01-activity-feed/README.md). Spoilers below, so **try the exercise first for 15 minutes**, then compare.

| Template | Where it lives | The filled-in example |
|---|---|---|
| Symptom + budgets | exercise `README.md` | [../../levels/L00-start-here/exercises/L0-01-activity-feed/README.md](../../levels/L00-start-here/exercises/L0-01-activity-feed/README.md) |
| Progressive hints | exercise `HINTS.md` | [../../levels/L00-start-here/exercises/L0-01-activity-feed/HINTS.md](../../levels/L00-start-here/exercises/L0-01-activity-feed/HINTS.md) |
| Lab-log entry | your `templates/LAB-LOG.md` | [LAB-LOG-example.md](LAB-LOG-example.md) |
| Solution write-up | `solutions/…/SOLUTION.md` | [../../levels/L00-start-here/solutions/L0-01-activity-feed/SOLUTION.md](../../levels/L00-start-here/solutions/L0-01-activity-feed/SOLUTION.md) |
| Post-mortem (Level 7+ template, shown early) | your `templates/POSTMORTEM.md` | [POSTMORTEM-example.md](POSTMORTEM-example.md) |

## The loop, at a glance
1. `npm run lab -- run L0-01` → `FAIL` (≈ 177 ms vs a 50-ref-ms budget, about 15 ms on the machine this was written on).
2. Profile with sampling: `npm run lab -- profile L0-01 --cpu-prof`. Sort by **self time**. Find the top frame, then get the line inside it with `npm run lab -- lines` (the profile viewers show time per function, not per line).
3. **Write the hypothesis in the log before touching code.**
4. Change **one** thing. Re-run. `PASS`.
5. Explain *why the number moved*. Read the solution. Break your own fix.

## What a good entry is (and isn't)
- Specific: it names a frame, a line, a count, a size.
- Honest: it records the wrong first guess. That is where calibration comes from.
- Short: 10 lines, not a report.

## A note on the profiler observations
The harness numbers and the profile summary in these files were measured (a `--cpu-prof` capture, read from the raw `.cpuprofile`). They were not taken from a DevTools screenshot.
When you do this for real, write what *your* profiler showed, including the surprises.
