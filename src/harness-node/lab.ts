import inspector from 'node:inspector/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import { basename, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** What an exercise's `spec.ts` exports: the budgets and the checksum. Shared by the exercise and its solution. */
export interface LabSpec {
  /** Printed in the banner. */
  name: string;
  /** What the *fixed* workload returns. A fast wrong answer doesn't count. Keep it below 2^53 (use {@link hash32} for big outputs). */
  expectedChecksum: number;
  /** Median time budget in "reference ms": measured on a slow box, scaled to yours by the calibration loop. */
  maxMedianMs: number;
  /** Allocation budget in MB. Absolute, never scaled. Counted by V8's sampling heap profiler in a separate, untimed pass. */
  maxAllocatedMB: number;
  warmupRuns?: number;
  measuredRuns?: number;
  /** Optional: MB still reachable after a full GC (leak exercises). */
  maxRetainedMB?: number;
  /** Called before every run, to put shared state back. */
  reset?: () => void;
  /** Warm up by time as well as by count so V8 has tiered the hot code up before the measured runs. Default true. */
  timedWarmup?: boolean;
}

export type Workload = () => number;
export interface Exercise extends LabSpec { workload: Workload }

/**
 * Three modes:
 *   (default)        warm up, measure N runs, print a table, PASS/FAIL against the budgets.
 *   --profile        loop the workload for --seconds (default 15) so a profiler gets plenty of samples.
 *   --cold [--runs]  no warm-up, no budgets: watch V8 tier up (Ignition interpreter, Sparkplug baseline, TurboFan optimising; Maglev is opt-in in Node 22).
 *
 * Exit codes: 0 = pass, 1 = over budget, 2 = wrong result (behaviour was broken),
 *             3 = inconclusive (everything checked passed, but the machine was too noisy to check the time budget).
 */
export async function run(ex: Exercise, args: string[]): Promise<number> {
  console.log(`== ${ex.name} ==`);
  warnAboutEnvironment(args);
  if (args.includes('--cold')) return runCold(ex, getInt(args, '--runs', 12));
  if (args.includes('--profile')) return runProfile(ex, getInt(args, '--seconds', 15));
  return runMeasure(ex);
}

/**
 * Entry point shared by every exercise and solution `main.ts` (the file is identical in both).
 * A solution is graded by its exercise's `spec.ts`: one source of truth for budgets and checksum.
 */
export async function runFromDir(dir: string, args: string[]): Promise<number> {
  const isSolution = dir.split(sep).includes('solutions');
  const specDir = isSolution ? join(dir, '..', '..', 'exercises', basename(dir)) : dir;
  const { spec } = await import(pathToFileURL(join(specDir, 'spec.ts')).href) as { spec: LabSpec };
  const { workload } = await import(pathToFileURL(join(dir, 'workload.ts')).href) as { workload: Workload };
  return run({ ...spec, workload }, args);
}

