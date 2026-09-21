# Profiling guide

A profiler can't tell you what's wrong — it can only tell you where time and memory actually went, which is usually surprising enough on its own. This is the cheat sheet for turning that into an answer.

Everything below is written in terms of **modes** — sampling, tracing, timeline, allocations, snapshots — not one specific product, because any real profiler gives you these in some form. Concrete steps are included for Chrome DevTools and the free Node.js built-ins; use whichever you've got. Browser and Angular specifics (the Performance panel on a running app, Angular DevTools, Lighthouse) arrive with Level 9 and are marked *planned* below.

## The loop
1. **Measure** a baseline (harness output) — a real number to beat, not a vague sense that it's slow.
2. **Profile** with the right mode — the table below maps symptom to mode; guessing wastes a run.
3. **Hypothesise** — one sentence, written down, *before* you touch any code: what's wrong, and why you think so.
4. **Experiment** — change exactly one thing. Two changes at once means you won't know which one mattered.
5. **Re-measure** — same harness, same machine otherwise idle, no shortcuts.
6. Explain *why* the number moved. If you can't, you got lucky — and luck doesn't generalise to the next bug.

## Pick the mode for the symptom
| Symptom | Mode you need | Why | Where to find it |
|---|---|---|---|
| High CPU, "it's slow" | **Sampling** | Low overhead; shows where CPU time goes | `node --cpu-prof`, Chrome DevTools Performance / Profiler |
| "Called too often?" / exact counts | **Tracing** (manual) | Exact counts; distorts timings — use for counts, then confirm with sampling | a counter or `console.count`, `performance.mark` / `performance.measure` |
| Which *line* in a hot function | **Line-by-line** | Only after sampling narrowed it down | per-line ticks (`positionTicks`) in a `.cpuprofile`, printed by `npm run lab -- lines`; Chrome DevTools and the Firefox Profiler show time per function only |
| Low CPU but slow / waiting | **Timeline** | Shows what ran when, blocking, GC pauses, gaps | DevTools Performance panel; `perf_hooks.monitorEventLoopDelay` for event-loop stalls |
| Lots of GCs, high allocation rate | **Allocations** | Allocation call stacks | `node --heap-prof` (sampling), DevTools Memory → allocation sampling |
| Memory keeps growing / "leak" | **Snapshots** (diff) + retainers | Who retains what | DevTools Memory → heap snapshot, `v8.writeHeapSnapshot()` |
| Slow app in a browser | **Performance panel** *(planned, Level 9)* | Scripting vs rendering vs layout, long tasks, INP | Chrome DevTools, Angular DevTools |

V8 has no built-in exact-call-count profiler: its CPU profiler is a sampler. When you need exact counts, count in code.

Every profiler, whatever it's called, is really offering some subset of these. Knowing what each one is actually doing under the hood is what lets you pick correctly instead of by habit.

- **Sampling.** Every millisecond or so, the profiler interrupts the thread and writes down its current call stack. Do that a few thousand times and the frames that show up most often are the ones actually costing you CPU time. It's statistics, not exact measurement — a very fast function that happens to run in the gaps between samples can be under-counted — but the overhead is low enough that the program still runs at close to normal speed. This is your default first move for "why is this slow."
- **Tracing (instrumentation).** Record an event on *every* function entry and exit (or every call you care about). You get exact call counts and exact per-call timing, no statistics involved — but the instrumentation itself takes time, especially on small, frequently-called functions, so the timings it reports can be inflated relative to reality. Good for "how many times is this actually called," bad for trusting the absolute milliseconds it shows you.
- **Line-by-line.** The same idea as tracing, but a hit count and time per *source line* instead of per function. The most precise of the three, and the heaviest: only reach for it after sampling has already told you which function to look inside.
- **Timeline.** A chronological record of what the thread was doing over wall-clock time — running your code, waiting, paused by the GC. Sampling answers "what is the CPU doing"; timeline answers "why is the CPU sitting idle." JavaScript is single-threaded, so one long synchronous task stalls *everything* queued behind it: a timeline shows that; a sampling profile alone will mislead you.
- **Allocations.** Records object allocations together with the call stack that caused them. This is how you find *who* is generating the garbage, as opposed to a timeline telling you *that* garbage collection is happening.
- **Snapshots (heap diff).** Pauses the process and walks the entire live object graph — a complete inventory of every object and what's holding a reference to it. Take one snapshot, run some work, take another, and diff them: whatever's left over is either legitimately still needed, or a leak. This is the only mode built for answering "why does memory keep growing" rather than "why is this slow."

Rough overhead ordering, cheapest to most invasive: **sampling ≈ allocation sampling ≈ timeline < tracing < line-by-line.** Start cheap, and only reach for something heavier once a cheaper mode has narrowed down where to look.

## Reading a call tree
- **Own/self time** = time in that function's own code. **Total/cumulative** = including callees.
- Sort by self time to find the *leaf* doing the work; then walk **up** to the first frame that's *your code*.
- **In V8, built-ins have no frame of their own.** Time spent inside `Array.prototype.unshift`, `JSON.parse`, `Map.prototype.set`… is charged to the JavaScript function that called them. So the top self-time frame is often already your code; the question becomes *which line*. (L0-01 is exactly this.) The profile viewers stop at the function, so use `npm run lab -- lines` to get the line. Garbage collection shows up separately as `(garbage collector)`, and `(program)` / `(idle)` are the engine and waiting.
- The biggest total-time frame is often just the entry point. It tells you nothing.
- A function that "looks expensive" and a function that *is* expensive are different things. Trust the numbers.
- Ask "how many times?" as well as "how long?". 1 µs × 100 million is a problem; 10 ms × 1 isn't.

