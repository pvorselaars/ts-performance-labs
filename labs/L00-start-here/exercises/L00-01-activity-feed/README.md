# L00-01 - Activity feed

*Training wheels*

> **This is Level 0: a complete, already worked exercise.** Do it once *with* [`docs/worked-example/`](../../../../docs/worked-example/README.md)
> open beside you, to see what a finished attempt looks like: every template filled in. Then start Level 1 and fill in your own.

## Symptom
Building an activity feed of 60,000 items takes about **180 ms**. The feed shows newest first, and the code
does exactly one simple operation per item. Allocation is small (about 4 MB) and the GC barely runs. So it is not memory; something is burning CPU.

## Goal
Same feed (checksum), and:

| Budget | Value |
|---|---|
| Median time | 50 ref-ms |
| Median allocated | 8 MB |

## Rules
- Edit `workload.ts`. Don't edit `spec.ts` (budgets and checksum live there).
- Run it with 
```
npm run lab -- run L01-01
```
- Profile with (see [the profiling guide](../../../../docs/PROFILING-GUIDE.md)).
```
npm run lab -- profile L0-01 --cpu-prof
```
- Stuck? `HINTS.md`, one hint at a time. Solution: `../../solutions/L00-01-activity-feed`, only after you pass.

## Extra credit
Change the count to 240,000 (in a scratch copy; the checksum will no longer match, so just time it). Predict first: 4x, 16x, or more? Then measure. What does the answer tell you about the algorithm, and about the cache?