/** FNV-1a over a string: a 32-bit checksum for outputs too big to sum into a double. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// ---- measure ---------------------------------------------------------------------------------------------------

const MinWarmupMs = 1000, MaxWarmupRuns = 60;

async function runMeasure(ex: Exercise): Promise<number> {
  const warmupRuns = ex.warmupRuns ?? 2, measuredRuns = ex.measuredRuns ?? 5, timed = ex.timedWarmup ?? true;

  // Warm up by *time* as well as by count: V8 promotes hot functions to optimised code on a background thread, so a
  // couple of quick runs would leave a correct, fast fix still running slow tier-0 code in the measured runs.
  const warmStart = performance.now();
  for (let i = 0; i < MaxWarmupRuns; i++) {
    ex.reset?.();
    if (!checkResult(ex, ex.workload())) return 2;
    if (i + 1 >= warmupRuns && (!timed || performance.now() - warmStart >= MinWarmupMs)) break;
  }

  const cal = calibrate();
  const timeBudget = ex.maxMedianMs * cal.factor;
  console.log(cal.factor === 1
    ? 'Time budgets: unscaled.'
    : `Machine factor ${cal.factor.toFixed(2)}x vs. reference (budget ${ex.maxMedianMs} ms -> ${timeBudget.toFixed(1)} ms on this machine, calibration cv ${(cal.cv * 100).toFixed(1)}%).`);
  if (cal.noisy) console.log('!! Noisy machine: the calibration loop varied too much to trust a time budget. Close other programs; on Linux run through `npm run lab` (it pins to isolated cores).');
  console.log();

  const times: number[] = [], retained: number[] = [];
  console.log(`${'run'.padStart(4)} ${'ms'.padStart(10)}`);
  for (let i = 1; i <= measuredRuns; i++) {
    ex.reset?.();
    gc();
    const heap0 = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const result = ex.workload();
    const ms = performance.now() - t0;
    if (!checkResult(ex, result)) return 2;
    times.push(ms);
    console.log(`${String(i).padStart(4)} ${ms.toFixed(1).padStart(10)}`);
    if (ex.maxRetainedMB !== undefined) { gc(); retained.push(Math.max(0, process.memoryUsage().heapUsed - heap0) / MB); }
  }

  const allocMb = await measureAllocatedMB(ex);

  const medMs = median(times);
  const timeOk = medMs <= timeBudget, allocOk = allocMb <= ex.maxAllocatedMB;
  const skipTime = cal.noisy && process.env.PERFLAB_FORCE_TIME !== '1';
  console.log();
  console.log(`median time : ${medMs.toFixed(1).padStart(9)} ms   budget ${timeBudget.toFixed(1).padStart(8)} ms   ${skipTime ? 'SKIPPED (noisy machine)' : timeOk ? 'PASS' : 'FAIL'}`);
  console.log(`alloc       : ${allocMb.toFixed(2).padStart(9)} MB   budget ${ex.maxAllocatedMB.toFixed(2).padStart(8)} MB   ${allocOk ? 'PASS' : 'FAIL'}`);
  let retOk = true;
  if (ex.maxRetainedMB !== undefined) {
    const r = median(retained); retOk = r <= ex.maxRetainedMB;
    console.log(`median kept : ${r.toFixed(2).padStart(9)} MB   budget ${ex.maxRetainedMB.toFixed(2).padStart(8)} MB   ${retOk ? 'PASS' : 'FAIL'}   (still reachable after a full GC)`);
  }

  if (!allocOk || !retOk || (!skipTime && !timeOk)) { console.log('\nRESULT: over budget - keep profiling.'); return 1; }
  if (skipTime) { console.log('\nRESULT: INCONCLUSIVE - everything else passed, but the time budget could not be checked on this noisy machine.'); return 3; }
  console.log('\nRESULT: PASS');
  return 0;
}

/**
 * V8 has no GC.GetTotalAllocatedBytes(). The closest exact-enough thing is the sampling heap profiler: sample every
 * ~512 bytes (including objects that were collected since), sum the samples. It costs 2-60x in wall time depending on the
 * interval, so it runs as its own untimed pass, never during a timed run. Off-heap ArrayBuffers are added separately.
 * Note that TurboFan can delete allocations that never escape a loop: 0 MB after warm-up is real.
 */
async function measureAllocatedMB(ex: Exercise): Promise<number> {
  const session = new inspector.Session();
  session.connect();
  await session.post('HeapProfiler.enable');
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    ex.reset?.();
    gc();
    await new Promise(r => setImmediate(r));
    const buffers0 = process.memoryUsage().arrayBuffers;
    await session.post('HeapProfiler.startSampling', {
      samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
    });
    const t0 = performance.now();
    ex.workload();
    const ms = performance.now() - t0;
    const { profile } = await session.post('HeapProfiler.stopSampling');
    const buffers = Math.max(0, process.memoryUsage().arrayBuffers - buffers0);
    samples.push((selfSizeTotal(profile.head) + buffers) / MB);
    if (ms > 1000) break;   // a slow workload under the sampler is very slow: one pass is enough
  }
  session.disconnect();
  return median(samples);
}

interface HeapNode { selfSize: number; children: HeapNode[] }
function selfSizeTotal(n: HeapNode): number {
  let total = n.selfSize;
  for (const c of n.children) total += selfSizeTotal(c);
  return total;
}

// ---- cold / profile --------------------------------------------------------------------------------------------

/** --cold [--runs N]: no warm-up, no budgets. Prints every run so you can watch tier-up (run 1 is usually the slowest). */
function runCold(ex: Exercise, runs: number): number {
  const v8Flags = process.execArgv.filter(a => a.startsWith('--')).join(' ');
  console.log(`Cold mode: ${runs} runs, no warm-up, no budgets.  (node flags: ${v8Flags || 'none'})`);
  console.log(`${'run'.padStart(4)} ${'ms'.padStart(10)}`);
  for (let i = 1; i <= runs; i++) {
    ex.reset?.();
    const t0 = performance.now();
    const result = ex.workload();
    const ms = performance.now() - t0;
    if (!checkResult(ex, result)) return 2;
    console.log(`${String(i).padStart(4)} ${ms.toFixed(1).padStart(10)}`);
  }
  return 0;
}

