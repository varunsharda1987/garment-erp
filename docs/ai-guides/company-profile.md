---
slug: company-profile
title: Change the company details on invoices (GSTIN, MSME, address, bank, logo)
keywords:
  # English
  - company profile
  - company details
  - change gstin
  - gst number
  - update gst number
  - msme number
  - udyam number
  - pan number
  - cin
  - iec code
  - tan
  - company address
  - change address on invoice
  - company logo
  - letterhead
  - authorised signature
  - bank details on invoice
  - account number
  - ifsc code
  - invoice terms
  - jurisdiction
  - company name on documents
  - second company
  - second gstin
  - another firm
  - default entity
  - which company issues invoices
  # Hinglish
  - company profile kaise badle
  - gst number change karna
  - gstin update karna
  - msme number dalna
  - udyam number kahan dale
  - company ka pata badalna
  - invoice par address change
  - logo upload karna
  - letterhead change karna
  - bank details dalna
  - account number update
  - dusri company add karna
  - default company badalna
  - invoice par company name
  # Devanagari (MANDATORY)
  - कंपनी प्रोफाइल
  - कंपनी की जानकारी
  - जीएसटी नंबर बदलना
  - जीएसटीआईएन
  - एमएसएमई नंबर
  - उद्यम नंबर
  - पैन नंबर
  - कंपनी का पता
  - इनवॉइस पर पता
  - कंपनी लोगो
  - लेटरहेड
  - हस्ताक्षर
  - बैंक विवरण
  - खाता संख्या
  - आईएफएससी
  - दूसरी कंपनी
  - डिफ़ॉल्ट कंपनी
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/Settings.tsx
  - frontend/src/pages/CompanyProfiles.tsx
  - frontend/src/pages/CompanyProfileForm.tsx
  - frontend/src/services/companyProfile.service.ts
  - frontend/src/hooks/useCompanyProfile.ts
  - backend/src/schemas/companyProfile.schema.ts
  - backend/src/services/company-profile.service.ts
route: /settings/company
---

## What this page controls

The company details printed on every invoice, purchase order, challan, job work order and
test requirement form — company name, GSTIN, PAN, Udyam/MSME number, address, bank details,
logo and signature. Changing them here takes effect immediately; no deployment is needed.

The **state code** taken from the GSTIN also decides whether a document shows **CGST + SGST**
(supplier or customer in our own state) or **IGST** (another state).

## Steps

### Open Company Profile
1. In the sidebar, open **Team & Settings**
2. Click **Settings**
3. The **Company profile** card at the top shows the current company — name, GSTIN, Udyam, PAN and address
4. Click **Edit these details** to change them, or **Manage entities** to see every company
5. Admin only

### Change the GSTIN, PAN or Udyam/MSME number
1. Open the **Identity** tab
2. Edit:
   - **Trading name** — the name printed on the letterhead
   - **Legal name** — the full registered name
   - **GSTIN** — must be 15 characters
   - **PAN**, **Udyam / MSME number**, **CIN**, **IEC**, **TAN**
3. Click **Save changes**

The **State code** on the Address tab updates automatically from the first two digits of the
GSTIN and cannot be typed by hand — this is deliberate, because a state code that disagrees
with the GSTIN silently puts the wrong tax on every document.

### Change the address or contact details
1. Open the **Address & contact** tab
2. **Address**, **City** and **PIN code** appear on the letterhead
3. **Phone (accounts)** and **Email (accounts)** are printed on invoices, purchase orders and
   challans — this is the number a customer rings about a bill
4. **Lab / test-report contact** (name, phone, email) is a separate person — the one a buyer's
   testing lab contacts about a Test Requirement Form. It is deliberately not the accounts contact
5. Click **Save changes**

### Add bank details
1. Open the **Bank** tab
2. Fill in **Bank name**, **Branch**, **Account number** and **IFSC code**
3. Click **Save changes**

These are used on proforma invoices when no primary bank account is set up separately.

### Upload a logo or signature
1. Open the **Branding** tab
2. Under **Company logo** or **Authorised signature**, click **Upload** (or **Replace**)
3. Choose a JPG, PNG or WEBP image up to 2MB
4. The image uploads straight away — you do not need to click Save for it

You can also set the **Tagline** printed under the company name, and the brand colours used in
generated PDFs.

### Change the invoice terms
1. Open the **Terms** tab
2. Type the **Terms & conditions**, one per line
3. Set the **Jurisdiction** line, for example "Subject to Jaipur jurisdiction only."
4. Click **Save changes**

### Add a second company or GSTIN
1. From the Settings page click **Manage entities**
2. Click **Add entity**
3. Fill in at least the trading name, legal name, GSTIN, address, city, PIN code and state name
4. Click **Create entity**
5. Logo and signature can only be added after the entity is saved

### Switch which company issues documents
1. From the Settings page click **Manage entities**
2. Find the company you want and click **Make default**
3. Read the confirmation carefully, then confirm

Every **new** invoice, purchase order, challan and letterhead will then be issued under that
company and its GSTIN, and its state code will decide CGST/SGST versus IGST. Documents already
issued do not change.

Only one company can be the default at a time. The current one is marked with a **Default** badge.

## Notes

- Anyone signed in can see the company details on screens that show a letterhead, but only an
  admin can change them
- The company cannot be archived while it is the default — make another company the default first
- If no default company is set, documents will refuse to print a letterhead rather than print
  the wrong one
