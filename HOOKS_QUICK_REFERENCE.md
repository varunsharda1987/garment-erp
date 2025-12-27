# Hooks Quick Reference Card

**Automated quality gates - no manual checking needed!**

---

## 🎯 The 4 Hooks

| Hook | Triggers | Blocks? | Purpose |
|------|----------|---------|---------|
| **post-type-change** | Type files change | No | Auto-validate type sync |
| **pre-commit** | Before commit | Yes | TypeScript + type sync + console.log |
| **pre-migration** | Before migration | Yes | Schema validation + safety |
| **post-docs-update** | Docs change | No | Link validation + timestamps |

---

## 🔍 What Each Hook Does

### post-type-change
**Runs:** When `*.types.ts` or `schema.prisma` changes
**Checks:**
- Type synchronization (backend ↔ frontend)
- Serializer mappings (snake_case → camelCase)
- Suggests running API docs if controller types changed

**Manual test:**
```bash
node scripts/hooks/post-type-change.js
```

---

### pre-commit
**Runs:** Before every `git commit`
**Checks:**
1. TypeScript type checking (backend + frontend)
2. Type synchronization validation
3. Console.log detection (warns, doesn't block)

**Blocks commit if:**
- TypeScript errors found
- Types out of sync
- Critical quality issues

**Manual test:**
```bash
git add .
node scripts/hooks/pre-commit.js
```

---

### pre-migration
**Runs:** Before Prisma migrations
**Checks:**
1. Schema syntax validation
2. Destructive operations detection
3. Serializer relation mappings
4. Environment check (blocks in production!)
5. Migration conflicts

**Blocks migration if:**
- Schema has syntax errors
- Running in production (without override)
- Critical safety issues

**Manual test:**
```bash
node scripts/hooks/pre-migration.js
```

---

### post-docs-update
**Runs:** When `*.md` files change
**Checks:**
1. Broken internal links
2. Dangerous commands in code blocks
3. Auto-updates timestamps

**Manual test:**
```bash
node scripts/hooks/post-docs-update.js
```

---

## 🚀 Common Scenarios

### Adding New Feature
```bash
# 1. Edit schema
# → pre-migration validates before migration

# 2. Create backend types
# → post-type-change warns if frontend missing

# 3. Create frontend types
# → post-type-change confirms sync

# 4. Commit
# → pre-commit validates TypeScript + types
```

### Hook Catches Error
```bash
git commit -m "Update types"
# → pre-commit runs
# ✗ Frontend TypeScript errors
# → BLOCKED

# Fix the issues
node scripts/skills/sync-types.js --check

git commit -m "Update types"
# → pre-commit runs
# ✓ All checks passed
# → ALLOWED
```

### Production Protection
```bash
# Accidentally in production
export NODE_ENV=production

node scripts/skills/db-workflow.js --migrate
# → pre-migration runs
# ✗ Production migration blocked
# → BLOCKED

# Fix environment
export NODE_ENV=development
# → Migration allowed
```

---

## 🔧 Manual Testing

```bash
# Test all hooks
node scripts/hooks/post-type-change.js
node scripts/hooks/pre-commit.js       # Needs staged files
node scripts/hooks/pre-migration.js
node scripts/hooks/post-docs-update.js
```

---

## ⚙️ Configuration

**Enable/Disable:**
Edit `.claude/hooks/<hook-name>.hook.json`:
```json
{
  "enabled": true,   // false to disable
  "blocking": true   // false for warnings only
}
```

**Temporarily Skip (NOT RECOMMENDED):**
```bash
git commit --no-verify -m "message"
```

---

## ⚠️ Best Practices

### ✅ DO:
- Read hook output messages
- Fix issues instead of skipping hooks
- Test manually before committing
- Keep hooks enabled

### ❌ DON'T:
- Skip hooks with `--no-verify`
- Ignore warning messages
- Disable hooks permanently
- Commit with known errors

---

## 🆘 Quick Help

### "Pre-commit hook is blocking me"
```bash
# See what's wrong
git add .
node scripts/hooks/pre-commit.js

# Common fixes:
# TypeScript errors → Fix type issues
# Type sync issues → Run sync-types
# Console.log → Remove debug statements
```

### "Pre-migration hook is blocking me"
```bash
# See what's wrong
node scripts/hooks/pre-migration.js

# Common fixes:
# Schema errors → Fix schema.prisma syntax
# Production env → Change to development
# Missing mappings → Update serializer.ts
```

### "Post-type-change warns about sync"
```bash
# Check synchronization
node scripts/skills/sync-types.js --report

# Fix sync issues
# Create missing frontend types
# Update serializer mappings
```

---

## 📊 Hook Status Messages

### Success Messages
- `✓` Green checkmark - Check passed
- `✓ All checks passed` - Safe to proceed

### Warning Messages
- `⚠` Yellow warning - Issue detected (not blocking)
- `ℹ` Blue info - Informational message

### Error Messages
- `✗` Red X - Check failed (blocking)
- `✗ Pre-commit checks failed` - Fix before proceeding

---

## 📖 Full Documentation

- Complete guide: [HOOKS_USAGE_GUIDE.md](HOOKS_USAGE_GUIDE.md)
- Skills integration: [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md)
- Project overview: [CLAUDE.md](CLAUDE.md)

---

**Remember:** Hooks are your safety net - they catch issues before they become problems!

**Last Updated:** December 27, 2025
