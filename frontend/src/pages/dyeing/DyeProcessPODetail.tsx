// BUG-DASH4: Dye Job Work Order Detail Page - Thin wrapper around shared ProcessPODetail
// Route: /manufacturing/dyeing/process-pos/:id
import ProcessPODetail from '@/components/processing/ProcessPODetail';

export default function DyeProcessPODetail() {
  return <ProcessPODetail processType="DYEING" backPath="/manufacturing/processing" title="Dyeing Job Work Order" />;
}
