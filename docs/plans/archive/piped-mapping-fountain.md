# AI Feature Integration Plan for Garment ERP

## Executive Summary

Based on Andrej Karpathy's insights and our codebase analysis, we're currently using **8 out of 16** modern AI development features (50%). This plan proposes integrating the **4 most impactful** missing features to dramatically improve development velocity and code quality.

**Current Usage:** Agents ✓ | Subagents ✓ | Tools ✓ | IDE Integration ✓ | Context ✓ | Hooks ✓
**Missing Opportunities:** Skills ✗ | MCP ✗ | Workflows ✗ | Memory ✗ | LSP ✗ | Plugins ✗

---

## Recommended Features (Priority Order)

### 1. **Custom Skills** - HIGHEST PRIORITY ⭐⭐⭐
**Impact:** Massive productivity boost for repetitive tasks
**Effort:** Low-Medium
**Time to Value:** Immediate

#### Why Skills?
Our analysis found **extensive repetitive patterns**:
- 57 backend utility scripts with overlapping functionality
- Manual type synchronization across 82+ type files
- Database setup requiring 4+ sequential commands
- Testing workflows needing knowledge of 8+ different npm scripts

#### Proposed Custom Skills

**1. `/sync-types` Skill**
- **Purpose:** Auto-generate frontend types from backend Prisma schema & types
- **What it does:**
  - Reads backend types (`backend/src/types/*.types.ts`)
  - Reads Prisma schema relations
  - Applies serializer camelCase transformation rules
  - Generates matching frontend types (`frontend/src/types/*.types.ts`)
  - Flags mismatches and deprecation warnings
- **Why critical:** Solves our #1 pain point (82 type files manually synchronized)
- **Technical approach:** TypeScript AST parsing + schema analysis

**2. `/db-workflow` Skill**
- **Purpose:** Unified database setup/migration/seeding
- **What it does:**
  - Single command database reset + migrate + seed + docs
  - Environment-aware (dev/test/prod)
  - Pre-migration validation
  - Auto-generates schema documentation
- **Replaces:** 4-5 manual commands currently required
- **Technical approach:** Orchestrates existing npm scripts with validation

**3. `/test-all` Skill**
- **Purpose:** Unified test orchestration with consolidated reporting
- **What it does:**
  - Runs frontend E2E (Playwright) + backend unit/integration (Jest)
  - Generates combined coverage report
  - Cleans up old test artifacts
  - Outputs unified pass/fail summary
- **Replaces:** Manual execution of 8+ test commands
- **Technical approach:** Parallel execution with result aggregation

**4. `/api-docs` Skill**
- **Purpose:** Auto-generate API documentation from code
- **What it does:**
  - Scans 80+ route files
  - Extracts controllers, request/response types
  - Generates OpenAPI/Swagger spec
  - Creates markdown API reference
  - Validates serializer camelCase conversions
- **Solves:** Documentation drift (13 outdated/scattered docs)
- **Technical approach:** Route parsing + type extraction + OpenAPI generation

**5. `/commit-smart` Skill**
- **Purpose:** Intelligent git commits with context-aware messages
- **What it does:**
  - Analyzes changed files (schema, types, controllers, pages)
  - Suggests appropriate commit type (feat/fix/refactor/docs)
  - Generates multi-line commit with detailed bullets
  - Follows existing commit patterns (68% feat, 18% fix)
  - Validates related docs are updated
- **Improves:** Commit quality and consistency
- **Technical approach:** Git diff analysis + pattern matching

#### Implementation Plan for Skills
1. Create `.claude/skills/` directory
2. Define skill metadata files (`.skill.json`)
3. Write skill execution scripts (TypeScript)
4. Register in Claude Code settings
5. Test each skill independently
6. Document usage in `CLAUDE.md`

**Files to Create:**
- `.claude/skills/sync-types.skill.json`
- `.claude/skills/db-workflow.skill.json`
- `.claude/skills/test-all.skill.json`
- `.claude/skills/api-docs.skill.json`
- `.claude/skills/commit-smart.skill.json`
- `scripts/skills/` (execution logic)

---

### 2. **MCP Servers** - HIGH PRIORITY ⭐⭐
**Impact:** Enhanced external integrations and data access
**Effort:** Medium
**Time to Value:** 1-2 weeks

#### Why MCP?
Model Context Protocol enables Claude to:
- Access external data sources (databases, APIs)
- Integrate with development tools (Prisma, TypeScript compiler)
- Provide specialized domain knowledge

