---
slug: testing-lab-create
title: Add a Testing Lab
keywords:
  # English
  - testing lab
  - lab master
  - test laboratory
  - quality lab
  - add lab
  - create lab
  - external lab
  - testing facility
  - SGS
  - NABL
  - ISO 17025
  # Hinglish
  - testing lab add karna
  - lab banana
  - quality lab banana
  - naya lab
  - lab add kaise kare
  # Devanagari
  - टेस्टिंग लैब
  - लैब मास्टर
  - क्वालिटी लैब
  - लैब जोड़ना
  - नई लैब बनाना
  - परीक्षण प्रयोगशाला
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TestingLabs.tsx
  - frontend/src/pages/TestingDashboard.tsx
route: /testing/labs
---

## Steps

1. Open **Manufacturing > Testing (FPT/GPT)** in the sidebar.
2. On the Testing Dashboard, click the **Testing Labs** card.
3. Click the **Add Testing Lab** button in the top-right corner.
4. Fill in the required fields:
   - **Lab Code** — A unique code for the lab (e.g., LAB-001, SGS-DEL).
   - **Lab Name** — The full name of the laboratory (e.g., SGS India, Bureau Veritas).
5. Fill in optional fields as needed:
   - **Contact Person** — Name of your contact at the lab.
   - **Contact Email** — Email address for sending samples.
   - **Contact Phone** — Phone number for coordination.
   - **Avg. Turnaround (days)** — Expected days to receive test results (defaults to 7).
   - **Address**, **City**, **State**, **Pincode** — Lab location details.
   - **Accreditations** — Enter certifications separated by commas (e.g., NABL, ISO 17025).
   - **Active** toggle — Keep ON if the lab is currently in use.
6. Click **Create Lab** to save.

## Traps

- **Lab Code must be unique** — The system will reject duplicate codes.
- **Accreditations are comma-separated** — Enter "NABL, ISO 17025" not "NABL; ISO 17025".
- **Turnaround days affects planning** — Enter realistic values; this may be used for test scheduling.
- **Inactive labs hidden from dropdowns** — Turn off Active only for labs you no longer use.

## After saving

- The lab appears in the Testing Labs list with an Active badge.
- The lab becomes available when assigning Fabric Physical Tests (FPT) or Garment Physical Tests (GPT).
- Lab count updates on the Testing Dashboard.
- Use the **Edit** button on any lab card to update details later.
