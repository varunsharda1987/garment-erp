/**
 * Section 143 (CGST) — when the one-year return period of a job's inputs STARTS, and how close it is.
 *
 * The period runs from the day the job worker RECEIVED the inputs (Sec 19 explanation). For cloth sent
 * from our store that is the sent date; for cloth a job took where it already lay at the processor
 * (delivered straight there — the direct-to-processor plan, 2026-09-25) it is the day the processor got
 * it, weeks before the job existed. `jobWorkOrderService.setStatutoryDueDate` stamps the due date from
 * the earlier of the two, so the START is that due date less one year. The sent date is used only for a
 * job whose due date was never stamped. Every §143 reader counts through here — the ageing report,
 * the dashboard count, the list and detail badges.
 */

export type Section143Severity = 'OK' | 'WARNING' | 'CRITICAL' | 'BREACHED';

/** From this many days the report warns; from CRITICAL it escalates; past a year it is breached. */
export const SECTION_143_WARNING_DAYS = 270;
export const SECTION_143_CRITICAL_DAYS = 300;
export const SECTION_143_YEAR_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day the one-year period started, or null for a job that has not gone out. */
export function section143ClockStart(order: {
  statutoryDueDate?: Date | string | null;
  sentDate?: Date | string | null;
}): Date | null {
  if (order.statutoryDueDate) {
    const start = new Date(order.statutoryDueDate);
    start.setFullYear(start.getFullYear() - 1); // the inverse of calculateStatutoryDueDate
    return start;
  }
  return order.sentDate ? new Date(order.sentDate) : null;
}

/** Whole days from `from` to `asOf`. */
export function daysSince(from: Date, asOf: Date = new Date()): number {
  return Math.floor((asOf.getTime() - from.getTime()) / DAY_MS);
}

export function section143Severity(daysOutstanding: number): Section143Severity {
  if (daysOutstanding > SECTION_143_YEAR_DAYS) return 'BREACHED';
  if (daysOutstanding >= SECTION_143_CRITICAL_DAYS) return 'CRITICAL';
  if (daysOutstanding >= SECTION_143_WARNING_DAYS) return 'WARNING';
  return 'OK';
}
