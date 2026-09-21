/**
 * Ingest AI Knowledge Guides
 *
 * Reads docs/ai-guides/*.md, upserts them into ai_knowledge_guides, and records the
 * source-file hashes in docs/ai-guides/manifest.json so scripts/hooks/check-ai-guides.js
 * can tell which guides went stale when the underlying pages/routes/schemas changed.
 *
 * Lives under backend/scripts (not the repo-root scripts/) because Node resolves
 * @prisma/client from the SCRIPT's directory upward — only backend/ has it installed.
 *
 * Usage:  cd backend && node scripts/ingest-ai-guides.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { PrismaClient } = require('@prisma/client');

const REPO_ROOT = path.join(__dirname, '../..');
const GUIDES_DIR = path.join(REPO_ROOT, 'docs/ai-guides');
const MANIFEST_PATH = path.join(GUIDES_DIR, 'manifest.json');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const allowDirty = process.argv.includes('--allow-dirty');

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}

/** Hash a source file; a missing file hashes to MISSING so the guide reads as stale. */
function hashSourceFile(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) return 'MISSING';
  return sha1(fs.readFileSync(abs, 'utf8'));
}

/**
 * Minimal frontmatter parser — supports `key: value`, and list items either inline
 * (`keywords: [a, b]`) or as `- item` lines under the key.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta = {};
  let currentListKey = null;

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentListKey) {
      meta[currentListKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const value = kv[2].trim();

    if (value === '') {
      meta[key] = [];
      currentListKey = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => stripQuotes(v.trim()))
        .filter(Boolean);
      currentListKey = null;
    } else {
      meta[key] = stripQuotes(value);
      currentListKey = null;
    }
  }

  return { meta, body: match[2].trim() };
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * Paths git reports as changed, relative to the repo root, forward-slashed.
 * Returns null when git can't be consulted — an unknown state must not block the ingest.
 */
function dirtyPaths() {
  let out;
  try {
    out = cp.execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1e8 });
  } catch {
    return null; // not a git checkout, or git unavailable
  }
  const paths = new Set();
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let p = line.slice(3).trim();
    // Renames read "old -> new"; the new path is the one on disk we would hash
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    paths.add(p.replace(/^"|"$/g, ''));
  }
  return paths;
}

/**
 * Refuse to hash anything that is still uncommitted.
 *
 * manifest.json records WHICH COMMITTED STATE each guide was written against. Hashing a file
 * that is only in the working tree freezes that uncommitted content into the record, so the
 * guide reads "current" against a version that was never in git — and check-ai-guides.js
 * stops flagging it, permanently. There is no error and nothing to notice.
 *
 * That stranded 9 guides on 2026-09-21, two of them (fabric-create, greige-create) describing
 * list screens that had just been rebuilt. The guides most in need of rewriting became the
 * ones the tooling promised were fine. The same class of silence is why the fabric-costing
 * guides spent months telling the team that "Print Type" offers Rotary / Flat Bed / Digital.
 *
 * Only files THIS ingest would hash are checked — unrelated work in the tree can't corrupt
 * the manifest, and in a repo where several people edit at once, blocking on that would just
 * train everyone to reach for --allow-dirty.
 */
