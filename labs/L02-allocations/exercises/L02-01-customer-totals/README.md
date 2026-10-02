# L02-01 - Customer totals

*Spread thin*

## Symptom
The nightly rollup totals 5,000 orders per customer. The result is about 300 numbers, yet the run takes a quarter of a second. Last month's run (500 orders) took a few ms.

## Goal
Same feed (checksum), and:

| Budget | Value |
|---|---|
| Median time | 2 ref-ms |
| Median allocated | 1 MB |

## Rules
- Edit `workload.ts`. Don't edit `spec.ts` (budgets and checksum live there).
- Run it with
```
npm run lab -- run L02-01
```
- Profile with (see [the profiling guide](../../../../docs/PROFILING-GUIDE.md)).
```
npm run lab -- profile L0-01 --cpu-prof
```
- Stuck? `HINTS.md`, one hint at a time. Solution: `../../solutions/L00-01-activity-feed`, only after you pass.
