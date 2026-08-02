// Print Process PO Detail Page - Thin wrapper around shared ProcessPODetail
import ProcessPODetail from '@/components/processing/ProcessPODetail';

export default function PrintProcessPODetail() {
  return (
    <ProcessPODetail processType="PRINTING" backPath="/manufacturing/processing" title="Print Process PO Details" />
  );
}
