import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface Project { id: string; level: string; kind: 'exercise' | 'solution'; dir: string }

/** Every exercise/solution directory that has a main.ts, sorted by level then id. */
export function findProjects(): Project[] {
  const out: Project[] = [];
  const levelsDir = join(repoRoot, 'levels');
  for (const level of readdirSync(levelsDir).sort()) {
    for (const [folder, kind] of [['exercises', 'exercise'], ['solutions', 'solution']] as const) {
      const base = join(levelsDir, level, folder);
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
 * Linux only: pin to one thread per physical core, fastest cores only (skips the E-cores on hybrid CPUs and the
 * hyperthread siblings), up to 4. Measured on a hybrid i7: under background load the calibration loop's run-to-run
 * variation went from 15% unpinned to ~3% pinned. Disable with PERFLAB_PIN=0.
 */
export function pinCpus(): string | null {
  if (process.platform !== 'linux' || process.env.PERFLAB_PIN === '0') return null;
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

export interface SpawnOptions { nodeFlags?: string[]; harnessArgs?: string[]; pin?: boolean; quiet?: boolean; timeoutMs?: number }

/** Run a project's main.ts in a child node (pinned on Linux). Returns the child's exit code (124 = timed out). */
export function runProject(p: Project, o: SpawnOptions = {}): number {
  const cpus = o.pin === false ? null : pinCpus();
  const node = [process.execPath, ...(o.nodeFlags ?? []), join(p.dir, 'main.ts'), ...(o.harnessArgs ?? [])];
  const [cmd, ...args] = cpus ? ['taskset', '-c', cpus, ...node] : node;
  const r = spawnSync(cmd!, args, {
    stdio: o.quiet ? 'ignore' : 'inherit',
    cwd: repoRoot,
    timeout: o.timeoutMs,
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

