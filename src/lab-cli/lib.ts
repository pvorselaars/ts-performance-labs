import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface Project { id: string; level: string; kind: 'exercise' | 'solution'; dir: string }

/** Every exercise/solution directory that has a main.ts, sorted by level then id. */
export function findProjects(): Project[] {
  const out: Project[] = [];
  const labsDir = join(repoRoot, 'labs');
  for (const level of readdirSync(labsDir).sort()) {
    for (const [folder, kind] of [['exercises', 'exercise'], ['solutions', 'solution']] as const) {
      const base = join(labsDir, level, folder);
      if (!existsSync(base)) continue;
      for (const id of readdirSync(base).sort()) {
        const dir = join(base, id);
        if (existsSync(join(dir, 'main.ts'))) out.push({ id, level, kind, dir });
      }
    }
  }
  return out;
}

/** Match an id exactly (case-insensitive) or as a unique prefix, e.g. "L0-01". */
export function resolveProject(idPrefix: string, kind: Project['kind']): Project {
  const all = findProjects().filter(p => p.kind === kind);
  const q = idPrefix.toLowerCase();
  const exact = all.filter(p => p.id.toLowerCase() === q);
  const hits = exact.length ? exact : all.filter(p => p.id.toLowerCase().startsWith(q));
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new Error(`No ${kind} matches "${idPrefix}". Try: npm run lab -- list`);
  throw new Error(`"${idPrefix}" is ambiguous: ${hits.map(h => h.id).join(', ')}`);
}

/**
 * Pin to one thread per physical core, fastest cores only (skips the E-cores on hybrid CPUs and the hyperthread
 * siblings), up to 4. Measured on a hybrid i7 (Linux): under background load the calibration loop's run-to-run
 * variation went from 15% unpinned to ~3% pinned. Linux and Windows; macOS has no API for it. Disable with PERFLAB_PIN=0.
 * Returns the logical CPU numbers, e.g. "0,2,4,6", or null for "don't pin".
 */
export function pinCpus(): string | null {
  if (process.env.PERFLAB_PIN === '0') return null;
  if (process.platform === 'linux') return linuxCpus();
  if (process.platform === 'win32') return windowsCpus ??= findWindowsCpus();
  return null;
}

function linuxCpus(): string | null {
  if (spawnSync('taskset', ['--version']).status !== 0) return null;
  const r = spawnSync('lscpu', ['-e=CPU,CORE,MAXMHZ'], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
  if (r.status !== 0) return null;
  const rows = r.stdout.trim().split('\n').slice(1).map(l => l.trim().split(/\s+/))
    .map(([cpu, core, mhz]) => ({ cpu: Number(cpu), core: Number(core), mhz: Number(mhz) || 0 }))
    .filter(x => Number.isInteger(x.cpu) && Number.isInteger(x.core));
  if (rows.length === 0) return null;
  const top = Math.max(...rows.map(x => x.mhz));
  const firstThread = new Map<number, number>();
  for (const x of rows) if (x.mhz >= top * 0.95 && !firstThread.has(x.core)) firstThread.set(x.core, x.cpu);
  const cpus = [...firstThread.values()].sort((a, b) => a - b).slice(0, 4);
  return cpus.length ? cpus.join(',') : null;
}

let windowsCpus: string | null | undefined;   // cached: the PowerShell query takes about a second

/**
 * Windows reports no per-core speed without P/Invoke, so this is a heuristic: logical CPUs 2k and 2k+1 are the two
 * threads of one core, and the hyperthreaded cores come first. On Intel hybrid CPUs only the P-cores are
 * hyperthreaded and Windows numbers them first, so "the first thread of each hyperthreaded core" is the P-cores.
 * No hyperthreading at all (logical == physical): CPUs 0-3. Anything unexpected: don't pin.
 */
function findWindowsCpus(): string | null {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum'], { encoding: 'utf8' });
  const cores = Number(r.stdout?.trim()), logical = availableParallelism();
  if (r.status !== 0 || !Number.isInteger(cores) || cores <= 0 || cores > logical || logical > 64) return null;
  const smtCores = logical - cores;
  const cpus = smtCores > 0
    ? Array.from({ length: Math.min(4, smtCores) }, (_, i) => 2 * i)
    : Array.from({ length: Math.min(4, cores) }, (_, i) => i);
  return cpus.join(',');
}

/**
 * Wrap a node command line so it runs pinned: `taskset -c` on Linux, `start /affinity <hex mask>` on Windows.
 * On Windows `start /b /wait` keeps the child in this console and hands its exit code back through cmd.
 * Caveat: a spawnSync timeout kills cmd there, not the node child under it.
 */
function pinned(cpus: string, node: string[]): { cmd: string; args: string[]; verbatim: boolean } {
  if (process.platform !== 'win32') return { cmd: 'taskset', args: ['-c', cpus, ...node], verbatim: false };
  const mask = cpus.split(',').reduce((m, c) => m | (1n << BigInt(c)), 0n).toString(16);
  const line = `start "" /b /wait /affinity ${mask} ${node.map(a => `"${a}"`).join(' ')}`;
  return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], verbatim: true };
}

