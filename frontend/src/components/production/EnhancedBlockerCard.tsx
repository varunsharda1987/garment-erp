import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, CheckCircle, Clock } from 'lucide-react';

interface BlockerInfo {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  daysStuck?: number | null;
  styleId?: string;
  sampleId?: string;
  testId?: string;
}

interface EnhancedBlockerCardProps {
  blocker: BlockerInfo;
  orderItemId: string;
  onResolve?: () => void;
}

const getResolutionSteps = (blockerType: string): string[] => {
  const resolutionMap: Record<string, string[]> = {
    FIT_SAMPLE_NOT_APPROVED: [
      'Navigate to Samples page for this style',
      'Review FIT sample details and measurements',
      'If measurements are acceptable, approve the sample',
      'Sample approval will automatically unblock printing/dyeing stages',
    ],
    PP_SAMPLE_NOT_APPROVED: [
      'Navigate to Samples page for this style',
      'Review PP (Pre-Production) sample',
      'Verify quality and construction details',
      'Approve sample to proceed with SIZE_SET sample creation',
    ],
    SIZE_SET_SAMPLE_NOT_APPROVED: [
      'Navigate to Samples page for this style',
      'Review SIZE_SET sample for all sizes',
      'Verify grading and fit across size range',
      'Approve sample to unblock cutting and subsequent stages',
    ],
    FPT_NOT_PASSED: [
      'Navigate to Testing module and locate the FPT record',
      'Review fabric physical test results',
      'If failed: Work with supplier to improve fabric quality',
      'If acceptable with justification: Admin can override with reason',
      'Mark test as PASS to unblock production',
    ],
    GPT_NOT_PASSED: [
      'Navigate to Testing module and locate the GPT record',
      'Review garment physical test results',
      'If failed: Identify and fix construction/quality issues',
      'If acceptable with justification: Admin can override with reason',
      'Mark test as PASS to unblock production',
    ],
    FIT_SAMPLE_REQUIRED: [
      'Navigate to Styles page and open the style',
      'Create a FIT sample first',
      'FIT sample must be approved before creating PP sample',
    ],
    PP_SAMPLE_REQUIRED: [
      'Navigate to Styles page and open the style',
      'Create a PP (Pre-Production) sample',
      'PP sample must be approved before creating SIZE_SET sample',
    ],
  };

  return (
    resolutionMap[blockerType] || [
      'Review the blocker message for specific requirements',
      'Contact production manager if unsure how to proceed',
      'Admin users can override with valid business justification',
    ]
  );
};

const getActionButton = (blocker: BlockerInfo, navigate: ReturnType<typeof useNavigate>): React.ReactNode | null => {
  switch (blocker.type) {
    case 'FIT_SAMPLE_NOT_APPROVED':
    case 'PP_SAMPLE_NOT_APPROVED':
    case 'SIZE_SET_SAMPLE_NOT_APPROVED':
      if (blocker.styleId) {
        return (
          <Button size="sm" variant="outline" onClick={() => navigate(`/styles/${blocker.styleId}`)} className="gap-1">
            <ExternalLink className="h-3 w-3" />
            View Style & Samples
          </Button>
        );
      }
      return null;

    case 'FPT_NOT_PASSED':
      if (blocker.testId) {
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/testing?testId=${blocker.testId}&type=FPT`)}
            className="gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View FPT Results
          </Button>
        );
      }
      return (
        <Button size="sm" variant="outline" onClick={() => navigate('/testing')} className="gap-1">
          <ExternalLink className="h-3 w-3" />
          Go to Testing
        </Button>
      );

    case 'GPT_NOT_PASSED':
      if (blocker.testId) {
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/testing?testId=${blocker.testId}&type=GPT`)}
            className="gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View GPT Results
          </Button>
        );
      }
      return (
        <Button size="sm" variant="outline" onClick={() => navigate('/testing')} className="gap-1">
          <ExternalLink className="h-3 w-3" />
          Go to Testing
        </Button>
      );

    case 'FIT_SAMPLE_REQUIRED':
    case 'PP_SAMPLE_REQUIRED':
      if (blocker.styleId) {
        return (
          <Button size="sm" variant="outline" onClick={() => navigate(`/styles/${blocker.styleId}`)} className="gap-1">
            <ExternalLink className="h-3 w-3" />
            Create Sample
          </Button>
        );
      }
      return null;

    default:
      return null;
  }
};

const getSeverityConfig = (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
  switch (severity) {
    case 'CRITICAL':
      return {
        borderColor: 'border-destructive',
        bgColor: 'bg-destructive/10',
        iconColor: 'text-destructive',
        badgeBg: 'bg-destructive/10',
        badgeText: 'text-destructive',
      };
    case 'HIGH':
      return {
        borderColor: 'border-primary',
        bgColor: 'bg-primary/10',
        iconColor: 'text-primary',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
      };
    case 'MEDIUM':
      return {
        borderColor: 'border-warning',
        bgColor: 'bg-warning-muted',
        iconColor: 'text-warning',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-800',
      };
    case 'LOW':
      return {
        borderColor: 'border-border',
        bgColor: 'bg-muted',
        iconColor: 'text-muted-foreground',
        badgeBg: 'bg-muted',
        badgeText: 'text-foreground',
      };
  }
};

const EnhancedBlockerCard: React.FC<EnhancedBlockerCardProps> = ({ blocker }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const severityConfig = getSeverityConfig(blocker.severity);
  const actionButton = getActionButton(blocker, navigate);
  const resolutionSteps = getResolutionSteps(blocker.type);

  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-all duration-200',
        severityConfig.borderColor,
        severityConfig.bgColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <AlertCircle className={cn('h-5 w-5 mt-0.5 flex-shrink-0', severityConfig.iconColor)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded',
                  severityConfig.badgeBg,
                  severityConfig.badgeText
                )}
              >
                {blocker.severity}
              </span>
              {blocker.daysStuck != null && blocker.daysStuck > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Stuck for {blocker.daysStuck} {blocker.daysStuck === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>
            <p className="font-medium text-sm text-foreground break-words">{blocker.message}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actionButton}
          <Button size="sm" variant="ghost" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Blocker Type */}
          <div className="text-xs">
            <p className="font-semibold text-foreground mb-1">Blocker Type:</p>
            <p className="text-muted-foreground font-mono bg-card px-2 py-1 rounded border border-border">
              {blocker.type}
            </p>
          </div>

          {/* Resolution Steps */}
          <div className="text-xs">
            <p className="font-semibold text-foreground mb-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Resolution Steps:
            </p>
            <ol className="list-decimal list-inside text-foreground space-y-1.5 bg-card px-3 py-2 rounded border border-border">
              {resolutionSteps.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Admin Note */}
          <div className="text-xs bg-info-muted border border-info/20 rounded p-2">
            <p className="text-info">
              <span className="font-semibold">Note:</span> Admin users can override this blocker with a valid business
              justification. All overrides are logged and auditable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedBlockerCard;
