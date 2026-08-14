// BUG-DASH4: Dye Job Work Order Create Page - Thin wrapper around shared ProcessPOCreateForm
// Route: /manufacturing/dyeing/process-pos/new
import ProcessPOCreateForm from '@/components/processing/ProcessPOCreateForm';

export default function DyeProcessPOCreate() {
  return (
    <ProcessPOCreateForm processType="DYEING" backPath="/manufacturing/dyeing" title="New Dyeing Job Work Order" />
  );
}
