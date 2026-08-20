# Field specification by document

Legend: **S** = system-populated · **H** = hand-filled after printing, use `.open` hatch · **D** = derived at render

---

## Job Work Order / Job Card

Same document. "Job Card" is what the shop floor calls the copy that travels with the goods.

**01 — Order & job worker**
| Field | Src | Notes |
|---|---|---|
| Job worker legal name | S | `JobWorker.legalName` |
| Address, city, state | S | |
| GSTIN + registration status | S | Show status explicitly. Unregistered is fine, unstated is not. |
| Contact name, phone | S | |
| Order no., order date | S | |
| Process type | S | Drives SAC and rate |
| Challan no. + date | S | Link to the movement doc |
| Due back (commercial) | S | |
| **Statutory due (issue + 1yr)** | D | Sec 143. Show it. Immutable. |
| Buyer reference | S | Which brand/style this feeds |

**02 — Material issued**
Line: `# · Item + lot + HSN · UOM · Qty · Rate · Value`
Footer: total material value, labelled *for challan / e-way bill only — no sale*.
**No tax column. Ever.** Free-issue items (packing, cones) show `—` in rate and value with a returnable note.

**03 — Expected output & job charges**
Line: `Output item · spec (shade/design) · Expected qty · Tolerance % · Rate per unit · Charges`
Then: freight line, taxable value, SAC, GST rate, CGST/SGST or IGST, gross commitment.
If `ProcessType.gstRate` is null → render `.blocked` panel instead of a rate, and do not print a gross figure.

**Costing callout** (`.callout`): material + charges + freight = FG value, ÷ expected qty = FG rate. State that tolerance loss is absorbed and that GST is excluded as recoverable credit.

**04 — Return reconciliation** — all **H**
Issued (S, pre-filled) · Received A grade · Received B grade · Normal loss (within tol.) · Abnormal loss · Balance still with job worker.
That last row is the one that catches partial returns before the 1-year clock runs out. Never drop it.

**05 — Terms** — see the standing set in the template. Non-negotiable clauses: title retention, 1-year return with recovery of deemed-supply liability, Rule 55 challan movement, conversion-charges-only invoicing, wastage beyond tolerance to vendor account, ITC-04 inclusion.

**Signatures:** Prepared by/Store · Authorised Signatory · Job Worker acknowledgement.

---

## Delivery Challan (Rule 55)

Statutory. Field list is prescribed, not discretionary.

Date and serial number · consignor name/address/GSTIN · consignee name/address/GSTIN · HSN and description of goods · quantity · **taxable value** · tax rate and amount *only where movement is for supply* — nil for job work · place of supply (inter-state) · signature.

Plus: reason for transportation (`JOB WORK — NOT A SUPPLY`), vehicle no., transporter, e-way bill no., reference to the Job Work Order.

Print in **triplicate** with copy marks: ORIGINAL FOR CONSIGNEE · DUPLICATE FOR TRANSPORTER · TRIPLICATE FOR CONSIGNOR.

---

## GRN / Job Work Receipt

Receipt no. + date · job work order ref · inward challan ref from the vendor · expected vs received by grade · loss split normal/abnormal against snapshotted tolerance · inspection result and inspector · debit note reference where abnormal · **computed FG value and FG rate** · balance still with vendor.

The FG value on the GRN is what posts to stock. It is the one number on this document that must be right to the paisa.

---

## Purchase Order (genuine goods purchase)

Distinct from job work. Use when buying material outright — including buying trims *from* a job worker.

Vendor · PO no./date · delivery date and place · item, HSN, qty, rate, discount, taxable value · GST per line (rate varies by HSN, unlike job work where one rate covers the order) · freight and terms · payment terms · gross total in figures and words.

If a job worker also sells us thread or buttons, that is a PO. Mixing it into the job work order corrupts component reconciliation — the ERP will treat purchased goods as material we issued.

---

## Tax Invoice (Sec 31)

Supplier name/address/GSTIN · sequential invoice no. and date · recipient details with GSTIN · place of supply and state code · HSN per line · qty, rate, taxable value · CGST/SGST or IGST per line · total in words · reverse charge applicability · signature or digital signature.

Garment rate depends on per-piece value — the ₹2,500 threshold post-22 Sep 2025 splits 5% from 18%. This is a **per-piece** test, not per-invoice. Confirm the current threshold before hardcoding.

Inter-company: House of Kasya buying from Kashaya Fabs at cost + 10% is a real sale between two GSTINs. Full tax invoice, both sides book it, ITC flows.

---

## Packing List

Despatch no./date · buyer and consignee · style, colour, size breakdown · carton no., pcs per carton, nett/gross weight, dimensions · total cartons and CBM · marks and numbers · invoice reference.

Export despatch adds: port of loading/discharge, IEC, shipping bill reference, country of origin.
