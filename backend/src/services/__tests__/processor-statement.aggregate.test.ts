/**
 * Processor Statement — the arithmetic, with no database.
 *
 * `buildLedgerEvents` and `aggregateProcessorStatement` are pure by design so the figures a
 * processor is asked to CONFIRM can be pinned down here rather than only observed on live data.
 * The scenario below is the one that breaks naive implementations: two jobs settled inside the
 * window but sent before it (so they belong to opening, not to "sent"), one job returned
 * unprocessed, cloth parked by a transfer challan with no job at all, a processor who returned
 * MORE than was due, and a piece-work vendor measured in pieces rather than metres.
 */

import {
  aggregateProcessorStatement,
  agreedShrinkagePercent,
  buildLedgerEvents,
  normalizeUom,
  resolveJobKey,
  type JobSource,
  type MaterialKey,
  type SentLineSource,
  type StatementSources,
} from '../processor-statement.service';

const GREIGE: MaterialKey = { kind: 'GREIGE', id: 'greige-1', code: 'GRG-0001', name: 'Rayon 14kg' };
const STYLE: MaterialKey = { kind: 'GARMENT', id: 'style-1', code: 'KS-1045', name: 'Anarkali' };

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

const baseJob = (over: Partial<JobSource> & Pick<JobSource, 'id' | 'jobWorkNumber'>): JobSource => ({
  processType: 'DYEING',
  jwoStatus: 'STOCK_UPDATED',
  uom: 'MTR',
  qtySentMeters: 0,
  qtyReceivedMeters: null,
  qtyBillable: null,
  expectedShrinkage: null,
  qtyNormalLoss: null,
  qtyAbnormalLoss: null,
  tolerancePercent: null,
  sentDate: null,
  receivedDate: null,
  remarks: null,
  greige: GREIGE,
  lace: null,
  fabric: null,
  garment: null,
  lotAtThisProcessor: false,
  receipts: [],
  hasSendOuts: false,
  ...over,
});

const sentLine = (over: Partial<SentLineSource> & Pick<SentLineSource, 'id' | 'challanNumber'>): SentLineSource => ({
  challanId: `challan-${over.challanNumber}`,
  challanDate: d('2026-08-05'),
  jobWorkOrderId: null,
  quantity: 0,
  unit: 'METER',
  material: GREIGE,
  isTransfer: false,
  isDirectSupply: false,
  arrivedOn: null,
  ...over,
});

/**
 * Job A  sent 1000 on 05 Aug @ 10% agreed, came back 450 + 450 across two parts → settled exactly.
 * Job C  sent  500 on 12 Aug @ 10% agreed, came back 460 → 10 m MORE than due.
 * Job B  sent  500 on 02 Sep, returned unprocessed on 08 Sep → never settles shrinkage.
 * CH-T1  parked 300 at the processor on 01 Sep with no job; 100 handed back on 20 Sep.
 * SO-1   480 pieces sent to the same vendor on 05 Sep, nothing back yet.
 */
