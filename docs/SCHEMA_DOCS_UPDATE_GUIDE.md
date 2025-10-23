# 🔄 Database Schema Documentation - Auto-Update Guide

> **Keep DATABASE_SCHEMA.md automatically synchronized with Prisma schema**

**Last Updated:** October 23, 2025

---

## 🎯 THE PROBLEM WE SOLVED

Before: Manual documentation updates were:
- ❌ Time-consuming
- ❌ Error-prone
- ❌ Often forgotten
- ❌ Quickly out of sync

Now: Automated documentation is:
- ✅ Instant (< 1 second)
- ✅ Always accurate
- ✅ Easy to remember
- ✅ Always in sync

---

## 🚀 QUICK START

### After ANY Prisma schema change:

```bash
cd backend
npm run docs:schema
```

**That's it!** The DATABASE_SCHEMA.md file is now updated.

---

## 📋 WHEN TO UPDATE

Update the schema documentation whenever you:

✅ **Add a new model** (table)
```prisma
model NewTable {
  id String @id @default(uuid())
  // ...
}
```

✅ **Add a new enum**
```prisma
enum NewStatus {
  ACTIVE
  INACTIVE
}
```

✅ **Add/modify fields**
```prisma
model User {
  // ... existing fields
  newField String?  // Added
}
```

✅ **Add/remove indexes**
```prisma
@@index([fieldName])
@@unique([field1, field2])
```

✅ **After running migrations**
```bash
npx prisma migrate dev --name add_new_table
npm run docs:schema  # ← Don't forget this!
```

---

## 🛠️ AVAILABLE COMMANDS

### 1. Update Documentation Only
```bash
cd backend
npm run docs:schema
```

**Use this when:**
- You've already created a migration
- You just want to refresh the docs
- You're reviewing the current schema

### 2. Migrate + Update Docs (Combined)
```bash
cd backend
npm run migrate:docs
```

**What it does:**
1. Runs `npx prisma migrate dev` (creates migration)
2. Automatically runs `npm run docs:schema`
3. You get both migration AND updated docs!

**Use this when:**
- Creating a new migration
- You want to do everything in one command

---

## 📂 WHAT GETS UPDATED

The script automatically generates:

### ✅ Enums Section
- All enum names
- All enum values
- Formatted code blocks

### ✅ Tables Section
- All model/table names
- All fields with types
- Primary keys, unique constraints
- Nullable fields
- Default values
- Indexes
- Relationships

### ✅ Statistics
- Total number of tables
- Total number of enums
- Style Master table count
- File size

### ✅ Metadata
- Last updated date
- Generator script location
- Auto-generation notice

---

## 🔄 RECOMMENDED WORKFLOW

### Option 1: Manual (Simple)
```bash
# 1. Modify Prisma schema
# ... make your changes in schema.prisma ...

# 2. Create migration
cd backend
npx prisma migrate dev --name your_migration_name

# 3. Update documentation
npm run docs:schema

# 4. Commit both
git add prisma/migrations/ ../docs/DATABASE_SCHEMA.md
git commit -m "feat(db): Your changes description"
```

### Option 2: Combined Command (Easier)
```bash
# 1. Modify Prisma schema
# ... make your changes in schema.prisma ...

# 2. Run combined command
cd backend
npm run migrate:docs
# This creates migration AND updates docs!

# 3. Commit
git add prisma/migrations/ ../docs/DATABASE_SCHEMA.md
git commit -m "feat(db): Your changes description"
```

### Option 3: Automated (Advanced)
Add to your Git hooks or CI/CD pipeline:

**Pre-commit Hook** (.husky/pre-commit):
```bash
#!/bin/sh
cd backend && npm run docs:schema
git add ../docs/DATABASE_SCHEMA.md
```

---

## 📊 WHAT THE SCRIPT DOES

### Step-by-Step Process:

1. **Reads** `backend/prisma/schema.prisma`
2. **Parses** all enums and models
3. **Extracts** fields, types, attributes
4. **Identifies** indexes and unique constraints
5. **Categorizes** tables by module
6. **Generates** formatted Markdown
7. **Creates backup** of existing docs
8. **Writes** new `docs/DATABASE_SCHEMA.md`
9. **Reports** statistics

### Output Example:
```
📊 Generating Database Schema Documentation...

✅ Read Prisma schema from: backend/prisma/schema.prisma
✅ Parsed 24 enums
✅ Parsed 50 models (tables)
✅ Created backup: docs/DATABASE_SCHEMA.md.backup
✅ Generated documentation: docs/DATABASE_SCHEMA.md

📊 Documentation Statistics:
   - Total Enums: 24
   - Total Tables: 50
   - Style Master Tables: 13
   - File Size: 37.75 KB

✅ DATABASE_SCHEMA.md successfully generated!
```

