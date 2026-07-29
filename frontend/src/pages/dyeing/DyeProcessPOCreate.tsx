// Dye Process PO Create Page - Thin wrapper around shared ProcessPOCreateForm
import ProcessPOCreateForm from '@/components/processing/ProcessPOCreateForm';

export default function DyeProcessPOCreate() {
  return <ProcessPOCreateForm processType="DYEING" backPath="/manufacturing/dyeing" title="New Dye Process PO" />;
}
