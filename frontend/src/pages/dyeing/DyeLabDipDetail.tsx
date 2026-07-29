// Dye Lab Dip Detail Page - Thin wrapper around shared LabDipDetail
import LabDipDetail from '@/components/processing/LabDipDetail';

export default function DyeLabDipDetail() {
  return <LabDipDetail processType="DYEING" backPath="/manufacturing/dyeing" title="Dye Lab Dip Details" />;
}
