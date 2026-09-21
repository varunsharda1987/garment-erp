# Stock Movement Doors — Team Guide

> **What is a "door"?** Each way goods enter or leave your stock. Using the RIGHT door ensures correct accounting, GST treatment, and audit trail.

---

## Quick Decision Tree

### Goods Going OUT?

```
What are you doing?
│
├─► Sending greige/fabric to PROCESSOR (dyeing/printing)?
│   └─► Use: Process PO Create & Send (Dyeing or Printing page)
│
├─► Returning goods to SUPPLIER (wrong material, excess, defective)?
│   └─► Use: Stock Out → Purchase Return
│
├─► Sending to another DEPARTMENT or BRANCH?
│   └─► Use: Stock Out → Internal Issue
│
└─► Something else / unusual movement?
    └─► Use: Manual Challan Form (ask supervisor first)
```

### Goods Coming IN?

```
What are you receiving?
│
├─► Processed fabric BACK from processor (dyeing/printing mill)?
│   └─► Use: Receive from processor (on the SAME Job Work Order you sent) — one action
│
├─► PURCHASED goods from supplier (new material you bought)?
│   └─► Use: GRN (against the Purchase PO)
│
├─► Internal transfer from another department/branch?
│   └─► Use: Challan Receive (find the challan, mark received)
│
└─► Opening balance or physical count correction?
    └─► Use: Stock In (supervisor approval required)
```

---

## OUTWARD Doors (Goods Leaving)

### 1. Process PO Create & Send

**Location:** Dyeing page or Printing page → New Process PO

**Use when:** Sending YOUR greige/fabric to a processor for dyeing, printing, or other job work

**What happens:**
- Process PO created (your job work order)
- Outward challan auto-generated
- Greige deducted from your stock
- Greige recorded at processor's location (still YOUR material)

**Required info:**
- Style (which style is this for)
- Greige lot (which stock to send)
- Processor (which mill)
- Rate (or mark as "TBD" if not finalized)
- Quantity

**Example:** Sending 500m of greige code GRG-2024-001 to ABC Dyeing Mill for style KS-1045

---

### 2. Stock Out → Purchase Return

**Location:** Stock Out page → Select "Purchase Return"

**Use when:** Returning goods BACK to the supplier who sold them to you

**What happens:**
- Outward challan created
- Stock deducted
- Linked to original purchase for accounting

**Common reasons:**
- Wrong material received
- Quality rejection
- Excess quantity
- Damaged goods

**Example:** Returning 50m of defective lining fabric to XYZ Fabrics

---

### 3. Stock Out → Internal Issue

**Location:** Stock Out page → Select "Internal Issue"

**Use when:** Moving stock between departments or branches (still within your company)

**What happens:**
- Outward challan created
- Stock moves from source location
- Receiving location will do "Challan Receive" to confirm

**Example:** Sending 200m fabric from Main Warehouse to Cutting Department

---

### 4. Manual Challan Form

**Location:** Challans page → Create Challan

**Use when:** Unusual movements that don't fit above categories

**Warning:** Ask supervisor before using. This is the "escape hatch" — overuse creates audit problems.

**Example:** Sending samples to a buyer, lending equipment to another unit

---

### 5. Embroidery / Processing Batches

**Location:** Embroidery module, Processing Batches

**Use when:** Sending cut pieces or panels for embroidery or specialized processing

**Note:** These have their own workflows — follow those module guides

---

## INWARD Doors (Goods Arriving)

### 1. Receive from processor (on the Job Work Order)

**Location:** Job Work Order → Actions → **Receive from processor** (also the green icon on
Manufacturing → Dyeing & Printing, Job Work Orders tab, on a job showing At Mill)

**Use when:** YOUR material coming BACK from processor after job work (dyed/printed/finished fabric, dyed lace)

**What happens — in ONE action, one transaction:**
- A **Job work return** receipt is filed, already accepted (it is listed on the GRN page, never created or approved there)
- Finished fabric lot created (dyed lace → lace stock) at processing rate + greige cost; stock levels synced
- **Inward challan** raised from the processor (the GST document for goods back from a job worker)
- Than/fold, measured width and quality written onto the job. On the **final delivery** the shrinkage is
  written too and the job → **Stock Updated**; a part leaves it at **Partial Receipt**
- Loss split into normal / abnormal on the final delivery, on the total of all parts; a short return beyond
  tolerance is warned about *before* you commit
- Material requirements the job covered are advanced by each receipt's metres

**Receiving in parts (2026-09-19):** a processor often returns a job in two or more deliveries. Each is its
own receipt — untick **This is the final delivery** on every part but the last (the box ticks itself once the
total reaches the expected quantity less tolerance). Every part books its own lot (`fabric_stock.grnItemId`)
and its own inward challan (`challans.grnId`); the job carries the running total, and the over-receipt cap is
on the total. Reversal is per receipt: that part's lot and challan go, the others stay, and the job is
recomputed — reversing the final part re-opens the job as Partial Receipt.

**Closing short needs a confirmation (both ways):** a final delivery that leaves the total short beyond the
tolerance asks *"Close … short?"* and the server refuses the receipt unless it was confirmed
(`shortCloseConfirmed`). A job left at Partial Receipt when nothing more is coming is closed with **Close short
— nothing more is coming** on the job (`POST /api/job-work-orders/:id/close-short`), behind the same
confirmation: it finalises on what was received, files no further receipt, and the shortfall becomes a loss
against the processor (debit note before Close Order).

**Important:**
- This is NOT a purchase — material was always yours. The GRN *form* is for things you bought.
- GST is on the SERVICE (processing charges), not the fabric — the return receipt is what the ITC report reads
- A wrong count is reversed by an admin, one receipt at a time (that lot taken back, that challan cancelled)

