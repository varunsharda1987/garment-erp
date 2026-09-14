/**
 * AI Gaps Report
 *
 * Prints what the in-app AI assistant could not answer (no guide matched), where a guide
 * matched only weakly, which answers got a thumbs-down, and how often each guide is used —
 * the same numbers as the AI Insights admin page. The /ai-gaps Claude Code skill runs this,
 * then writes or fixes guides in docs/ai-guides/.
 *
 * Lives under backend/scripts because it imports the backend services (Prisma).
 *
 * Usage:
 *   cd backend && npx ts-node scripts/ai-gaps.ts [--since YYYY-MM-DD] [--until YYYY-MM-DD]
 *                                                 [--top N] [--include-data] [--json]
 *   cd backend && npx ts-node scripts/ai-gaps.ts --test "maal receive kaise kare" [--route /grn/new]
 *
 * --test ranks the live guide set for one question — after adding a guide and re-ingesting,
 * run it to prove the question now matches.
 */

import prisma from '../src/config/database';
import { aiInsightsService, resolveRange } from '../src/services/ai/ai-insights.service';
import { knowledgeService, rankGuides } from '../src/services/ai/knowledge.service';
import { searchMissService } from '../src/services/search-miss.service';

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const hasFlag = (name: string) => process.argv.includes(name);
const pad = (value: unknown, width: number) => String(value ?? '').padEnd(width);
const clip = (value: string, width: number) => (value.length > width ? `${value.slice(0, width - 1)}…` : value);
const day = (iso: string) => iso.slice(0, 10);

async function testQuestion(question: string, route?: string) {
  const guides = await knowledgeService.getActiveGuides();
  const result = rankGuides(guides, question.toLowerCase(), route);

  console.log('\n=== Guide match test ===');
  console.log(`question: "${question}"${route ? `   page: ${route}` : ''}`);
  console.log(`guides loaded: ${guides.length}`);
  console.log(
    `zeroMatch: ${result.zeroMatch}   topKeywordScore: ${result.topKeywordScore}   pageGuide: ${result.pageGuide?.slug ?? '-'}\n`
  );

  if (result.ranked.length === 0) {
    console.log('No guide would be injected. Add keywords (English + Hinglish + Devanagari) to the nearest guide, or write a new one.');
    return;
  }
  for (const entry of result.ranked) {
    console.log(`  ${pad(entry.guide.slug, 32)} score ${entry.score}  (keywords ${entry.keywordScore} + page ${entry.boost})`);
  }
}

