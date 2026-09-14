---
slug: ai-insights
title: Use AI Insights (what the assistant could not answer)
keywords:
  # English
  - ai insights
  - unanswered questions
  - assistant feedback
  - knowledge gaps
  - missing guides
  - thumbs down
  - guide usage
  # Hinglish
  - ai insights dekhna
  - assistant kya nahi jaanta
  - unanswered sawal
  - guide missing hai
  # Devanagari (MANDATORY)
  - एआई इनसाइट्स
  - अनुत्तरित सवाल
  - असिस्टेंट फीडबैक
  - मिसिंग गाइड
  - गाइड यूसेज
sources:
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/AIInsights.tsx
  - frontend/src/config/permissions.config.ts
  - backend/src/services/ai/ai-insights.service.ts
route: /ai-insights
---

## Before you start

Only **ADMIN** users see this page. It fills up as the team uses the AI Assistant: every answer
records which guide (if any) backed it, and users rate answers with thumbs up / thumbs down.

## Steps

1. Open **AI Insights** in the sidebar (under **AI Assistant**, next to **AI Settings**).
2. Pick a period with the date picker at the top right (default: last 30 days). The six cards
   show **Questions asked**, **No guide matched**, **Weak matches**, **Thumbs down**, **Thumbs up**
   and **Searched, found nothing**.
3. **Unanswered** tab — questions where no guide matched, grouped, most frequent first, with the
   page they were asked from and the user's role. Switch on **Include data questions** to also
   see lookups such as "how many orders this month" (those are not how-to gaps).
4. **Weak matches** tab — a guide matched only by a single loose word; check that the nearest
   guide really answers the question.
5. **Negative feedback** tab — thumbs-down answers with the issue type, the user's comment, and
   the guide(s) that produced the answer.
6. **Guide usage** tab — how often each guide answered and its **Helpful %**.
7. **Not found** tab — what people typed into any search box and got no results, with the screen
   they were on and the other filters they had set. This is recorded automatically the moment a
   search comes back empty; nobody has to ask the assistant or report anything.
8. Click **Copy as guide request** (or **Copy as request** on the Not found tab) to copy a
   ready-made block, then paste it to Claude Code and run `/ai-gaps` — it writes or fixes the
   guide, widens the search, or reports that the record really does not exist.

## Traps

- Only questions asked after this feature went live carry their question text; older chats do
  not appear in the lists.
- A question can sit in **Unanswered** even when the assistant gave a sensible general answer —
  it means no *guide* backed that answer, so the steps may be guessed.
- Guide fixes take effect after re-ingest (`cd backend && node scripts/ingest-ai-guides.js`);
  no restart is needed.
- Users who search twice for something that is not there (or hit two errors on one screen)
  see a small **Stuck? Ask the assistant** message; pressing **Ask** opens the assistant with
  the question already typed. It appears at most once per screen every ten minutes.
