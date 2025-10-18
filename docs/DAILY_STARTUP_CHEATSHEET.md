# ⚡ DAILY STARTUP CHEAT SHEET

> **Your 2-minute guide to starting work each day**

---

## 🚀 STEP-BY-STEP

### Step 1: Start Servers (1 command)
```bash
office-control
# Press: 3 (Start Both Servers)
```
✅ Backend running on http://localhost:5000
✅ Frontend running on http://localhost:5173

---

### Step 2: Open 2 Claude Code Windows

**Window 1:** Backend Agent
**Window 2:** Frontend Agent

---

### Step 3: Copy-Paste Instructions

#### 📋 BACKEND AGENT (Window 1):
```
You are the BACKEND DEVELOPER for Kashaya Fabs ERP.

Read in order:
1. AGENTS_START_HERE.md
2. README.md (check current status)
3. Work on current module

Verification (must show outputs):
- npx tsc --noEmit
- curl http://localhost:5000/health
- curl tests for endpoints
- Auth tests (401)
- Validation tests (400)

Start by announcing your role.
```

#### 📋 FRONTEND AGENT (Window 2):
```
You are the FRONTEND DEVELOPER for Kashaya Fabs ERP.

Read in order:
1. AGENTS_START_HERE.md
2. README.md (check current status)
3. Work on current module

Verification (must show outputs):
- npx tsc --noEmit
- npm run build
- npm run test:e2e
- node scripts/check-console.cjs http://localhost:5173/[page]

Start by announcing your role.
```

---

### Step 4: Let Them Work!

Agents will:
1. Read the guides
2. Check current status
3. Start working
4. Show verification outputs
5. Complete the module

---

## 📱 EVEN SIMPLER (One-Liner)

### Backend:
```
Backend Dev: Read AGENTS_START_HERE.md, check README.md, work on current module, show all verification outputs (tsc, curl, auth, validation).
```

### Frontend:
```
Frontend Dev: Read AGENTS_START_HERE.md, check README.md, work on current module, show all verification outputs (tsc, build, E2E, console).
```

---

## 🎯 QUICK REFERENCE

### Current Status Location:
📄 **README.md** → "Current Project Status" section

### What Module to Work On:
📄 **README.md** → "In Progress" section

### If Agent Confused:
📄 **AGENTS_START_HERE.md** → Complete guide

### If Agent Creates Files:
📄 **FILE_CREATION_POLICY.md** → Check first!

---

## 🔧 DAILY CHECKLIST

**Morning:**
- [ ] Run: `office-control` → Press 3
- [ ] Open 2 Claude Code windows
- [ ] Paste backend instructions → Window 1
- [ ] Paste frontend instructions → Window 2
- [ ] Wait for agents to announce roles

**During Work:**
- [ ] Monitor progress
- [ ] Check verification outputs
- [ ] Test in browser (frontend only)
- [ ] Approve completed work

**End of Day:**
- [ ] Run: `office-control` → Press 6
- [ ] Review completed work
- [ ] Update README.md if needed

---

## 💡 PRO TIPS

**Tip 1:** Keep this file open for quick copy-paste
**Tip 2:** Backend should finish API before frontend starts UI
**Tip 3:** Check README.md for current status daily
**Tip 4:** Agents must show ALL verification outputs

---

## 🚨 IF PROBLEMS

### Agent doesn't follow instructions:
```
Read AGENTS_START_HERE.md completely.
Show actual command outputs.
```

### Agent creates unnecessary files:
```
Read FILE_CREATION_POLICY.md first.
Update existing files instead.
```

### Agent works on wrong module:
```
Check README.md "In Progress" section.
Work only on that module.
```

---

## 📞 HELP

- **How to start servers?** → See QUICK_START.md
- **What should agents work on?** → Check README.md
- **How should agents operate?** → See AGENTS_START_HERE.md
- **All documentation?** → See DOCUMENTATION_INDEX.md

---

**Last Updated:** October 18, 2025
**Purpose:** Quick daily startup reference
**Time Required:** 2 minutes to start work