---

## 🔍 SCRIPT LOCATION

**Generator Script:** `backend/scripts/generate-schema-docs.js`

### How it works:
- Written in vanilla Node.js (no dependencies)
- Uses regular expressions to parse Prisma schema
- Generates clean, formatted Markdown
- Creates automatic backups
- Provides detailed statistics

### Script Features:
✅ No external dependencies
✅ Fast execution (< 1 second)
✅ Automatic backup creation
✅ Error handling
✅ Detailed console output
✅ Cross-platform compatible

---

## 🛡️ SAFETY FEATURES

### Automatic Backup
Every time you run the script, it:
1. Checks if DATABASE_SCHEMA.md exists
2. Creates a backup: `DATABASE_SCHEMA.md.backup`
3. Then overwrites with new version

**If something goes wrong:**
```bash
# Restore from backup
cd docs
cp DATABASE_SCHEMA.md.backup DATABASE_SCHEMA.md
```

### Version Control
- Always commit docs with migrations
- Review changes in git diff
- Documentation is part of your codebase

---

## ❓ FAQ

### Q: Do I need to run this for every schema change?
**A:** Yes! Even small changes. It takes < 1 second.

### Q: What if I forget to run it?
**A:** The docs will be outdated. Add it to your workflow or use git hooks.

### Q: Can I edit DATABASE_SCHEMA.md manually?
**A:** No! It will be overwritten. The file header says "AUTO-GENERATED".

### Q: What if I want to add custom documentation?
**A:** Create a separate file (e.g., `SCHEMA_NOTES.md`) for custom notes.

### Q: Does this work on Windows/Mac/Linux?
**A:** Yes! The script is cross-platform.

### Q: What if the script fails?
**A:** Check:
  - Are you in the `backend` directory?
  - Does `prisma/schema.prisma` exist?
  - Do you have Node.js installed?

---

## 💡 BEST PRACTICES

### ✅ DO:
- Run `npm run docs:schema` after every migration
- Commit docs and migrations together
- Review the generated docs
- Use the combined `migrate:docs` command
- Add to your CI/CD pipeline

### ❌ DON'T:
- Manually edit DATABASE_SCHEMA.md
- Skip documentation updates
- Commit migrations without updated docs
- Delete the generator script
- Ignore the backup files

---

## 🎯 BENEFITS

### For Developers:
- ✅ Always know the current schema
- ✅ No manual documentation work
- ✅ Instant reference
- ✅ Accurate field types
- ✅ Clear relationships

### For Teams:
- ✅ Everyone sees the same schema
- ✅ New developers onboard faster
- ✅ Reduced confusion
- ✅ Better code reviews

### For Project:
- ✅ Professional documentation
- ✅ Always up-to-date
- ✅ Searchable reference
- ✅ Version controlled

---

## 🔗 RELATED FILES

- **Prisma Schema:** `backend/prisma/schema.prisma` (source of truth)
- **Generator Script:** `backend/scripts/generate-schema-docs.js`
- **Generated Docs:** `docs/DATABASE_SCHEMA.md`
- **Backup:** `docs/DATABASE_SCHEMA.md.backup`
- **Package Scripts:** `backend/package.json` (contains npm scripts)

---

## 📞 TROUBLESHOOTING

### Script not found?
```bash
# Make sure you're in the backend directory
cd backend
npm run docs:schema
```

### Permission denied?
```bash
# On Unix systems, make script executable
chmod +x scripts/generate-schema-docs.js
```

### Documentation looks wrong?
```bash
# Check your Prisma schema syntax first
cd backend
npx prisma format
npx prisma validate

# Then regenerate docs
npm run docs:schema
```

---

## 🎉 SUCCESS CHECKLIST

After making schema changes, verify:

- [ ] Modified `schema.prisma`
- [ ] Ran `npm run migrate:docs` OR both:
  - [ ] Ran `npx prisma migrate dev`
  - [ ] Ran `npm run docs:schema`
- [ ] Reviewed generated `DATABASE_SCHEMA.md`
- [ ] Committed migration files
- [ ] Committed updated documentation
- [ ] Used descriptive commit message

---

**Remember:** Good documentation is automated documentation! 🚀

**One Command:** `npm run docs:schema`
**Zero Manual Work:** Automatically generated
**Always Accurate:** Reads directly from Prisma schema

---

**Last Updated:** October 23, 2025
**Maintained By:** Development Team
**Script Version:** 1.0.0
