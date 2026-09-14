---
name: ai-gaps
description: Find and fix what the in-app AI assistant could not answer. Runs backend/scripts/ai-gaps.ts (unanswered questions, weak guide matches, thumbs-down answers, guide usage), then adds keywords to existing guides or writes new ones in docs/ai-guides, re-ingests, and proves each question now matches. Use when asked to check AI gaps / unanswered questions / improve the assistant, or when handed a "Guide request" block copied from the AI Insights page.
---

# AI Gaps

Every answer the assistant gives records which guides it used (or that none matched) on
`ai_messages.metadata`, and users rate answers with thumbs up/down. The **AI Insights** page
(`/ai-insights`, ADMIN) and this script read the same data. Your job is to turn that list into
guide changes so the next person who asks gets real steps.

## Steps

### 1. Run the report

```bash
cd backend && npx ts-node scripts/ai-gaps.ts --since <30 days ago> --top 25
```

Options: `--until YYYY-MM-DD`, `--include-data` (also show lookups like "how many orders this
month" — usually NOT guide material), `--json`.

If the owner pasted a `### Guide request` block instead, treat each block as one row of the
Unanswered list and skip to step 2.

If everything is empty, stop and say so.

### 2. Decide, per unanswered / weak question

Read the question, the page it was asked from, and the role. Then:

- **A guide already covers it** (search `docs/ai-guides/*.md` titles and `route:` for the page)
  → the keywords missed. Add the user's phrasing to that guide's `keywords:` — the English
  words used, the Hinglish spelling, and the **Devanagari** form (the chat mic emits
  Devanagari). Add misspellings you can foresee.
- **No guide covers it, and it is a "how do I" question about a real screen** → write a new
  guide following the `update-ai-guides` skill rules: read the page component + Zod schema,
  exact labels, required fields, traps; frontmatter `slug`, `title`, `route` (the page path
  from `frontend/src/config/navigation.ts` / `App.tsx`), `keywords` (English + Hinglish +
  Devanagari), `sources` (every file read, including `navigation.ts` when a menu path is stated).
  Never include rates, margins, or prices.
- **The feature does not exist** (the user asked for something the ERP cannot do) → do not
  invent a guide. List it in your summary as a product gap for the owner.
- **Thumbs-down rows** name the guide that produced the answer and the issue type. Re-read
  that guide against the current page code; fix wrong labels/steps; if the guide is right and
  the question was really about another screen, add keywords to the correct guide instead.

Weak matches (score 1-2) usually mean a single loose word matched — check the guide really
answers the question; if not, treat it like an unanswered one.

**"Searched, found nothing" rows** are what users typed into a screen's search box and got
zero results (recorded automatically by `transform.middleware.ts`, no user action needed). Decide:
- **Search field gap** — the screen shows a column the search does not cover (e.g. a customer or
  buyer style code): extend that endpoint's `searchFields` / `buildSearchWhere` list
  (`backend/src/utils/search-filter.ts` recipe) and add the endpoint to
  `backend/src/__tests__/integration/listSearchCoverage.test.ts`.
- **Looking in the wrong place** — the record lives on another screen (e.g. draft styles are not
  sold): add the user's words as keywords to the guide for the right screen and say where to look.
- **The data really is absent** — a master that was never created: report it to the owner.
Never write a guide that tells users a record exists.

### 3. Re-ingest

```bash
node scripts/hooks/check-ai-guides.js
cd backend && node scripts/ingest-ai-guides.js
```

### 4. Prove each question now matches

```bash
cd backend && npx ts-node scripts/ai-gaps.ts --test "<the user's exact question>" --route grn/new
```

Pass the route **without** the leading slash (Git Bash rewrites `/grn/new` into a Windows
path; the script adds the slash back).

`zeroMatch` must be `false` and the intended guide must be first. If it is not, the keywords
are still missing the user's words — fix and repeat.

### 5. Report

List: guides created, guides whose keywords were extended (with the words added), guides
corrected from thumbs-down feedback, and product gaps that need the owner's decision.