function scenario(): StatementSources {
  return {
    processor: { id: 'proc-1', code: 'SUP-001', name: 'ABC Dyeing Mill', gstin: '27AAAAA0000A1Z5' },
    jobs: [
      baseJob({
        id: 'jobA',
        jobWorkNumber: 'DJ-A-001',
        qtySentMeters: 1000,
        qtyReceivedMeters: 900,
        expectedShrinkage: 10,
        sentDate: d('2026-08-05'),
        receivedDate: d('2026-09-10'),
        receipts: [
          { grnNumber: 'GRN-1', date: d('2026-09-03'), qty: 450 },
          { grnNumber: 'GRN-2', date: d('2026-09-10'), qty: 450 },
        ],
      }),
      baseJob({
        id: 'jobC',
        jobWorkNumber: 'DJ-C-001',
        qtySentMeters: 500,
        qtyReceivedMeters: 460,
        expectedShrinkage: 10,
        sentDate: d('2026-08-12'),
        receivedDate: d('2026-09-15'),
        receipts: [{ grnNumber: 'GRN-3', date: d('2026-09-15'), qty: 460 }],
      }),
      baseJob({
        id: 'jobB',
        jobWorkNumber: 'DJ-B-001',
        jwoStatus: 'CANCELLED',
        qtySentMeters: 500,
        qtyReceivedMeters: 0,
        sentDate: d('2026-09-02'),
        receivedDate: d('2026-09-08'),
        remarks: '[RETURNED UNPROCESSED] 500 meters returned',
      }),
    ],
    sentLines: [
      sentLine({
        id: 'l1',
        challanNumber: 'CH-1',
        challanDate: d('2026-08-05'),
        quantity: 1000,
        jobWorkOrderId: 'jobA',
      }),
      sentLine({
        id: 'l2',
        challanNumber: 'CH-2',
        challanDate: d('2026-08-12'),
        quantity: 500,
        jobWorkOrderId: 'jobC',
      }),
      sentLine({
        id: 'l3',
        challanNumber: 'CH-3',
        challanDate: d('2026-09-02'),
        quantity: 500,
        jobWorkOrderId: 'jobB',
      }),
      sentLine({ id: 'l4', challanNumber: 'CH-T1', challanDate: d('2026-09-01'), quantity: 300, isTransfer: true }),
    ],
    returnLines: [
      { jobWorkOrderId: 'jobB', challanNumber: 'CH-R1', challanDate: d('2026-09-08'), quantity: 500, unit: 'METER' },
    ],
    noJobReturns: [{ id: 'r1', date: d('2026-09-20'), qty: 100, material: GREIGE }],
    sendOuts: [
      {
        id: 'so1',
        batchNumber: 'SO-1',
        processType: 'HANDWORK',
        unit: 'PCS',
        quantitySent: 480,
        quantityReceived: null,
        quantityDamaged: null,
        sendDate: d('2026-09-05'),
        actualReturnDate: null,
        status: 'SENT',
        outwardChallanId: null,
        jobWorkOrderId: null,
        material: STYLE,
      },
    ],
  };
}

const greigeSection = (sections: ReturnType<typeof aggregateProcessorStatement>) =>
  sections.find((s) => s.kind === 'GREIGE')!;

describe('processor statement — window arithmetic', () => {
  it('counts an August send in August and leaves September untouched', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-08-01'), end: d('2026-08-31') })
    ).rows[0];

    expect(row.opening).toBe(0);
    expect(row.sent).toBe(1500);
    expect(row.received).toBe(0);
    expect(row.returned).toBe(0);
    expect(row.closing).toBe(1500);
  });

  it('carries August sends into September as opening, not as sent again', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-09-01'), end: d('2026-09-30') })
    ).rows[0];

    expect(row.opening).toBe(1500);
    expect(row.sent).toBe(800); // 300 transfer + 500 job B — NOT the two August jobs
    expect(row.received).toBe(1360); // 450 + 450 + 460
    expect(row.returned).toBe(600); // 500 unprocessed + 100 no-job
    expect(row.shrinkage).toBe(150); // 100 (job A) + 50 (job C)
    expect(row.shortfall).toBe(-10); // job C came back 10 m over
    // 1500 + 800 − 1360 − 600 − 150 − (−10): only the parked 300 less the 100 handed back remains
    expect(row.closing).toBe(200);
  });

  it('settles a job to zero balance when it meets the agreed shrinkage exactly', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-08-01'), end: d('2026-09-30') })
    ).rows[0];

    const jobA = row.jobs.find((j) => j.jwoId === 'jobA')!;
    expect(jobA.agreedShrinkagePct).toBe(10);
    expect(jobA.dueBack).toBe(900);
    expect(jobA.shrinkage).toBe(100);
    expect(jobA.shortfall).toBe(0);
    expect(jobA.balance).toBe(0);
    expect(jobA.receipts.map((r) => r.grnNumber)).toEqual(['GRN-1', 'GRN-2']);
    expect(jobA.challanNumbers).toEqual(['CH-1']);
  });

  it('shows an over-return as negative shortfall rather than a negative balance', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-08-01'), end: d('2026-09-30') })
    ).rows[0];

    const jobC = row.jobs.find((j) => j.jwoId === 'jobC')!;
    expect(jobC.shortfall).toBe(-10);
    expect(jobC.balance).toBe(0);
  });

  it('books an unprocessed return without inventing shrinkage', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-09-01'), end: d('2026-09-30') })
    ).rows[0];

    const jobB = row.jobs.find((j) => j.jwoId === 'jobB')!;
    expect(jobB.returned).toBe(500);
    expect(jobB.shrinkage).toBe(0);
    expect(jobB.shortfall).toBe(0);
    expect(jobB.balance).toBe(0);
  });

  it('keeps pieces in their own section and never assigns them shrinkage', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const sections = aggregateProcessorStatement(events, jobs, { start: d('2026-09-01'), end: d('2026-09-30') });

    const garment = sections.find((s) => s.kind === 'GARMENT')!;
    expect(garment.unit).toBe('PCS');
    expect(garment.rows[0].sent).toBe(480);
    expect(garment.rows[0].shrinkage).toBe(0);
    expect(garment.rows[0].closing).toBe(480);
  });

  it('drops materials with no activity and no balance in the window', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const sections = aggregateProcessorStatement(events, jobs, { start: d('2026-08-01'), end: d('2026-08-31') });
    // The piece-work send-out is a September event — its section should not appear at all.
    expect(sections.find((s) => s.kind === 'GARMENT')).toBeUndefined();
  });

  it('totals every row in a section', () => {
    const { events, jobs } = buildLedgerEvents(scenario());
    const section = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-09-01'), end: d('2026-09-30') })
    );
    expect(section.totals.closing).toBe(200);
    expect(section.totals.received).toBe(1360);
  });
});

