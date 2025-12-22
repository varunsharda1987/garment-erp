# Backend Scripts

Utility scripts for managing the GST implementation and database.

## GST Configuration Scripts

### 1. Auto-Configure Company State (Recommended)
```bash
node scripts/auto-configure.js [StateName or StateCode]
```

**What it does:**
- Automatically sets `COMPANY_STATE_ID` in `.env` file
- No user interaction required - perfect for automation
- Creates backup of `.env` before modifying
- Accepts state name or GST code as argument

**Examples:**
```bash
node scripts/auto-configure.js Maharashtra
node scripts/auto-configure.js 27
node scripts/auto-configure.js "Tamil Nadu"
```

**When to use:** Quick setup or automation scripts.

---

### 2. Configure Company State (Interactive)
```bash
node scripts/configure-company-state.js
```

**What it does:**
- Shows popular garment manufacturing states
- Allows you to select your company's registered state
- Automatically updates `.env` with the correct `COMPANY_STATE_ID`
- Guides you through the configuration process

**When to use:** When you want to browse states before selecting.

---

### 3. List All States
```bash
node scripts/list-states.js
```

**What it does:**
- Displays all 36 Indian states/UTs with GST codes
- Shows the UUID for each state
- Highlights popular garment manufacturing states

**When to use:** When you need to manually find a state ID for configuration.

---

### 4. Verify Setup
```bash
node scripts/verify-setup.js
```

**What it does:**
- Checks if all 36 states are in the database
- Checks if all 133 cities are in the database
- Verifies `COMPANY_STATE_ID` is configured
- Shows sample data and statistics
- Provides next steps based on verification results

**When to use:** After installation, configuration changes, or when troubleshooting.

---

### 5. Backfill GST States
```bash
npx ts-node scripts/backfill-gst-states.ts
```

**What it does:**
- Updates existing `customer_gst_numbers` records
- Populates `stateId` field from `stateCode`
- Reports success/failure statistics

**When to use:** If you have existing customer GST data without state IDs (migration scenario).

---

## Quick Start Workflow

### First-Time Setup (Automated - Recommended)
```bash
# 1. Verify database is seeded
node scripts/verify-setup.js

# 2. Auto-configure company state
node scripts/auto-configure.js Maharashtra

# 3. Verify configuration
node scripts/verify-setup.js

# 4. Restart backend
npm run dev
```

### First-Time Setup (Interactive)
```bash
# 1. Verify database is seeded
node scripts/verify-setup.js

# 2. Configure company state (interactive)
node scripts/configure-company-state.js

# 3. Verify configuration
node scripts/verify-setup.js

# 4. Restart backend
npm run dev
```

### If You Have Existing Data
```bash
# After first-time setup, run backfill script
npx ts-node scripts/backfill-gst-states.ts
```

---

## Script Outputs

### ✅ Success Indicators
- Green checkmarks (✅)
- "All checks passed"
- Exit code 0

### ❌ Failure Indicators
- Red X marks (❌)
- Warning messages (⚠️)
- Exit code 1
- Specific instructions to fix issues

---

## Troubleshooting

### "States count is 0"
```bash
# Re-run database seeds
cd backend
npx prisma db seed
```

### "COMPANY_STATE_ID not set"
```bash
# Use the interactive configuration script
node scripts/configure-company-state.js
```

### "State ID not found in database"
```bash
# List all states to find the correct ID
node scripts/list-states.js

# Or use the configuration wizard
node scripts/configure-company-state.js
```

### "Cannot find module '@prisma/client'"
```bash
# Regenerate Prisma client
npx prisma generate
```

---

## Environment Variables

These scripts read from `backend/.env`:

```env
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/garment_erp"

# GST Configuration (set by configure-company-state.js)
COMPANY_STATE_ID="uuid-of-your-state"
```

---

## Additional Resources

- **Implementation Guide**: `docs/GST_IMPLEMENTATION_GUIDE.md`
- **Quick Start**: `docs/GST_QUICK_START.md`
- **API Testing**: Use curl commands from Quick Start guide
- **Form Integration**: See Implementation Guide for frontend updates

---

## Notes

- All scripts use Prisma Client and connect to the database
- Scripts are safe to run multiple times
- Configuration scripts create backups before modifying files
- Always restart the backend after configuration changes
- Scripts provide clear error messages and guidance

---

**Last Updated**: December 22, 2025
