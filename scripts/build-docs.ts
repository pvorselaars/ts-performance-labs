// Builds the docs site (MkDocs). Creates/reuses a local venv (.venv-docs), so the first run is slower than the rest.
//
//   npm run docs            one-shot build under --strict (fails on broken internal links)
//   npm run docs:serve      serve locally with live-reload
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../src/lab-cli/lib.ts';

const serve = process.argv.includes('--serve');
const windows = process.platform === 'win32';
const venv = join(repoRoot, '.venv-docs');
const python = windows ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python');
const config = join(repoRoot, '.mkdocs', 'mkdocs.yml');

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(python)) {
  console.log('Creating docs venv at .venv-docs ...');
  // On Windows prefer the "py" launcher: plain "python" can resolve to the Microsoft Store alias stub.
  const candidates = windows ? ['py', 'python'] : ['python3', 'python'];
  const found = candidates.find(c => spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0);
  if (!found) { console.error("Couldn't find Python 3. Install it and make sure it's on PATH."); process.exit(1); }
  run(found, ['-m', 'venv', venv]);
}

run(python, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements-docs.txt']);
if (serve) run(python, ['-m', 'mkdocs', 'serve', '-f', config]);
else {
  run(python, ['-m', 'mkdocs', 'build', '--strict', '-f', config]);
  console.log('\nBuilt to ../ts-performance-labs-site (see site_dir in .mkdocs/mkdocs.yml).');
}
