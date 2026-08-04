// BUG-DASH4 fix: corrected route path - Unified Process PO Create Page
// Route: /manufacturing/processing/process-pos/new
// When accessed from /manufacturing/processing, navigates back to unified view
// Quality Check & Return Unprocessed are DIALOGS in ProcessingList.tsx, not separate routes
import ProcessPOCreateForm from '@/components/processing/ProcessPOCreateForm';

export default function UnifiedProcessPOCreate() {
  // Default to DYEING for unified view, but back path goes to unified processing list
  return <ProcessPOCreateForm processType="DYEING" backPath="/manufacturing/processing" title="New Process PO" />;
}