## Traps
- **Not warmed up.** V8 starts in an interpreter and tiers hot code up to faster compiled code on a background thread. The first runs are slow and noisy. The harness warms up for you; a profile of a cold process shows startup, which is a different problem. ([RUNTIME.md](RUNTIME.md) explains the tiers.) (`npm run lab -- cold <id>` lets you watch it happen.)
- **GC state.** How long a run takes can depend on whether the garbage collector happens to be mid-way through marking. The harness collects before each timed run; if you time things by hand, do the same (`node --expose-gc`, call `gc()`), or your numbers will jump around for no reason.
- **Optimised-away work.** TurboFan can delete an allocation that never escapes a loop, or a whole loop whose result is unused. If your micro-benchmark shows 0 MB or 0 ms, use the result.
- **A debugger or inspector attached** (`--inspect`, an IDE debug session), or a profiler flag left on, changes timings. Measure plain; profile in profile mode.
- **Profiler overhead** changes behaviour (allocation sampling costs 2–60× depending on interval). Confirm a finding with a second, lighter method.
- **A busy machine.** Close other programs. Under background load the harness's calibration loop stops matching your workload. It sometimes notices and says so (`Noisy machine`, exit code 3), but it often doesn't, so treat a time result from a busy machine as suspect. On Linux, `npm run lab` pins itself to isolated cores to reduce this (`PERFLAB_PIN=0` disables).
- **One run isn't data.** Look at several; the harness reports the median of five.
- **Don't optimise what the profile doesn't show.** And re-profile after each fix: the picture changes.

## Workflows
### Node's built-in CPU profiler (the CLI route; works everywhere)
```bash
npm run lab -- profile L0-01 --cpu-prof          # writes .profiles/CPU.*.cpuprofile
npm run lab -- profile L0-01 --heap-prof         # writes .profiles/Heap.*.heapprofile (sampling allocations)
```
Open a `.cpuprofile` in Chrome DevTools (Performance panel → *Load profile*; the Performance panel imports these files since Chrome 124 [[21]](READING-LIST.md#ref21)), in the [Firefox Profiler](https://profiler.firefox.com) (load the file from disk; the hosted page can't fetch from `localhost`), or drop it on [speedscope](https://www.speedscope.app). Sort by **self time**, find the top frame, then the first frame that is *your* code.

These viewers show time per **function**. For the hot **line**, run `npm run lab -- lines` (newest profile in `.profiles/`, or pass a file; `--top N` sets how many lines). It reads `positionTicks`, the per-line sample counts V8 stores in every node of the raw JSON, and prints each line's share of all samples with the source text. We found no current documentation showing that either browser tool can display those counts for a loaded profile, and neither showed them when we tried.
`--cpu-prof-interval=<µs>` (a plain `node` flag, see `node --help`) changes the sampling interval.

### Chrome DevTools attached to Node
1. `node --inspect-brk levels/L00-start-here/exercises/L0-01-activity-feed/main.ts --profile --seconds 15`
2. Open `chrome://inspect`, click **inspect** on the target, resume, and use the profiler / Memory tabs (wording varies by version).
3. For memory: take heap snapshots at different points, use the **Comparison** view, then look at **Retainers**.

Running `main.ts` directly skips the harness's core pinning; that's fine for profiling, not for timing.

### VS Code and WebStorm
Both can run `main.ts --profile --seconds 15` as a plain Node run configuration and offer a CPU profile from the debug/run tooling (VS Code: *Debug: Take Performance Profile*; WebStorm: run with the CPU profiler). *We haven't verified the exact steps in either IDE here; the built-in `--cpu-prof` route above is the tested one.*

**WebStorm cannot open the `.cpuprofile` files this repo's CLI writes.** Its *Analyze V8 Profiling Log* action reads V8 *tick logs* (`isolate-<n>` files) and its heap action reads `.heapsnapshot` files; [the documentation](https://www.jetbrains.com/help/webstorm/v8-cpu-and-memory-profiling.html) doesn't mention `.cpuprofile`, and importing one shows nothing useful. JetBrains tracks this as a bug for Chrome-saved `.cpuprofile` files ([WEB-46486](https://youtrack.jetbrains.com/issue/WEB-46486), unresolved when last updated in January 2023). Options: open the file in Chrome DevTools, the Firefox Profiler or speedscope and use `npm run lab -- lines` for lines, or record with WebStorm's own *V8 Profiling* run-configuration tab. Node's `--prof` flag also writes a V8 tick log (`isolate-…-v8.log`, readable with `node --prof-process`); we confirmed Node writes it, but not that WebStorm opens it.

### Browser and Angular *(planned, Level 9)*
Chrome DevTools Performance panel on a running app, Angular DevTools' profiler, Lighthouse, and the browser-side harness.

### Other CLI tools
```bash
node --trace-gc levels/L00-start-here/exercises/L0-01-activity-feed/main.ts --profile --seconds 1
```
`--trace-gc` prints one line per garbage collection: the kind (`Scavenge` is the cheap young-generation one; `Mark-Compact` is the full one), heap size before and after, and how long it took. More CLI tools arrive with Level 8 (the CLI-only labs).
