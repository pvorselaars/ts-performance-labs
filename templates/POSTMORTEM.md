# Post-mortem

Write this after every boss fight and capstone, *before* reading any solution. A blameless format: describe the system, not the person - nobody learns anything from a report that's secretly about how dumb they felt.
Keep it under one page. The value is in "why did it take that long to find?".

```
## <incident name> — <date>

#### Summary
One or two sentences: what users saw, for how long, how bad.

#### Impact
Numbers: p50/p99 before and after, error rate, peak memory, requests per second or interactions per minute at the time.

#### Timeline
What I looked at, in order, with what each step told me (including the wrong turns).

#### Root causes
Every distinct defect, in the order they were exposed. Note which one masked which.

##### Detection
How would I have noticed this in production? Which metric, alert or budget would have caught it?

##### Fix
What I changed, one line per defect, and the measurement that confirmed each.

#### What I got wrong
Hypotheses I held that were false, and what evidence killed them.

#### Prevention
One regression gate (budget, test, alert) per root cause.

#### Earlier exercise it resembles
e.g. L2-03 closure churn
```