#### Proposed MCP Servers

**1. Prisma MCP Server**
- **Purpose:** Deep schema analysis and query optimization
- **Capabilities:**
  - Live schema introspection
  - Suggest optimal includes for queries
  - Detect N+1 query patterns
  - Generate migration suggestions
  - Validate relation mappings vs serializer.ts
- **Why valuable:** 120+ models with complex relations need expert guidance
- **Implementation:** Use `@prisma/internals` API

**2. TypeScript LSP MCP Server**
- **Purpose:** Type-aware code analysis
- **Capabilities:**
  - Type inference and validation
  - Find all references across frontend/backend
  - Suggest type improvements
  - Detect type mismatches (especially camelCase issues)
  - Auto-import management
- **Why valuable:** 82 type files need constant synchronization
- **Implementation:** Integrate `typescript` language server

**3. Database Query MCP Server**
- **Purpose:** Direct database insights during development
- **Capabilities:**
  - Execute read-only queries for debugging
  - Show table statistics (row counts, index usage)
  - Validate seed data
  - Performance analysis (slow queries)
- **Why valuable:** Rapid debugging without leaving Claude Code
- **Implementation:** PostgreSQL client with read-only access

**4. Documentation MCP Server**
- **Purpose:** Smart documentation search and updates
- **Capabilities:**
  - Semantic search across 13 markdown files
  - Detect outdated documentation
  - Suggest doc updates when code changes
  - Generate doc templates
- **Why valuable:** Documentation drift is a major issue
- **Implementation:** Vector search + markdown parsing

#### Implementation Plan for MCP
1. Create `.claude/mcp/` directory
2. Install MCP SDK (`npm install @modelcontextprotocol/sdk`)
3. Develop each server as standalone Node.js service
4. Register in Claude Code settings (`mcp.config.json`)
5. Test server connectivity and responses
6. Document available MCP capabilities

**Files to Create:**
- `.claude/mcp/mcp.config.json`
- `mcp-servers/prisma-server/` (Prisma MCP implementation)
- `mcp-servers/typescript-server/` (TypeScript LSP MCP)
- `mcp-servers/database-server/` (PostgreSQL MCP)
- `mcp-servers/docs-server/` (Documentation MCP)

---

### 3. **Hooks** - MEDIUM PRIORITY ⭐
**Impact:** Automated quality gates and workflow enforcement
**Effort:** Low
**Time to Value:** Days

#### Why Hooks?
Currently no hooks configured, but we have **107 permission rules** showing allowed operations. Hooks would enforce quality standards automatically.

#### Proposed Hooks

**1. Pre-Commit Hook**
- **Purpose:** Code quality gates before commits
- **Actions:**
  - Run TypeScript type checking (`tsc --noEmit`)
  - Lint changed files only (incremental)
  - Check for console.logs in production code
  - Validate commit message format
  - Ensure tests pass for affected modules
- **Prevents:** Breaking commits, type errors in production

**2. Post-Type-Change Hook**
- **Purpose:** Auto-trigger type synchronization
- **Trigger:** When `backend/src/types/*.ts` or `schema.prisma` changes
- **Actions:**
  - Run `/sync-types` skill
  - Regenerate API docs if controller types changed
  - Flag frontend components using old types
- **Prevents:** Frontend-backend type drift

**3. Pre-Migration Hook**
- **Purpose:** Database safety checks
- **Trigger:** Before `prisma migrate dev`
- **Actions:**
  - Validate migration doesn't drop production data
  - Check for conflicting migrations
  - Ensure backup exists
  - Validate serializer.ts has relation mappings
- **Prevents:** Data loss, migration conflicts

**4. Post-Documentation-Update Hook**
- **Purpose:** Keep docs in sync with code
- **Trigger:** When markdown files change
- **Actions:**
  - Validate markdown syntax
  - Check for broken internal links
  - Ensure code examples are valid
  - Update "Last Modified" timestamps
- **Prevents:** Broken documentation

#### Implementation Plan for Hooks
1. Create `.claude/hooks/` directory
2. Define hook configuration files
3. Write hook execution scripts (Bash/Node.js)
4. Register in Claude Code settings
5. Test each hook trigger scenario
6. Document hook behavior in `CLAUDE.md`

**Files to Create:**
- `.claude/hooks/pre-commit.hook.json`
- `.claude/hooks/post-type-change.hook.json`
- `.claude/hooks/pre-migration.hook.json`
- `.claude/hooks/post-docs-update.hook.json`
- `scripts/hooks/` (hook execution logic)

