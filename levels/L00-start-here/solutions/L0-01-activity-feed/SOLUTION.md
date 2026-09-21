# L0-01 · Solution

## What the profile shows
Captured with `npm run lab -- profile L0-01 --seconds 4 --cpu-prof` and read from the raw `.cpuprofile` (Node 22.23, V8 12.4):

- **Sampling:** 98% of self time is in `buildFeed`. There is no separate `unshift` frame: V8 charges built-in time to the JavaScript caller.
  The profile viewers show that per function; `npm run lab -- lines` shows it per line: the `feed.unshift(...)` line holds about 97% of all samples. The object literal, the loop and the checksum are noise.
- **Allocation:** about 4 MB: the 60,000 small objects (40 bytes each) plus the array's backing store. The GC is not the problem.

## Root cause
`Array.prototype.unshift` shifts every existing element along by one. The k-th call moves k elements, so 60,000 calls move about 1.8 billion element slots: O(n²) work in total.
Doubling the count roughly quadruples the time.

## Fix
`push` (O(1) amortised) in arrival order, then `reverse()` once at the end: O(n) total.

## Measured (20-thread Linux box pinned to 4 cores, Node 22.23, `npm run lab -- run`)
| | time | allocated |
|---|---|---|
| before (`unshift`) | ≈ 177 ms | 4.04 MB |
| after (`push` + one `reverse`) | ≈ 0.6 ms | 4.08 MB |

Scaling of the slow version (warmed up, `gc()` before each run, median of 5): 15k → 10.6 ms, 30k → 43.6 ms, 60k → 180 ms, 120k → 709 ms (each doubling ≈ 4×, textbook n²), then 240k → 4,832 ms (6.8× for the next doubling: worse than n²).

## Take-aways
1. **Total cost = cost per call × calls.** Each `unshift` is microseconds and looks harmless; the *count* and the growing size make it quadratic.
2. A profile with all its self time on one line, and no allocation to speak of, tells you the category (CPU, data movement) before you have read any code.
3. Prediction check (see the worked [lab log](../../../../docs/worked-example/LAB-LOG-example.md)): each doubling should cost 4×; the last one cost more.
4. **Measure with the GC in a known state.** An earlier, sloppier version of these scaling numbers, without a `gc()` before each run, was erratic (30k took 199 ms one time and 44 ms another). Same code, different heap state. The harness does the `gc()` for you for exactly this reason.

## Break your own fix
The fix is wrong when readers need the feed **between** inserts (you can't reverse "at the end" if someone reads it after every insert). Then use a structure with O(1) front insertion:
a ring buffer / deque, or keep the array in arrival order and *index from the back* when reading.
At a count of 5 the original is perfectly fine: never optimise what the profile doesn't show.

## Go further
Why is 240k worse than n²? A backing store of 240k pointers is about 1.9 MB. We have not tested what is behind the extra cost; a plausible guess is that the block being moved no longer fits in the CPU cache, so each move runs at memory-bandwidth speed. Design an experiment that would separate that from a GC effect (hint: `--trace-gc`).

## Further reading
- [[5]](../../../../docs/READING-LIST.md#ref5): how V8 stores arrays, and what makes them fast or slow.
- [[14]](../../../../docs/READING-LIST.md#ref14): flame graphs, and reading "self time" at a glance.
- [[20]](../../../../docs/READING-LIST.md#ref20): amortised analysis of dynamic arrays.
