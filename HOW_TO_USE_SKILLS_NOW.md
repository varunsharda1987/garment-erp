# How to Use Skills RIGHT NOW

## Your Current Situation

You have uncommitted changes for TWO different features:
1. ✅ **NEW:** Claude Code Skills (5 automation tools we just built)
2. 📦 **EXISTING:** Fabric Costing & Processor Rate Card changes

---

## 🎯 What to Do Next

### Step 1: Commit the Skills (Cleanly Separated)

```bash
# A. Reset staging area (start fresh)
git reset

# B. Stage ONLY skills-related files
git add .claude/skills/
git add scripts/skills/
git add AI_FEATURES_GUIDE.md
git add CLAUDE.md
git add SKILLS_USAGE_GUIDE.md
git add SKILLS_QUICK_REFERENCE.md

# C. Check what you're about to commit
git status

# D. Generate smart commit message
node scripts/skills/commit-smart.js --generate

# E. It will output something like:
# feat: Add custom Claude Code skills for development automation
#
# - Implement /sync-types skill for type synchronization
# - Add /db-workflow skill for database operations
# - Create /test-all skill for unified testing
# - Add /api-docs skill for API documentation
# - Implement /commit-smart skill for intelligent commits
# - Update CLAUDE.md with skills documentation
# - Add comprehensive usage guides
#
# 🤖 Generated with Claude Code
# Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

# F. Use the generated commit command OR copy the message and commit manually
git commit -m "<paste the generated message here>"

# G. Push to remote
git push
```

---

### Step 2: Commit Fabric Costing Changes Separately

```bash
# A. Stage fabric costing files
git add backend/prisma/schema.prisma
git add backend/src/controllers/fabric-costing.controller.ts
git add backend/src/routes/index.ts
git add backend/src/services/processor-rate-v2.service.ts
git add backend/src/types/processor-rate-v2.types.ts
git add frontend/src/pages/FabricCostingPage.tsx
git add frontend/src/pages/ProcessorRateCardPage.tsx
git add frontend/src/types/fabricCosting.types.ts
git add FABRIC_COSTING_COMPLETE_GUIDE.md
git add NAVIGATION_UPDATE.md
git add START_HERE.md
git add backend/create-test-processors.ts
git add backend/prisma/seeds/

# Also stage deleted files
git add backend/src/controllers/processor-rate-card.controller.ts
git add backend/src/routes/processor-rate-card.routes.ts
git add backend/src/services/processor-rate.service.ts

# B. Generate commit message
node scripts/skills/commit-smart.js --generate

# C. Commit
git commit -m "<paste message>"

# D. Push
git push
```

---

## 🚀 Future Workflow (Going Forward)

From now on, **before every commit**, use this workflow:

### Daily Commit Workflow

```bash
# 1. Check type synchronization
node scripts/skills/sync-types.js --check

# 2. Make sure you're committing what you think you are
git status

# 3. Stage your changes
git add <your files>

# 4. Preview commit
node scripts/skills/commit-smart.js --preview

# 5. Generate smart commit message
node scripts/skills/commit-smart.js --generate

# 6. Use the generated message
git commit -m "<paste message>"

# 7. Push
git push
```

---

## 💡 Practical Example: Adding a New Feature Tomorrow

Let's say tomorrow you want to add "Supplier Performance Ratings":

```bash
# 1. Check current state
node scripts/skills/sync-types.js --report

# 2. Add Prisma model
# Edit: backend/prisma/schema.prisma

# 3. Run database workflow
node scripts/skills/db-workflow.js --migrate
# ✅ This replaces 4+ manual commands!

# 4. Create backend files
# - backend/src/types/supplier-rating.types.ts
# - backend/src/controllers/supplier-rating.controller.ts
# - backend/src/services/supplier-rating.service.ts
# - backend/src/routes/supplier-rating.routes.ts

# 5. Check type sync
node scripts/skills/sync-types.js --report
# It will show "Backend Only: supplier-rating.types.ts"

# 6. Create frontend type
# - frontend/src/types/supplier-rating.types.ts

# 7. Create frontend page
# - frontend/src/pages/SupplierRatingPage.tsx

# 8. Validate everything
node scripts/skills/sync-types.js --check     # ✓ Types in sync
node scripts/skills/api-docs.js --generate    # ✓ API docs updated
node scripts/skills/test-all.js --all         # ✓ Tests pass

# 9. Stage and commit
git add .
node scripts/skills/commit-smart.js --generate
git commit -m "<paste message>"
git push
```