---

### 4. **Automated Workflows** - MEDIUM PRIORITY ⭐
**Impact:** End-to-end task automation
**Effort:** Medium-High
**Time to Value:** 2-3 weeks

#### Why Workflows?
Complex multi-step processes currently require manual orchestration. Workflows would chain operations intelligently.

#### Proposed Workflows

**1. Feature Development Workflow**
- **Trigger:** User says "create new feature X"
- **Steps:**
  1. Read existing similar features (pattern matching)
  2. Generate Prisma schema changes (if needed)
  3. Create backend types, controller, service, routes
  4. Generate frontend types from backend
  5. Create React component scaffolding
  6. Generate API documentation
  7. Create placeholder tests
  8. Run type checking and linting
  9. Create git commit with detailed message
- **Benefit:** Consistent feature scaffolding with all boilerplate

**2. Bug Fix Workflow**
- **Trigger:** User reports a bug with error message
- **Steps:**
  1. Search codebase for error origin
  2. Analyze related components (services, controllers)
  3. Check if tests exist for failing code
  4. Suggest fix with explanation
  5. Implement fix after approval
  6. Add regression test if missing
  7. Validate fix with existing tests
  8. Generate commit with fix explanation
- **Benefit:** Systematic debugging with test coverage

**3. Database Schema Update Workflow**
- **Trigger:** User modifies `schema.prisma`
- **Steps:**
  1. Validate schema syntax
  2. Generate migration with descriptive name
  3. Update serializer.ts with new relation mappings
  4. Regenerate backend types
  5. Sync frontend types
  6. Update affected API endpoints
  7. Regenerate API documentation
  8. Run database migration
  9. Update seed scripts if needed
  10. Commit with schema change details
- **Benefit:** No missed steps in schema updates

**4. Release Preparation Workflow**
- **Trigger:** User says "prepare release"
- **Steps:**
  1. Run all tests (frontend + backend)
  2. Generate coverage report
  3. Run production builds
  4. Validate no console.logs in production code
  5. Check for outdated dependencies (npm audit)
  6. Generate changelog from commits since last release
  7. Update version numbers
  8. Create git tag
  9. Generate release notes
- **Benefit:** Consistent release process

#### Implementation Plan for Workflows
1. Define workflow specifications (YAML/JSON)
2. Create workflow engine/orchestrator
3. Integrate with existing skills and hooks
4. Build workflow templates
5. Add workflow status tracking
6. Document available workflows

**Files to Create:**
- `.claude/workflows/` directory
- `workflows/feature-development.workflow.json`
- `workflows/bug-fix.workflow.json`
- `workflows/schema-update.workflow.json`
- `workflows/release-prep.workflow.json`
- `scripts/workflow-engine.ts` (orchestration logic)

---

## NOT Recommended (Lower Priority)

### Memory
- **Why skip:** Conversation context already unlimited via summarization
- **When to reconsider:** If we need persistent knowledge across projects

### Permissions System
- **Why skip:** Already have 107 permission rules in settings.local.json
- **When to reconsider:** If we need role-based AI capabilities

### Plugins
- **Why skip:** MCP servers + skills cover our extension needs
- **When to reconsider:** If we need third-party integrations

### Full LSP Integration
- **Why skip:** TypeScript MCP server provides targeted LSP features
- **When to reconsider:** If we add more languages (Python, Go, etc.)

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
**Goal:** Immediate productivity boost

1. **Create 5 Custom Skills** ⭐⭐⭐
   - `/sync-types` (solves biggest pain point)
   - `/db-workflow` (simplifies database operations)
   - `/test-all` (unified testing)
   - `/api-docs` (documentation automation)
   - `/commit-smart` (better commits)

2. **Set Up Basic Hooks**
   - Pre-commit (type checking + linting)
   - Post-type-change (auto sync types)

**Deliverables:**
- `.claude/skills/` with 5 working skills
- `.claude/hooks/` with 2 critical hooks
- Updated `CLAUDE.md` with usage instructions
- Validation that skills work end-to-end

---

### Phase 2: Deep Integrations (Week 3-4)
**Goal:** Enhanced capabilities via MCP

3. **Implement MCP Servers** ⭐⭐
   - Prisma MCP (schema analysis)
   - TypeScript LSP MCP (type intelligence)
   - Database Query MCP (debugging)
   - Documentation MCP (smart search)