function runProfile(ex: Exercise, seconds: number): number {
  console.log(`Profile mode: looping for ~${seconds}s. Attach/start your profiler now if you haven't.`);
  if (!checkResult(ex, ex.workload())) return 2;   // one warm-up so JIT noise is out of the way
  const end = performance.now() + seconds * 1000;
  let runs = 0;
  while (performance.now() < end) {
    ex.reset?.();
    if (!checkResult(ex, ex.workload())) return 2;
    runs++;
  }
  console.log(`Done: ${runs} iterations.`);
  return 0;
}

// ---- machine-speed calibration ---------------------------------------------------------------------------------
// Time budgets are written in "reference milliseconds". We time a fixed CPU loop and scale budgets by
// (this machine / reference machine), so a fast laptop can't pass by accident and a slow CI box doesn't fail
// spuriously. Allocation budgets are deterministic and never scaled. PERFLAB_NO_SCALE=1 disables all of it.
// Scaling only corrects a machine that is uniformly slower. It cannot correct a machine that is busy: under
// background load the ratio between the loop and the workload drifts, so if the loop's own run-to-run
// variation (cv) is above 3% the time budget is skipped instead of guessed at. This is a heuristic: measured on a
// busy 20-thread box the time/calibration ratio drifted 0.4x-1.8x of its idle value while the cv stayed under 4% in
// 6 of 7 runs. Budgets therefore need real headroom (CONTRIBUTING.md says 3x).
const ReferenceSpinMs = 90.0;
const NoisyCv = 0.03;
let sink = 0;

function spin(): number {
  let x = 88172645 | 0, acc = 0;
  for (let i = 0; i < 20_000_000; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; acc += x & 0xff; }
  return acc;
}

function calibrate(): { factor: number; cv: number; noisy: boolean } {
  if (process.env.PERFLAB_NO_SCALE === '1') return { factor: 1, cv: 0, noisy: false };
  sink += spin(); sink += spin();   // warm up
  let best = { min: Infinity, cv: Infinity };
  for (let attempt = 0; attempt < 3; attempt++) {
    const xs: number[] = [];
    for (let i = 0; i < 5; i++) { const t0 = performance.now(); sink += spin(); xs.push(performance.now() - t0); }
    const mean = xs.reduce((a, b) => a + b) / xs.length;
    const cv = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) / mean;
    if (cv < best.cv) best = { min: Math.min(...xs), cv };
    if (cv < NoisyCv) break;
  }
  return { factor: best.min / ReferenceSpinMs, cv: best.cv, noisy: best.cv >= NoisyCv };
}

// ---- helpers ---------------------------------------------------------------------------------------------------

const MB = 1024 * 1024;

v8.setFlagsFromString('--expose-gc');
const gcFn = vm.runInNewContext('gc') as () => void;
function gc(): void { gcFn(); }

function checkResult(ex: Exercise, actual: number): boolean {
  if (actual === ex.expectedChecksum) return true;
  console.log(`WRONG RESULT: checksum ${actual}, expected ${ex.expectedChecksum}. A 'fast' answer that is wrong doesn't count.`);
  return false;
}

function warnAboutEnvironment(args: string[]): void {
  const measuring = !args.includes('--profile') && !args.includes('--cold');
  if (measuring && inspector.url() !== undefined)
    console.log('!! Inspector attached (--inspect). Use --profile mode to profile; a debugger changes timing.');
  if (measuring && process.execArgv.some(a => a.startsWith('--cpu-prof') || a.startsWith('--heap-prof') || a === '--prof'))
    console.log('!! A profiler flag is active. Numbers include profiler overhead: use --profile mode when profiling, plain runs when measuring.');
  const pinned = process.env.PERFLAB_PINNED ? `, pinned to CPUs ${process.env.PERFLAB_PINNED}` : '';
  console.log(`Runtime: Node ${process.version}, V8 ${process.versions.v8}, cores: ${navigatorCores()}${pinned}`);
  console.log();
}

function navigatorCores(): number { return globalThis.navigator?.hardwareConcurrency ?? 0; }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 === 1 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
}

function getInt(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isInteger(v) ? v : fallback;
}
