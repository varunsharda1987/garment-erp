// Dye Lab Dip Create Page - Thin wrapper around shared LabDipCreateForm
import LabDipCreateForm from '@/components/processing/LabDipCreateForm';

export default function DyeLabDipCreate() {
  return <LabDipCreateForm processType="DYEING" backPath="/manufacturing/dyeing" title="New Dye Lab Dip" />;
}
