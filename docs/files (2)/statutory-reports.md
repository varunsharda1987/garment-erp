# Statutory reports — ITC-04 and Section 143 ageing

Two reports the schema currently cannot produce. Both are queries, not tables — deriving them means they can never drift from the underlying challans.

---

## 1. Section 143 ageing

The one that has a deadline you cannot see. Material sent to a job worker must return within **one year** of despatch. Miss it and the original despatch is deemed a supply **from the despatch date** — interest runs from then, not from the breach.

### The query

```sql
-- Outstanding quantity by job worker, by order, by age
WITH movements AS (
  SELECT
    ci."jobWorkOrderId",
    ci."jobWorkOrderComponentId",
    SUM(CASE WHEN c."challanType" = 'OUTWARD' THEN ci.quantity ELSE 0 END) AS qty_out,
    SUM(CASE WHEN c."challanType" = 'INWARD'  THEN ci.quantity ELSE 0 END) AS qty_in
  FROM challan_items ci
  JOIN challans c ON c.id = ci."challanId"
  WHERE ci."jobWorkOrderId" IS NOT NULL
    AND c.status NOT IN ('DRAFT', 'CANCELLED')
  GROUP BY 1, 2
)
SELECT
  s."supplierName",
  jw."jobWorkNumber",
  jw."sentDate",
  jw."statutoryDueDate",
  (m.qty_out - m.qty_in)                                  AS balance_qty,
  CURRENT_DATE - jw."sentDate"::date                      AS days_out,
  jw."statutoryDueDate"::date - CURRENT_DATE              AS days_remaining,
  CASE
    WHEN jw."statutoryDueDate" < CURRENT_DATE           THEN 'BREACHED'
    WHEN CURRENT_DATE - jw."sentDate"::date >= 300      THEN 'CRITICAL'
    WHEN CURRENT_DATE - jw."sentDate"::date >= 240      THEN 'WARNING'
    ELSE 'OK'
  END                                                     AS flag
FROM movements m
JOIN job_work_orders jw ON jw.id = m."jobWorkOrderId"
JOIN suppliers s        ON s.id = jw."processorId"
WHERE (m.qty_out - m.qty_in) > 0
ORDER BY jw."sentDate";
```

### Thresholds

| Days out | Flag | Action |
|---|---|---|
| < 240 | OK | — |
| 240–299 | WARNING | Surface on the vendor dashboard |
| 300+ | CRITICAL | Escalate. 65 days of runway remain. |
| Past `statutoryDueDate` | BREACHED | Deemed supply has occurred. Raise the tax liability and recover from the vendor under the order terms. |

300 days is the number that matters. Two months is roughly the minimum time to chase a vendor, escalate, and if necessary raise the paperwork before the liability crystallises.

### Where it surfaces

Not a report someone remembers to run. It belongs on the landing dashboard as a count, and as a scheduled weekly digest to whoever owns vendor relationships. A statutory clock nobody watches is the same as no clock.

**Capital goods** run on a 3-year limit rather than 1 year. Moulds, dies, jigs, fixtures and tools are outside the 3-year limit entirely. If capital goods are ever sent out, add an `assetClass` to the order and branch the threshold — do not apply the 1-year rule to a machine.

---

## 2. ITC-04

Reports goods sent to and received from job workers in a period. Filing frequency depends on turnover slab — **confirm the current frequency and thresholds with the CA**; they have been amended more than once.

### The extract

Two sections, driven off the same challan lines.

**Table A — goods sent to job worker in the period**

| Column | Source |
|---|---|
| Job worker GSTIN | `supplier_gst_numbers.gstin` |
| Job worker state | `suppliers.billing_state` |
| Challan number, date | `challans.challanNumber`, `challanDate` |
| Description of goods | `challan_items.description` |
| UQC | `challan_items.unit`, mapped to the notified UQC list |
| Quantity | `challan_items.quantity` |
| Taxable value | `challan_items.declaredValue` |
| Type of goods | `INPUTS` or `CAPITAL_GOODS` |

**Table B — goods received back in the period**

Adds the job worker's own challan reference (`challans` where `challanType = INWARD`), the original outward challan number, and the nature of processing — sourced from `process_type_master.name`, which is why that table needs to exist before this report can.

### Guards to build into the query

These are not cosmetic. Each one catches a class of error that produces a wrong return.

```sql
-- 1. In-house work must never appear.
--    If this returns rows, routing rule RT1 has been violated.
AND jw."processorId" IS NOT NULL

-- 2. Internal movements must never appear.
AND c."challanType" IN ('OUTWARD', 'INWARD')

-- 3. Draft and cancelled challans must never appear.
AND c.status NOT IN ('DRAFT', 'CANCELLED')

-- 4. Unregistered job workers still appear in ITC-04.
--    Their lack of GSTIN does not exempt the movement from reporting.
--    Do NOT filter on gstin IS NOT NULL.
```

Guard 4 is the one most often got wrong. An unregistered contractor charges no GST, so it feels like the movement is outside the system. It is not — the reporting obligation is the principal's and it attaches to the movement, not to the tax.

Guard 1 should be asserted as a **test**, not just a filter. If in-house cutting can reach this query at all, the routing is broken upstream and the filter is only hiding it.

### Reconciliation check

Before filing, assert:

```
SUM(Table A quantity for period)
  - SUM(Table B quantity for period)
  = closing balance with job workers
  - opening balance with job workers
```

If this does not tie, something has moved without a challan. Find it before filing, not after.

---

## 3. Supporting reports worth building alongside

**Vendor performance.** Loss percentage by job worker by process, over rolling 6 months, against the tolerance set on their orders. This is what makes per-vendor tolerance meaningful — otherwise you are setting the same number for a good dyer and a cheap one because you have no evidence to distinguish them.

**Rate variance.** `agreedRatePerMeter` on the order versus the current active `processor_rate_card` row. `processor_rate_card` already has proper effective-dating with `supersededById`, so the history is there — this report just surfaces orders placed at off-card rates.

**Material at vendor, valued.** Total value sitting in `JOB_WORK` warehouses by vendor. This is real balance-sheet stock that is physically outside your premises, and most people are surprised by the number the first time they see it.
