// Print Lab Dip Detail Page - Thin wrapper around shared LabDipDetail
import LabDipDetail from '@/components/processing/LabDipDetail';

export default function PrintLabDipDetail() {
  return <LabDipDetail processType="PRINTING" backPath="/manufacturing/printing" title="Print Lab Dip Details" />;
}
