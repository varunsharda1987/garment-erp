# Skills Quick Reference Card

**Print this and keep it near your desk!**

---

## 🎯 The 5 Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| **sync-types** | `node scripts/skills/sync-types.js --report` | After changing types, before committing |
| **db-workflow** | `node scripts/skills/db-workflow.js --migrate` | After schema changes |
| **test-all** | `node scripts/skills/test-all.js --all` | Before committing, before PRs |
| **api-docs** | `node scripts/skills/api-docs.js --generate` | After adding/changing routes |
| **commit-smart** | `node scripts/skills/commit-smart.js --generate` | Before every commit |

---

## 📝 Most Common Commands

### Daily Development
```bash
# Morning check
node scripts/skills/sync-types.js --report

# After making changes
node scripts/skills/sync-types.js --check
node scripts/skills/test-all.js --all

# Before committing
node scripts/skills/commit-smart.js --generate
```

### After Schema Changes
```bash
node scripts/skills/db-workflow.js --migrate
node scripts/skills/sync-types.js --check
```

### Before Pull Request
```bash
node scripts/skills/sync-types.js --check
node scripts/skills/test-all.js --coverage
node scripts/skills/api-docs.js --generate
```

---

## 🔍 Quick Lookups

### Check Type Synchronization
```bash
node scripts/skills/sync-types.js --report
```

### List All API Endpoints
```bash
node scripts/skills/api-docs.js --list
```

### Find Specific Endpoints
```bash
node scripts/skills/api-docs.js --list | grep "user"
node scripts/skills/api-docs.js --list | grep "POST"
```

### Preview Commit Changes
```bash
node scripts/skills/commit-smart.js --preview
```

---

## 💾 Add to package.json

```json
"scripts": {
  "sync": "node scripts/skills/sync-types.js --report",
  "db": "node scripts/skills/db-workflow.js --migrate",
  "test": "node scripts/skills/test-all.js --all",
  "docs": "node scripts/skills/api-docs.js --generate",
  "commit": "node scripts/skills/commit-smart.js --generate"
}
```

Then use: `npm run sync`, `npm run test`, etc.

---

## ⚡ Power User Tips

### 1. Chain Commands
```bash
# Complete validation before commit
node scripts/skills/sync-types.js --check && \
node scripts/skills/test-all.js --all && \
node scripts/skills/commit-smart.js --generate
```

### 2. Get Help Anytime
```bash
node scripts/skills/sync-types.js --help
node scripts/skills/db-workflow.js --help
node scripts/skills/test-all.js --help
node scripts/skills/api-docs.js --help
node scripts/skills/commit-smart.js --help
```

### 3. Database Quick Actions
```bash
# Full setup (first time)
node scripts/skills/db-workflow.js --setup

# Just re-seed
node scripts/skills/db-workflow.js --seed

# Complete reset (⚠ deletes data!)
node scripts/skills/db-workflow.js --reset
```

### 4. Test Specific Suites
```bash
# E2E tests only
node scripts/skills/test-all.js --e2e

# Backend tests only
node scripts/skills/test-all.js --backend

# With coverage
node scripts/skills/test-all.js --coverage
```

---

## 🆘 Emergency Commands

### Types Out of Sync?
```bash
node scripts/skills/sync-types.js --report
# Look at "Serializer Mappings" section
# Use camelCase in frontend!
```

### Can't Find API Endpoint?
```bash
node scripts/skills/api-docs.js --list | grep "search-term"
```

### Need to Reset Database?
```bash
node scripts/skills/db-workflow.js --reset
```

### Tests Failing?
```bash
# Run specific suite
node scripts/skills/test-all.js --e2e
node scripts/skills/test-all.js --backend
```

---

**Remember:** All skills have `--help` for detailed usage!

**Location:** Keep this file open in your editor while developing
