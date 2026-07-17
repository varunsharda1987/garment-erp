/**
 * Shared baseline-ratchet helper for the pre-commit guardrails.
 *
 * A "ratchet" grandfathers the violations that already exist (listed in a committed baseline
 * JSON) and BLOCKS only NEW ones. This lets a check enforce immediately without a big-bang
 * cleanup of the existing backlog — the same pattern the stock-sync check uses.
 *
 * Baseline keys are line-number-INDEPENDENT (path + normalized expression, or a structural
 * identity) so a new violation inside an already-listed file is still caught and reformatting
 * does not churn the baseline.
 */

const fs = require('fs');
const path = require('path');

// Baselines live next to this file (scripts/hooks/), independent of the process cwd.
const HOOKS_DIR = __dirname;

/**
 * Load a baseline file (a JSON array of violation keys) into a Set.
 * Missing/unreadable → empty Set (nothing grandfathered; the check still runs).
 */
function loadBaseline(name) {
  try {
    return new Set(JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, name), 'utf8')));
  } catch {
    return new Set();
  }
}

/**
 * Split current violation keys against a baseline Set.
 * @returns {{ fresh: string[], grandfathered: string[] }}
 *   fresh = not in baseline (BLOCK); grandfathered = in baseline (warn only).
 */
function diff(currentKeys, baseline) {
  const fresh = [];
  const grandfathered = [];
  for (const key of currentKeys) {
    (baseline.has(key) ? grandfathered : fresh).push(key);
  }
  return { fresh, grandfathered };
}

/** (Re)generate a baseline file from a list of keys — sorted & deduped for stable diffs. */
function writeBaseline(name, keys) {
  const unique = [...new Set(keys)].sort();
  fs.writeFileSync(path.join(HOOKS_DIR, name), JSON.stringify(unique, null, 2) + '\n');
  return unique.length;
}

module.exports = { loadBaseline, diff, writeBaseline };
