# 🧪 TESTING & VERIFICATION GUIDE

> **Complete guide for testing, verification, and quality assurance**

---

## ⚡ QUICK COMMANDS

### Frontend Testing
```bash
cd frontend
npx tsc --noEmit                                    # TypeScript check
npm run build                                        # Build check
npm run test:e2e                                     # Run all E2E tests
npm run test:e2e:ui                                  # Run with UI mode
node scripts/check-console.cjs http://localhost:5173/[page]  # Console errors
node scripts/screenshot.cjs http://localhost:5173/[page] [file]  # Screenshot
```

### Backend Testing
```bash
cd backend
npx tsc --noEmit                                    # TypeScript check
curl http://localhost:5000/health                   # Health check
curl -X POST http://localhost:5000/api/[endpoint]  # Test endpoint
```

---

## 📋 TABLE OF CONTENTS

1. [Frontend Testing](#frontend-testing)
2. [Backend Testing](#backend-testing)
3. [E2E Testing with Playwright](#e2e-testing-with-playwright)
4. [Console Error Checking](#console-error-checking)
5. [Verification Protocols](#verification-protocols)
6. [Common Issues](#common-issues)

---

## 🎨 FRONTEND TESTING

### 1. TypeScript Compilation Check

**Purpose:** Ensure no type errors

```bash
cd frontend
npx tsc --noEmit
```

**Expected Output:**
- **Success:** (no output)
- **Failure:** List of type errors

**Common Errors:**
- `Cannot find name 'any'` - Don't use `any` type
- `Property 'x' does not exist` - Type mismatch
- `Type 'undefined' is not assignable` - Missing null checks

---

### 2. Build Check

**Purpose:** Ensure production build succeeds

```bash
npm run build
```

**Expected Output:**
```
vite v7.1.10 building for production...
transforming...
✓ 143 modules transformed.
rendering chunks...
dist/index.html                 0.45 kB
dist/assets/index-abc123.css   12.34 kB
dist/assets/index-xyz789.js    145.67 kB
✓ built in 2.45s
```

**Common Errors:**
- Import errors - Missing dependencies
- Syntax errors - Invalid JavaScript
- Type errors - Fix with `npx tsc --noEmit` first

---

### 3. E2E Tests with Playwright

**Purpose:** Test user flows in a real browser

```bash
# Run all tests (headless)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/auth.spec.ts
```

**Expected Output:**
```
Running 12 tests using 1 worker

  ✓ login page loads correctly (2s)
  ✓ register page loads correctly (2s)
  ✓ user can register (3s)
  ✓ user can login (4s)
  ✓ shows error for invalid credentials (2s)
  ✓ logout works (2s)
  ✓ protected route redirects (1s)
  ✓ no console errors on login (2s)
  ✓ no console errors on register (2s)
  ✓ no console errors on dashboard (3s)
  ✓ password validation works (2s)
  ✓ session persists (2s)

  12 passed (28s)
```

**View Test Report:**
```bash
npx playwright show-report
```

---

### 4. Console Error Check

**Purpose:** Detect JavaScript errors programmatically

```bash
node scripts/check-console.cjs http://localhost:5173/login
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Console Error Check: http://localhost:5173/login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading page...
Page loaded. Waiting for JavaScript execution...

Page title: "Kashaya Fabs ERP - Login"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Console Errors:   0
Console Warnings: 0
Failed Requests:  0
Console Logs:     3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ NO CONSOLE ERRORS - Page is clean!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If Errors Found:**
```
❌ CONSOLE ERRORS DETECTED!

Error 1: TypeError: Cannot read property 'user' of undefined
  at Login.tsx:42:15

Error 2: Failed to load resource: net::ERR_CONNECTION_REFUSED
  http://localhost:5000/api/auth/login
```

---

### 5. Screenshot Tool

**Purpose:** Capture page screenshots for documentation

```bash
node scripts/screenshot.cjs http://localhost:5173/login login.png
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Screenshot Tool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading page...
Page loaded. Waiting for render...

Page title: "Kashaya Fabs ERP - Login"
Viewport: 1280x720

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Screenshot saved successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Location: C:\...\login.png

✅ No console errors detected
```

---

### Frontend Verification Checklist

Before claiming "complete":
- [ ] `npx tsc --noEmit` passes (no errors)
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` passes (all tests green)
- [ ] Console error check passes (0 errors)
- [ ] All files created and listed
- [ ] API client configured correctly
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Forms have validation

---

## ⚙️ BACKEND TESTING

### 1. TypeScript Compilation Check

**Purpose:** Ensure no type errors

```bash
cd backend
npx tsc --noEmit
```

**Expected Output:**
- **Success:** (no output)
- **Failure:** List of type errors

---

### 2. Server Health Check

**Purpose:** Verify server is running

```bash
curl http://localhost:5000/health
```

**Expected Output:**
```json
{
  "status": "ok",
  "message": "API is running",
  "timestamp": "2025-10-18T10:30:00.000Z"
}
```

**If Failed:**
```
curl: (7) Failed to connect to localhost port 5000: Connection refused
```
→ Server is not running. Start with `npm run dev`

---

### 3. Endpoint Testing with curl

#### Create Operation (POST)

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{
    "email": "test@test.com",
    "name": "Test User",
    "role": "INVENTORY"
  }'
```

**Expected: 201 Created**
```json
{
  "data": {
    "id": "abc123",
    "email": "test@test.com",
    "name": "Test User",
    "role": "INVENTORY"
  }
}
```

#### Read Operation (GET)

```bash
# List all (paginated)
curl http://localhost:5000/api/users \
  -H "Authorization: Bearer [TOKEN]"

# Get single
curl http://localhost:5000/api/users/abc123 \
  -H "Authorization: Bearer [TOKEN]"
```

**Expected: 200 OK**
```json
{
  "data": {
    "id": "abc123",
    "email": "test@test.com",
    "name": "Test User",
    "role": "INVENTORY"
  }
}
```

#### Update Operation (PUT)

```bash
curl -X PUT http://localhost:5000/api/users/abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{
    "name": "Updated Name"
  }'
```

**Expected: 200 OK**
```json
{
  "data": {
    "id": "abc123",
    "email": "test@test.com",
    "name": "Updated Name",
    "role": "INVENTORY"
  }
}
```

#### Delete Operation (DELETE)

```bash
curl -X DELETE http://localhost:5000/api/users/abc123 \
  -H "Authorization: Bearer [TOKEN]"
```

**Expected: 204 No Content** (empty response)

---

### 4. Authentication Testing

#### Test Without Token (Should Fail)

```bash
curl http://localhost:5000/api/users
```

**Expected: 401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### Test With Invalid Token (Should Fail)

```bash
curl http://localhost:5000/api/users \
  -H "Authorization: Bearer invalid_token"
```

**Expected: 401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

---

### 5. Validation Testing

#### Test Missing Required Fields

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{}'
```

**Expected: 400 Bad Request**
```json
{
  "error": "Validation Error",
  "message": "Email is required"
}
```

#### Test Invalid Data Format

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{
    "email": "not-an-email",
    "name": "Test"
  }'
```

**Expected: 400 Bad Request**
```json
{
  "error": "Validation Error",
  "message": "Invalid email format"
}
```

---

### 6. Error Case Testing

#### Test 404 Not Found

```bash
curl http://localhost:5000/api/users/nonexistent-id \
  -H "Authorization: Bearer [TOKEN]"
```

**Expected: 404 Not Found**
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

#### Test 409 Conflict (Duplicate)

```bash
# Create user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"email":"duplicate@test.com","name":"Test"}'

# Try to create again with same email
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"email":"duplicate@test.com","name":"Test2"}'
```

**Expected: 409 Conflict**
```json
{
  "error": "Conflict",
  "message": "User with this email already exists"
}
```

---

### Backend Verification Checklist

Before claiming "complete":
- [ ] `npx tsc --noEmit` passes (no errors)
- [ ] Server health check passes
- [ ] All endpoints tested with curl
- [ ] Actual HTTP responses shown (200, 201, etc.)
- [ ] Auth protection tested (401 test)
- [ ] Validation tested (400 test)
- [ ] Error cases tested (404, 409, etc.)
- [ ] No passwords in responses
- [ ] Used Prisma for all DB operations
- [ ] All files created and listed
- [ ] All endpoints listed

---

## 🎭 E2E TESTING WITH PLAYWRIGHT

### Setup

Playwright is already installed and configured for this project.

**Configuration:** `frontend/playwright.config.ts`

**Features:**
- Auto-starts dev server before tests
- Takes screenshots on failure
- Records video on failure
- Generates HTML test report

---

### Running Tests

```bash
cd frontend

# Run all tests (headless)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with UI mode (interactive debugging)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run tests matching a pattern
npx playwright test --grep "login"
```

---

### Viewing Test Results

```bash
# View last test report
npx playwright show-report

# Opens browser with interactive test results
```

**Report shows:**
- Which tests passed/failed
- Screenshots of failures
- Videos of test runs
- Console logs
- Network requests
- Timeline of events

---

### Writing New Tests

**Example test file:** `frontend/tests/user-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@kashayafabs.com');
    await page.getByLabel('Password').fill('Admin@123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('can view user list', async ({ page }) => {
    await page.goto('/users');

    // Check page loaded
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    // Check table exists
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('can create new user', async ({ page }) => {
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add User' }).click();

    // Fill form
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill('newuser@test.com');
    await page.getByLabel('Role').selectOption('INVENTORY');

    // Submit
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify success
    await expect(page.getByText('User created successfully')).toBeVisible();
  });

  test('no console errors on user page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    expect(errors.length).toBe(0);
  });

});
```

---

### Test Best Practices

1. **Use Data Test IDs**
```tsx
// In component
<button data-testid="submit-button">Submit</button>

// In test
await page.getByTestId('submit-button').click();
```

2. **Wait for Network Idle**
```typescript
await page.waitForLoadState('networkidle');
```

3. **Check for Console Errors**
```typescript
const errors: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
expect(errors.length).toBe(0);
```

4. **Take Screenshots on Important Steps**
```typescript
await page.screenshot({ path: 'user-list.png' });
```

5. **Test Error States**
```typescript
test('shows error for invalid input', async ({ page }) => {
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Invalid email format')).toBeVisible();
});
```

---

## 🔍 CONSOLE ERROR CHECKING

### Automated Console Check Script

**Location:** `frontend/scripts/check-console.cjs`

**Usage:**
```bash
node scripts/check-console.cjs http://localhost:5173/[page]
```

**What it checks:**
- JavaScript console errors
- JavaScript console warnings
- Failed network requests
- Console logs (informational)

**Example:**
```bash
# Check login page
node scripts/check-console.cjs http://localhost:5173/login

# Check dashboard
node scripts/check-console.cjs http://localhost:5173/dashboard

# Check user list
node scripts/check-console.cjs http://localhost:5173/users
```

---

## ✅ VERIFICATION PROTOCOLS

### Mandatory Verification - Frontend

**MUST run ALL 4 commands:**

```bash
# 1. TypeScript Check
npx tsc --noEmit

# 2. Build Check
npm run build

# 3. E2E Tests
npm run test:e2e

# 4. Console Errors
node scripts/check-console.cjs http://localhost:5173/[your-page]
```

**All must pass before claiming "complete"**

---

### Mandatory Verification - Backend

**MUST run ALL tests:**

```bash
# 1. TypeScript Check
npx tsc --noEmit

# 2. Health Check
curl http://localhost:5000/health

# 3. Test Endpoints (for EACH endpoint you created)
curl -X POST http://localhost:5000/api/[endpoint] [with data]

# 4. Auth Protection Test
curl http://localhost:5000/api/[endpoint]  # Should return 401

# 5. Validation Test
curl -X POST http://localhost:5000/api/[endpoint] -d '{}'  # Should return 400
```

**Show actual responses for all tests**

---

## 🐛 COMMON ISSUES

### Frontend Issues

#### Issue: TypeScript Errors
**Symptom:** `npx tsc --noEmit` shows errors
**Solution:** Fix the type errors before proceeding

#### Issue: Build Fails
**Symptom:** `npm run build` fails
**Solution:**
1. Check the error message
2. Usually import errors or syntax errors
3. Fix and retry

#### Issue: E2E Tests Fail
**Symptom:** Playwright tests failing
**Solution:**
1. Check test report: `npx playwright show-report`
2. Look at screenshots of failure
3. Fix the issue
4. Re-run tests

#### Issue: Console Errors Found
**Symptom:** Console checker reports errors
**Solution:**
1. Read the error message
2. Check the file and line number
3. Fix the JavaScript error
4. Re-run check

---

### Backend Issues

#### Issue: Server Not Running
**Symptom:** `curl: Connection refused`
**Solution:** Start server with `npm run dev`

#### Issue: 401 Unauthorized
**Symptom:** Getting 401 when you shouldn't
**Solution:** Check if:
1. Token is valid
2. Token is included in header
3. Middleware is applied correctly

#### Issue: 400 Bad Request
**Symptom:** Getting 400 on valid data
**Solution:** Check:
1. Request body format
2. Validation rules
3. Required fields

#### Issue: 500 Internal Server Error
**Symptom:** Server crashes or returns 500
**Solution:**
1. Check backend logs
2. Look for error stack trace
3. Fix the error
4. Re-test

---

## 📊 TESTING CHECKLIST

### Before Claiming Module Complete

Frontend:
- [ ] TypeScript compiles (0 errors)
- [ ] Build succeeds
- [ ] E2E tests pass (100%)
- [ ] Console errors = 0
- [ ] All files created
- [ ] API integration works
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Forms validated

Backend:
- [ ] TypeScript compiles (0 errors)
- [ ] Server running (health check passes)
- [ ] All endpoints tested with curl
- [ ] HTTP responses shown
- [ ] Auth protection tested (401)
- [ ] Validation tested (400)
- [ ] Error cases tested (404, 409, etc.)
- [ ] No sensitive data exposed
- [ ] All files created
- [ ] Prisma used for DB operations

---

**Last Updated:** October 18, 2025
**Status:** Complete Testing Guide
