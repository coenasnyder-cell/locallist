const { execSync } = require('node:child_process');
const path = require('node:path');

const EXPECTED_ROOT = process.env.MYAPP_CANONICAL_ROOT || 'C:/Projects/myApp';
const EXPECTED_REMOTE_FRAGMENT = process.env.MYAPP_EXPECTED_REMOTE || 'coenasnyder-cell/locallist';

function normalizePath(value) {
  return path
    .resolve(String(value || ''))
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function fail(message) {
  console.error(`\n[repo-guard] ${message}`);
  process.exit(1);
}

let gitRoot = '';
let remoteUrl = '';

try {
  gitRoot = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
} catch {
  fail('Unable to determine Git root. Run this command from a valid repository.');
}

try {
  remoteUrl = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
} catch {
  fail('Unable to read remote.origin.url.');
}

const expected = normalizePath(EXPECTED_ROOT);
const actualRoot = normalizePath(gitRoot);
const actualCwd = normalizePath(process.cwd());

if (actualRoot !== expected) {
  fail(
    `Wrong repository root. Expected ${EXPECTED_ROOT}, but Git root is ${gitRoot}.\n` +
      'Use only the canonical clone at C:/Projects/myApp.'
  );
}

if (actualCwd !== expected) {
  fail(`Wrong working directory. Expected ${EXPECTED_ROOT}, but current directory is ${process.cwd()}.`);
}

if (!remoteUrl.toLowerCase().includes(EXPECTED_REMOTE_FRAGMENT.toLowerCase())) {
  fail(
    `Unexpected origin remote: ${remoteUrl}\n` +
      `Expected a URL containing: ${EXPECTED_REMOTE_FRAGMENT}`
  );
}

console.log(`[repo-guard] Verified canonical repository at ${gitRoot}`);