**Time saved: 30+ minutes → 5 minutes!**

---

## 📊 Quick Reference: When to Use Each Skill

| Skill | Use When | Frequency |
|-------|----------|-----------|
| `/sync-types` | After changing ANY type file | Every type change |
| `/db-workflow` | After modifying schema.prisma | Every schema change |
| `/test-all` | Before committing, before PRs | Before every commit |
| `/api-docs` | After adding/changing routes | When routes change |
| `/commit-smart` | Before EVERY commit | **Every single commit** |

---

## 🎓 Learning the Skills

### Try Each One Now!

```bash
# 1. See type synchronization status
node scripts/skills/sync-types.js --report

# 2. List all 729 API endpoints
node scripts/skills/api-docs.js --list

# 3. Preview current changes
node scripts/skills/commit-smart.js --preview

# 4. Get help for any skill
node scripts/skills/sync-types.js --help
node scripts/skills/db-workflow.js --help
node scripts/skills/test-all.js --help
node scripts/skills/api-docs.js --help
node scripts/skills/commit-smart.js --help
```

---

## ⚡ Power Tips

### Tip 1: Add to package.json (Optional but Recommended)

Add to your `package.json`:

```json
{
  "scripts": {
    "check": "node scripts/skills/sync-types.js --check && node scripts/skills/test-all.js --all",
    "commit": "node scripts/skills/commit-smart.js --generate",
    "docs": "node scripts/skills/api-docs.js --generate"
  }
}
```

Then use: `npm run check`, `npm run commit`, `npm run docs`

### Tip 2: Create a Pre-Commit Checklist

Save this as a file you can run:

```bash
#!/bin/bash
# pre-commit-check.sh

echo "Running pre-commit checks..."
node scripts/skills/sync-types.js --check || exit 1
node scripts/skills/test-all.js --all || exit 1
echo "All checks passed! Ready to commit."
node scripts/skills/commit-smart.js --generate
```

---

## 🆘 Common Issues

### "I don't know what files to stage"

Use `git status` to see all changes, then stage related files together:

```bash
git status          # See what changed
git add <files>     # Stage related changes
git status          # Verify what's staged
node scripts/skills/commit-smart.js --preview  # Preview commit
```

### "Types are out of sync error"

```bash
node scripts/skills/sync-types.js --report
# Look at the report to see which types need frontend equivalents
# Create the missing frontend type files
# Run: node scripts/skills/sync-types.js --check
```

### "I want to commit everything at once"

```bash
git add .
node scripts/skills/commit-smart.js --generate
git commit -m "<paste message>"
```

But it's better to commit related changes separately for cleaner history!

---

## 🎯 Your Action Items (Right Now)

1. ✅ Read this file (you're doing it!)
2. ⬜ Try running: `node scripts/skills/sync-types.js --report`
3. ⬜ Try running: `node scripts/skills/api-docs.js --list`
4. ⬜ Commit the skills (follow Step 1 above)
5. ⬜ Commit fabric costing changes (follow Step 2 above)
6. ⬜ Bookmark [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md) for detailed examples
7. ⬜ Print [SKILLS_QUICK_REFERENCE.md](SKILLS_QUICK_REFERENCE.md) and keep it visible

---

**Next time you develop a feature, these skills will save you HOURS of manual work!**

**Questions? Check [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md) for detailed workflows.**
