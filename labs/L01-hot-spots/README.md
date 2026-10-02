# Lab 1: obvious hot spots

The easy wins: code that's simply doing more work than it needs to, in ways a profiler makes obvious at a glance once you know where to look.

**Skills**: Read a call tree; self vs. total time; sampling vs. tracing; budgets as a regression gate.

**Mastery checkpoint**: Find the top self-time frame and its first "your code" caller in under 5 minutes, and say whether the problem is CPU, allocation or call count.

Run one: `npm run lab -- run L01-01` (expect `FAIL`), work it as described in the [top-level README](../../README.md), and only then open the solution.
