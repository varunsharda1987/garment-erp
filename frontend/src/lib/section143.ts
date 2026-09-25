/**
 * Section 143 (CGST) — how long a job's inputs have been with the processor. Mirrors
 * backend/src/services/helpers/section143.helper.ts.
 *
 * The one-year period runs from the day the processor RECEIVED the goods. For cloth a job took where
 * it already lay at the processor (delivered straight there), that is before the job was sent, and the
 * server stamps `statutoryDueDate` from it. So the start is that due date less one year; the sent date
 * only when no due date was stamped.
 */

export type Section143Severity = 'OK' | 'WARNING' | 'CRITICAL' | 'BREACHED';

export const SECTION_143_WARNING_DAYS = 270;
export const SECTION_143_CRITICAL_DAYS = 300;
export const SECTION_143_YEAR_DAYS = 365;

/** The day the one-year period started, or null for a job that has not gone out. */
export function section143ClockStart(jwo: { statutoryDueDate?: string | null; sentDate?: string | null }): Date | null {
  if (jwo.statutoryDueDate) {
    const start = new Date(jwo.statutoryDueDate);
    start.setFullYear(start.getFullYear() - 1);
    return start;
  }
  return jwo.sentDate ? new Date(jwo.sentDate) : null;
}

/** Days the goods have been with the processor, or null for a job that has not gone out. */
export function section143Days(
  jwo: { statutoryDueDate?: string | null; sentDate?: string | null },
  asOf: Date = new Date()
): number | null {
  const start = section143ClockStart(jwo);
  return start ? Math.floor((asOf.getTime() - start.getTime()) / 86_400_000) : null;
}

export function section143Severity(days: number): Section143Severity {
  if (days > SECTION_143_YEAR_DAYS) return 'BREACHED';
  if (days >= SECTION_143_CRITICAL_DAYS) return 'CRITICAL';
  if (days >= SECTION_143_WARNING_DAYS) return 'WARNING';
  return 'OK';
}