export interface SpawnOptions { nodeFlags?: string[]; harnessArgs?: string[]; pin?: boolean; quiet?: boolean; timeoutMs?: number }

/** Run a project's main.ts in a child node (pinned on Linux and Windows). Returns the child's exit code (124 = timed out). */
export function runProject(p: Project, o: SpawnOptions = {}): number {
  return runScript(join(p.dir, 'main.ts'), o);
}

/** Run a script in a child node, pinned like the exercises. Returns the child's exit code (124 = timed out). */
export function runScript(file: string, o: SpawnOptions = {}): number {
  const node = [process.execPath, ...(o.nodeFlags ?? []), file, ...(o.harnessArgs ?? [])];
  // cmd.exe can't safely quote an argument that contains a quote: run those unpinned.
  let cpus = o.pin === false ? null : pinCpus();
  if (cpus && process.platform === 'win32' && node.some(a => a.includes('"'))) cpus = null;
  const { cmd, args, verbatim } = cpus ? pinned(cpus, node) : { cmd: node[0]!, args: node.slice(1), verbatim: false };
  const r = spawnSync(cmd, args, {
    stdio: o.quiet ? 'ignore' : 'inherit',
    cwd: repoRoot,
    timeout: o.timeoutMs,
    windowsVerbatimArguments: verbatim,
    env: { ...process.env, ...(cpus ? { PERFLAB_PINNED: cpus } : {}) },
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') return 124;
  return r.status ?? 1;
}

/** The newest .cpuprofile in .profiles/, or undefined if there is none. */
export function newestCpuProfile(): string | undefined {
  const dir = join(repoRoot, '.profiles');
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir).filter(f => f.endsWith('.cpuprofile')).map(f => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

interface CpuProfile { samples: number[]; nodes: { callFrame: { url: string }; positionTicks?: { line: number; ticks: number }[] }[] }

/**
 * The hottest source lines in a .cpuprofile. V8 stores per-line sample counts (`positionTicks`) on every node, but neither
 * Chrome DevTools nor the Firefox Profiler displays them for a loaded profile: they show time per function only.
 */
export function hotLines(file: string, top: number): string[] {
  const profile = JSON.parse(readFileSync(file, 'utf8')) as CpuProfile;
  const total = profile.samples.length;
  const hits = new Map<string, number>();
  for (const node of profile.nodes)
    for (const { line, ticks } of node.positionTicks ?? []) {
      const key = `${node.callFrame.url}\t${line}`;
      hits.set(key, (hits.get(key) ?? 0) + ticks);
    }
  const sources = new Map<string, string[]>();
  const lineText = (url: string, line: number): string => {
    if (!url.startsWith('file://')) return '';
    if (!sources.has(url)) {
      try { sources.set(url, readFileSync(fileURLToPath(url), 'utf8').split('\n')); } catch { sources.set(url, []); }
    }
    return (sources.get(url)![line - 1] ?? '').trim();
  };
  const out = [`${total} samples in ${file}`];
  for (const [key, ticks] of [...hits].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    const [url, line] = key.split('\t') as [string, string];
    const where = `${url.split('/').slice(-1)[0]}:${line}`;
    out.push(`${(ticks / total * 100).toFixed(1).padStart(5)}%  ${String(ticks).padStart(6)}  ${where.padEnd(24)} ${lineText(url, Number(line))}`);
  }
  return out;
}

