# Roadmap

If you just want to get going, the [top-level README](README.md) has the quick start — this file is the detailed map: what each level teaches, what's built versus still just a sketch, and why the order is what it is.

One sequence of **fifteen levels (0–14)** that share one method (measure → profile → hypothesise → change one thing → re-measure):

- **Levels 0–8, the runtime:** CPU, allocation, GC, memory, event loop, libraries, V8 effects, production tooling. Plain TypeScript on Node, no browser needed.
- **Levels 9–14, Angular:** the same skills in a browser, where new failure modes appear (change-detection storms, layout thrash, long tasks hurting INP, DOM and subscription leaks, bundle weight).

Books, articles and docs per level: [docs/READING-LIST.md](docs/READING-LIST.md). Every level lives in its own folder under [`levels/`](levels/), with its own README. Runtime: **Node 22.18+**; Angular levels target the current Angular release at the time they're built.

**Status legend:**

- ✅ built and verified (slow version fails its budgets, fixed version passes, same checksum)
- 🛠️ being built
- 📐 designed
- 💡 idea

| Level | Theme                                     | Profiling skill                                   | Exercises | Final boss | Status |
|-------|-------------------------------------------|---------------------------------------------------|-----------|------------|--------|
| 0     | Start here: worked example + foundations reading | sampling                                   | 1         | —          | ✅     |
| 1     | Obvious hot spots                         | sampling, line-level ticks                        | planned   | planned    | 📐     |
| 2     | Allocations & GC pressure                 | allocation sampling, `--trace-gc`                 | planned   | planned    | 📐     |
| 3     | Leaks & retention                         | heap snapshots, retainers                         | planned   | planned    | 📐     |
| 4     | Event loop & async                        | event-loop delay, timeline                        | planned   | planned    | 📐     |
| 5     | Library & network stack                   | bundle analysis, network panel                    | planned   | planned    | 📐     |
| 6     | Runtime effects (V8)                      | `--trace-deopt`, `--cpu-prof`, cold-start tiering | planned   | planned    | 📐     |
| 7     | Boss fights                               | everything                                        | planned   | (the whole level) | 💡 |
| 8     | Beyond the IDE (labs)                     | `node --cpu-prof/--heap-prof/--report`, Lighthouse CLI, Chrome traces | planned | planned | 💡 |
| 9     | Angular: change detection                 | Angular DevTools profiler, change-detection tick count | planned | planned  | 📐     |
| 10    | Angular: rendering & layout               | DevTools Performance panel, INP                   | planned   | planned    | 📐     |
| 11    | RxJS & state                              | leak snapshots, request counts                    | planned   | planned    | 💡     |
| 12    | Data, HTTP & caching                      | network + counters                                | planned   | planned    | 💡     |
| 13    | Build & delivery                          | `--stats-json`, Lighthouse                        | planned   | —          | 💡     |
| 14    | Angular: production capstones             | everything                                        | planned   | (the whole level) | 💡 |

*"Profiling skill" names the capability you need, not a specific product — see [docs/PROFILING-GUIDE.md](docs/PROFILING-GUIDE.md) for which tools give you each one.*

## What each level is planned to cover
These are the ideas behind the sketches, not promises about specific exercises.

- **1 — Obvious hot spots.** `includes` in a loop, `reduce` that spreads an accumulator (`{...acc}`), regex backtracking, `JSON.parse(JSON.stringify(x))` for cloning, JSON parsed or stringified repeatedly (or only to compare two objects), `reviver`/`replacer` callbacks on a large payload, sorting with recomputed keys.
- **2 — Allocations & GC pressure.** Objects with unstable shapes, closures created in hot loops, array holes, `arguments`/spread, typed arrays vs plain arrays, and a large `JSON.parse` whose cost is the object graph it allocates. Includes the case where V8 removes the allocation entirely.
- **3 — Leaks & retention.** Closures pinning large data, listeners and timers that are never removed, `Map` vs `WeakMap`, unsubscribed RxJS streams, detached DOM.
- **4 — Event loop & async.** Synchronous work blocking everyone else, sequential `await` in a loop, unbounded `Promise.all`, microtask starvation, moving work to a worker, and a big synchronous `JSON.parse` that stalls every other request on the process (diagnosed with event-loop delay, not a CPU profile).
- **5 — Library & network stack.** Importing a whole utility library for one function, tree-shaking that doesn't, duplicate dependencies, request waterfalls, over-fetching, and oversized JSON payloads (paginate, or stream line-delimited JSON instead of one document).
- **6 — Runtime effects.** Deoptimisation loops, hidden-class churn, watching code tier up with `--cold`.
- **7 / 14 — Boss fights and capstones.** Disguised combinations of a level's defects, with a post-mortem.
- **8 — Beyond the IDE.** A mystery service or app triaged with command-line tools only.
- **9 — Change detection.** Function calls in templates, Default vs OnPush, impure pipes, `@for` without `track`, zone.js noise vs signals/zoneless.
- **10 — Rendering & layout.** A 10,000-row list (virtual scrolling), layout thrash, `@defer`, image loading, layout shift, and a large HTTP response whose JSON parse becomes a long task on the main thread.
- **11 — RxJS & state.** Nested subscribes, `shareReplay` misuse, an `async` pipe that fires N requests, `combineLatest` storms.
- **12 — Data, HTTP & caching.** Interceptor overhead, request de-duplication, cache headers.
- **13 — Build & delivery.** Lazy routes, preloading, size budgets, SSR/hydration cost.

**How to work through it:** in order, 0 → 14, once they exist. Each level ends with a **final boss fight**: a disguised combination of that level's defects with no per-defect hints (Levels 7 and 14 *are* boss levels). Each level has a **mastery checkpoint**: something to do *without notes* before moving on.