async function report() {
  const range = resolveRange(readArg('--since'), readArg('--until'));
  const top = Number(readArg('--top') ?? 25);
  const includeData = hasFlag('--include-data');

  const [summary, unanswered, weak, negative, usage, misses] = await Promise.all([
    aiInsightsService.getSummary(range),
    aiInsightsService.getUnanswered(range, { includeData, limit: top }),
    aiInsightsService.getWeakMatches(range, { limit: top }),
    aiInsightsService.getNegativeFeedback(range, { limit: top }),
    aiInsightsService.getGuideUsage(range),
    searchMissService.listGrouped(range, { limit: top }),
  ]);

  if (hasFlag('--json')) {
    console.log(JSON.stringify({ summary, unanswered, weak, negative, usage, misses }, null, 2));
    return;
  }

  console.log('\n=== AI Gaps ===');
  console.log(`range: ${day(summary.from)} → ${day(summary.to)}`);
  console.log(
    `questions: ${summary.totalQuestions}   no guide: ${summary.zeroMatch}   weak: ${summary.weak}   ` +
      `thumbs down: ${summary.negativeFeedback}   thumbs up: ${summary.positiveFeedback}   ` +
      `searched-nothing: ${summary.searchMisses}` +
      (summary.knowledgeDisabled ? `   (guides OFF for ${summary.knowledgeDisabled})` : '')
  );

  console.log('\n--- Searched, found nothing (what users typed that returned no results) ---');
  if (misses.length === 0) console.log('none');
  else {
    console.log(`${pad('times', 6)}${pad('users', 6)}${pad('last', 11)}${pad('screen', 26)}${pad('endpoint', 28)}term`);
    console.log('-'.repeat(120));
    for (const row of misses) {
      console.log(
        `${pad(row.count, 6)}${pad(row.users, 6)}${pad(day(row.lastAt), 11)}${pad(clip(row.samplePageRoute ?? '-', 25), 26)}` +
          `${pad(clip(row.endpoint, 27), 28)}"${clip(row.term, 40)}"` +
          (row.sampleFilters ? `  filters=${clip(JSON.stringify(row.sampleFilters), 40)}` : '')
      );
    }
  }

  console.log(`\n--- Unanswered (no guide matched${includeData ? ', incl. data questions' : ''}) ---`);
  if (unanswered.length === 0) console.log('none');
  else {
    console.log(`${pad('count', 6)}${pad('last', 11)}${pad('page', 28)}${pad('role', 20)}question`);
    console.log('-'.repeat(120));
    for (const row of unanswered) {
      console.log(
        `${pad(row.count, 6)}${pad(day(row.lastAskedAt), 11)}${pad(clip(row.samplePageRoute ?? '-', 27), 28)}` +
          `${pad(row.sampleRole ?? '-', 20)}${clip(row.question, 60)}`
      );
    }
  }

  console.log('\n--- Weak matches (keyword score 1-2 — check the guide really answers it) ---');
  if (weak.length === 0) console.log('none');
  else {
    console.log(`${pad('count', 6)}${pad('score', 6)}${pad('nearest guide(s)', 40)}question`);
    console.log('-'.repeat(120));
    for (const row of weak) {
      console.log(`${pad(row.count, 6)}${pad(row.topScore, 6)}${pad(clip(row.guideSlugs.join(', '), 39), 40)}${clip(row.question, 60)}`);
    }
  }

  console.log('\n--- Thumbs down ---');
  if (negative.length === 0) console.log('none');
  else {
    console.log(`${pad('date', 11)}${pad('issue', 14)}${pad('guide(s)', 34)}question / comment`);
    console.log('-'.repeat(120));
    for (const row of negative) {
      console.log(
        `${pad(day(row.createdAt), 11)}${pad(row.issueType ?? '-', 14)}${pad(clip(row.guideSlugs.join(', ') || 'none', 33), 34)}${clip(row.question, 60)}`
      );
      if (row.comment) console.log(`${' '.repeat(59)}"${clip(row.comment, 60)}"`);
    }
  }

  console.log('\n--- Guide usage ---');
  if (usage.length === 0) console.log('none');
  else {
    console.log(`${pad('uses', 6)}${pad('up', 4)}${pad('down', 6)}${pad('slug', 34)}title`);
    console.log('-'.repeat(120));
    for (const row of usage.slice(0, top)) {
      console.log(`${pad(row.uses, 6)}${pad(row.helpful, 4)}${pad(row.notHelpful, 6)}${pad(row.slug, 34)}${clip(row.title, 60)}`);
    }
  }

  console.log('\nNext: for each unanswered question, either add keywords to the nearest guide or write a new one, then re-ingest and re-run with --test.');
}

/**
 * Git Bash rewrites "/grn/new" into "C:/Program Files/Git/grn/new" (MSYS path conversion), so
 * undo that and accept routes without a leading slash ("grn/new").
 */
function cleanRoute(route?: string): string | undefined {
  if (!route) return undefined;
  const unmangled = route.replace(/^[A-Za-z]:\/.*?\/Git(?=\/)/, '');
  return unmangled.startsWith('/') ? unmangled : `/${unmangled}`;
}

async function main() {
  const question = readArg('--test');
  if (question) await testQuestion(question, cleanRoute(readArg('--route')));
  else await report();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
