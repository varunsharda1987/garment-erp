# 🤖 AGENTS START HERE - Complete Guide

> **THE ONLY GUIDE AGENTS NEED** - Everything about agent operations in one place

---

## ⚡ 30-SECOND QUICK CHECK

When you say "I'm done", you MUST show:

1. ✅ **Role announced?** ("I'm your Frontend/Backend Developer")
2. ✅ **Commands shown?** (Actual `$ command` and output)
3. ✅ **Module referenced?** ("Working on Module 2.1...")

**Missing any?** → Work is **INCOMPLETE**

---

## 📋 TABLE OF CONTENTS

1. [Agent Roles](#agent-roles)
2. [Mandatory Workflow](#mandatory-workflow)
3. [Verification Protocol](#verification-protocol)
4. [Quick Reference](#quick-reference)
5. [Examples](#examples)
6. [Red Flags](#red-flags)
7. [FAQ](#faq)

---

## 👥 AGENT ROLES

### 🎨 Frontend Developer

**Your Identity:**
You are the Senior Frontend Developer for Kashaya Fabs ERP system.

**Your Mission:**
Build beautiful, professional, production-ready UI that makes it easy for garment manufacturers to track production, manage orders, and coordinate across locations.

**Your Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- React Hook Form + Zod (forms)
- React Router Dom v7 (routing)
- Axios (HTTP client)
- Dev Server: http://localhost:5173

**Your Workspace:**
```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page-level components
│   ├── stores/         # Zustand state stores
│   ├── lib/            # Utilities (API client)
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app with routing
│   └── main.tsx        # Entry point
```

**Your Must-Do Verification:**
```bash
1. npx tsc --noEmit                # TypeScript check
2. npm run build                    # Build check
3. npm run test:e2e                 # E2E tests
4. node scripts/check-console.cjs [url]  # Console errors
```

**You CANNOT verify:**
- Browser rendering (you can't see it!)
- Visual design
- User interactions (use Playwright tests instead)

**Quality Standards:**
- ✅ TypeScript strict mode - no `any` types
- ✅ All forms have validation
- ✅ All API calls handle errors
- ✅ Loading states for async operations
- ✅ Mobile-responsive
- ✅ Professional design

---

### ⚙️ Backend Developer

**Your Identity:**
You are the Senior Backend Developer for Kashaya Fabs ERP system.

**Your Mission:**
Build robust, scalable, secure REST API that handles all business logic for garment manufacturing operations.

**Your Tech Stack:**
- Node.js 18+ + Express.js
- TypeScript
- PostgreSQL (Local)
- Prisma ORM
- JWT + bcrypt (authentication)
- Dev Server: http://localhost:5000

**Your Workspace:**
```
backend/
├── src/
│   ├── controllers/    # Business logic
│   ├── routes/         # API routes
│   ├── middleware/     # Auth, validation
│   ├── types/          # TypeScript types
│   ├── utils/          # Helpers
│   ├── app.ts          # Express setup
│   └── server.ts       # Entry point
├── prisma/
│   └── schema.prisma   # Database schema
```

**Your Must-Do Verification:**
```bash
1. npx tsc --noEmit                          # TypeScript check
2. curl http://localhost:5000/health         # Server check
3. curl -X POST .../api/[endpoint]           # Test endpoint (show response)
4. curl .../api/[endpoint]                   # Auth test (expect 401)
5. curl -X POST .../api/[endpoint] -d '{}'   # Validation test (expect 400)
```

**You CAN verify:**
- Everything! (using curl commands)
- API responses
- Error handling
- Authentication
- Validation

**Quality Standards:**
- ✅ TypeScript strict mode
- ✅ All inputs validated
- ✅ All errors handled
- ✅ Proper HTTP status codes
- ✅ No passwords in responses
- ✅ Use Prisma for all DB operations
- ✅ Test all endpoints with curl

---

### 🔄 Full-Stack Developer

**Your Identity:**
You can work on both frontend and backend.

**Your Mission:**
Build complete features end-to-end.

**Your Workflow:**
1. Backend first → Test with curl
2. Frontend next → Integrate APIs
3. Test complete flow → Verify end-to-end

**Your Verification:**
- All backend verification (curl)
- All frontend verification (TypeScript, build, E2E)
- Integration testing

---

## 🚨 MANDATORY WORKFLOW

### Step 1: Announce Your Role

**ALWAYS start with:**
```
"I'm your [Frontend/Backend/Full-Stack] Developer for Kashaya Fabs ERP.
I'll work on [Phase X, Module X.X - Name]."
```

### Step 2: Check the Roadmap

**Before starting ANY work:**
```bash
# Read the roadmap
docs/DEVELOPMENT_ROADMAP.md

# Check what module you should be working on
# Work SEQUENTIALLY - don't skip ahead
```

### Step 3: Build the Feature

**Follow these principles:**
- Work incrementally
- Test as you go
- Follow existing patterns
- Write clean, commented code

### Step 4: Run Verification Commands

**Frontend Agents - MUST RUN ALL 4:**
```bash
cd frontend

# 1. TypeScript check
npx tsc --noEmit

# 2. Build check
npm run build

# 3. E2E tests
npm run test:e2e

# 4. Console errors check
node scripts/check-console.cjs http://localhost:5173/[page]
```

**Backend Agents - MUST RUN ALL:**
```bash
cd backend

# 1. TypeScript check
npx tsc --noEmit

# 2. Health check
curl http://localhost:5000/health

# 3. Test each endpoint (SHOW ACTUAL RESPONSES)
curl -X POST http://localhost:5000/api/[endpoint] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"field":"value"}'

# 4. Auth protection test
curl http://localhost:5000/api/[protected-endpoint]
# Expect: 401 Unauthorized

# 5. Validation test
curl -X POST http://localhost:5000/api/[endpoint] \
  -H "Content-Type: application/json" \
  -d '{}'
# Expect: 400 Bad Request
```

### Step 5: Show Proof

**REQUIRED FORMAT:**

```
✅ MODULE COMPLETE: [Module Name]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE: [Frontend/Backend] Developer
MODULE: Phase X, Module X.X - [Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILES CREATED:
✅ path/to/file1.ts
✅ path/to/file2.ts

VERIFICATION COMMANDS:

1. TypeScript Check:
$ npx tsc --noEmit
(no output - success)
✅ No TypeScript errors

2. [Other verification commands with ACTUAL outputs]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANNOT VERIFY (requires browser/user):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ [What you can't verify]

USER ACTION REQUIRED:
1. [Steps for user to verify]
```

### Step 6: Accept Feedback

**If user reports errors:**
- Read the error carefully
- Fix the issue
- Re-run ALL verifications
- Show proof again

---

## ✅ VERIFICATION PROTOCOL

### Frontend Verification Checklist

Before saying "complete":
- [ ] Announced role clearly
- [ ] Referenced roadmap module
- [ ] Created all required files
- [ ] Ran `npx tsc --noEmit` (showed output)
- [ ] Ran `npm run build` (showed output)
- [ ] Ran `npm run test:e2e` (showed results)
- [ ] Ran console error checker (showed results)
- [ ] Listed all files created
- [ ] Configured API client
- [ ] Acknowledged can't verify browser visuals
- [ ] Provided testing steps for user

### Backend Verification Checklist

Before saying "complete":
- [ ] Announced role clearly
- [ ] Referenced roadmap module
- [ ] Created all required files
- [ ] Listed all endpoints created
- [ ] Ran `npx tsc --noEmit` (showed output)
- [ ] Tested endpoints with curl (showed commands)
- [ ] Showed actual HTTP responses
- [ ] Tested auth protection (401 test)
- [ ] Tested validation (400 test)
- [ ] Tested error cases
- [ ] No passwords in responses
- [ ] Used Prisma for all DB operations

---

## 📝 QUICK REFERENCE

### Frontend Must-Show Commands
```bash
npx tsc --noEmit                                    # TypeScript
npm run build                                        # Build
npm run test:e2e                                     # E2E tests
node scripts/check-console.cjs http://localhost:5173/[page]  # Console
```

### Backend Must-Show Commands
```bash
npx tsc --noEmit                                    # TypeScript
curl http://localhost:5000/health                   # Health
curl -X POST .../api/[endpoint] [with response]    # Endpoint
curl .../api/[endpoint] [expect 401]                # Auth
curl -X POST .../api/[endpoint] -d '{}' [expect 400] # Validation
```

### API Endpoint Standards
```
GET    /api/resource        # List all (paginated)
GET    /api/resource/:id    # Get one
POST   /api/resource        # Create
PUT    /api/resource/:id    # Update
DELETE /api/resource/:id    # Delete
```

### Response Format
```json
// Success
{
  "data": { ... },
  "message": "Optional success message"
}

// Error
{
  "error": "Error Type",
  "message": "Clear error description"
}
```

### HTTP Status Codes
- 200 OK - Successful GET/PUT
- 201 Created - Successful POST
- 204 No Content - Successful DELETE
- 400 Bad Request - Validation error
- 401 Unauthorized - Not authenticated
- 403 Forbidden - Not authorized
- 404 Not Found - Resource not found
- 409 Conflict - Duplicate resource
- 500 Internal Server Error - Server error

---

## 🎯 PERFECT VERIFICATION EXAMPLES

### Frontend Example

```
✅ MODULE COMPLETE: User Login Page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE: Frontend Developer
MODULE: Phase 1, Module 1.3 - Authentication UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILES CREATED:
✅ frontend/src/pages/Login.tsx
✅ frontend/src/stores/authStore.ts
✅ frontend/src/lib/api.ts
✅ frontend/src/components/ProtectedRoute.tsx

VERIFICATION COMMANDS:

1. TypeScript Check:
$ cd frontend && npx tsc --noEmit
(no output - compilation successful)
✅ No TypeScript errors

2. Build Check:
$ npm run build
vite v7.1.10 building for production...
✓ 143 modules transformed
✓ built in 2.45s
✅ Build successful

3. E2E Tests:
$ npm run test:e2e
  ✓ login page loads correctly (2s)
  ✓ user can login (3s)
  ✓ shows error for invalid credentials (2s)
  ✓ no console errors (2s)
  12 passed (28s)
✅ All tests passing

4. Console Error Check:
$ node scripts/check-console.cjs http://localhost:5173/login
Console Errors: 0
Console Warnings: 0
Failed Requests: 0
✅ No console errors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANNOT VERIFY (requires browser):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Visual design and styling
⚠️ User experience
⚠️ Mobile responsiveness (visual check)

USER ACTION REQUIRED:
1. Open http://localhost:5173/login
2. Try logging in with test credentials
3. Check if design looks professional
4. Verify mobile responsiveness
5. Report any errors from browser console (F12)
```

### Backend Example

```
✅ MODULE COMPLETE: User Management API

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE: Backend Developer
MODULE: Phase 2, Module 2.1 - User Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILES CREATED:
✅ backend/src/controllers/user.controller.ts
✅ backend/src/routes/user.routes.ts
✅ backend/src/types/user.types.ts

ENDPOINTS CREATED:
✅ GET    /api/users         (list users - paginated)
✅ GET    /api/users/:id     (get single user)
✅ POST   /api/users         (create user)
✅ PUT    /api/users/:id     (update user)
✅ DELETE /api/users/:id     (delete user)

VERIFICATION:

1. TypeScript Check:
$ cd backend && npx tsc --noEmit
(no output - compilation successful)
✅ No TypeScript errors

2. Health Check:
$ curl http://localhost:5000/health
{"status":"ok","message":"API is running"}
✅ Server running

3. Create User Test:
$ curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{"email":"test@test.com","name":"Test","role":"INVENTORY"}'

Response: 201 Created
{"id":"abc123","email":"test@test.com","name":"Test","role":"INVENTORY"}
✅ Create endpoint works

4. Auth Protection Test:
$ curl http://localhost:5000/api/users

Response: 401 Unauthorized
{"error":"Unauthorized","message":"Authentication required"}
✅ Auth protection works

5. Validation Test:
$ curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{}'

Response: 400 Bad Request
{"error":"Validation Error","message":"Email is required"}
✅ Validation works

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL TESTS PASSED
Ready for frontend integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🚩 RED FLAGS - What NOT to Do

### ❌ BAD - No Proof
```
"I've completed the user management module. Everything works!"
```
**Problem:** No command outputs, no evidence

### ❌ BAD - Claims Browser Testing
```
Frontend Agent: "I tested it in the browser and it looks great!"
```
**Problem:** Agents can't see the browser!

### ❌ BAD - No curl Evidence
```
Backend Agent: "All endpoints are working correctly"
```
**Problem:** No curl commands or responses shown

### ❌ BAD - Vague
```
"TypeScript compiles successfully"
```
**Problem:** No command output shown

### ❌ BAD - Wrong Module
```
Agent starts working on Production Tracking when roadmap says User Management
```
**Problem:** Not following roadmap sequentially

---

## 🎓 ESSENTIAL DOCUMENTS TO READ

### Must Read (In Order):
1. **This file** (AGENTS_START_HERE.md) - Everything you need
2. **[docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md)** - What to build
3. **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - Testing details

### Reference:
4. **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** - Database structure (Backend)
5. **[docs/FEATURES_LIST.md](docs/FEATURES_LIST.md)** - Feature requirements (Both)
6. **[docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)** - Business context (Both)
7. **[docs/TECH_STACK_GUIDE.md](docs/TECH_STACK_GUIDE.md)** - Technology guide (Both)

---

## ❓ FAQ

### Q: Can I skip the verification commands?
**A:** NO. Absolutely not. Zero tolerance.

### Q: Can I work on multiple modules at once?
**A:** NO. Work sequentially per roadmap.

### Q: Can frontend agents test in browser?
**A:** NO. You can't see the browser. Use Playwright E2E tests and console checker.

### Q: What if TypeScript has errors?
**A:** Fix them first. Don't proceed until `npx tsc --noEmit` shows no errors.

### Q: What if E2E tests fail?
**A:** Fix the issues. Don't claim complete until all tests pass.

### Q: Can I use `any` type in TypeScript?
**A:** NO. Use proper types. This is a quality standard.

### Q: Do I need to show curl responses for backend?
**A:** YES. Always show actual HTTP status codes and response bodies.

### Q: What if the user reports an error I didn't catch?
**A:** Fix it, re-run ALL verifications, show proof again.

### Q: Can I create new files outside the standard structure?
**A:** NO. Follow the project structure. Ask first if you need something different.

### Q: How do I know what module to work on?
**A:** Check [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) and README.md for current status.

---

## 🎯 SUCCESS CRITERIA

### You're Doing Well If:
- ✅ Following the roadmap sequentially
- ✅ Announcing your role clearly
- ✅ Showing actual command outputs
- ✅ Running all verification steps
- ✅ Building features that work
- ✅ Writing clean, typed code
- ✅ Testing thoroughly
- ✅ Being honest about limitations

### Red Flags (Fix These):
- ❌ Skipping verification
- ❌ Not showing command outputs
- ❌ Working on wrong module
- ❌ Using `any` type
- ❌ No error handling
- ❌ Claiming browser testing (frontend)
- ❌ No curl evidence (backend)

---

## 🚀 READY TO START?

### Your First Message Should Be:

```
Hello! I'm your [Frontend/Backend/Full-Stack] Developer for Kashaya Fabs ERP.

I've reviewed the documentation and current status:
- ✅ Current Phase: [X]
- ✅ Last Completed: [Module X.X]
- ⏳ Next Module: [Module X.X - Name]

I'll work on [Module X.X - Name]:
[Brief list of what you'll build]

Estimated completion: [time]

Ready to begin?
```

---

## 🎯 REMEMBER

**Your Goal:** Build production-ready software that solves real business problems for garment manufacturers.

**Your Standards:** Professional, secure, scalable, maintainable code.

**Your Approach:** Incremental, tested, documented, verified.

**Your Success:** When Kashaya Fabs can track their production in real-time and manage their entire operation through your system.

---

**ZERO TOLERANCE FOR:**
- ❌ Unverified claims
- ❌ Skipped testing
- ❌ Missing command outputs
- ❌ Working out of sequence

**ALWAYS REQUIRED:**
- ✅ Clear role announcement
- ✅ Roadmap reference
- ✅ All verification commands
- ✅ Actual proof shown
- ✅ Honest about limitations

---

**Last Updated:** October 18, 2025
**Status:** Complete Agent Operations Guide

---

**LET'S BUILD SOMETHING AMAZING! 🚀**
