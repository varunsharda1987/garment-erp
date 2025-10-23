# ⚠️ SCHEMA CHANGE CHECKLIST - READ THIS FIRST!

> **MANDATORY: Run this checklist EVERY TIME you modify Prisma schema**

**Last Updated:** October 23, 2025

---

## 🚨 CRITICAL REMINDER

### When you modify `backend/prisma/schema.prisma`:

```bash
# STEP 1: Make your schema changes
# ... edit schema.prisma ...

# STEP 2: Push/Migrate to database
cd backend
npx prisma db push
# OR
npx prisma migrate dev --name your_migration_name

# STEP 3: ⚠️ ALWAYS RUN THIS - DO NOT SKIP! ⚠️
npm run docs:schema

# STEP 4: Commit BOTH schema and docs together
git add prisma/schema.prisma ../docs/DATABASE_SCHEMA.md
git commit -m "feat(db): Your changes"
```

---

## ✅ CHECKLIST (Check each box)

After ANY schema change:

- [ ] Modified `backend/prisma/schema.prisma`
- [ ] Ran database migration/push
- [ ] **RAN `npm run docs:schema`** ⚠️ MOST IMPORTANT
- [ ] Verified `docs/DATABASE_SCHEMA.md` was updated
- [ ] Committed schema + docs together
- [ ] Verified commit includes both files

---

## 🎯 WHY THIS IS CRITICAL

**Problem if you forget:**
- ❌ DATABASE_SCHEMA.md becomes outdated
- ❌ Other developers see wrong schema
- ❌ Documentation doesn't match reality
- ❌ Confusion and bugs

**Solution:**
- ✅ ALWAYS run `npm run docs:schema`
- ✅ Takes < 1 second
- ✅ Keeps docs synchronized
- ✅ Professional workflow

---

## 📝 QUICK REFERENCE

### After adding a field:
```prisma
model Customer {
  // ... existing fields
  newField String?  // ← Added this
}
```
```bash
cd backend
npx prisma db push
npm run docs:schema  # ← DON'T FORGET!
```

### After adding an enum:
```prisma
enum NewStatus {
  ACTIVE
  INACTIVE
}
```
```bash
cd backend
npx prisma db push
npm run docs:schema  # ← DON'T FORGET!
```

### After creating a new model:
```prisma
model NewTable {
  id String @id @default(uuid())
  // ... fields
}
```
```bash
cd backend
npx prisma migrate dev --name add_new_table
npm run docs:schema  # ← DON'T FORGET!
```

---

## 🔄 AUTOMATED REMINDER

This file is referenced in:
- ✅ `PROJECT_MASTER_GUIDE.md` (Coding Standards section)
- ✅ `SESSION_START.md` (Development Patterns section)
- ✅ `docs/SCHEMA_DOCS_UPDATE_GUIDE.md` (Full details)
- ✅ Top of `backend/prisma/schema.prisma` (Comment reminder)

---

## 💡 PRO TIP

Use the combined command to do everything at once:

```bash
cd backend
npm run migrate:docs
```

This will:
1. Create migration
2. Update database
3. Generate documentation
4. All in one command!

---

## ⚠️ FOR CLAUDE/AI AGENTS

**IMPORTANT INSTRUCTION:**

When you modify `backend/prisma/schema.prisma`, you MUST:

1. **Immediately after schema changes**, run:
   ```bash
   cd backend && npm run docs:schema
   ```

2. **Before committing**, verify:
   ```bash
   git status
   # Should show BOTH files modified:
   # - backend/prisma/schema.prisma
   # - docs/DATABASE_SCHEMA.md
   ```

3. **Commit both files together**:
   ```bash
   git add backend/prisma/schema.prisma docs/DATABASE_SCHEMA.md
   git commit -m "feat(db): description"
   ```

**DO NOT SKIP THIS STEP!**

---

## 📞 REMINDER LOCATIONS

If you're starting a new session and see Prisma schema changes:

1. **Check this file first:** `SCHEMA_CHANGE_CHECKLIST.md`
2. **Read:** `docs/SCHEMA_DOCS_UPDATE_GUIDE.md`
3. **Always run:** `npm run docs:schema`

---

**REMEMBER: Documentation is part of the code!**

**ONE COMMAND:** `npm run docs:schema`
**ONE SECOND:** That's all it takes
**ZERO EXCUSES:** Always run it!

---

**Created:** October 23, 2025
**Purpose:** Prevent forgetting schema documentation updates
**Status:** CRITICAL - READ BEFORE EVERY SCHEMA CHANGE
