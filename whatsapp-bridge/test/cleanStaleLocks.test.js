// Test for src/cleanStaleLocks.js
// Run with: node test/cleanStaleLocks.test.js
// No external test framework required.

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { cleanStaleLocks, LOCK_FILES } = require('../src/cleanStaleLocks');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wb-lock-test-'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\ncleanStaleLocks');

test('removes all lock files when all are present', () => {
  const dir = makeTmpDir();
  for (const f of LOCK_FILES) fs.writeFileSync(path.join(dir, f), '');

  const removed = cleanStaleLocks(dir);

  assert.deepStrictEqual(removed.sort(), [...LOCK_FILES].sort(), 'should return all removed file names');
  for (const f of LOCK_FILES) {
    assert.ok(!fs.existsSync(path.join(dir, f)), `${f} should not exist after cleanup`);
  }
  fs.rmdirSync(dir);
});

test('removes only the lock files that are present (partial)', () => {
  const dir = makeTmpDir();
  const present = ['SingletonLock', 'DevToolsActivePort'];
  for (const f of present) fs.writeFileSync(path.join(dir, f), '');

  const removed = cleanStaleLocks(dir);

  assert.deepStrictEqual(removed.sort(), [...present].sort(), 'should return only present file names');
  for (const f of present) {
    assert.ok(!fs.existsSync(path.join(dir, f)), `${f} should not exist after cleanup`);
  }
  fs.rmdirSync(dir);
});

test('returns empty array and does not throw when no lock files present', () => {
  const dir = makeTmpDir();

  const removed = cleanStaleLocks(dir);

  assert.deepStrictEqual(removed, [], 'should return empty array');
  fs.rmdirSync(dir);
});

test('does not remove non-lock files in the same directory', () => {
  const dir = makeTmpDir();
  const keeper = path.join(dir, 'Default');
  fs.writeFileSync(keeper, 'important');
  fs.writeFileSync(path.join(dir, 'SingletonLock'), '');

  cleanStaleLocks(dir);

  assert.ok(fs.existsSync(keeper), 'non-lock file should be untouched');
  fs.rmSync(dir, { recursive: true });
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
