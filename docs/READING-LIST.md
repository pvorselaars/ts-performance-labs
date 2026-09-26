# Reading list

Organised by level, matching [ROADMAP.md](../ROADMAP.md). Read **just in time**: attempt the exercise first, then read. Citations are IEEE-style, numbered continuously; the full list is in [References](#references) at the end.

Only Level 0 is written so far. The later sections are placeholders that fill in as each level is built.

## The core shelf

| # | Reference | Why | Level use |
|---|---|---|---|
| [[1]](#ref1) | Gregg, *Systems Performance* | Methodology, OS-level tools, Linux focus | 7, 8 |
| [[2]](#ref2) | Grigorik, *High Performance Browser Networking* | How the network actually behaves under a browser; free online | 5, 12, 13 |
| [[3]](#ref3) | The V8 blog | First-hand explanations from the engine's authors: arrays, objects, GC, the compilers | 0, 2, 3, 6 |

## Level 0: Foundations
Goal: know what the runtime is doing to your code, and how to look at it, before you start looking for problems.

- [[4]](#ref4) — V8's young-generation and full garbage collections: why one is cheap and the other is not. Needed for the Level 0 checkpoint.
- [[5]](#ref5) — how arrays are stored, and what makes them fast or slow. Directly relevant to L0-01.
- [the runtime guide](RUNTIME.md), then [[7]](#ref7) (the interpreter), [[8]](#ref8) (the baseline compiler), [[6]](#ref6) (the optimising compiler joins the pipeline) and [[9]](#ref9) (optional).
- [[10]](#ref10) — the language-level view of allocation, reachability and collection.
- [[11]](#ref11), [[12]](#ref12) — the built-in Node.js profiling tools this lab's CLI wraps.
- [[13]](#ref13), [[21]](#ref21) — the DevTools Performance panel, where you'll open the `.cpuprofile` files, and the Chrome 124 announcement that it imports them.
- [[14]](#ref14), [[15]](#ref15) — what a flame graph is and how to read one; a viewer that opens `.cpuprofile` files.
- [[20]](#ref20) — amortised analysis of dynamic arrays, the background to why `unshift` in a loop is quadratic and `push` is not (the L0-01 solution's further reading).

## Level 1: Obvious hot spots
*Not written yet.*

## Level 2: Allocations & GC pressure
*Not written yet. Likely starts from* [[16]](#ref16) *and* [[17]](#ref17).

## Levels 3-8: Leaks, event loop, libraries, runtime effects, boss fights, CLI-only labs
*Not written yet.*

## Levels 9-14: Angular
*Not written yet. Likely first entries:* [[18]](#ref18), [[19]](#ref19).

## References

<a id="ref1"></a>[1] B. Gregg, *Systems Performance*, 2nd ed. Addison-Wesley, 2020. [Online]. Available: [https://www.brendangregg.com/systems-performance-2nd-edition-book.html](https://www.brendangregg.com/systems-performance-2nd-edition-book.html)

<a id="ref2"></a>[2] I. Grigorik, *High Performance Browser Networking*. O'Reilly Media, 2013. [Online]. Available: [https://hpbn.co/](https://hpbn.co/)

<a id="ref3"></a>[3] V8 Team, "V8 blog," v8.dev. [Online]. Available: [https://v8.dev/blog](https://v8.dev/blog)

<a id="ref4"></a>[4] P. Marshall, "Trash talk: the Orinoco garbage collector," V8 blog, Jan. 3, 2019. [Online]. Available: [https://v8.dev/blog/trash-talk](https://v8.dev/blog/trash-talk)

<a id="ref5"></a>[5] M. Bynens, "Elements kinds in V8," V8 blog, Sep. 12, 2017. [Online]. Available: [https://v8.dev/blog/elements-kinds](https://v8.dev/blog/elements-kinds)

<a id="ref6"></a>[6] V8 Team, "Launching Ignition and TurboFan," V8 blog, May 15, 2017. [Online]. Available: [https://v8.dev/blog/launching-ignition-and-turbofan](https://v8.dev/blog/launching-ignition-and-turbofan)

<a id="ref7"></a>[7] R. McIlroy, "Firing up the Ignition interpreter," V8 blog, Aug. 23, 2016. [Online]. Available: [https://v8.dev/blog/ignition-interpreter](https://v8.dev/blog/ignition-interpreter)

<a id="ref8"></a>[8] L. Swirski, "Sparkplug — a non-optimizing JavaScript compiler," V8 blog, May 27, 2021. [Online]. Available: [https://v8.dev/blog/sparkplug](https://v8.dev/blog/sparkplug)

<a id="ref9"></a>[9] T. Verwaest, L. Swirski, V. Gomes, O. Flückiger, D. Mercadier, and C. Bruni, "Maglev - V8's fastest optimizing JIT," V8 blog, Dec. 5, 2023. [Online]. Available: [https://v8.dev/blog/maglev](https://v8.dev/blog/maglev)

<a id="ref10"></a>[10] MDN contributors, "Memory management," MDN Web Docs, Mozilla. [Online]. Available: [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)

<a id="ref11"></a>[11] OpenJS Foundation, "Profiling Node.js applications," Node.js Learn. [Online]. Available: [https://nodejs.org/en/learn/getting-started/profiling](https://nodejs.org/en/learn/getting-started/profiling)

<a id="ref12"></a>[12] OpenJS Foundation, "Flame graphs," Node.js Learn (Diagnostics). [Online]. Available: [https://nodejs.org/en/learn/diagnostics/flame-graphs](https://nodejs.org/en/learn/diagnostics/flame-graphs)

<a id="ref13"></a>[13] Google, "Analyze runtime performance," Chrome DevTools, Chrome for Developers. [Online]. Available: [https://developer.chrome.com/docs/devtools/performance](https://developer.chrome.com/docs/devtools/performance)

<a id="ref14"></a>[14] B. Gregg, "Flame Graphs," personal site. [Online]. Available: [https://www.brendangregg.com/flamegraphs.html](https://www.brendangregg.com/flamegraphs.html)

<a id="ref15"></a>[15] J. Wong, "speedscope," GitHub. [Online]. Available: [https://github.com/jlfwong/speedscope](https://github.com/jlfwong/speedscope) (hosted viewer: [https://www.speedscope.app](https://www.speedscope.app))

<a id="ref16"></a>[16] C. Bruni, "Fast properties in V8," V8 blog, Aug. 30, 2017. [Online]. Available: [https://v8.dev/blog/fast-properties](https://v8.dev/blog/fast-properties)

<a id="ref17"></a>[17] OpenJS Foundation, "Memory," Node.js Learn (Diagnostics). [Online]. Available: [https://nodejs.org/en/learn/diagnostics/memory](https://nodejs.org/en/learn/diagnostics/memory)

<a id="ref18"></a>[18] Google, "Web Vitals," web.dev. [Online]. Available: [https://web.dev/articles/vitals](https://web.dev/articles/vitals)

<a id="ref19"></a>[19] Google, "Fix memory problems," Chrome DevTools, Chrome for Developers. [Online]. Available: [https://developer.chrome.com/docs/devtools/memory-problems](https://developer.chrome.com/docs/devtools/memory-problems)

<a id="ref20"></a>[20] T. H. Cormen, C. E. Leiserson, R. L. Rivest, and C. Stein, *Introduction to Algorithms*, 4th ed. Cambridge, MA, USA: MIT Press, 2022. ISBN 978-0-262-04630-5.

<a id="ref21"></a>[21] Google, "Goodbye JS Profiler, profiling CPU with the Performance panel," Chrome for Developers blog. [Online]. Available: [https://developer.chrome.com/blog/profiling-cpu](https://developer.chrome.com/blog/profiling-cpu)
