# L01-01 - Solution

## What the profile shows
Captured with `npm run lab -- profile L01-01 --seconds 4 --cpu-prof` and read from the raw `.cpuprofile` (Node 22.23, V8 12.4):

- **Harness output:** about 240 ms against a budget of about 10 ms, but only about 6 MB allocated, which is within budget. Only the time budget failed, so memory tools were the wrong choice.
- **Sampling:** 96% of self time is in `importContacts`. There is no separate `includes` frame: V8 charges built-in time to the JavaScript caller. `npm run lab -- lines` puts 96% of all samples on the `seen.includes(key)` line. The `toLowerCase` call and the rest of the loop are noise.

## Root cause
`seen` is an array, and `includes` scans it linearly for every row. Row k compares against up to k-1 earlier keys, so total work is **O(n^2)**: with about 12,000 distinct emails among 20,000 rows, that is on the order of 10^8 string comparisons. Each one is cheap and allocates nothing, which is why neither the code nor the memory numbers look wrong.

It hides at small sizes. 2,000 rows is roughly 100x fewer comparisons than 20,000.

## Fix
A `Set` of the normalised keys. One hash lookup per row, so O(n). Median time drops from about 240 ms to about 4 ms. Allocation stays about the same (about 6 MB, mostly the generated rows), because the allocation was never the problem. The checksum is identical: the `toLowerCase` normalisation keeps the exact case-insensitive semantics.

## Take-aways
1. **Which budget failed told you which tool to use.** CPU-bound with flat memory means a sampling profile.
2. **Complexity bugs are invisible until N grows.** When you review code, ask "what is N in production?"
3. A "seen" check is a membership question. An array answers it in O(n), a `Set` or `Map` in O(1).

## Break your own fix
A `Set` costs memory (per-entry overhead) and a hash on every lookup. For a handful of entries, `includes` on an array is often just as fast or faster. At 10 rows the original is perfectly fine: measure at the realistic N, not the theoretical one.

## Go further
- Double the row count (in a scratch copy; the checksum will no longer match) and predict the ratio before you measure. Is it 2x, 4x, or something in between, and why? (Hint: the number of distinct people is fixed.)
- After the fix, profile again. What is the top frame now, and is it worth optimising?
- `sort` + compare neighbours also dedupes in O(n log n). When would you prefer it over a `Set`?

## Further reading
- [[5]](../../../../docs/READING-LIST.md#ref5): how V8 stores arrays, and what makes them fast or slow.
- [[14]](../../../../docs/READING-LIST.md#ref14): flame graphs, and reading "self time" at a glance.