describe('processor statement — event sourcing', () => {
  it('normalises the three spellings of a unit', () => {
    expect(normalizeUom('METER')).toBe('MTR');
    expect(normalizeUom('meters')).toBe('MTR');
    expect(normalizeUom('MTR')).toBe('MTR');
    expect(normalizeUom('PIECE')).toBe('PCS');
    expect(normalizeUom('PCS')).toBe('PCS');
    expect(normalizeUom('KG')).toBe('KG');
    expect(normalizeUom(null)).toBe('MTR');
  });

  it('does not double-count a piece-work send-out that also has an outward challan', () => {
    const sources = scenario();
    sources.sendOuts[0].outwardChallanId = 'challan-CH-SO';
    sources.sentLines.push(
      sentLine({
        id: 'l5',
        challanNumber: 'CH-SO',
        challanId: 'challan-CH-SO',
        challanDate: d('2026-09-05'),
        quantity: 480,
        isTransfer: true,
      })
    );

    const { events } = buildLedgerEvents(sources);
    const sends = events.filter((e) => e.type === 'SENT' && e.ref === 'CH-SO');
    expect(sends).toHaveLength(0);
    expect(events.filter((e) => e.type === 'SENT' && e.ref === 'SO-1')).toHaveLength(1);
  });

  it('raises no SENT event for a job whose greige was already lying at the processor', () => {
    const sources = scenario();
    sources.jobs.push(
      baseJob({
        id: 'jobV',
        jobWorkNumber: 'DJ-V-001',
        qtySentMeters: 300,
        sentDate: d('2026-09-03'),
        lotAtThisProcessor: true,
      })
    );

    const { events, jobs, warnings } = buildLedgerEvents(sources);
    expect(events.filter((e) => e.jwoId === 'jobV' && e.type === 'SENT')).toHaveLength(0);
    expect(jobs.find((j) => j.jwoId === 'jobV')!.virtual).toBe(true);
    // It is virtual, not missing — no "no issued challan line" warning.
    expect(warnings.some((w) => w.includes('DJ-V-001'))).toBe(false);
  });

  it('counts goods delivered straight to the processor as SENT on the day they arrived, and the job that takes them adds none', () => {
    const sources = scenario();
    // A Rule 45 challan issued late (01 Oct) for greige the dyer received on 12 Aug
    sources.sentLines.push(
      sentLine({
        id: 'ds1',
        challanNumber: 'CH-DS1',
        challanDate: d('2026-10-01'),
        quantity: 400,
        isDirectSupply: true,
        arrivedOn: d('2026-08-12'),
      })
    );
    sources.jobs.push(
      baseJob({
        id: 'jobD',
        jobWorkNumber: 'DJ-D-001',
        qtySentMeters: 400,
        sentDate: d('2026-10-02'),
        lotAtThisProcessor: true,
        jwoStatus: 'ISSUED',
      })
    );

    const { events, jobs, warnings } = buildLedgerEvents(sources);
    const sent = events.filter((e) => e.type === 'SENT' && e.ref === 'CH-DS1');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ refKind: 'DIRECT_SUPPLY', qty: 400, jwoId: null });
    expect(sent[0].date.toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(events.filter((e) => e.jwoId === 'jobD' && e.type === 'SENT')).toHaveLength(0);
    expect(jobs.find((j) => j.jwoId === 'jobD')!.virtual).toBe(true);
    expect(warnings.some((w) => w.includes('DJ-D-001'))).toBe(false);

    // October: the row carries the 400 m once (opening, from August); the job is listed holding it
    const [section] = aggregateProcessorStatement(events, jobs, { start: d('2026-10-01'), end: d('2026-10-31') });
    const row = section.rows.find((r) => r.material.id === GREIGE.id)!;
    const job = row.jobs.find((j) => j.jwoId === 'jobD')!;
    expect(job.balance).toBe(400);
    expect(row.sent).toBe(0);
  });

  it('warns when a job says it was sent but no issued challan line backs it', () => {
    const sources = scenario();
    sources.jobs.push(
      baseJob({ id: 'jobX', jobWorkNumber: 'DJ-X-001', qtySentMeters: 250, sentDate: d('2026-09-04') })
    );

    const { warnings } = buildLedgerEvents(sources);
    expect(warnings.some((w) => w.includes('DJ-X-001') && w.includes('no issued challan line'))).toBe(true);
  });

  it('stays quiet about a cancelled job whose challan was cancelled with it', () => {
    const sources = scenario();
    sources.jobs.push(
      baseJob({
        id: 'jobK',
        jobWorkNumber: 'PJ-K-001',
        jwoStatus: 'CANCELLED',
        qtySentMeters: 3058.82,
        sentDate: d('2026-09-04'),
      })
    );

    const { events, warnings } = buildLedgerEvents(sources);
    // Cancelling credits the lot back and cancels the challan: nothing was ever with the
    // processor, so it must contribute neither an event nor a false alarm.
    expect(events.some((e) => e.jwoId === 'jobK')).toBe(false);
    expect(warnings.some((w) => w.includes('PJ-K-001'))).toBe(false);
  });

  it('warns when a job is marked returned unprocessed but its inward challan is missing', () => {
    const sources = scenario();
    sources.returnLines = [];

    const { warnings } = buildLedgerEvents(sources);
    expect(warnings.some((w) => w.includes('DJ-B-001') && w.includes('returned unprocessed'))).toBe(true);
  });

  it('files an unidentifiable job under a visible placeholder instead of dropping it', () => {
    const sources = scenario();
    sources.jobs = [
      baseJob({
        id: 'jobU',
        jobWorkNumber: 'DJ-U-001',
        qtySentMeters: 100,
        sentDate: d('2026-09-06'),
        greige: null,
      }),
    ];
    sources.sentLines = [];
    sources.returnLines = [];
    sources.noJobReturns = [];
    sources.sendOuts = [];

    const { events, warnings } = buildLedgerEvents(sources);
    expect(warnings.some((w) => w.includes('DJ-U-001') && w.includes('could not identify'))).toBe(true);
    expect(events.every((e) => e.material.name === 'Unidentified material')).toBe(true);
  });

  it('receives piece work that never files a GRN', () => {
    const sources = scenario();
    sources.jobs = [
      baseJob({
        id: 'jobP',
        jobWorkNumber: 'EJ-P-001',
        processType: 'EMBROIDERY',
        uom: 'PCS',
        qtySentMeters: 200,
        qtyReceivedMeters: 190,
        sentDate: d('2026-09-02'),
        receivedDate: d('2026-09-18'),
        greige: null,
        garment: STYLE,
      }),
    ];
    sources.sentLines = [];
    sources.returnLines = [];
    sources.noJobReturns = [];
    sources.sendOuts = [];

    const { events } = buildLedgerEvents(sources);
    const received = events.filter((e) => e.type === 'RECEIVED');
    expect(received).toHaveLength(1);
    expect(received[0].qty).toBe(190);
    expect(received[0].refKind).toBe('JOB');
    // Pieces never carry shrinkage — the 10 missing pieces stay on the balance to be chased.
    expect(events.some((e) => e.type === 'SHRINKAGE')).toBe(false);
  });
});

