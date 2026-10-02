# Hints (open one at a time)

<details><summary>Hint 1 — which tool?</summary>

Look at the harness output before you open a profiler. The result is a few hundred numbers, yet hundreds of MB were allocated. Both budgets failed, so time and memory are two views of the same problem. Start with a **sampling** CPU profile (`npm run lab -- profile L02-01 --cpu-prof`) and sort by **self time**. `node --trace-gc` shows how busy the garbage collector is.
</details>

<details><summary>Hint 2 — where?</summary>

Nearly all self time sits in one small function of yours, and the GC is a minor slice of it. `npm run lab -- lines` prints the hottest source lines in your newest profile. Which line? Then ask what that line *builds* each time it runs, and whether anything ever reads the previous result again.
</details>

<details><summary>Hint 3 — why?</summary>

Count the keys. How many does the accumulator hold when the 10th order is processed? The 1,000th? The 5,000th? The line gives every order a fresh object. How many properties does it have to copy to make it, and what happens to the old object? Multiply that by the number of orders. Does the total look like the amount of work the result needs?
</details>
