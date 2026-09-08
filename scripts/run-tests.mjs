import { rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execFile);
const root = process.cwd();
const outDir = join(root, '.build', 'test');

await rm(outDir, { recursive: true, force: true });
await exec(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['--outDir', outDir, '--noEmit', 'false'], { cwd: root });

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) files.push(full);
  }
  return files;
}

const testFiles = await collect(join(outDir, 'tests'));
await exec(process.execPath, ['--test', ...testFiles], { cwd: root });