function assertNothingUncommitted(files) {
  const dirty = dirtyPaths();
  if (!dirty) {
    // Fail open — but say so. A silent pass here is indistinguishable from a verified one.
    console.warn('git unavailable: recording without a committed-state check.');
    return;
  }

  const atRisk = [];
  for (const file of files) {
    const guidePath = `docs/ai-guides/${file}`;
    if (dirty.has(guidePath)) atRisk.push(`${guidePath} — the guide itself`);

    const { meta } = parseFrontmatter(fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8'));
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    for (const src of sources) {
      if (dirty.has(src)) atRisk.push(`${src} — source of ${meta.slug || path.basename(file, '.md')}`);
    }
  }
  if (atRisk.length === 0) return;

  const unique = [...new Set(atRisk)].sort();
  console.error('\nRefusing to ingest: these files are not committed yet.\n');
  unique.slice(0, 20).forEach((p) => console.error(`  ${p}`));
  if (unique.length > 20) console.error(`  ...and ${unique.length - 20} more`);
  console.error(
    '\nThe manifest records which COMMITTED state each guide was written against.\n' +
      'Hashing an uncommitted file freezes working-tree content into that record, so the\n' +
      'guide reads "current" against a version that is not in git and is never flagged\n' +
      'stale again.\n\n' +
      'Commit the work first (rewriting any guide whose screen changed), then ingest on a\n' +
      'clean tree and commit manifest.json on its own.\n\n' +
      'Use --dry-run to check what would be ingested without writing anything.\n' +
      'Use --allow-dirty only if you intend to record uncommitted state.\n'
  );
  const err = new Error('guide sources have uncommitted changes');
  err.handled = true;
  throw err;
}

async function main() {
  if (!fs.existsSync(GUIDES_DIR)) {
    console.log(`No guides directory at ${GUIDES_DIR} — nothing to ingest.`);
    return;
  }

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  if (files.length === 0) {
    console.log('No guide files found.');
    return;
  }

  // --dry-run writes no manifest, so it cannot record anything and needs no guard
  if (!dryRun && !allowDirty) {
    assertNothingUncommitted(files);
  } else if (allowDirty && !dryRun) {
    console.warn(
      '\n--allow-dirty: recording hashes of UNCOMMITTED files.\n' +
        'Any guide hashed against working-tree content will read "current" against a version\n' +
        'that is not in git, and will never be flagged stale again.\n'
    );
  }

  const manifest = {};
  const seenSlugs = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const problems = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);

    const slug = meta.slug || path.basename(file, '.md');
    const title = meta.title;
    const route = typeof meta.route === 'string' ? meta.route : null; // internal app route for navigation
    const keywords = Array.isArray(meta.keywords) ? meta.keywords : [];
    const sources = Array.isArray(meta.sources) ? meta.sources : [];

    if (!title) {
      problems.push(`${file}: missing "title" in frontmatter — skipped`);
      continue;
    }
    if (keywords.length === 0) {
      problems.push(`${file}: no keywords — it will never be retrieved`);
    }
    if (sources.length === 0) {
      problems.push(`${file}: no sources — staleness can never be detected for it`);
    }

    const sourcesJson = sources.map((p) => ({ path: p, hash: hashSourceFile(p) }));
    const contentHash = sha1(body);
    seenSlugs.push(slug);

    manifest[slug] = {
      sources: Object.fromEntries(sourcesJson.map((s) => [s.path, s.hash])),
      contentHash,
      generatedAt: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(`[dry-run] ${slug} — ${keywords.length} keywords, ${sources.length} sources`);
      continue;
    }

    const existing = await prisma.ai_knowledge_guides.findUnique({ where: { slug } });

    if (!existing) {
      await prisma.ai_knowledge_guides.create({
        data: { slug, title, route, keywords, content: body, sourcesJson, isActive: true },
      });
      created++;
    } else if (
      existing.content !== body ||
      existing.title !== title ||
      existing.route !== route ||
      JSON.stringify(existing.keywords) !== JSON.stringify(keywords) ||
      !existing.isActive
    ) {
      await prisma.ai_knowledge_guides.update({
        where: { slug },
        data: { title, route, keywords, content: body, sourcesJson, isActive: true },
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  // A guide deleted from disk must stop being retrieved (kept as a row for history)
  let deactivated = 0;
  if (!dryRun) {
    const result = await prisma.ai_knowledge_guides.updateMany({
      where: { slug: { notIn: seenSlugs }, isActive: true },
      data: { isActive: false },
    });
    deactivated = result.count;
  }

  if (!dryRun) {
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  console.log(
    `Guides: ${created} created, ${updated} updated, ${unchanged} unchanged` +
      (deactivated ? `, ${deactivated} deactivated` : '')
  );
  if (problems.length > 0) {
    console.log('\nWarnings:');
    problems.forEach((p) => console.log(`  - ${p}`));
  }
  if (!dryRun) console.log(`Manifest written to docs/ai-guides/manifest.json`);
}

main()
  .catch((error) => {
    // A refusal has already explained itself — a stack trace would only bury the reason
    if (!error.handled) console.error('Ingest failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
