---
name: update-ai-guides
description: Regenerate the AI assistant's how-to guides after code changes. Use when scripts/hooks/check-ai-guides.js reports stale guides, after changing any frontend page/route/Zod schema that a guide documents, or when asked to add/refresh guides for the in-app AI assistant (docs/ai-guides). Pass --all to regenerate every guide.
---

# Update AI Guides

The in-app AI assistant (DeepSeek) answers how-to questions from a library of guides in
`docs/ai-guides/*.md`, ingested into the `ai_knowledge_guides` table. The guides are written
from the REAL page components, so when those pages change the guides must be rewritten —
otherwise the assistant hands the team steps for screens that no longer exist.

## Steps

### 1. Find what is stale

```bash
node scripts/hooks/check-ai-guides.js
```

It prints each stale guide slug and which source files changed. With `--all`, skip this and
treat every guide in `docs/ai-guides/` as stale.

If nothing is stale and no new guide was requested, stop and say so.

### 2. Rewrite each stale guide

For each stale slug, open `docs/ai-guides/<slug>.md`, read every file in its `sources:`
frontmatter list **as it is now**, and rewrite the body to match the current UI.

Rules for guide content:
- **Steps only — never rates, margins, or example prices.** Every role can receive any
  guide, so pricing data must not live in them.
- Use the **exact** sidebar path, button labels, and field names from the code. Check
  `frontend/src/config/navigation.ts` + `frontend/src/components/Sidebar.tsx` for the menu
  path; check the page component for button/field labels; check the Zod schema for which
  fields are genuinely required.
- Numbered steps, short sentences. Mention required fields explicitly and note validation
  traps a user would otherwise hit (e.g. "code must be unique", "at least one category").
- English only — the assistant translates to Hindi at answer time.

Keep the frontmatter contract intact:
- `slug` — must equal the filename
- `title` — short, e.g. "Create a GRN (Goods Receipt)"
- `keywords` — English + Hinglish + **Devanagari** + common misspellings. The chat mic
  emits Devanagari, which shares no characters with romanized keywords, so Devanagari terms
  are required, not optional.
- `sources` — every file the guide was written from, **including** `frontend/src/config/navigation.ts`
  and `frontend/src/components/Sidebar.tsx` when the guide states a menu path. A file missing
  from this list means changes to it will never mark the guide stale.

### 3. Re-ingest

```bash
cd backend && node scripts/ingest-ai-guides.js
```

This upserts the guides, deactivates guides whose file was deleted, and rewrites
`docs/ai-guides/manifest.json` with fresh source hashes. The assistant picks up the change
on the next question — there is no retraining step and no restart needed.

### 4. Confirm

Re-run `node scripts/hooks/check-ai-guides.js` — it should report all guides current.
Report which guides were regenerated and why.

## Adding a brand-new guide

Create `docs/ai-guides/<slug>.md` with the frontmatter contract above, write the steps from
the real page, then run the ingest command. No DB or code change is needed.
