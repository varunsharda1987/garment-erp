/**
 * The canonical answer to "did this lab round pass?"
 *
 * A lab round is one Test Requirement Form (TRF) — the sheet that travels with a sample to the lab.
 * The lab's result comes back as at most one fabric test (FPT) and at most one garment test (GPT),
 * each linked to the round by `trfId` (unique on both tables). A retest is a NEW round: a new TRF
 * whose tests carry `originalTestId` back to the round before.
 *
 * Three readers must agree on this answer, so it is computed here and nowhere else:
 *   - the sample page's Lab Tests panel (via `labResult` on every TRF the API returns),
 *   - the approve-sample warning (owner, 2026-09-23: warn only, never refuse),
 *   - the Shipment Sample dispatch gate in productionBlockingValidation.service.ts.
 *
 * An admin override counts as a pass, exactly as validateFPTForStage treats it (it skips overridden
 * rows). Overrides are written only by the /approve endpoints, which also stamp approvedById — the
 * update schemas no longer accept adminOverride. A plain approval of a FAIL does NOT turn it into a
 * pass here: the override is the explicit "accept it anyway" decision. (UNRESOLVED_TEST_FAILURE in
 * test-failure.helper.ts answers a different question — "does this still need attention?" — and there
 * any approval clears it.)
 */

import { Prisma, TestResult } from '@prisma/client';
import prisma from '../../config/database';
import { ConflictError, ValidationError } from '../../errors';

export type LabRoundResult = 'NO_RESULT' | 'PASS' | 'FAIL';

/** The one select for a round's test summary — used by the TRF list and by this helper. */
export const LAB_ROUND_TEST_SELECT = {
  id: true,
  testNumber: true,
  testReportNumber: true,
  testResultReceivedDate: true,
  sentToLabDate: true,
  overallTestResult: true,
  failureReason: true,
  testReportUrl: true,
  remarks: true,
  adminOverride: true,
  approvedById: true,
  isRetest: true,
  originalTestId: true,
  retestCount: true,
} as const;

type RoundTest = {
  overallTestResult: TestResult;
  adminOverride: boolean;
} | null;

const PASSING: TestResult[] = ['PASS', 'CONDITIONAL_PASS'];
const FAILING: TestResult[] = ['FAIL', 'RETEST_REQUIRED'];

/** An admin-overridden test counts as a pass for the round (same stance as validateFPTForStage). */
function overridden(test: NonNullable<RoundTest>): boolean {
  return test.adminOverride;
}

/**
 * The round's verdict from its linked tests.
 *
 * FAIL wins over everything: one failing test fails the round. PASS needs at least one recorded test
 * and every recorded test passing. Anything else — no test yet, or a test still PENDING — is
 * NO_RESULT, which the dispatch gate treats as "not passed".
 */
export function roundResult(round: { fabricTest: RoundTest; garmentTest: RoundTest }): LabRoundResult {
  const tests = [round.fabricTest, round.garmentTest].filter((t): t is NonNullable<RoundTest> => t !== null);
  if (tests.length === 0) return 'NO_RESULT';

  if (tests.some((t) => FAILING.includes(t.overallTestResult) && !overridden(t))) return 'FAIL';
  if (tests.every((t) => PASSING.includes(t.overallTestResult) || overridden(t))) return 'PASS';
  return 'NO_RESULT';
}

export interface LatestLabRound {
  trfId: string;
  trfNumber: string;
  sampleStage: string;
  result: LabRoundResult;
  /** The lab's report number for the round, when one has been recorded. */
  reportNumber: string | null;
}

/**
 * The sample's most recent active round.
 *
 * Ordered by `createdAt`, not `trfDate`: the TRF date is an editable, printable field that can be
 * back-dated, and `createdAt` is also the TRF list's default sort — so the panel, the approve warning
 * and the dispatch gate all agree on which round is "latest".
 */
