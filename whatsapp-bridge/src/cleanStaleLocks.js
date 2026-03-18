const fs = require('fs');
const path = require('path');

const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];

/**
 * Removes stale Chromium singleton lock files from the given session directory.
 * These files are left behind when the Chrome process crashes or is killed abruptly,
 * preventing the next launch from starting.
 * @param {string} sessionDir - Path to the Chromium user data directory
 * @returns {string[]} Names of files that were actually present and removed
 */
function cleanStaleLocks(sessionDir) {
  const removed = [];
  for (const f of LOCK_FILES) {
    const full = path.join(sessionDir, f);
    try {
      fs.rmSync(full); // throws if file doesn't exist
      removed.push(f);
    } catch {
      // File wasn't there — nothing to do
    }
  }
  if (removed.length > 0) {
    console.log('[Bridge] Removed stale lock files:', removed.join(', '));
  }
  return removed;
}

module.exports = { cleanStaleLocks, LOCK_FILES };
