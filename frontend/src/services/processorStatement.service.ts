import api from '@/lib/api';
import type { ProcessorStatement, ProcessorStatementParams } from '@/types/processorStatement.types';

const BASE_URL = '/job-work-statutory/processor-statement';

function toQuery(params: ProcessorStatementParams): string {
  return new URLSearchParams({
    processorId: params.processorId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  }).toString();
}

export async function getProcessorStatement(params: ProcessorStatementParams): Promise<ProcessorStatement> {
  const response = await api.get<{ success: boolean; data: ProcessorStatement }>(`${BASE_URL}?${toQuery(params)}`);
  return response.data.data;
}

/** The endpoint path for `openPDF` — same query, plus the pdf switch. */
export function processorStatementPdfPath(params: ProcessorStatementParams): string {
  return `${BASE_URL}?${toQuery(params)}&format=pdf`;
}

export default { getProcessorStatement, processorStatementPdfPath };
