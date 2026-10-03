/** How a job work order line is named on screen — its colour, and "Buyer Style Code · colour" */
import { buyerStyleCode } from '@/lib/style-code';
import type { JobWorkOrderLineBrief } from '@/types/jobWorkOrder.types';

/** The line's colour: its own, else its fabric's / lace's (jobs made before lines kept it only there) */
export const lineColour = (line: JobWorkOrderLineBrief) =>
  line.colorMaster?.colorName ?? line.colorName ?? line.finishedLace?.color ?? line.finishedFabric?.colorName ?? null;

/**
 * What a colour that came back untouched is called on this job: a dyeing job's comes back "undyed", a
 * printing job's "unprinted" (PJ-ESSKY090LS-002 said "undyed" on a printing job, 3-Oct).
 */
export const notProcessedWord = (processType: string | null | undefined) =>
  processType === 'DYEING' ? 'undyed' : processType === 'PRINTING' ? 'unprinted' : 'unprocessed';

/** The verb for the same: "without dyeing it" / "without printing it" */
export const processingVerb = (processType: string | null | undefined) =>
  processType === 'DYEING' ? 'dyeing' : processType === 'PRINTING' ? 'printing' : 'processing';

/** Statuses of a job whose goods have not left yet */
const NOT_YET_SENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

/**
 * Has this colour's greige gone to the processor? Its own send date when it went on its own (2026-10-03); a job sent
 * whole (no colour has a date) has every colour sent with it. The server's rule (jwo-lines.helper lineIsSent).
 */
export const lineIsSent = (
  line: { sentDate?: string | Date | null },
  job: { sentDate?: string | Date | null; jwoStatus?: string | null },
  lines: ReadonlyArray<{ sentDate?: string | Date | null }>
) =>
  line.sentDate != null ||
  ((job.sentDate != null ||
    (job.jwoStatus != null && job.jwoStatus !== 'CANCELLED' && !NOT_YET_SENT_STATUSES.includes(job.jwoStatus))) &&
    lines.every((l) => l.sentDate == null));

/** A line as the person receiving it names it: "ESSKY092LS · Red" (Line 2 when it has neither) */
export const lineName = (line: JobWorkOrderLineBrief) =>
  [line.style ? buyerStyleCode(line.style) : null, lineColour(line)].filter(Boolean).join(' · ') ||
  `Line ${line.lineNo}`;