**Example:** Receiving 480m printed fabric back from ABC Printing (sent 500m, 20m shrinkage)

---

### 2. GRN (Goods Receipt Note)

**Location:** GRN page → Create GRN against Purchase PO

**Use when:** Receiving goods you PURCHASED from a supplier

**What happens:**
- New stock created (ownership transfers to you)
- Linked to Purchase PO
- Payment liability created
- GST on goods recorded

**Use for:**
- Fabric from fabric suppliers
- Trims from trim suppliers
- Any material you BOUGHT

**DO NOT use for:**
- Processor returns (use Receive from processor on the Job Work Order — the "Job work return" receipt it files is
  visible on this page, but is never created or approved here)
- Internal transfers (use Challan Receive)

**Example:** Receiving 1000m greige fabric purchased from DEF Textiles

---

### 3. Challan Receive

**Location:** Challans page → Find the challan → Mark Received

**Use when:** Confirming receipt of internal/branch transfers

**What happens:**
- Challan status updated to RECEIVED
- Stock added to receiving location
- Audit trail complete

**Example:** Cutting Dept confirming receipt of 200m fabric sent from Main Warehouse

---

### 4. Stock In (RESTRICTED)

**Location:** Stock In page

**Use when:** Opening balance or physical count corrections ONLY

**Requires:** Supervisor approval

**Legitimate uses:**
- System go-live: entering existing stock
- Physical count: found 5 extra pieces
- Correction: reversing a wrong entry

**DO NOT use for:**
- Processor returns → Use Process PO Receive
- Purchases → Use GRN
- Internal transfers → Use Challan Receive

**Why restricted:** No source document = no audit trail. Every Stock In entry is flagged for review.

---

## The Greige → Processor → Fabric Flow (Most Common)

Here's the complete flow for sending greige for printing and receiving printed fabric:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: SEND GREIGE                                             │
│                                                                 │
│ Printing page → New Process PO → Direct Style-Based mode        │
│ • Select style: KS-1045                                         │
│ • Select greige lot: GRG-2024-001 (500m available)              │
│ • Select processor: ABC Printing Mill                           │
│ • Enter quantity: 500m                                          │
│ • Rate: ₹45/m (or check "TBD" if not decided)                   │
│ • Click "Create & Send"                                         │
│                                                                 │
│ Result:                                                         │
│ ✓ Process PO #PPO-2024-0156 created (status: AT_MILL)           │
│ ✓ Outward Challan #CH-2024-0892 created                         │
│ ✓ Your greige stock: -500m                                      │
│ ✓ Greige at processor: +500m (still YOUR material)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     [ Mill does printing ]
                     [ 2-3 weeks pass ]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: RECEIVE PRINTED FABRIC (can be multiple lots)          │
│                                                                 │
│ Printing page → Find PPO-2024-0156 → Receive                    │
│                                                                 │
│ Lot 1 (Day 15):                                                 │
│ • Received: 200m                                                │
│ • QC: Pass                                                      │
│ • Update Stock → 200m added to fabric_stock                     │
│                                                                 │
│ Lot 2 (Day 20):                                                 │
│ • Received: 290m                                                │
│ • QC: Pass, actual rate confirmed ₹45/m                         │
│ • Update Stock → 290m added to fabric_stock                     │
│                                                                 │
│ Close PO:                                                       │
│ • Sent: 500m                                                    │
│ • Received: 490m                                                │
│ • Shrinkage: 10m (2%) — within acceptable range                 │
│ • Mark Complete                                                 │
│                                                                 │
│ Result:                                                         │
│ ✓ Fabric stock: +490m printed fabric                            │
│ ✓ Greige at processor: 0m (all accounted)                       │
│ ✓ Inward challan auto-created                                   │
│ ✓ Processing cost: ₹22,050 (490m × ₹45) recorded                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common Mistakes to Avoid

| Mistake | Why It's Wrong | Correct Action |
|---------|---------------|----------------|
| Using the GRN form for processor returns | It is a purchase form; nothing you bought is arriving | Use Receive from processor on the Job Work Order |
| Using Stock In for processor returns | No audit trail, no document link | Use Receive from processor on the Job Work Order |
| Using Stock Out for processor issues | Creates challan but no Process PO, can't track return | Use Process PO Create & Send |
| Using Stock In for purchases | Skips Purchase PO, wrong accounting | Use GRN against PO |
| Using manual Challan for everything | Bypasses proper workflows | Use purpose-specific doors |

---

## Document Chain Summary

| Flow | Documents Created |
|------|-------------------|
| **Purchase** | Purchase PO → GRN → Payment |
| **Job Work (Processor)** | Job Work Order → Outward Challan → (mill works) → Receive from processor [one action: Job work return receipt + stock lot + Inward Challan + loss split] → Service Invoice Payment |
| **Internal Transfer** | Outward Challan → Challan Receive |
| **Purchase Return** | Outward Challan (linked to original PO) |

---

## Why This Matters for GST

Indian GST treats these differently:

| Type | GST Treatment | Reporting |
|------|--------------|-----------|
| **Purchase** | GST on goods value, ITC claimed | GSTR-2A/2B |
| **Job Work** | GST on service charges only, ITC on service | ITC-04 (quarterly job work report) |
| **Internal Transfer** | No GST (same entity) | Delivery challan only |
| **Purchase Return** | GST credit reversed | Credit/Debit note |

Using wrong door = wrong GST return = compliance issues.

---

## Questions?

- **Unsure which door?** Ask your supervisor before proceeding
- **System not allowing something?** There's probably a reason — check if you're using the right door
- **Need to fix a mistake?** Don't create offsetting entries — ask supervisor for proper reversal

---

*Last updated: 2026-07-30*
