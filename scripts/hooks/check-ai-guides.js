/**
 * AI Guide Staleness Check
 *
 * Compares each guide's recorded source-file hashes (docs/ai-guides/manifest.json)
 * against those files' current contents. When a page/route/schema a guide was written
 * from has changed, the guide is stale — the AI assistant would hand the team outdated
 * steps, which is worse than no guide at all.
 *
 * Warn-only by design: it prints what to run and always exits 0, so it never blocks a
 * commit. Hashes only — no DB, no Prisma — so it is safe to run from the repo root.
 *
 * Usage: node scripts/hooks/check-ai-guides.js [--quiet]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs/ai-guides/manifest.json');
const quiet = process.argv.includes('--quiet');

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}

function hashSourceFile(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) return 'MISSING';
  return sha1(fs.readFileSync(abs, 'utf8'));
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    if (!quiet) console.log('AI guides: no manifest yet — nothing to check.');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    console.log(`AI guides: manifest could not be parsed (${error.message}) — skipping check.`);
    return;
  }

  const stale = [];

  for (const [slug, entry] of Object.entries(manifest)) {
    const sources = entry.sources || {};
    const changed = [];
    const missing = [];

    for (const [sourcePath, recordedHash] of Object.entries(sources)) {
      const currentHash = hashSourceFile(sourcePath);
      // A source that was deleted or renamed makes the guide stale, not the check crash
      if (currentHash === 'MISSING') missing.push(sourcePath);
      else if (currentHash !== recordedHash) changed.push(sourcePath);
    }

    if (changed.length > 0 || missing.length > 0) {
      stale.push({ slug, changed, missing });
    }
  }

  if (stale.length === 0) {
    if (!quiet) console.log(`AI guides: all ${Object.keys(manifest).length} guides current.`);
    return;
  }

  console.log(`\n⚠  ${stale.length} AI guide(s) are STALE — the assistant may give outdated steps:`);
  for (const { slug, changed, missing } of stale) {
    const reasons = [...changed.map((p) => `changed: ${p}`), ...missing.map((p) => `missing: ${p}`)];
    console.log(`   • ${slug}`);
    reasons.slice(0, 3).forEach((r) => console.log(`       ${r}`));
    if (reasons.length > 3) console.log(`       …and ${reasons.length - 3} more`);
  }
  console.log('\n   Fix: run /update-ai-guides (regenerates stale guides and re-ingests them)\n');
}

main();
// Always exit 0 — this is a reminder, never a blocker.
process.exitCode = 0;
