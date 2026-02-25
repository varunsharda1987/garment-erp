/**
 * ProcessesTab Component
 * Tab 3: Production Processes
 */

import { useStyleForm } from '../StyleFormContext';
import { PRODUCTION_PROCESSES } from '../types';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Checkbox } from '../../../../components/ui/checkbox';
import { cn } from '../../../../lib/utils';

interface ProcessesTabProps {
  onPrevious: () => void;
  onNext: () => void;
}

export function ProcessesTab({ onPrevious, onNext }: ProcessesTabProps) {
  const { state, toggleProcess, updateProcess } = useStyleForm();
  const { processes } = state;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Production Processes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Cutting, Stitching, Finishing, and Transportation are pre-selected
          </p>
        </div>

        <div className="space-y-3">
          {processes.map((process) => (
            <div
              key={process.processType}
              className={cn(
                'p-4 border rounded-lg transition-all',
                process.isRequired ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={process.isRequired}
                  onCheckedChange={() => toggleProcess(process.processType)}
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {PRODUCTION_PROCESSES.find(p => p.type === process.processType)?.label}
                  </div>
                  {process.isRequired && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={process.description || ''}
                          onChange={(e) => updateProcess(process.processType, 'description', e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Vendor</Label>
                        <Input
                          value={process.vendor || ''}
                          onChange={(e) => updateProcess(process.processType, 'vendor', e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Est. Cost (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={process.estimatedCost || ''}
                          onChange={(e) => updateProcess(process.processType, 'estimatedCost', e.target.value ? parseFloat(e.target.value) : 0)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" onClick={onNext}>
          Next: Accessories
        </Button>
      </div>
    </div>
  );
}