4. **Enhance Hooks**
   - Pre-migration hook (database safety)
   - Post-docs-update hook (doc validation)

**Deliverables:**
- `mcp-servers/` with 4 working servers
- `.claude/mcp/mcp.config.json` configuration
- Enhanced hooks with MCP integration
- Documentation of MCP capabilities

---

### Phase 3: Workflow Automation (Week 5-6)
**Goal:** End-to-end task automation

5. **Build Workflow Engine** ⭐
   - Workflow definition format
   - Orchestration logic
   - Status tracking and rollback

6. **Create Core Workflows**
   - Feature development workflow
   - Bug fix workflow
   - Schema update workflow
   - Release preparation workflow

**Deliverables:**
- `.claude/workflows/` with 4 workflows
- `scripts/workflow-engine.ts` orchestrator
- Workflow templates and examples
- Comprehensive workflow documentation

---

## Success Metrics

### Productivity Improvements
- **Type Synchronization:** Manual (30+ min) → Automated (<1 min) with `/sync-types`
- **Database Setup:** 4 commands (5+ min) → 1 command (<2 min) with `/db-workflow`
- **Testing:** 8+ commands → 1 command with unified reporting via `/test-all`
- **API Docs:** Manual updates (hours) → Auto-generated (minutes) via `/api-docs`
- **Commits:** Generic messages → Context-aware detailed commits via `/commit-smart`

### Quality Improvements
- **Type Drift:** Frequent bugs → Zero drift (hooks + MCP validation)
- **Documentation:** 13 scattered/outdated docs → Auto-updated from code
- **Schema Safety:** Manual validation → Automated pre-migration checks
- **Test Coverage:** Fragmented → Consolidated with coverage tracking

### Developer Experience
- **Onboarding:** Hours reading docs → Minutes with working examples
- **Context Switching:** Multiple terminals → Single Claude Code interface
- **Debugging:** Manual SQL queries → MCP-powered insights
- **Consistency:** Varied patterns → Enforced standards via workflows

---

## Critical Files to Modify

### Configuration Files
- `.claude/settings.local.json` - Add skill/hook/MCP registrations
- `CLAUDE.md` - Document new AI features and usage
- Root `package.json` - Add orchestration scripts

### New Directories
- `.claude/skills/` - Custom skill definitions
- `.claude/hooks/` - Hook configurations
- `.claude/mcp/` - MCP server configs
- `.claude/workflows/` - Workflow specifications
- `scripts/skills/` - Skill execution logic
- `scripts/hooks/` - Hook execution logic
- `mcp-servers/` - MCP server implementations

### Documentation Updates
- `START_HERE.md` - Add AI features quick start
- `PROCESSOR_RATE_CARD_GUIDE.md` - Update with workflow usage
- `FABRIC_COSTING_FLOW.md` - Reference type sync skill
- New: `AI_FEATURES_GUIDE.md` - Comprehensive AI capabilities reference

---

## Risk Mitigation

### Technical Risks
1. **MCP Server Stability**
   - Mitigation: Implement graceful fallbacks, extensive error handling
   - Validation: Test with malformed inputs

2. **Type Sync Accuracy**
   - Mitigation: Generate diffs before applying, require user approval
   - Validation: Compare generated types against existing manually

3. **Hook Performance**
   - Mitigation: Run only incremental checks, timeout after 30s
   - Validation: Benchmark hook execution times

4. **Workflow Complexity**
   - Mitigation: Start simple (3-4 steps), add complexity incrementally
   - Validation: Manual testing of each workflow step

### Organizational Risks
1. **Learning Curve**
   - Mitigation: Comprehensive documentation, video demos
   - Training: Create skill/workflow usage examples

2. **Over-Automation**
   - Mitigation: Require user approval for destructive operations
   - Guardrails: Dry-run mode for all workflows

---

## Final Recommendation

Based on the analysis of your codebase pain points and potential ROI, here's my definitive recommendation:

### ✅ **START WITH: POC for `/sync-types` Skill Only**

**Why This First:**
1. **Solves Your #1 Pain Point:** 82 type files manually synchronized is your biggest source of bugs
   - Backend uses snake_case (Prisma relations)
   - API responses use camelCase (serializer.ts)
   - Frontend must remember the conversion rules
   - **Current cost:** 30+ minutes per schema change, frequent runtime errors

