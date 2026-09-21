/**
 * The canonical definition of an UNRESOLVED physical-test failure.
 *
 * "Has this test failed?" and "is that failure still a problem?" are different questions, and the
 * Manufacturing Control Center was asking the first while displaying the answer as the second. It
 * counted every row with `overallTestResult: 'FAIL'` that had ever existed, so the Quality Failures
 * tile could only ever go UP — approving a failure, overriding it, or passing a retest never
 * cleared it, and its "oldest" age was pinned to the first failure in the database forever.
 *
 * A failure is resolved when any of these is true:
 *   - someone approved it despite the result (`approvedById`)
 *   - an admin overrode it (`adminOverride`)
 *   - it was retested — `fabricPhysicalTests.service.ts:370` creates a NEW row for a retest rather
 *     than superseding the original, so without the `retests` check the original counts forever
 *   - the row was deactivated
 *
 * The same shape applies to fabric (FPT) and garment (GPT) tests: identical columns, identical
 * self-relation. Both live here so the two can never drift apart again.
 */

/**
 * Prisma where-fragment for a failure that still needs someone's attention.
 * Works as-is on both `fabric_physical_tests` and `garment_physical_tests`.
 */
export const UNRESOLVED_TEST_FAILURE = {
  overallTestResult: 'FAIL' as const,
  approvedById: null,
  adminOverride: false,
  isActive: true,
  // A retested failure has been superseded by its retest, whatever that retest said.
  retests: { none: {} },
};