export async function latestRoundForSample(
  sampleId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<LatestLabRound | null> {
  const trf = await tx.buyer_test_requirement_forms.findFirst({
    where: { sampleId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      trfNumber: true,
      sampleStage: true,
      fabricTest: { select: LAB_ROUND_TEST_SELECT },
      garmentTest: { select: LAB_ROUND_TEST_SELECT },
    },
  });
  if (!trf) return null;

  return {
    trfId: trf.id,
    trfNumber: trf.trfNumber,
    sampleStage: trf.sampleStage,
    result: roundResult(trf),
    reportNumber: trf.fabricTest?.testReportNumber ?? trf.garmentTest?.testReportNumber ?? null,
  };
}

/**
 * The latest lab round on ANY of a style's samples for a buyer — what the Shipment Sample dispatch
 * gate reads. The owner's process lab-tests the garment on the PP sample (before it is sent), not the
 * Shipment Sample, so the Shipment Sample's own rounds are usually empty; if a Shipment Sample is ever
 * sent to the lab, its round is the newest and becomes the one that counts. Rounds with no sample (a
 * fabric-lot test's form) are excluded — fabric has its own gate, at cutting.
 */
export async function latestSampleRoundForStyle(
  styleId: string,
  customerId?: string | null,
  tx: Prisma.TransactionClient = prisma
): Promise<(LatestLabRound & { sampleNumber: string }) | null> {
  const trf = await tx.buyer_test_requirement_forms.findFirst({
    where: {
      isActive: true,
      sample: { is: { styleId, ...(customerId ? { customerId } : {}) } },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      trfNumber: true,
      sampleStage: true,
      sample: { select: { sampleNumber: true } },
      fabricTest: { select: LAB_ROUND_TEST_SELECT },
      garmentTest: { select: LAB_ROUND_TEST_SELECT },
    },
  });
  if (!trf) return null;

  return {
    trfId: trf.id,
    trfNumber: trf.trfNumber,
    sampleStage: trf.sampleStage,
    sampleNumber: trf.sample?.sampleNumber ?? '',
    result: roundResult(trf),
    reportNumber: trf.garmentTest?.testReportNumber ?? trf.fabricTest?.testReportNumber ?? null,
  };
}

/* ───────────────────────── Linking a test to its round ───────────────────────── */

export type LabTestKind = 'fabric' | 'garment';

/**
 * Resolve the TRF a new FPT/GPT is being recorded against, before anything is written.
 *
 * Refuses a TRF that is gone, belongs to another style, or already has a result of this kind — one
 * of each per round is the rule that makes "a second test needs a second TRF" hold. The unique index
 * on trfId is the backstop for the race between this check and the insert (see conflictIfDuplicateRound).
 */
export async function resolveTrfForTest(trfId: string, kind: LabTestKind, styleId?: string | null) {
  const trf = await prisma.buyer_test_requirement_forms.findUnique({
    where: { id: trfId },
    select: {
      id: true,
      trfNumber: true,
      isActive: true,
      styleId: true,
      customerId: true,
      testingLabId: true,
      workOrderId: true,
      fabricTest: { select: { testNumber: true } },
      garmentTest: { select: { testNumber: true } },
    },
  });
  if (!trf || !trf.isActive) throw new ValidationError('That test requirement form does not exist');
  if (styleId && styleId !== trf.styleId) {
    throw new ValidationError(`${trf.trfNumber} is for a different style than this test`);
  }
  const existing = kind === 'fabric' ? trf.fabricTest : trf.garmentTest;
  if (existing) {
    throw new ConflictError(
      `${trf.trfNumber} already has a ${kind} result (${existing.testNumber}) — edit that one instead`
    );
  }
  return trf;
}

/**
 * The unique index on trfId fired: two saves raced past resolveTrfForTest. Answer 409, not the
 * generic 500 the testing services' catch-all would otherwise produce.
 */
export function conflictIfDuplicateRound(error: unknown, kind: LabTestKind): void {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes('trfId')
  ) {
    throw new ConflictError(`This lab round already has a ${kind} result — edit that one instead`);
  }
}

/** Copy only the result columns the schema accepts (FABRIC_RESULT_KEYS / GARMENT_RESULT_KEYS). */
export function pickResultFields(source: object, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}
