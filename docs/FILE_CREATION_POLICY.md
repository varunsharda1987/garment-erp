# 📋 FILE CREATION POLICY

> **PREVENT DOCUMENTATION CHAOS - Rules for creating new files**

---

## 🚨 THE PROBLEM WE'RE SOLVING

We had **35 MD files** with massive duplication:
- 9 agent-related docs saying the same things
- 5 verification docs repeating information
- 5 status docs with duplicate info
- Total confusion about which file to read

**Result:** Documentation chaos, wasted time, outdated information

---

## ✅ THE SOLUTION

**STRICT FILE CREATION POLICY**

Before creating ANY new file, ask these questions:

###  1. Does this information belong in an EXISTING file?

| Type of Information | Existing File to Update |
|---------------------|------------------------|
| Project current status | `README.md` |
| What to build next | `docs/DEVELOPMENT_ROADMAP.md` |
| How agents should operate | `AGENTS_START_HERE.md` |
| How to test/verify | `docs/TESTING_GUIDE.md` |
| How to start servers | `QUICK_START.md` |
| Business context | `docs/PROJECT_OVERVIEW.md` |
| Feature details | `docs/FEATURES_LIST.md` |
| Database structure | `docs/DATABASE_SCHEMA.md` |
| Technology explanations | `docs/TECH_STACK_GUIDE.md` |
| Development standards | `docs/CLAUDE_CODE_INSTRUCTIONS.md` |
| Git workflow | `docs/GIT_WORKFLOW_REFERENCE.md` |

### 2. Is this a TEMPORARY summary/completion note?

**DON'T create it!** Instead:
- Update `README.md` with current status
- Add to version history in `README.md`
- Create a git commit message with details

**Exception:** Module completion summaries can go in `docs/archive/`

### 3. Is this a NEW unique type of information?

**Only then** consider creating a new file.

**Ask the user first:**
```
"I need to add [information type]. Should I:
A) Update existing file [file name]
B) Create new file (explain why it's unique)"
```

---

## 📁 APPROVED FILE STRUCTURE

### Root Level (Quick Access) - 3 FILES ONLY

```
garment-erp/
├── README.md              # Project overview + current status
├── QUICK_START.md         # How to start servers
└── AGENTS_START_HERE.md   # Complete agent operations guide
```

**NO MORE ROOT FILES ALLOWED** (except this policy file)

---

### Docs Folder (Reference) - 8 CORE FILES

```
docs/
├── DEVELOPMENT_ROADMAP.md       # What to build (9 phases, 30 modules)
├── DATABASE_SCHEMA.md           # Database structure (35+ tables)
├── FEATURES_LIST.md             # Feature requirements
├── PROJECT_OVERVIEW.md          # Business context
├── TECH_STACK_GUIDE.md          # Technology explanations
├── TESTING_GUIDE.md             # Testing & verification
├── CLAUDE_CODE_INSTRUCTIONS.md  # Development standards
└── GIT_WORKFLOW_REFERENCE.md    # Git reference
```

**THESE ARE COMPLETE** - Don't create alternatives!

---

### Docs Archive (Historical) - UNLIMITED

```
docs/archive/
├── MODULE_1.3_COMPLETION_SUMMARY.md
├── MODULE_2.1_COMPLETION_SUMMARY.md
└── [other completion summaries]
```

**Purpose:** Historical record, not current reference

---

## 🚫 WHAT NOT TO DO

### ❌ Don't Create:
- `PROJECT_STATUS.md` → Update `README.md` instead
- `AGENT_QUICK_REFERENCE.md` → It's in `AGENTS_START_HERE.md`
- `VERIFICATION_PROTOCOL.md` → It's in `TESTING_GUIDE.md`
- `QUICK_COMMANDS.md` → It's in multiple files already
- `SETUP_GUIDE.md` → It's in `QUICK_START.md`
- Any file that duplicates existing information

### ❌ Don't Create Multiple Versions:
- `README_v2.md`
- `AGENT_GUIDE_NEW.md`
- `TESTING_GUIDE_UPDATED.md`

**Instead:** Update the original file!

### ❌ Don't Create Temporary Files:
- `NOTES.md`
- `TODO.md`
- `SCRATCH.md`
- `TEMP.md`

**Instead:** Use git commits or code comments

---

## ✅ WHAT TO DO INSTEAD

### When You Need to Add Information:

**Step 1:** Find the right existing file
```
Type of info → Which file?
- Current status → README.md
- Agent operations → AGENTS_START_HERE.md
- Testing → docs/TESTING_GUIDE.md
- etc.
```

**Step 2:** Update that file
- Read the file first
- Add/update the relevant section
- Maintain consistent formatting
- Update "Last Updated" date

**Step 3:** No need for separate file!

---

### When Completing a Module:

**DON'T** create `MODULE_X_COMPLETE.md`

**DO:**
1. Update `README.md` → Current Status section
2. Update `README.md` → Version History section
3. Create git commit with detailed message
4. Optionally: Save completion summary to `docs/archive/`

---

### When User Asks for "Quick Reference":

**DON'T** create `QUICK_REFERENCE.md`

