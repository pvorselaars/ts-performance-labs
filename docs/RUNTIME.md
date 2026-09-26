# Runtime: how V8 runs your code

> V8 is the JavaScript engine inside Node, and inside Chrome, which is why this page applies to the Angular levels too. This page is about the engine: how it compiles and runs your code. Node's own layer around it (the event loop, libuv, I/O) is [Level 4](../ROADMAP.md).

Every exercise in this lab is timed after a warm-up, and the harness has a `--cold` mode with no warm-up at all. This page explains why, because it changes how you read every number you'll see. Read it once in Level 0; you'll come back to it in Level 6.

**Where the numbers come from.** The measurements on this page were taken on the author's machine (Node 22.23.1, V8 12.4, one pinned core) and are there to show the *shape* of the effect. Yours will differ. The descriptions of how each compiler works come from the V8 team's own write-ups [[6]](READING-LIST.md#ref6)–[[9]](READING-LIST.md#ref9); go to them for the details.

## The idea: start cheap, spend more on what turns out to be hot
JavaScript is not compiled ahead of time. When a function is first called, V8 has to run it *now*, and most functions in a program run once or never again. Spending a lot of effort optimising all of them would make every start-up slow. So V8 keeps several ways of running the same function and moves hot code up a ladder:

| Tier | What it is | Cost to get there | Speed of the code it makes |
|---|---|---|---|
| **Ignition** | An interpreter: runs compact bytecode [[7]](READING-LIST.md#ref7) | Nothing extra: this is where everything starts | Slowest |
| **Sparkplug** | A baseline compiler: turns bytecode into machine code quickly, without optimising [[8]](READING-LIST.md#ref8) | Very cheap to compile | Faster than the interpreter |
| **TurboFan** | The optimising compiler: uses what it has *seen the code do* to generate specialised machine code [[6]](READING-LIST.md#ref6) | Expensive; runs on a background thread | Fastest |

There is also **Maglev**, a mid-tier optimising compiler between Sparkplug and TurboFan [[9]](READING-LIST.md#ref9). In this lab's Node (22.23) it is **off by default**: `node --v8-options` shows `--no-maglev` as the default. Other Node versions may differ, so check yours.

The important word in TurboFan's row is *seen*. While code runs in the lower tiers, V8 records feedback: which types went through this `+`, which object shapes this property access saw. TurboFan then **speculates**: "this has only ever been given integers, so I'll generate integer-only code". That is where most of the speed comes from. It is also a bet, and bets can lose.

## What it looks like: the same function, four ways
The same small function (a tight arithmetic loop), timed in eight successive batches of 20 calls, with the tiers switched on and off using V8 flags. Microseconds per batch:

````mermaid

xychart-beta
    title "Effects of tiered compilation"
    x-axis "batch" [1, 2, 3, 4, 5, 6, 7, 8]
    y-axis "Execution time (µs)" 0 --> 15000
    line "Default" [2182,1128,1134,1191,1158,1127,1136,1149]
    line "Interpreter only" [12497,12559,12367,12486,12535,12411,13007,12522]
    line "Interpreter + Sparkplug" [4931,4750,4769,4731,4729,4800,4727,4745]
    line "Interpreter + TurboFan" [2303,1121,1135,1126,1126,1123,1121,1121]
````

- With everything on, the first batch is slow and the rest are fast: that is the function climbing the ladder. The drop after batch 1 is consistent with TurboFan's code arriving (the next section shows how to see that happen).
- Steady state, the interpreter is about **12x** slower than TurboFan here and Sparkplug about **4x** slower. Sparkplug buys most of the benefit of compiling for almost none of the compile cost, which is why it exists.
- This is close to the *best case* for TurboFan (a hot loop on plain numbers). Real code, full of property lookups, calls and allocation, shows smaller gaps.
- The interpreter-only configuration never speeds up. That is the whole reason a tier has to exist above it.

Reproduce it (put this in any scratch `.ts` file):
```ts
function score(n: number): number { let s = 0; for (let i = 0; i < n; i++) s += (i * 7) % 101; return s; }
const rows: string[] = [];
for (let batch = 1; batch <= 8; batch++) {
  const t = performance.now(); let acc = 0;
  for (let k = 0; k < 20; k++) acc += score(50_000);
  rows.push(Math.round((performance.now() - t) * 1000).toString());   // microseconds
  if (acc < 0) console.log(acc);          // use the result so the work can't be discarded
}
console.log(rows.join(' '));
```
```bash
node scratch.ts                                    # everything on
node --no-sparkplug --no-turbofan scratch.ts       # interpreter only
node --no-turbofan scratch.ts                      # interpreter + Sparkplug
node --no-sparkplug scratch.ts                     # interpreter + TurboFan
```
(On Linux, `taskset -c 0 node ...` keeps it on one core, which makes the numbers steadier.)

## Watching it happen
V8 will tell you when it promotes a function. Use a second scratch file, `deopt.ts`: a function that only ever receives integers for a while, then gets a string.
```ts
function add(a: any, b: any): any { return a + b; }
let acc: any = 0;
for (let i = 0; i < 300_000; i++) acc = add(i, 1);   // always numbers: V8 specialises for them
for (let i = 0; i < 10; i++) acc = add('x', 1);      // a string shows up: the specialised code is invalid
console.log(String(acc).length);
```
```bash
node --trace-opt deopt.ts | grep add
```
prints lines like these:
```text
[marking 0x26663f63b801 <JSFunction add (sfi = 0x3012c2d43eb9)> for optimization to TURBOFAN, ConcurrencyMode::kConcurrent, reason: hot and stable]
[compiling method 0x26663f63b801 <JSFunction add (sfi = 0x3012c2d43eb9)> (target TURBOFAN), mode: ConcurrencyMode::kConcurrent]
[completed compiling 0x26663f63b801 <JSFunction add (sfi = 0x3012c2d43eb9)> (target TURBOFAN) - took 0.012, 0.454, 0.016 ms]
[completed optimizing 0x26663f63b801 <JSFunction add (sfi = 0x3012c2d43eb9)> (target TURBOFAN)]
```
"Hot and stable" is V8 deciding the function is used enough, and its types steady enough, to be worth optimising. `kConcurrent` means the compile happens on another thread while your code keeps running in the lower tier: the optimised code arrives *later*, not instantly. That delay is why the harness warms up by **time** as well as by run count.

Now the bet loses: the string call at the end of `deopt.ts` invalidates the integer assumption.
```bash
node --trace-deopt deopt.ts | grep add
```
```text
[bailout (kind: deopt-eager, reason: not a Smi): begin. deoptimizing 0x3234e2afc871 <JSFunction add (sfi = 0x17eb0685cdb1)>, 0x3beea2759d89 <Code TURBOFAN>, opt id 0, bytecode offset 2, deopt exit 0, FP to SP delta 32, caller SP 0x7fffb8125460, pc 0x7f689aad20b5]
```
The optimised code assumed integers (a *Smi* is V8's small-integer representation), the assumption failed, and V8 threw the optimised code away and went back to a lower tier. That is a **deoptimisation**. One is harmless. A function that gets optimised, deoptimised, optimised again in a loop is a real performance bug, and it is a Level 6 topic.

## What this means for the rest of the lab
- **Warm-up is not cheating.** A one-shot run measures start-up. The harness warms until the code has had time to tier up, then times it. `npm run lab -- cold <id>` skips that so you can watch the ladder: on the L0-01 solution, the first cold runs took 4.5, 2.5, 1.6, 1.7, 2.9, 3.0 ms and reached 0.6 ms by run 7 (noisy: the garbage collector is in there too), against a warmed-up median of 0.6 ms.
- **Profile warmed-up code.** A profile of a process that ran for 200 ms is mostly a profile of the interpreter and the compilers. `profile` mode loops for seconds for that reason.
- **Allocations can disappear.** TurboFan can prove that an object never escapes a loop and never allocate it.
- **Types matter.** Code that always sees the same types and shapes gets fast code. Code that sees many (a function called with numbers, strings and `undefined`) gets slower, more general code, or bounces between tiers. "Keep your hot paths monomorphic" is this fact, restated. Level 2 and Level 6 come back to it.
- **The flags are for learning, not for shipping.** Switching tiers off is a way to *see* them. Don't run production with them off.

## Check yourself
1. Why doesn't V8 compile every function with TurboFan the moment it is called?
2. On the chart above, what does Sparkplug buy you, and what does it cost?
3. What does "hot and stable" mean, and why does an optimised function sometimes get thrown away?
4. Why can an allocation budget pass on a warmed-up run but fail on a cold one?

## Further reading
[[6]](READING-LIST.md#ref6) Launching Ignition and TurboFan · [[7]](READING-LIST.md#ref7) Firing up the Ignition interpreter · [[8]](READING-LIST.md#ref8) Sparkplug · [[9]](READING-LIST.md#ref9) Maglev
