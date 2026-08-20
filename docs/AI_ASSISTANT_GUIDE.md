# AI Assistant Guide

How the in-app AI assistant works, and how to extend it safely.

The assistant lives at `/ai-assistant`. Admins configure the provider at `/ai-settings`.
It does three things:

1. **Answers how-to questions** from a library of guides written from the real UI code.
2. **Answers data questions** from live ERP data, filtered by the user's role.
3. **Performs create actions** — but only ones on an allowlist, and only after the user
   presses **Confirm** on a card showing exactly what will be created.

---

## 1. Provider configuration

| Piece | Where |
|---|---|
| Provider adapters | `backend/src/services/ai/providers/*Provider.ts` |
| Factory | `providers/AIProviderFactory.ts` |
| Encrypted settings (DB) | `backend/src/services/ai/ai-settings.service.ts` |
| Admin UI | `frontend/src/pages/AISettings.tsx` → `/ai-settings` |

Settings are stored in `system_settings` with the API key encrypted (AES-256-GCM). The
provider is initialized from the DB at startup (`server.ts` → `initializeFromDatabase()`),
falling back to `.env` when nothing is configured in the UI.

**Function calling is provider-specific.** Only `DeepSeekProvider` implements
`generateWithTools()`. The chat route advertises actions only when the active provider has
that method — swapping to a provider without it silently disables actions rather than
promising abilities the model cannot invoke.

---

## 2. Knowledge library (how-to answers)

A cheap model cannot see your code, so it invents plausible-but-wrong menu names. The fix is
to hand it the real steps at question time.

```
docs/ai-guides/*.md  ──ingest──>  ai_knowledge_guides table  ──keyword search──>  system prompt
```

| Piece | Where |
|---|---|
| Guide sources | `docs/ai-guides/<slug>.md` |
| Hash manifest | `docs/ai-guides/manifest.json` |
| Ingestion | `backend/scripts/ingest-ai-guides.js` |
| Retrieval | `backend/src/services/ai/knowledge.service.ts` |
| Staleness check | `scripts/hooks/check-ai-guides.js` |
| Regeneration | `/update-ai-guides` skill |

**Retrieval** is plain keyword scoring — no embeddings, no pgvector. Phrase keywords match with
`includes()`; keywords ≤3 characters need a word boundary (so "po" does not match "position").
Top 3 guides, capped at ~3000 characters, are injected into the system prompt, which instructs
the model to treat them as authoritative and to say "not documented" rather than invent steps.

**Devanagari keywords are mandatory.** The chat microphone defaults to `hi-IN` and emits
Devanagari text, which shares no characters with romanized keywords — without them, voice
questions retrieve nothing.

**Kill switch:** set `AI_KNOWLEDGE_ENABLED` to `false` in `system_settings` to disable
retrieval instantly, no deploy needed.

### Keeping guides in sync (this is the important part)

Each guide records the hash of every file it was written from. When those files change, the
guide is stale — and a stale guide is worse than no guide, because it confidently teaches
steps for screens that no longer exist.

Three overlapping safety nets:

1. `scripts/hooks/check-ai-guides.js` lists stale guides (always exits 0 — a reminder, not a blocker).
2. `smart-check.js` runs it automatically at pre-commit/pre-push when frontend, route or schema
   files are staged, and in CI `--all` mode.
3. `CLAUDE.md` instructs every Claude Code session to run the check and regenerate before finishing.

To fix staleness: run **`/update-ai-guides`**. It re-reads the sources, rewrites the guides,
and re-ingests. Changes are live on the next question — there is no retraining step.

### Guide authoring rules

- **Steps only — never rates, margins or example prices.** Every role can receive any guide,
  so pricing must not live in them.
- Exact UI labels from the code: sidebar path, button text, field names.
- `sources:` must list every file read, **including** `navigation.ts` / `Sidebar.tsx` when the
  guide states a menu path. A file missing from that list can change without flagging the guide.
- Keywords: English + Hinglish + Devanagari + the misspellings the team actually types.

---

## 3. Actions (chat-driven creation)