describe('processor statement — agreed shrinkage', () => {
  it('prefers the expected shrinkage recorded on the job', () => {
    expect(agreedShrinkagePercent({ expectedShrinkage: 7, qtyBillable: 500, qtySentMeters: 1000 })).toBe(7);
  });

  it('falls back to the billable quantity for rows written before shrinkage was recorded', () => {
    expect(agreedShrinkagePercent({ expectedShrinkage: null, qtyBillable: 900, qtySentMeters: 1000 })).toBe(10);
  });

  it('treats an unrecorded agreement as zero rather than guessing a house rate', () => {
    expect(agreedShrinkagePercent({ expectedShrinkage: null, qtyBillable: null, qtySentMeters: 1000 })).toBe(0);
  });

  it('shows the whole gap as short when no shrinkage was ever agreed, and says so', () => {
    const sources = scenario();
    sources.jobs = [
      baseJob({
        id: 'jobN',
        jobWorkNumber: 'DJ-N-001',
        qtySentMeters: 1000,
        qtyReceivedMeters: 950,
        sentDate: d('2026-08-01'),
        receivedDate: d('2026-09-05'),
        receipts: [{ grnNumber: 'GRN-N', date: d('2026-09-05'), qty: 950 }],
      }),
    ];
    sources.sentLines = [
      sentLine({
        id: 'n1',
        challanNumber: 'CH-N',
        challanDate: d('2026-08-01'),
        quantity: 1000,
        jobWorkOrderId: 'jobN',
      }),
    ];
    sources.returnLines = [];
    sources.noJobReturns = [];
    sources.sendOuts = [];

    const { events, jobs, warnings } = buildLedgerEvents(sources);
    const row = greigeSection(
      aggregateProcessorStatement(events, jobs, { start: d('2026-09-01'), end: d('2026-09-30') })
    ).rows[0];

    expect(row.shrinkage).toBe(0);
    expect(row.shortfall).toBe(50);
    expect(warnings.some((w) => w.includes('DJ-N-001') && w.includes('no agreed shrinkage'))).toBe(true);
  });
});

describe('processor statement — material identity', () => {
  const job = baseJob({ id: 'j', jobWorkNumber: 'J-1' });

  it('trusts what physically left on the challan over anything on the job', () => {
    const other: MaterialKey = { kind: 'GREIGE', id: 'greige-2', code: 'GRG-0002', name: 'Cotton 20s' };
    const { material, resolved } = resolveJobKey(job, [sentLine({ id: 'x', challanNumber: 'CH', material: other })]);
    expect(resolved).toBe(true);
    expect(material.id).toBe('greige-2');
  });

  it('files a lace job under its lace, not the greige behind its fabric', () => {
    const lace: MaterialKey = { kind: 'LACE', id: 'lace-1', code: 'LAC-1', name: 'Chantilly' };
    const { material } = resolveJobKey({ ...job, lace }, []);
    expect(material.kind).toBe('LACE');
  });

  it('files a fabric reprocessing job under the fabric it sent', () => {
    const fabric: MaterialKey = { kind: 'FABRIC', id: 'fab-1', code: 'FAB-1', name: 'Printed rayon' };
    const { material } = resolveJobKey({ ...job, fabric }, []);
    expect(material.kind).toBe('FABRIC');
  });
});
