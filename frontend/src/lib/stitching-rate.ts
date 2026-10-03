/**
 * The stitching contractor's pay per piece — the screen's preview of the ONE rule in
 * backend/src/services/helpers/stitching-rate.helper.ts (owner, 2026-10-03):
 *
 *   per piece = operator rate + commission % of it   (commission = one company setting, 10%)
 *   owed      = GOOD pieces × operator rate, + commission % of that
 *
 * The server computes and stores; this only shows the numbers before saving.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Commission and total per piece for an operator rate */
export function withCommission(operatorRate: number, commissionPercent: number) {
  const rate = round2(operatorRate);
  const commissionPerPiece = round2((rate * commissionPercent) / 100);
  return { operatorRatePerPiece: rate, commissionPerPiece, totalPerPiece: round2(rate + commissionPerPiece) };
}

/** What a number of pieces costs at an operator rate, commission included */
export function amountFor(pieces: number, operatorRate: number, commissionPercent: number) {
  const operatorAmount = round2(pieces * operatorRate);
  const commissionAmount = round2((operatorAmount * commissionPercent) / 100);
  return { operatorAmount, commissionAmount, totalAmount: round2(operatorAmount + commissionAmount) };
}
