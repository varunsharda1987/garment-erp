/**
 * Processing Assign Dialog
 * Assign processors to PROCESSING material requirements with intelligent suggestions
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertTriangle, HelpCircle, Sparkles } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  suggestProcessorsForProcessing,
  bulkAssignProcessorsForProcessing,
  autoAssignProcessorsForProcessing,
  getProcessorSuppliers,
  getConfidenceBadgeColor,
} from '@/services/vendorSuggestion.service';
import type { ProcessingSuggestionForRequirement, ProcessorAssignmentInput } from '@/services/vendorSuggestion.service';

interface ProcessingAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementIds: string[];
  onComplete?: () => void;
}

export default function ProcessingAssignDialog({
  open,
  onOpenChange,
  requirementIds,
  onComplete,
}: ProcessingAssignDialogProps) {
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [suggestions, setSuggestions] = useState<ProcessingSuggestionForRequirement[]>([]);
  const [processors, setProcessors] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open && requirementIds.length > 0) {
      loadSuggestions();
      loadProcessors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementIds]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestProcessorsForProcessing(requirementIds);
      setSuggestions(response.suggestions);

      // Auto-populate assignments with suggestions or current processors
      const initialAssignments = new Map<string, string>();
      response.suggestions.forEach((s) => {
        if (s.suggestedProcessorId) {
          initialAssignments.set(s.requirementId, s.suggestedProcessorId);
        } else if (s.currentProcessorId) {
          initialAssignments.set(s.requirementId, s.currentProcessorId);
        }
      });
      setAssignments(initialAssignments);
    } catch (err) {
      handleApiError(err, 'Failed to load processor suggestions');
    } finally {
      setLoading(false);
    }
  };

  const loadProcessors = async () => {
    try {
      const data = await getProcessorSuppliers();
      setProcessors(data.processorList);
    } catch (err) {
      handleApiError(err, 'Failed to load processors');
    }
  };

  const handleAssignmentChange = (requirementId: string, processorId: string) => {
    const newAssignments = new Map(assignments);
    newAssignments.set(requirementId, processorId);
    setAssignments(newAssignments);
  };

  const handleAutoAssign = async () => {
    try {
      setAssigning(true);
      const result = await autoAssignProcessorsForProcessing(requirementIds, 'medium');
      handleApiSuccess(
        'Auto-Assignment Complete',
        `${result.assigned} processors assigned, ${result.skipped} skipped (low confidence)`
      );
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to auto-assign processors');
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async () => {
    try {
      setAssigning(true);

      const assignmentList: ProcessorAssignmentInput[] = Array.from(assignments.entries()).map(
        ([requirementId, processorId]) => ({
          requirementId,
          processorId,
        })
      );

      if (assignmentList.length === 0) {
        handleApiError(new Error('No assignments to save'), 'Please select processors');
        return;
      }

      const result = await bulkAssignProcessorsForProcessing(assignmentList);
      handleApiSuccess('Processors Assigned', `${result.updatedCount} processing requirements assigned to processors`);
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to assign processors');
    } finally {
      setAssigning(false);
    }
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <HelpCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const stats =
    suggestions.length > 0
      ? {
          high: suggestions.filter((s) => s.confidence === 'high').length,
          medium: suggestions.filter((s) => s.confidence === 'medium').length,
          low: suggestions.filter((s) => s.confidence === 'low').length,
          withSuggestion: suggestions.filter((s) => s.suggestedProcessorId !== null).length,
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Assign Processors</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Assign processors to {requirementIds.length} processing requirement(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">
              Analyzing requirements and suggesting processors...
            </span>
          </div>
        ) : (
          <>
            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{stats.high}</div>
                  <div className="text-xs text-green-600">High Confidence</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{stats.medium}</div>
                  <div className="text-xs text-yellow-600">Medium Confidence</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{stats.low}</div>
                  <div className="text-xs text-gray-600">Low Confidence</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{stats.withSuggestion}</div>
                  <div className="text-xs text-blue-600">With Suggestion</div>
                </div>
              </div>
            )}

            {/* Suggestions List */}
            <DialogDescription className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.requirementId}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors"
                >
                  {/* Material Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">
                        {suggestion.materialName || 'Unknown Material'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {suggestion.materialCode}
                        {suggestion.currentProcessorName && (
                          <span className="ml-2">
                            Current: <span className="font-medium">{suggestion.currentProcessorName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Confidence Badge */}
                    <Badge
                      variant="outline"
                      className={`${getConfidenceBadgeColor(suggestion.confidence)} flex items-center gap-1`}
                    >
                      {getConfidenceIcon(suggestion.confidence)}
                      {suggestion.confidence.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Suggestion Reason */}
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">{suggestion.reason}</div>

                  {/* Processor Selection */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-foreground min-w-[100px]">Assign to:</label>
                    <Select
                      value={assignments.get(suggestion.requirementId) || ''}
                      onValueChange={(value) => handleAssignmentChange(suggestion.requirementId, value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select processor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestion.suggestedProcessorId && (
                          <>
                            <SelectItem value={suggestion.suggestedProcessorId}>
                              {suggestion.suggestedProcessorName} (Suggested)
                            </SelectItem>
                            <div className="border-t my-1" />
                          </>
                        )}
                        {processors
                          .filter((p) => p.id !== suggestion.suggestedProcessorId)
                          .map((processor) => (
                            <SelectItem key={processor.id} value={processor.id}>
                              {processor.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alternatives */}
                  {suggestion.alternatives.length > 0 && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <span className="font-medium">Alternatives:</span>{' '}
                      {suggestion.alternatives.map((alt) => alt.processorName).join(', ')}
                    </div>
                  )}
                </div>
              ))}

              {suggestions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No processing requirements to assign</p>
                </div>
              )}
            </DialogDescription>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleAutoAssign}
              disabled={loading || assigning || suggestions.length === 0}
              className="flex-1 sm:flex-none"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Auto-Assigning...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Assign
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-2 flex-1 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={assigning}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleManualAssign}
              disabled={loading || assigning || assignments.size === 0}
              className="flex-1 sm:flex-none"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${assignments.size} Processor${assignments.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
