# Hints (open one at a time)

<details><summary>Hint 1 — which tool?</summary>

Only the time budget failed; allocation is fine. That points at CPU, so use a **sampling** profile (`npm run lab -- profile L01-01 --cpu-prof`) and sort by **self time**. A memory tool would show you nothing useful here.
</details>

<details><summary>Hint 2 — where?</summary>

Nearly all self time sits in one function of yours. V8 doesn't show built-in methods such as `Array.prototype.*` as separate frames: their time is charged to the JavaScript function that called them. `npm run lab -- lines` prints the hottest source lines in your newest profile. Which line holds almost all the samples?
</details>

<details><summary>Hint 3 — why?</summary>

How many entries does the list you search hold when row 100 is processed? Row 10,000? Row 20,000? Add up the comparisons. Then ask what question that line is really answering ("have I seen this email?") and whether it needs to look at every earlier entry to answer it.
</details>
