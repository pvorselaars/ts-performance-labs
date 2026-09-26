import { join, resolve } from 'node:path';
import { findProjects, hotLines, newestCpuProfile, repoRoot, resolveProject, runProject, runScript, type Project } from './lib.ts';

const usage = `Usage: npm run lab -- <command> <id> [options]

  run <id>       warm up, measure, PASS/FAIL against the budgets (exit 0 pass, 1 over budget, 2 wrong result, 3 inconclusive)
  profile <id>   loop for --seconds (default 15) so a profiler gets plenty of samples
  cold <id>      no warm-up, no budgets: watch V8 tier up
  lines [file]   the hottest source lines in a .cpuprofile (default: the newest one in .profiles/), with hit counts
  list           every exercise (and solution, with --solution)
  calibrate      this machine's factor: how many ms here one "reference ms" (the unit of time budgets) takes

<id> is an exercise id or a unique prefix, e.g. L0-01. Leave it out when running from inside an exercise or
solution folder (e.g. its package.json's "measure" script) and that folder is used.

Options:
  --solution     use the solution instead of the exercise (only after you have passed the exercise)
  --cpu-prof     write a .cpuprofile into .profiles/ (open it in Chrome DevTools > Performance, the Firefox Profiler, or speedscope; they show time per function; use the 'lines' command for lines)
  --heap-prof    write a .heapprofile into .profiles/ (sampling allocation profile)
  --no-pin       don't pin to isolated cores (Linux and Windows; same as PERFLAB_PIN=0)
  --top N        how many lines the 'lines' command prints (default 10)
  --seconds N, --runs N   passed through to the harness`;

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter(a => a.startsWith('--')));
const kind = flags.has('--solution') ? 'solution' : 'exercise';

/** The project folder `npm run` was started from: npm sets INIT_CWD to it, even when the script cds elsewhere. */
function projectFromCwd(): Project | undefined {
  const cwd = resolve(process.env.INIT_CWD ?? process.cwd());
  return findProjects().find(p => p.dir === cwd);
}

function passThrough(): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--seconds' || rest[i] === '--runs') out.push(rest[i]!, rest[++i] ?? '');
  }
  return out;
}

function nodeFlags(): string[] {
  const f: string[] = [];
  if (flags.has('--cpu-prof')) f.push('--cpu-prof', '--cpu-prof-dir=.profiles');
  if (flags.has('--heap-prof')) f.push('--heap-prof', '--heap-prof-dir=.profiles');
  return f;
}

try {
  if (cmd === 'lines') {
    const ti = rest.indexOf('--top');
    const top = ti >= 0 ? Number(rest[ti + 1]) || 10 : 10;
    const file = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--top') ?? newestCpuProfile();
    if (!file) throw new Error('No .cpuprofile found. Make one with: npm run lab -- profile <id> --cpu-prof');
    console.log(hotLines(file, top).join('\n'));
  } else if (cmd === 'calibrate') {
    process.exitCode = runScript(join(repoRoot, 'src', 'harness-node', 'calibrate.ts'), { pin: !flags.has('--no-pin') });
  } else if (cmd === 'list') {
    for (const p of findProjects().filter(p => p.kind === kind)) console.log(`${p.level}  ${p.id}`);
  } else if (cmd === 'run' || cmd === 'profile' || cmd === 'cold') {
    const id = rest.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
    const p = id ? resolveProject(id, kind) : projectFromCwd();
    if (!p) throw new Error(`"${cmd}" needs an exercise id.\n\n${usage}`);
    const modeArgs = cmd === 'profile' ? ['--profile'] : cmd === 'cold' ? ['--cold'] : [];
    process.exitCode = runProject(p, { nodeFlags: nodeFlags(), harnessArgs: [...modeArgs, ...passThrough()], pin: !flags.has('--no-pin') });
  } else {
    console.log(usage);
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