| Piece | Where |
|---|---|
| Types + helpers | `backend/src/services/ai/ai-action-types.ts` |
| Definitions | `backend/src/services/ai/actions/*.actions.ts` |
| Service | `backend/src/services/ai/ai-actions.service.ts` |
| Endpoints | `POST /api/ai/actions/:messageId/confirm` \| `/reject` |
| Card UI | `frontend/src/components/AIActionCard.tsx` |
| Drift test | `backend/src/__tests__/integration/ai-actions-registry.test.ts` |

### Flow

```
model tool call
   → toolSchema.parse()        (names the user spoke)
   → resolve()                 (names → UUIDs, or a disambiguation question)
   → prepare()                 (next code, pending lines…)
   → executionSchema.parse()   (sanity check)
   → saved PENDING on the message   ← nothing has been written yet
   → user presses Confirm
   → executionSchema.parse() again + role + age checks
   → POST to the EXISTING endpoint with the user's own JWT
```

Executing through the real endpoint means every existing Zod validation, permission check,
code generator and database transaction is reused — the registry never re-implements them.

### Why two schemas per action

The model speaks names (`customerName: "Kasya"`); the API speaks UUIDs (`customerId`).
`resolve()` rewrites the payload between them. Validating that resolved payload against the
*tool* schema would strip the ids (Zod strips unknown keys) and every action would 400 at its
endpoint — so `executionSchema` describes the resolved shape and is what confirm validates.
It also strips `displayLines` from the request body automatically.

### Safety rails

- **Allowlist only** — an action not in `actions/*.actions.ts` does not exist to the model.
- **Create-only.** No update, no delete.
- **Confirm always.** Nothing is written on the model's say-so.
- **Role checks** in `allowedRoles`, mirroring each route's `authorize()` (may be stricter, never looser).
- **Only active records resolve**, so a document can't be attached to a deactivated customer.
- **Proposals expire after 7 days** — stale resolved ids are refused.
- **Internal calls time out at 10s** so a hung lookup cannot pin the chat request.
- **One action per turn** — `DeepSeekProvider` reads only the first tool call, so the prompt
  instructs the model to propose one record at a time.

### Recipe: add a new action

1. Find the real endpoint and read its Zod create schema — required fields, enums, traps.
2. Add a definition to `actions/master.actions.ts` or `actions/workflow.actions.ts`:
   - `toolSchema` (names) and `executionSchema` (resolved shape)
   - `tool.function.parameters` mirroring the tool schema, with a short description
   - `allowedRoles` copied from the route's `authorize()`
   - `resolve()` using `resolveEntity()` for any FK the user would speak by name
   - `successMessage()` linking to the record's detail page
3. Never name a payload key after a serializer relation (`styles`, `customers`, `suppliers`) —
   `applyRelationMappings` recurses into Json and would rename it.
4. Run `npx jest ai-actions-registry` — it asserts the endpoint exists and the definition is coherent.
5. The system prompt regenerates itself from the registry. Nothing else to update.

### Rollback

Comment out the definition, `npm run build`, `pm2-safe-restart garment-erp-api:5000`.
Actions have no schema of their own, so reverting is cheap.

---

## 4. Other pieces

- **Conversations** persist per user (`ai_conversations` / `ai_messages`); users only ever see
  their own. Sidebar list refreshes via the `['ai-conversations']` React Query key.
- **Role-based data filtering** — `ai-permission.service.ts` decides which live ERP data a role
  may see, and blocks cost/margin *data* questions for unauthorized roles. Procedural "how do I
  make a cost sheet" questions are deliberately exempt (`isHowToQuestion`), since guides contain
  no figures.
- **Scope guard** — the system prompt restricts answers to this ERP and garment manufacturing;
  off-topic questions get "Kaam Pe Dhyan Do 😄".
- **Voice input** — `useSpeechInput.ts`, Web Speech API, hi-IN/en-IN toggle. Requires a secure
  origin: works on localhost; LAN clients need HTTPS or the Chrome insecure-origin flag.
- **Markdown rendering** — `MarkdownMessage.tsx` (react-markdown + remark-gfm).
