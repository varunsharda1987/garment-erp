// BUG-DASH4: Print Job Work Order Detail Page - Thin wrapper around shared ProcessPODetail
// Route: /manufacturing/printing/process-pos/:id
import ProcessPODetail from '@/components/processing/ProcessPODetail';

export default function PrintProcessPODetail() {
  return (
    <ProcessPODetail processType="PRINTING" backPath="/manufacturing/processing" title="Printing Job Work Order" />
  );
}
