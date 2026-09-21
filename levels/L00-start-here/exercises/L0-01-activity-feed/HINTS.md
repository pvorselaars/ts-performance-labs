# Hints (open one at a time)

<details><summary>Hint 1 — which tool?</summary>

A **sampling** CPU profile. `npm run lab -- profile L0-01 --cpu-prof` writes a `.cpuprofile` into `.profiles/`; open it in Chrome DevTools (Performance panel → load profile) or speedscope, and sort by **self time**. The harness output tells you the rest: allocation is tiny and the time is huge, so this is a CPU problem, not a memory one.
</details>

<details><summary>Hint 2 — where?</summary>

Nearly all self time sits in one function of yours. V8 doesn't show built-in methods such as `Array.prototype.*` as separate frames: their time is charged to the JavaScript function that called them. So the top self-time frame *is* your code; open it. The profile viewers show time per *function*, not per line, so ask for the lines instead: `npm run lab -- lines` prints the hottest source lines in your newest profile. Which line?
</details>

<details><summary>Hint 3 — why?</summary>

A JavaScript array is backed by a contiguous store. Adding at the front has to move every existing element one slot along. How many elements are moved by the 1st insert? By the 60,000th? Add those up.
</details>
