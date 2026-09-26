# Basics to mastery

You know the moment: some perfectly reasonable-looking code is quietly eating a gigabyte of RAM, freezing the tab for half a second on every keystroke, or stalling your Node service for everyone at once, and you have no idea why yet. This lab exists to give you that moment on purpose, somewhere safe — a profiler, a stopwatch, and nobody paging you at 3 a.m.

It's a self-study lab of small, deliberately broken programs. Each one hands you a **symptom**, not a diagnosis ("this feed takes 180 ms to build," never "this is doing quadratic array inserts"), plus a built-in load driver, a pass/fail budget, progressive hints, and a solution write-up for afterwards. You go find the problem yourself with a real profiler — whichever one you've got — fix it, and the harness tells you two things: did you actually make it faster, and did you keep the output correct. No credit for a fast wrong answer.

It is the TypeScript sibling of [C# Performance Labs](https://github.com/pvorselaars/csharp-performance-labs) and shares its method: 

> measure → profile → hypothesise → experiment → re-measure.

**New to performance work?** Start with Level 0. **Already comfortable with V8 internals?** Level 1 is next, once it exists.

## Status
**Level 0 is built** (one worked exercise, the harness, the gate, the docs). Levels 1–14 are mapped out in [ROADMAP.md](ROADMAP.md) but not built yet. Reading for each level is in [docs/READING-LIST.md](docs/READING-LIST.md), and grows as levels are written.

**Start with [Level 0](docs/worked-example/README.md):** one exercise, already worked — lab log, hints, solution and post-mortem all filled in — so you can see what a finished attempt looks like before you attempt your own.

## Setup
- **Node.js 22.18 or newer** (`.nvmrc` says 22). Exercises are plain `.ts` files that Node runs directly by stripping the types, so there is no build step. `npm install` only fetches TypeScript for type-checking.
- **A profiler.** Nothing here is tied to one brand. Every exercise just needs a sampling CPU profile, and later ones allocation and heap-snapshot views:
  - **Node's built-in profilers** (`--cpu-prof`, `--heap-prof`) — what this repo's CLI wraps, and the tested route. Free, cross-platform.
  - **Chrome DevTools** — opens the `.cpuprofile` files, or attaches live with `--inspect`.
  - **Firefox Profiler** — opens the `.cpuprofile` files too (load them from disk at profiler.firefox.com); it can't attach live to Node.
  - **VS Code or WebStorm** built-in profilers, if you'd rather stay in the IDE. (WebStorm can't open the `.cpuprofile` files this repo writes; see the [profiling guide](docs/PROFILING-GUIDE.md).)
  - **speedscope**, for a flame-graph view of a `.cpuprofile`.

  **New to profiling?** [docs/PROFILING-GUIDE.md](docs/PROFILING-GUIDE.md) opens by explaining what sampling, tracing, timeline, allocations and snapshots each actually *are*, then maps symptom → mode → tool. **New to V8?** [docs/RUNTIME.md](docs/RUNTIME.md) explains the Ignition → Sparkplug → TurboFan pipeline, which is why every run is warmed up before it is timed.