2. **Immediate, Measurable Impact:**
   - Before: Manual type updates, 30+ min, error-prone
   - After: One command (`/sync-types`), <1 minute, zero drift
   - **ROI:** 30x time saving, eliminates entire class of bugs

3. **Proof of Concept Value:**
   - Validates the skill architecture works for our codebase
   - Tests integration with Claude Code environment
   - Provides template for building other 4 skills
   - Low risk - doesn't modify anything destructively

4. **Foundation for Everything Else:**
   - Type sync is required before schema changes
   - Schema changes feed into API docs
   - API docs enable better testing
   - **Unlocks:** Database workflows, API documentation, feature scaffolding

### 📋 **Phase 1a: `/sync-types` POC (Week 1)**

**What Gets Built:**
- `.claude/skills/sync-types.skill.json` - Skill definition
- `scripts/skills/sync-types.ts` - Core logic:
  - Parse `backend/src/types/*.types.ts`
  - Read `backend/prisma/schema.prisma` relations
  - Apply serializer camelCase transformation rules
  - Generate/update `frontend/src/types/*.types.ts`
  - Output diff report before applying changes
  - Require user approval for destructive changes

**Success Criteria:**
✓ Can sync all 82 type files in <1 minute
✓ Correctly applies camelCase transformation
✓ Detects and flags deprecations
✓ Generates diff report for review
✓ Integrates with Claude Code as `/sync-types` command

**Validation:**
1. Manual test: Modify `backend/src/types/style.types.ts`
2. Run `/sync-types`
3. Verify `frontend/src/types/style.types.ts` updated correctly
4. Check serializer rules applied (snake_case → camelCase)
5. Validate TypeScript compilation passes

### 📋 **Phase 1b: Expand to All 5 Skills (Week 2-3)**
*Only proceed if POC succeeds*

Once `/sync-types` proves valuable, quickly add:
- `/db-workflow` - Database operations (5x speedup)
- `/test-all` - Unified testing (eliminate 8 commands)
- `/api-docs` - Auto-generate API docs (hours → minutes)
- `/commit-smart` - Better commits (consistency + quality)

### 📋 **Phase 2: Add Critical Hooks (Week 4)**
*Enforce quality automatically*

- **Post-type-change hook:** Auto-run `/sync-types` when backend types change
- **Pre-commit hook:** Type checking + linting before commits

### 📋 **Phase 3: MCP Servers (Week 5-6)**
*Only if skills prove highly valuable*

- Prisma MCP (schema analysis)
- TypeScript LSP MCP (type intelligence)

### 🎯 **Expected Outcomes**

**After POC (1 week):**
- Type synchronization: 30 min → <1 min
- Zero camelCase/snake_case bugs
- Validated skill architecture

**After Phase 1b (3 weeks):**
- Database setup: 4 commands → 1 command
- Testing: 8 commands → 1 unified command
- Documentation: Auto-generated from code
- Commits: Consistently high-quality

**After Phase 2 (4 weeks):**
- Types auto-sync on every change (hook)
- Pre-commit validation (catch errors before commit)

**After Phase 3 (6 weeks):**
- Deep schema analysis via Prisma MCP
- Type-aware code suggestions via TypeScript MCP

### 🚫 **What We're NOT Doing (And Why)**

**Skip for Now:**
- ❌ **Memory/Plugins:** Unnecessary - we have context + skills
- ❌ **Full LSP Integration:** TypeScript MCP gives us 80% benefit with 20% effort
- ❌ **Permissions System:** Already have 107 rules configured
- ❌ **Complex Workflows:** Skills handle most needs, workflows are overkill initially

### 📊 **Success Metrics**

**Week 1 (POC):**
- `/sync-types` working end-to-end
- Sync time: <1 minute for all 82 files
- Zero manual type updates needed

**Week 3 (Phase 1b):**
- All 5 skills operational
- 50%+ reduction in manual workflow commands
- Documentation auto-generated

**Week 4 (Phase 2):**
- Hooks enforcing quality automatically
- Zero type drift incidents

**Week 6 (Phase 3):**
- MCP providing expert analysis
- 10x productivity improvement validated

---

## Conclusion

**Start small, prove value, scale up.**

By implementing just `/sync-types` first, we:
1. Solve your biggest pain point (type synchronization)
2. Validate the AI features architecture works
3. Build foundation for 4 more skills
4. Minimize risk and time investment

This is the **highest ROI, lowest risk** path to achieving Andrej Karpathy's 10x productivity vision.

**Recommendation: Build `/sync-types` POC this week, then reassess based on results.**
