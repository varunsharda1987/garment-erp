// Dye Process PO Detail Page - Thin wrapper around shared ProcessPODetail
import ProcessPODetail from '@/components/processing/ProcessPODetail';

export default function DyeProcessPODetail() {
  return <ProcessPODetail processType="DYEING" backPath="/manufacturing/processing" title="Dye Process PO Details" />;
}
