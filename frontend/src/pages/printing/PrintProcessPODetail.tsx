// BUG-DASH4: Print Process PO Detail Page - Thin wrapper around shared ProcessPODetail
// Route: /manufacturing/printing/process-pos/:id
import ProcessPODetail from '@/components/processing/ProcessPODetail';

export default function PrintProcessPODetail() {
  return (
    <ProcessPODetail processType="PRINTING" backPath="/manufacturing/processing" title="Print Process PO Details" />
  );
}
