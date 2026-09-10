import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const files = [
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'docs/implementation-progress.md',
  'docs/productization-master-plan.md',
  'docs/agent-runbook.md',
  'AGENTS.md',
  '.github/copilot-instructions.md',
  'spec/versions/v2.9/HYPER-QUANT_MASTER_SPEC_v2.9.md',
];

function readText(relativePath) {
  const full = join(root, relativePath);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function hasText(relativePath, token) {
  return readText(relativePath).includes(token);
}

const branch = (() => {
  try {
    return execSync('git branch --show-current', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

const specVersion = hasText('README.md', 'Current specification:** v2.9') || hasText('README.md', 'Current specification: v2.9') ? 'v2.9' : 'unknown';
const reviewStatus = hasText('README.md', 'REVIEW_REQUIRED') ? 'REVIEW_REQUIRED' : 'unknown';
const productMode = hasText('docs/productization-master-plan.md', 'PAPER_ONLY') ? 'PAPER_ONLY' : 'unknown';

const checkFileStatus = files.map((file) => ({ file, present: existsSync(join(root, file)) }));
const missingFiles = checkFileStatus.filter((entry) => !entry.present).map((entry) => entry.file);

console.log('HYPER-QUANT Agent Status');
console.log('========================');
console.log(`Branch: ${branch}`);
console.log(`Spec version: ${specVersion}`);
console.log(`Review status: ${reviewStatus}`);
console.log(`Live trading: PROHIBITED`);
console.log(`Product mode: ${productMode}`);
console.log('');
console.log('Required files:');
for (const entry of checkFileStatus) {
  console.log(`- ${entry.file}: ${entry.present ? 'OK' : 'MISSING'}`);
}

if (missingFiles.length > 0) {
  console.log('');
  console.log('Missing required files:');
  for (const file of missingFiles) console.log(`- ${file}`);
}

console.log('');
console.log('Recommended next actions:');
console.log('1. Read docs/productization-master-plan.md, AGENTS.md, and docs/agent-runbook.md before changing repo behavior.');
console.log('2. Validate with npm run check and npm test when work changes code or docs that affect repo contracts.');
console.log('3. Leave a resumable handoff in docs/agent-status.md when work is paused.');
console.log('4. Treat live capital, signing, or exchange credentials as out-of-scope without explicit human approval.');
