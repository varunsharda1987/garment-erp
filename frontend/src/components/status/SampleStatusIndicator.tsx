import { CheckCircle, XCircle, Clock, Circle } from 'lucide-react';
import type { ProductionStatusItem } from '@/types/productionStatus.types';

interface SampleStatusIndicatorProps {
  sampleStatus: ProductionStatusItem['sampleStatus'];
}

export default function SampleStatusIndicator({ sampleStatus }: SampleStatusIndicatorProps) {
  const getSampleIcon = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
      case 'APPROVED_WITH_COMMENTS':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'SUBMITTED':
      case 'SENT':
        return <Clock className="h-4 w-4 text-info" />;
      case 'FEEDBACK_PENDING':
      case 'REVISION_NEEDED':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSampleTextColor = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
      case 'APPROVED_WITH_COMMENTS':
        return 'text-success';
      case 'REJECTED':
        return 'text-destructive';
      case 'SUBMITTED':
      case 'SENT':
        return 'text-info';
      case 'FEEDBACK_PENDING':
      case 'REVISION_NEEDED':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted-foreground font-medium">Samples:</span>

      {/* FIT Sample */}
      {sampleStatus.fitSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.fitSample.status)}
          <span className={getSampleTextColor(sampleStatus.fitSample.status)}>FIT</span>
          {sampleStatus.fitSample.daysPending && sampleStatus.fitSample.daysPending > 0 && (
            <span className="text-muted-foreground">({sampleStatus.fitSample.daysPending}d)</span>
          )}
        </div>
      )}

      {/* PP Sample */}
      {sampleStatus.ppSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.ppSample.status)}
          <span className={getSampleTextColor(sampleStatus.ppSample.status)}>PP</span>
          {sampleStatus.ppSample.daysPending && sampleStatus.ppSample.daysPending > 0 && (
            <span className="text-muted-foreground">({sampleStatus.ppSample.daysPending}d)</span>
          )}
        </div>
      )}

      {/* Size Set Sample */}
      {sampleStatus.sizeSetSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.sizeSetSample.status)}
          <span className={getSampleTextColor(sampleStatus.sizeSetSample.status)}>Size Set</span>
          {sampleStatus.sizeSetSample.daysPending && sampleStatus.sizeSetSample.daysPending > 0 && (
            <span className="text-muted-foreground">({sampleStatus.sizeSetSample.daysPending}d)</span>
          )}
        </div>
      )}

      {/* Shipment Sample */}
      {sampleStatus.shipmentSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.shipmentSample.status)}
          <span className={getSampleTextColor(sampleStatus.shipmentSample.status)}>Shipment</span>
          {sampleStatus.shipmentSample.daysPending && sampleStatus.shipmentSample.daysPending > 0 && (
            <span className="text-muted-foreground">({sampleStatus.shipmentSample.daysPending}d)</span>
          )}
        </div>
      )}

      {!sampleStatus.fitSample.exists &&
        !sampleStatus.ppSample.exists &&
        !sampleStatus.sizeSetSample.exists &&
        !sampleStatus.shipmentSample.exists && <span className="text-muted-foreground">No samples tracked</span>}
    </div>
  );
}
