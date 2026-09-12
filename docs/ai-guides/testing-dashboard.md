---
slug: testing-dashboard
title: Use the Testing Dashboard
keywords:
  # English
  - testing dashboard
  - quality dashboard
  - test overview
  - pending tests
  - FPT
  - GPT
  - fabric physical test
  - garment physical test
  - testing labs
  - test templates
  - failed tests
  - buyer approval
  # Hinglish
  - testing dashboard dekhna
  - quality check status
  - test ka overview
  - pending test dekhna
  - fabric test status
  - garment test status
  # Devanagari
  - टेस्टिंग डैशबोर्ड
  - क्वालिटी डैशबोर्ड
  - पेंडिंग टेस्ट
  - फैब्रिक टेस्ट
  - गारमेंट टेस्ट
  - टेस्ट स्टेटस
  - क्वालिटी चेक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TestingDashboard.tsx
route: /testing
---

## Steps
1. Open **Manufacturing -> Testing (FPT/GPT)** in the sidebar.
2. The Testing Module Dashboard loads with four stat cards and quick actions.

## Understanding the dashboard

### Stat cards
The dashboard displays four clickable summary cards:

1. **Fabric Tests (FPT)** - Click to open the Fabric Physical Tests list
   - Total tests count
   - Pending (yellow badge)
   - Passed (green badge)
   - Failed (red badge)

2. **Garment Tests (GPT)** - Click to open the Garment Physical Tests list
   - Total tests count
   - Pending (yellow badge)
   - Buyer Approval (blue badge) - tests awaiting customer sign-off
   - Failed (red badge)

3. **Testing Labs** - Click to manage testing laboratories
   - Total labs count
   - Active labs count

4. **Test Templates** - Click to manage reusable test configurations
   - Total templates count
   - FPT Templates (fabric-specific)
   - GPT Templates (garment-specific)

### Action Required section
A red alert panel appears when any tests need attention:
- **Failed Fabric Tests** - Click **Review** to filter the FPT list by FAIL status
- **Failed Garment Tests** - Click **Review** to filter the GPT list by FAIL status
- **Pending Buyer Approval** - Click **Review** to see GPT tests awaiting customer approval

### Quick Actions
Two action panels at the bottom provide shortcuts:

**Fabric Testing panel:**
- **Create New FPT** - Opens form for a new fabric physical test
- **View Pending Tests** - Opens FPT list filtered to PENDING status

**Garment Testing panel:**
- **Create New GPT** - Opens form for a new garment physical test
- **View Pending Tests** - Opens GPT list filtered to PENDING status

## Traps
- The dashboard auto-fetches all counts on load. If the API is slow, a spinner shows "Loading dashboard..." until data arrives.
- Failed to load data shows an error toast "Failed to load testing dashboard. Please refresh the page."
- Clicking a stat card navigates away from the dashboard - use browser back or sidebar to return.
- Buyer Approval count only appears on GPT card (garment tests require customer sign-off; fabric tests do not).
