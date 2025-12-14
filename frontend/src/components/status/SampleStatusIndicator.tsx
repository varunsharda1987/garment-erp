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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'SUBMITTED':
      case 'SENT':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'FEEDBACK_PENDING':
      case 'REVISION_NEEDED':
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSampleTextColor = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
      case 'APPROVED_WITH_COMMENTS':
        return 'text-green-700';
      case 'REJECTED':
        return 'text-red-700';
      case 'SUBMITTED':
      case 'SENT':
        return 'text-blue-700';
      case 'FEEDBACK_PENDING':
      case 'REVISION_NEEDED':
        return 'text-amber-700';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-500 font-medium">Samples:</span>

      {/* FIT Sample */}
      {sampleStatus.fitSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.fitSample.status)}
          <span className={getSampleTextColor(sampleStatus.fitSample.status)}>
            FIT
          </span>
          {sampleStatus.fitSample.daysPending && sampleStatus.fitSample.daysPending > 0 && (
            <span className="text-gray-500">
              ({sampleStatus.fitSample.daysPending}d)
            </span>
          )}
        </div>
      )}

      {/* PP Sample */}
      {sampleStatus.ppSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.ppSample.status)}
          <span className={getSampleTextColor(sampleStatus.ppSample.status)}>
            PP
          </span>
          {sampleStatus.ppSample.daysPending && sampleStatus.ppSample.daysPending > 0 && (
            <span className="text-gray-500">
              ({sampleStatus.ppSample.daysPending}d)
            </span>
          )}
        </div>
      )}

      {/* Size Set Sample */}
      {sampleStatus.sizeSetSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.sizeSetSample.status)}
          <span className={getSampleTextColor(sampleStatus.sizeSetSample.status)}>
            Size Set
          </span>
          {sampleStatus.sizeSetSample.daysPending && sampleStatus.sizeSetSample.daysPending > 0 && (
            <span className="text-gray-500">
              ({sampleStatus.sizeSetSample.daysPending}d)
            </span>
          )}
        </div>
      )}

      {/* Shipment Sample */}
      {sampleStatus.shipmentSample.exists && (
        <div className="flex items-center gap-1">
          {getSampleIcon(sampleStatus.shipmentSample.status)}
          <span className={getSampleTextColor(sampleStatus.shipmentSample.status)}>
            Shipment
          </span>
          {sampleStatus.shipmentSample.daysPending && sampleStatus.shipmentSample.daysPending > 0 && (
            <span className="text-gray-500">
              ({sampleStatus.shipmentSample.daysPending}d)
            </span>
          )}
        </div>
      )}

      {!sampleStatus.fitSample.exists && !sampleStatus.ppSample.exists &&
       !sampleStatus.sizeSetSample.exists && !sampleStatus.shipmentSample.exists && (
        <span className="text-gray-400">No samples tracked</span>
      )}
    </div>
  );
}
