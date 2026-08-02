// BUG-DASH4 fix: Unified Lab Dip Create Page
// When accessed from /manufacturing/processing, navigates back to unified view
import LabDipBatchCreateForm from '@/components/processing/LabDipBatchCreateForm';

export default function UnifiedLabDipCreate() {
  // backPath goes to unified processing list, not dyeing-specific list
  return <LabDipBatchCreateForm backPath="/manufacturing/processing" />;
}
