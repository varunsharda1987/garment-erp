/** How a job work order line is named on screen — its colour, and "Buyer Style Code · colour" */
import { buyerStyleCode } from '@/lib/style-code';
import type { JobWorkOrderLineBrief } from '@/types/jobWorkOrder.types';

/** The line's colour: its own, else its fabric's / lace's (jobs made before lines kept it only there) */
export const lineColour = (line: JobWorkOrderLineBrief) =>
  line.colorMaster?.colorName ?? line.colorName ?? line.finishedLace?.color ?? line.finishedFabric?.colorName ?? null;

/** A line as the person receiving it names it: "ESSKY092LS · Red" (Line 2 when it has neither) */
export const lineName = (line: JobWorkOrderLineBrief) =>
  [line.style ? buyerStyleCode(line.style) : null, lineColour(line)].filter(Boolean).join(' · ') ||
  `Line ${line.lineNo}`;
