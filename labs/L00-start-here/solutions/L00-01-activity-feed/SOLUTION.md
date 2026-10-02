# L00-01 - Solution

## What the profile shows
Captured with `npm run lab -- profile L0-01 --seconds 4 --cpu-prof` and read from the raw `.cpuprofile` (Node 22.23, V8 12.4):

- **Sampling:** 98% of self time is in `buildFeed`. There is no separate `unshift` frame: V8 charges built-in time to the JavaScript caller.
  The profile viewers show that per function; `npm run lab -- lines` shows it per line: the `feed.unshift(...)` line holds about 97% of all samples. The object literal, the loop and the checksum are noise.
- **Allocation:** about 4 MB: the 60,000 small objects (40 bytes each) plus the array's backing store. The GC is not the problem.

## Root cause
`Array.prototype.unshift` shifts every existing element along by one. The k-th call moves k elements, so 60,000 calls move about 1.8 billion element slots: O(n^2) work in total.
Doubling the count roughly quadruples the time.

## Fix
`push` (O(1) amortised) in arrival order, then `reverse()` once at the end: O(n) total.

## Take-aways
1. **Total cost = cost per call x calls.** Each `unshift` is microseconds and looks harmless; the *count* and the growing size make it quadratic.
2. A profile with all its self time on one line, and no allocation to speak of, tells you the category (CPU, data movement) before you have read any code.
3. Prediction check (see the worked [lab log](../../../../docs/worked-example/LAB-LOG-example.md)): each doubling should cost 4x; the last one cost more.

## Break your own fix
The fix is wrong when readers need the feed **between** inserts (you can't reverse "at the end" if someone reads it after every insert). Then use a structure with O(1) front insertion:
a ring buffer / deque, or keep the array in arrival order and *index from the back* when reading.
At a count of 5 the original is perfectly fine: never optimise what the profile doesn't show.

## Go further
Why is 240k worse than n^2? A backing store of 240k pointers is about 1.9 MB. We have not tested what is behind the extra cost; a plausible guess is that the block being moved no longer fits in the CPU cache, so each move runs at memory-bandwidth speed. Design an experiment that would separate that from a GC effect (hint: `--trace-gc`).

## Further reading
- [[5]](../../../../docs/READING-LIST.md#ref5): how V8 stores arrays, and what makes them fast or slow.
- [[14]](../../../../docs/READING-LIST.md#ref14): flame graphs, and reading "self time" at a glance.
- [[20]](../../../../docs/READING-LIST.md#ref20): amortised analysis of dynamic arrays.
