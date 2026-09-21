// Perf gate: every *solution* must PASS its budgets (exit 0) and every *exercise* must FAIL them (exit 1).
// A green run means the budgets still separate the fixed code from the slow code, i.e. the gate can actually
// catch regressions.
//
//   npm run gate              everything
//   npm run gate -- L0        only ids starting with "L0"
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjects, repoRoot, runProject } from '../src/lab-cli/lib.ts';

const prefix = (process.argv[2] ?? '').toLowerCase();
const TimeoutMs = 300_000;

for (const cfg of ['tsconfig.json', 'tsconfig.solutions.json']) {
  const r = spawnSync(process.execPath, [join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', cfg], { cwd: repoRoot, encoding: 'utf8' });
  if (r.status !== 0) { console.log(r.stdout || r.stderr); console.log(`typecheck failed (${cfg})`); process.exit(1); }
}

const row = (a: string, b: string, c: string, d: string) => console.log(`${a.padEnd(38)} ${b.padEnd(9)} ${c.padEnd(9)} ${d}`);
row('project', 'expected', 'actual', 'verdict');

let fail = 0, total = 0;
for (const kind of ['solution', 'exercise'] as const) {
  const want = kind === 'exercise' ? 1 : 0;
  for (const p of findProjects().filter(p => p.kind === kind && p.id.toLowerCase().startsWith(prefix))) {
    const name = `${kind}s/${p.id}`;
    // Exploration exercises (no pass/fail budget) are skipped.
    const specPath = join(kind === 'exercise' ? p.dir : join(p.dir, '..', '..', 'exercises', p.id), 'spec.ts');
    if (readFileSync(specPath, 'utf8').includes('no pass/fail gate')) { row(name, 'n/a', 'n/a', 'skipped (exploration)'); continue; }
    total++;
    // Exit 3 = inconclusive (noisy machine): retry twice before calling it a surprise.
    let rc = 3;
    for (let attempt = 0; attempt < 3 && rc === 3; attempt++) rc = runProject(p, { quiet: true, timeoutMs: TimeoutMs });
    const ok = rc === want;
    if (!ok) fail = 1;
    row(name, `exit ${want}`, `exit ${rc}`, ok ? 'OK' : rc === 3 ? 'SURPRISE (inconclusive: noisy machine)' : 'SURPRISE');
  }
}
console.log(`checked ${total} projects: ${fail === 0 ? 'all as expected' : 'SURPRISES found'}`);
process.exit(fail);
