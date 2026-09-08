import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, '.build', 'test');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Child process failed with code=${code} signal=${signal ?? 'none'}`));
    });
  });
}

await rm(outDir, { recursive: true, force: true });
const tscEntry = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
await runNode([tscEntry, '--outDir', outDir, '--noEmit', 'false']);

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
if (testFiles.length === 0) throw new Error('No compiled test files found');
await runNode(['--test', ...testFiles]);
