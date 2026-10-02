# L02-01 - Solution

## What the profile shows
Captured with `npm run lab -- profile L02-01 --seconds 4 --cpu-prof` and read from the raw `.cpuprofile` (Node 22.23, V8 12.4):

- **Harness output:** about 308 ms and about 580 MB allocated, for a result of 300 numbers. Allocation is about 116 KB *per order*.
- **Sampling:** 98% of self time is in one anonymous function, the reducer callback at `workload.ts:8`. `npm run lab -- lines` puts 96% of all samples on that single line. `totalsByCustomer` itself, `createOrders` and the checksum loop are noise. Another 1% is the garbage collector.
- **GC:** `--trace-gc` shows about 59 scavenges per run and no mark-compacts. Each scavenge is cheap, but there are a lot of them, and nearly everything they look at is already dead.
- **The numbers don't fit the output.** 300 totals is a few KB of live data; 580 MB went through the allocator to produce it.

## Root cause
`{ ...totals, [customer]: ... }` builds a brand-new object and copies every existing key into it, on every order. Once all 300 customers have appeared, each of the remaining orders copies about 300 properties and throws the previous object away. Total work is about orders x distinct customers (here around 1.5 million property copies), and almost all of it becomes garbage immediately.

Each step also looks harmless: one reducer call, one spread. It only adds up because the count (5,000) and the size of the accumulator (up to 300) multiply.

## Fix
Update one `Map` in place and convert it to the object shape once, at the end.
Cost is one lookup and one write per order, plus one pass at the end: O(orders). Median time drops from about 308 ms to about 0.6 ms, and allocation from about 580 MB to under 1 MB. The checksum is identical, since both versions list customers in first-seen order.

## Take-aways
1. **Time and allocation are two views of the same problem.** The allocation number is also a deterministic regression gate: it doesn't wobble the way wall-clock time does.
2. **Tiny output, huge allocation** is the signature of copying you don't need. Ask what each iteration builds and whether anything reads it again.
3. **A reducer that returns a new object is not "free functional style".** `{ ...acc }` is fine once, or for a handful of keys. In a loop over a growing accumulator it is quadratic in practice.
4. **Mutating an accumulator that nobody else can see is not a style crime.** It never escapes the function, so the immutability you gave up wasn't protecting anyone.

## Break your own fix
The fix is only right because nobody observes the intermediate objects. If each step's result is a *state that other code keeps* (a Redux-style reducer, undo history, anything compared by reference), you need the new object, and the cost is the price of that guarantee. Then look at structural sharing (Immer, persistent maps) instead of full copies.

At 10 customers the original is perfectly fine: never optimise what the profile doesn't show.

## Go further
- Double the order count (in a scratch copy; the checksum will no longer match), predict the ratio, then measure. Then keep the orders and double the customer count. Which of the two changes the time more, and why?
- Use a plain object (`totals[o.customer] = ...`) as the mutable accumulator instead of a `Map`. How close is it to the `Map`, and what changes when the keys look like integers?
- `--heap-prof` on this exercise barely shows the problem. Why would a sampling *heap* profile miss garbage that was already collected, when the harness's allocation counter caught all of it?

## Further reading
- [[5]](../../../../docs/READING-LIST.md#ref5): how V8 stores objects, and what makes copying and growing them expensive.
- [[14]](../../../../docs/READING-LIST.md#ref14): flame graphs, and reading "self time" at a glance.
