// BUG-DASH4: Print Job Work Order Create Page - Thin wrapper around shared ProcessPOCreateForm
// Route: /manufacturing/printing/job-work/new
import ProcessPOCreateForm from '@/components/processing/ProcessPOCreateForm';

export default function PrintProcessPOCreate() {
  return (
    <ProcessPOCreateForm
      processType="PRINTING"
      backPath="/manufacturing/printing"
      title="New Printing Job Work Order"
    />
  );
}
