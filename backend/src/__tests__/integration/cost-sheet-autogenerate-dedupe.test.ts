/**
 * Auto-Generate fabric dedupe (silent-data-loss hunt 2026-08-31, finding doc-#2 — CRITICAL).
 *
 * POST /style-costing/generate/:styleId builds the cost-sheet preview from the style's costed
 * CAD rows, deduplicating them on `componentName || 'default'`. componentName is free-text and
 * NULL on most live rows, so two fully-costed CAD rows of the same component collapse to one
 * key and the second is silently dropped — no line, no warning (the warnings query only covers
 * UNcosted rows, so a costed-but-dropped row structurally cannot appear in it).
 *
 * On live data this understates fabric cost by roughly two-thirds on 8 styles: EBWW-007 keeps
 * ₹31.34/pc and silently drops ₹61.94/pc; on a 2,500-piece order that is ~₹1.55 lakh of fabric
 * missing from the quote, flowing straight into the selling price and later into the Order BOM.
 *
 * Fixtures replicate the dominant live shape: ONE greige costed at TWO widths, componentName
 * NULL on both rows, both carrying BOTH approvals (the generate gate requires CAD approval AND
 * price approval). The dedupe key must separate them; only a true duplicate (same component,
 * same styleFabric, same width) may collapse — and even that collapse must be reported.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `AGD${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let greigeId: string;
let componentId: string;
let styleFabricId: string;
let cadNarrow: string;
let cadWide: string;
let cadDuplicate: string;

const NARROW = { width: 50, average: 0.4967, rate: 63.09 };
const WIDE = { width: 52, average: 0.9817, rate: 63.09 };

function approvedCadRow(width: number, average: number, rate: number) {
  return {
    id: randomUUID(),
    greigeId,
    styleFabricId,
    componentName: null as string | null, // the live collision shape — most rows carry NULL
    cutableWidth: width,
    cadAverage: average,
    totalCostPerMeter: rate,
    purpose: 'COSTING',
    costingStyleId: styleId,
    // Both halves of the generate gate
    approvalStatus: 'APPROVED' as const,
    costingApprovalStatus: 'APPROVED' as const,
    createdById: userId,
  };
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GRG`,
      greigeName: `${RUN} Viscose Slub 30x30 / 68x64 / 63" (Super Dyeing)`,
      composition: '100% Viscose',
      greigeWidth: 63,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Shirt', componentType: 'MAIN' },
  });
  componentId = component.id;

  const sf = await prisma.style_fabrics.create({
    data: { id: randomUUID(), componentId, selectedGreigeId: greigeId, fabricName: `${RUN} Viscose Slub` },
  });
  styleFabricId = sf.id;

  const narrow = await prisma.fabric_width_cad.create({
    data: approvedCadRow(NARROW.width, NARROW.average, NARROW.rate),
  });
  cadNarrow = narrow.id;
  const wide = await prisma.fabric_width_cad.create({ data: approvedCadRow(WIDE.width, WIDE.average, WIDE.rate) });
  cadWide = wide.id;
});

afterAll(async () => {
  await prisma.fabric_width_cad.deleteMany({
    where: { id: { in: [cadNarrow, cadWide, cadDuplicate].filter((v): v is string => typeof v === 'string') } },
  });
  await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Auto-Generate keeps every distinct costed fabric row', () => {
  it('returns BOTH width options of one greige instead of collapsing them to one line', async () => {
    const res = await request(app).post(`/api/style-costing/generate/${styleId}`).set(authHeader).send({});

    expect(res.status).toBe(200);
    const details: Array<{ fabricWidth: number; fabricAverage: number; fabricRate: number; fabricTotal: number }> =
      res.body.data.fabricDetails;

    // The bug: componentName is NULL on both rows, so they shared the key 'default' and only the
    // most recently updated survived — silently halving (here, thirding) the fabric cost.
    expect(details).toHaveLength(2);

    const narrowLine = details.find((d) => Number(d.fabricWidth) === NARROW.width)!;
    const wideLine = details.find((d) => Number(d.fabricWidth) === WIDE.width)!;
    expect(narrowLine).toBeDefined();
    expect(wideLine).toBeDefined();
    expect(narrowLine.fabricAverage).toBeCloseTo(NARROW.average, 4);
    expect(wideLine.fabricAverage).toBeCloseTo(WIDE.average, 4);

    // The money must be the SUM of both lines, not whichever line won the collision.
    const expectedTotal = NARROW.average * NARROW.rate + WIDE.average * WIDE.rate;
    expect(res.body.data.fabricTotal).toBeCloseTo(expectedTotal, 2);
  });

  it('still collapses a TRUE duplicate (same component, styleFabric and width) — but reports it', async () => {
    // A second costing of the SAME option tuple: legitimate to collapse (latest wins), but the
    // collapse of a fully-costed row must never be invisible.
    const dup = await prisma.fabric_width_cad.create({
      data: { ...approvedCadRow(WIDE.width, WIDE.average, 70.0), id: randomUUID() },
    });
    cadDuplicate = dup.id;

    const res = await request(app).post(`/api/style-costing/generate/${styleId}`).set(authHeader).send({});
    expect(res.status).toBe(200);

    // Still exactly two lines — the duplicate collapsed with its sibling, not with the other width.
    expect(res.body.data.fabricDetails).toHaveLength(2);

    // Latest-wins must actually hold: the survivor is the NEWER costing (rate 70), not the
    // original 63.09. Without this assertion, reverting the orderBy to oldest-first keeps every
    // other check green while every preview silently prices at the stale rate.
    const wideLine = res.body.data.fabricDetails.find(
      (d: { fabricWidth: number }) => Number(d.fabricWidth) === WIDE.width
    )!;
    expect(wideLine.fabricRate).toBe(70);
    expect(res.body.data.fabricTotal).toBeCloseTo(NARROW.average * NARROW.rate + WIDE.average * 70, 2);

    // ...and the drop of a costed row is reported, which the old warnings query structurally
    // could not do (it only covered totalCostPerMeter: null rows).
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.join(' ')).toMatch(/collapsed|duplicate/i);
  });
});
