import { runFromDir } from '../../../../src/harness-node/lab.ts';

process.exitCode = await runFromDir(import.meta.dirname, process.argv.slice(2));
