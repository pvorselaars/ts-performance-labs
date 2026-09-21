# Contributing

## Adding a new exercise

### Naming
`L<level>-<NN>-<slug>` (e.g. `L2-07-route-stats`). A level's final boss is `L<level>-boss-<slug>` instead of a number.

### Required files
Every exercise is a matched pair of folders:

```
levels/<level>/exercises/<id>/
    README.md        symptom + budgets table — NOT the diagnosis. See L0-01 for the shape.
    HINTS.md         progressive hints, one <details> block per hint, cheapest tool first.
    workload.ts      the deliberately slow/broken implementation. Exports `workload(): number` (returns the checksum).
    spec.ts          exports `spec: LabSpec` — the single source of truth for budgets and checksum.
    main.ts          two lines, identical in every exercise and solution (copy it from L0-01).
    package.json     name, "type": "module", and measure/profile scripts (copy from L0-01).

levels/<level>/solutions/<id>/
    SOLUTION.md      what the profile shows, root cause, the fix, "go further" question, further reading.
    workload.ts      the fixed implementation — same exports, same checksum as the exercise.
    main.ts          identical to the exercise's. It loads *the exercise's* spec.ts (see `runFromDir` in src/harness-node/lab.ts).
```
That shared `spec.ts` is what guarantees the exercise and its solution are graded by the exact same budgets and checksum — never copy `spec.ts` into the solution folder.

### Setting budgets and the checksum
`spec.ts` exports a `LabSpec`; see [`src/harness-node/lab.ts`](src/harness-node/lab.ts) for what each field means (it's documented). In short:
- **`expectedChecksum`**: run the *fixed* `workload.ts`, read the value it returns, paste it in. Both the exercise and the solution must produce the same number. Keep it below 2^53 (JavaScript numbers are doubles); for big outputs, hash a string with `hash32`.
- **`maxMedianMs`**: measure the fixed solution's median time with `npm run lab -- run <id> --solution`, then set the budget with generous headroom. It is in "reference ms" and is scaled per machine (see the README's harness section), so don't chase your own machine's exact number. Leave at least 3× headroom: under load we saw the calibrated ratio drift by up to 1.8×, and the harness cannot always tell. The budget must still be *below* the slow version's time on a fast machine.
- **`maxAllocatedMB`**: same idea, but **not** scaled. It is counted with V8's sampling profiler, and V8 can optimise away allocations that never escape, so measure the solution warmed up (the harness does) and leave headroom.
- Only set `maxRetainedMB` or `reset` if the exercise's specific lesson needs that gate.

The slow (exercise) version must **fail** at least one budget; the fixed (solution) version must **pass all of them**, with an identical checksum. That pairing is what `npm run gate` checks automatically. Also do the real work by hand first: profile the slow version and confirm the profile shows what your `SOLUTION.md` says it shows. Write down measured numbers, and mark anything you did not measure as illustrative or unverified.

Then add a row for it to that level's `levels/<level>/README.md` exercise table.

### Style
The existing exercises share a voice: the symptom is described in terms of what you'd *observe*, never what's wrong with the code; `README.md` never uses the word "bug"; hints escalate from "which tool" to "which line" without ever just stating the fix. Read L0-01 before writing a new one — matching that voice matters more than matching any template mechanically.

## Validating your change
```bash
npm run gate -- <prefix>    # e.g. npm run gate -- L2, or a single exercise's id
```
First type-checks both project sets (`tsconfig.json` for exercises, `tsconfig.solutions.json` for solutions). Then for every exercise/solution pair it runs each one and checks: every solution exits `0` (pass), every exercise exits `1` (over budget) — a slow version that accidentally passes is the one thing this script exists to catch. A mismatch prints `SURPRISE` and the script exits non-zero. Exit `3` (inconclusive, noisy machine) is retried twice before it counts as a surprise.

This is also what [.github/workflows/perf-gate.yml](.github/workflows/perf-gate.yml) runs in CI.

## Other changes
- **The harness** (`src/harness-node`, `src/lab-cli`): keep the doc comments on the public API (`LabSpec`, `run`, `runFromDir`) current — they're the first thing an exercise author sees.
- **Docs** (`README.md`, `ROADMAP.md`, `docs/`, `templates/`, every exercise's markdown): built with MkDocs. `npm run docs` (or `npm run docs:serve` for a live preview) builds under `--strict`, which fails on broken internal links — run it before opening a PR that touches markdown. The first run creates a Python venv in `.venv-docs` (needs Python 3). The site is published from `main` by [.github/workflows/docs.yml](.github/workflows/docs.yml). If you add a top-level folder that shouldn't be published, add it to `exclude_docs` in `.mkdocs/mkdocs.yml`.