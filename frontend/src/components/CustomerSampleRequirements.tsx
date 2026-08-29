/**
 * CustomerSampleRequirements Component
 *
 * Manages sample type requirements for a customer.
 * Configures which sample types (FIT, PP, SIZE_SET, etc.) are required
 * and whether they block production.
 */

import { useState, useEffect } from 'react';
import { Save, TestTube, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { notify } from '../lib/notify';
import api from '@/lib/api';

const SAMPLE_TYPES = [
  { value: 'FIT_SAMPLE', label: 'FIT Sample', description: 'Initial fit approval sample', defaultBlocks: true, blocksLabel: 'Blocks Production' },
  { value: 'PP_SAMPLE', label: 'PP Sample', description: 'Pre-production sample', defaultBlocks: true, blocksLabel: 'Blocks Production' },
  { value: 'SIZE_SET_SAMPLE', label: 'Size Set Sample', description: 'Full size range sample', defaultBlocks: false, blocksLabel: 'Blocks Production' },
  { value: 'PHOTO_SAMPLE', label: 'Photo Sample', description: 'Sample for photography', defaultBlocks: false, blocksLabel: 'Required' },
  { value: 'PRODUCTION_SAMPLE', label: 'Production Sample', description: 'Production quality sample', defaultBlocks: false, blocksLabel: 'Required' },
  { value: 'SHIPMENT_SAMPLE', label: 'Shipment Sample', description: 'Pre-shipment sample', defaultBlocks: true, blocksLabel: 'Blocks Dispatch' },
] as const;

interface SampleRequirement {
  id?: string;
  sampleType: string;
  isRequired: boolean;
  blocksProduction: boolean;
  targetDaysToSend?: number | null;
  targetDaysToFeedback?: number | null;
}

interface CustomerSampleRequirementsProps {
  customerId: string;
  customerName: string;
}

export function CustomerSampleRequirements({ customerId, customerName }: CustomerSampleRequirementsProps) {
  const [requirements, setRequirements] = useState<Record<string, SampleRequirement>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: SampleRequirement[] }>(`/customers/${customerId}/sample-requirements`);

      // Convert array to map for easier access
      const reqMap: Record<string, SampleRequirement> = {};
      SAMPLE_TYPES.forEach(type => {
        const existing = response.data.data.find(r => r.sampleType === type.value);
        reqMap[type.value] = existing || {
          sampleType: type.value,
          isRequired: false,
          blocksProduction: type.defaultBlocks,
        };
      });
      setRequirements(reqMap);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load sample requirements:', error);
      notify.error('Failed to load sample requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequired = (sampleType: string, checked: boolean) => {
    setRequirements(prev => ({
      ...prev,
      [sampleType]: {
        ...prev[sampleType],
        isRequired: checked,
      },
    }));
    setHasChanges(true);
  };

  const handleToggleBlocks = (sampleType: string, checked: boolean) => {
    setRequirements(prev => ({
      ...prev,
      [sampleType]: {
        ...prev[sampleType],
        blocksProduction: checked,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const reqArray = Object.values(requirements).filter(r => r.isRequired);

      await api.put(`/customers/${customerId}/sample-requirements`, {
        requirements: reqArray,
      });

      notify.success('Sample requirements saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save sample requirements:', error);
      notify.error('Failed to save sample requirements');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading sample requirements...</p>
        </CardContent>
      </Card>
    );
  }

  const requiredCount = Object.values(requirements).filter(r => r.isRequired).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Sample Requirements</CardTitle>
              <CardDescription>
                Configure which samples are required for {customerName}
              </CardDescription>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save ({requiredCount} selected)
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {SAMPLE_TYPES.map(type => {
            const req = requirements[type.value];
            return (
              <div
                key={type.value}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  req?.isRequired ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`req-${type.value}`}
                    checked={req?.isRequired || false}
                    onCheckedChange={(checked) => handleToggleRequired(type.value, checked === true)}
                  />
                  <div>
                    <Label htmlFor={`req-${type.value}`} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>

                {req?.isRequired && type.blocksLabel !== 'Required' && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`blocks-${type.value}`}
                      checked={req?.blocksProduction || false}
                      onCheckedChange={(checked) => handleToggleBlocks(type.value, checked === true)}
                    />
                    <Label htmlFor={`blocks-${type.value}`} className="text-sm cursor-pointer">
                      {type.blocksLabel}
                    </Label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {requiredCount === 0 && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No sample types selected. Samples won't be auto-created for this customer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
