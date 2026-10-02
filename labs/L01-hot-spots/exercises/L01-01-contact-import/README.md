# L01-01 - Contact import

*Seen It Before*

## Symptom
Importing 20,000 contact rows (about 12,000 distinct people, with repeats and inconsistent email casing) takes
about **a quarter of a second**. Last month's
import of 2,000 rows took a few milliseconds, and nobody thought about it.

## Goal
Keep the exact same results (first occurrence wins, emails compared case-insensitively) and pass:

| Budget | Value |
|---|---|
| Median time | 6 ref-ms |
| Median allocated | 7 MB |

## Rules
- Edit `workload.ts`. Don't edit `spec.ts` (budgets and checksum live there).
- Run it with
```
npm run lab -- run L01-01
```
- Profile with (see [the profiling guide](../../../../docs/PROFILING-GUIDE.md)).
```
npm run lab -- profile L01-01 --cpu-prof
```
- Stuck? `HINTS.md`, one hint at a time. Solution: `../../solutions/L01-01-contact-import`, only after you pass.
