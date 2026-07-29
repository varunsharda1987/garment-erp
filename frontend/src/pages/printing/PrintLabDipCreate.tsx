// Print Lab Dip Create Page - Thin wrapper around shared LabDipCreateForm
import LabDipCreateForm from '@/components/processing/LabDipCreateForm';

export default function PrintLabDipCreate() {
  return <LabDipCreateForm processType="PRINTING" backPath="/manufacturing/printing" title="New Print Lab Dip" />;
}
