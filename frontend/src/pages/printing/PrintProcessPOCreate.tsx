// Print Process PO Create Page - Thin wrapper around shared ProcessPOCreateForm
import ProcessPOCreateForm from '@/components/processing/ProcessPOCreateForm';

export default function PrintProcessPOCreate() {
  return <ProcessPOCreateForm processType="PRINTING" backPath="/manufacturing/printing" title="New Print Process PO" />;
}