- `npm install`, then `npm run typecheck` to check that everything compiles.
- **Leave the `solutions/` folders closed** until you've passed an exercise — they're the answer key. (`tsconfig.solutions.json` keeps them out of your editor's default project.)

## Running an exercise
```bash
npm run lab -- list                        # every exercise
npm run lab -- run L0-01                   # warm up, measure 5 runs, PASS/FAIL (expect FAIL to start)
npm run lab -- profile L0-01 --cpu-prof    # loop for 15 s and write a .cpuprofile into .profiles/
npm run lab -- lines                       # the hottest source lines in the newest .cpuprofile
npm run lab -- cold L0-01                  # no warm-up: watch V8 tier up
```
`<id>` can be any unique prefix. Add `--solution` to run the answer key. Each exercise folder also has a `package.json` with `measure` and `profile` scripts, so an IDE's npm panel picks them up.

To attach your own profiler to a process, run the entry file directly: `node levels/L00-start-here/exercises/L0-01-activity-feed/main.ts --profile --seconds 15` (or add `--inspect-brk` and open `chrome://inspect`). That skips the core pinning described below, which is fine for profiling and not for timing.

## How to work an exercise
1. Read the exercise `README.md` (symptom + budgets). If you can resist, don't open `workload.ts` yet.
2. Run it: `npm run lab -- run <id>` → expect `FAIL`. That's the point.
3. Profile it (see [docs/PROFILING-GUIDE.md](docs/PROFILING-GUIDE.md)). Use `profile` so it runs long enough to get a real sample.
4. In [LAB-LOG.md](templates/LAB-LOG.md), write **what you saw and your hypothesis** *before* changing code. Yes, really — this is the step everyone wants to skip, and the one that actually builds the intuition.
5. Change **one thing**. Re-run. Repeat until `RESULT: PASS`.
6. Stuck for 15+ minutes? Open one hint from `HINTS.md`. Just one. Then, if you still need it, the next.
7. After passing, read `solutions/<name>/SOLUTION.md`, compare with your fix, and answer the "Go further" question.

## The harness
Some terms below (GC, tiering, retained memory) won't mean much yet if you're brand new to this — that's fine. Level 0 and the reading list cover them properly. Treat this section as the reference to come back to.

- **Exit code:** `0` pass · `1` over budget · `2` wrong result (checksum mismatch — a fast wrong answer doesn't count) · `3` inconclusive (see "noisy machine").
- **Two budgets today.** *Median time* and *allocated MB*. Some exercises add *retained MB* (still reachable after a full GC). Level-specific budgets (event-loop delay, bundle size, change-detection ticks) arrive with the levels that need them.
- **Time budgets are scaled to your machine.** They're written in "reference ms" (measured on the reference machine, whose calibration loop takes 27 ms). The harness times a fixed CPU loop and scales the budget so a fast laptop can't pass by accident. `npm run lab -- calibrate` prints your machine's factor (how many ms here one reference ms takes). Set `PERFLAB_NO_SCALE=1` to see unscaled budgets.
- **Allocation is counted, not guessed.** V8 has no "total bytes allocated" counter, so the harness uses V8's sampling heap profiler in a separate, untimed pass (it slows the code down far too much to time). Two consequences: allocation budgets are absolute and machine-independent, and V8's optimiser can delete an allocation that never escapes a loop, so an exercise can honestly show 0 MB.
- **Noisy machine (a heuristic, not a guarantee).** Scaling only corrects a machine that is *uniformly* slower. Under background load the calibration loop and your workload slow down by different amounts: on the author's machine the time-to-calibration ratio was rock-steady idle (0.1–0.9% variation) but drifted between 0.4× and 1.8× of that under 20 busy loops. The harness watches the calibration loop's own variation, and if it is over 3% it says so, skips the time budget and exits `3` instead of guessing (`PERFLAB_FORCE_TIME=1` overrides). But that check only caught 1 of 7 loaded runs in our test, so **close other programs before trusting a time verdict**, and rely on budgets with generous headroom.
- **Core pinning (Linux, Windows).** `npm run lab` runs exercises pinned to one thread on each of up to four of your fastest physical cores, which reduced the drift under load (from 0.4×–1.8× of the idle ratio to a steady ~0.6×) but did not remove it. `--no-pin` or `PERFLAB_PIN=0` turns it off. On Windows the cores are picked by a heuristic (the first thread of each hyperthreaded core, which on Intel hybrid CPUs are the P-cores) and pinned with `start /affinity`; the numbers above were measured on Linux. macOS has no API for pinning, so it runs unpinned.
- **Warm-up.** V8 starts in an interpreter and tiers hot code up on a background thread, so the harness warms up by time as well as by count, and forces a GC before each timed run so the heap state is the same every time.
- **A debugger or profiler flag attached** while measuring: the numbers are meaningless, and the harness warns you.

## Validating
```bash
npm run gate            # every solution must PASS, every exercise must FAIL; also type-checks both project sets
npm run gate -- L0      # only ids starting with L0
```
See [CONTRIBUTING.md](CONTRIBUTING.md). 