**DO:**
- Add quick reference section to the relevant existing file
- Example: `AGENTS_START_HERE.md` already has quick reference section

---

## 📝 DECISION FLOWCHART

```
Need to document something?
    ↓
Is it about current project status?
    YES → Update README.md
    NO  → Continue
    ↓
Is it about agent operations?
    YES → Update AGENTS_START_HERE.md
    NO  → Continue
    ↓
Is it about testing/verification?
    YES → Update docs/TESTING_GUIDE.md
    NO  → Continue
    ↓
Is it about starting servers?
    YES → Update QUICK_START.md
    NO  → Continue
    ↓
Check the list of 8 core docs files
    Found a match? → Update that file
    No match? → Continue
    ↓
Is it a temporary completion note?
    YES → Update README.md + git commit (NO NEW FILE!)
    NO  → Continue
    ↓
Is it truly unique, new information?
    YES → ASK USER FIRST before creating
    NO  → Find existing file and update it
```

---

## 🎯 ENFORCEMENT

### For Agents:

**BEFORE creating a new .md file:**
1. ✅ Check if information belongs in existing file
2. ✅ Read this FILE_CREATION_POLICY.md
3. ✅ Ask user for permission
4. ✅ Explain why it's unique and necessary

**If you create a duplicate file:**
- ❌ User will ask you to consolidate it
- ❌ Wastes time
- ❌ Creates confusion

###  For Users:

**If an agent creates a new file:**
1. Ask: "Does this belong in an existing file?"
2. Check: Is it duplicating information?
3. Request: "Please update [existing file] instead"

---

## 📊 APPROVED FILE COUNT

### Current Structure (Post-Consolidation):

**Root:** 3 files
- README.md
- QUICK_START.md
- AGENTS_START_HERE.md

**Docs:** 8 files
- DEVELOPMENT_ROADMAP.md
- DATABASE_SCHEMA.md
- FEATURES_LIST.md
- PROJECT_OVERVIEW.md
- TECH_STACK_GUIDE.md
- TESTING_GUIDE.md
- CLAUDE_CODE_INSTRUCTIONS.md
- GIT_WORKFLOW_REFERENCE.md

**Total Core Docs:** 11 files

**Archive:** Unlimited (historical records only)

---

## 🎓 EXAMPLES

### ❌ BAD Example:

```
Agent: "I'll create AGENT_VERIFICATION_CHECKLIST.md to help with verification"
```

**Problem:** This info belongs in `AGENTS_START_HERE.md` and `docs/TESTING_GUIDE.md`

**Correct:**
```
Agent: "I'll add a verification checklist section to AGENTS_START_HERE.md"
```

---

### ❌ BAD Example:

```
Agent: "Module complete! Creating MODULE_2.1_FRONTEND_COMPLETE.md"
```

**Problem:** Temporary completion note

**Correct:**
```
Agent: "Module complete! Updating README.md status and creating git commit"
```

---

### ✅ GOOD Example:

```
Agent: "I need to document the webhook integration system. This is unique information not covered in any existing file. Should I create docs/WEBHOOK_GUIDE.md?"

User: "Yes, that's unique. Go ahead."
```

---

### ✅ GOOD Example:

```
Agent: "I'll add the deployment checklist to docs/CLAUDE_CODE_INSTRUCTIONS.md instead of creating a separate DEPLOYMENT.md file"
```

---

## 🚀 BENEFITS OF THIS POLICY

1. **No Duplication** - Each piece of info in ONE place
2. **Easy to Find** - Clear file names, clear purposes
3. **Easy to Update** - Update once, not 9 times
4. **Less Confusion** - No "which doc do I read?"
5. **Better Maintenance** - Fewer files to keep updated
6. **Cleaner Repo** - Professional, organized structure

---

## 📋 CHECKLIST FOR NEW FILES

Before creating a new .md file, verify:

- [ ] Information doesn't belong in README.md
- [ ] Information doesn't belong in AGENTS_START_HERE.md
- [ ] Information doesn't belong in any of 8 core docs
- [ ] Information doesn't belong in QUICK_START.md
- [ ] It's not a temporary completion note
- [ ] It's not a duplicate of existing info
- [ ] It's truly unique and necessary
- [ ] User has approved creation
- [ ] Clear, unique purpose defined
- [ ] No other file covers this topic

**If ALL checked** → OK to create

**If ANY unchecked** → Update existing file instead

---

## 🎯 SUMMARY

**ONE RULE TO RULE THEM ALL:**

> **"Before creating a new file, find the existing file that should contain this information and update it."**

**Exceptions:**
1. User explicitly requests a new file
2. Truly unique information not covered anywhere
3. Historical archive (docs/archive/)

**Everything else:** Update existing files!

---

## 📞 QUESTIONS?

**"Where should I document X?"**
→ Check the table at the top of this file

**"Can I create a quick reference?"**
→ No, add it to the relevant existing file

**"Module is complete, can I create a summary?"**
→ No, update README.md and git commit

**"This information is really unique!"**
→ Ask user first, explain why it's unique

---

**Last Updated:** October 18, 2025
**Purpose:** Prevent documentation chaos
**Status:** MANDATORY POLICY - All agents must follow
