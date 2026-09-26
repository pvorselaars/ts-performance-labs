# Post-mortem

You won't write one of these until Level 7, but here is the template completed for a small, real-shaped incident, so the format is familiar.
(Fictional service; the defect is the one from L0-01. The numbers are invented for illustration.)

## Feed page slow for power users, 2026-09-21

#### Summary
The notifications page for accounts with large histories took seconds to load. Median users were unaffected. About 1% of accounts were, all of them the heaviest users.

#### Impact
p50 40 ms (unchanged); p99 2.4 s (was 90 ms last month); no errors. One CPU core pegged per slow request, and the Node event loop stalled for everyone else on that instance while it ran.

#### Timeline
1. Alert on p99 only, so it looked like "a few slow requests", not a regression.
2. Checked the database first (wrong turn: the query log showed 3 ms). Wasted ~1 h.
3. `--cpu-prof` of a slow request: 95% self time in the feed builder. The per-line sample counts in the profile put all of it on one `unshift` line. Found `feed.unshift(...)` in a loop.

#### Root causes
Only one: front insertion into an array, quadratic in history length. It "worked" because test accounts had < 200 items.

##### Detection
A load test with a *realistic long-tail* of history sizes, or a budget on the p99 by account-size bucket. The p50 alert could never fire.

##### Fix
`push` + one `reverse()`. Confirmed: p99 back to 95 ms; a 240k-item synthetic account now builds in ~10 ms.

#### What I got wrong
"The database is usually the slow part." The query log had the answer in minutes (3 ms); I should have believed it.

#### Prevention
1. Budget in CI on feed-build time at n = 100k.
2. Alert on p99 latency per account-size bucket.
3. A code-review note: no `unshift` in a loop over data that can grow.

#### Earlier exercise it resembles
L1-02 (linear work inside a loop; planned): the same "count x cost" shape.
