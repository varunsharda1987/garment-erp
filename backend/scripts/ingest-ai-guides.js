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
const { PrismaClient } = require('@prisma/client');

const REPO_ROOT = path.join(__dirname, '../..');
const GUIDES_DIR = path.join(REPO_ROOT, 'docs/ai-guides');
const MANIFEST_PATH = path.join(GUIDES_DIR, 'manifest.json');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

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
        data: { slug, title, keywords, content: body, sourcesJson, isActive: true },
      });
      created++;
    } else if (
      existing.content !== body ||
      existing.title !== title ||
      JSON.stringify(existing.keywords) !== JSON.stringify(keywords) ||
      !existing.isActive
    ) {
      await prisma.ai_knowledge_guides.update({
        where: { slug },
        data: { title, keywords, content: body, sourcesJson, isActive: true },
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
    console.error('Ingest failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
