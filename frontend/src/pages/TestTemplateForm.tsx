// Test Template Create/Edit Form
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { testTemplatesService } from '@/services/testing.service';
import type { CreateTestTemplateInput, TestTemplateType, ToleranceRanges } from '@/types/testing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export default function TestTemplateForm() {
  const navigate = useNavigate();

  // Form state
  const [templateCode, setTemplateCode] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<TestTemplateType>('FPT');
  const [description, setDescription] = useState('');
  const [testingStandards, setTestingStandards] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Required params
  const [requiredParams, setRequiredParams] = useState<string[]>([]);
  const [newRequiredParam, setNewRequiredParam] = useState('');

  // Optional params
  const [optionalParams, setOptionalParams] = useState<string[]>([]);
  const [newOptionalParam, setNewOptionalParam] = useState('');

  // Tolerance ranges
  const [toleranceGSMMin, setToleranceGSMMin] = useState<number | undefined>();
  const [toleranceGSMMax, setToleranceGSMMax] = useState<number | undefined>();
  const [toleranceShrinkageLengthMin, setToleranceShrinkageLengthMin] = useState<number | undefined>();
  const [toleranceShrinkageLengthMax, setToleranceShrinkageLengthMax] = useState<number | undefined>();
  const [toleranceShrinkageWidthMin, setToleranceShrinkageWidthMin] = useState<number | undefined>();
  const [toleranceShrinkageWidthMax, setToleranceShrinkageWidthMax] = useState<number | undefined>();

  // Add required param
  const addRequiredParam = () => {
    const trimmed = newRequiredParam.trim();
    if (trimmed && !requiredParams.includes(trimmed)) {
      setRequiredParams([...requiredParams, trimmed]);
      setNewRequiredParam('');
    }
  };

  const removeRequiredParam = (param: string) => {
    setRequiredParams(requiredParams.filter((p) => p !== param));
  };

  // Add optional param
  const addOptionalParam = () => {
    const trimmed = newOptionalParam.trim();
    if (trimmed && !optionalParams.includes(trimmed)) {
      setOptionalParams([...optionalParams, trimmed]);
      setNewOptionalParam('');
    }
  };

  const removeOptionalParam = (param: string) => {
    setOptionalParams(optionalParams.filter((p) => p !== param));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTestTemplateInput) => testTemplatesService.create(data),
    onSuccess: () => {
      handleApiSuccess('Test template created successfully');
      navigate('/test-templates');
    },
    onError: (err) => handleApiError(err, 'Failed to create test template'),
  });

  const handleSubmit = () => {
    if (!templateCode.trim()) {
      handleApiError(new Error('Missing template code'), 'Please enter a template code');
      return;
    }

    if (!templateName.trim()) {
      handleApiError(new Error('Missing template name'), 'Please enter a template name');
      return;
    }

    if (requiredParams.length === 0) {
      handleApiError(new Error('No required parameters'), 'Please add at least one required parameter');
      return;
    }

    // Build tolerance ranges
    const toleranceRanges: ToleranceRanges = {};
    if (toleranceGSMMin !== undefined || toleranceGSMMax !== undefined) {
      toleranceRanges.gsm = {
        min: toleranceGSMMin,
        max: toleranceGSMMax,
        unit: 'gsm',
      };
    }
    if (toleranceShrinkageLengthMin !== undefined || toleranceShrinkageLengthMax !== undefined) {
      toleranceRanges.shrinkageLength = {
        min: toleranceShrinkageLengthMin,
        max: toleranceShrinkageLengthMax,
        unit: '%',
      };
    }
    if (toleranceShrinkageWidthMin !== undefined || toleranceShrinkageWidthMax !== undefined) {
      toleranceRanges.shrinkageWidth = {
        min: toleranceShrinkageWidthMin,
        max: toleranceShrinkageWidthMax,
        unit: '%',
      };
    }

    const request: CreateTestTemplateInput = {
      templateCode: templateCode.trim(),
      templateName: templateName.trim(),
      templateType,
      requiredParams,
      optionalParams: optionalParams.length > 0 ? optionalParams : undefined,
      toleranceRanges: Object.keys(toleranceRanges).length > 0 ? toleranceRanges : undefined,
      description: description.trim() || undefined,
      testingStandards: testingStandards.trim() || undefined,
      isActive,
    };

    createMutation.mutate(request);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/test-templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">New Test Template</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create a reusable test template for FPT or GPT</p>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Template identification and type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="templateCode">Template Code *</Label>
              <Input
                id="templateCode"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
                placeholder="e.g., FPT-GSM-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard GSM Test"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template Type *</Label>
            <RadioGroup
              value={templateType}
              onValueChange={(v) => setTemplateType(v as TestTemplateType)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FPT" id="fpt" />
                <Label htmlFor="fpt" className="cursor-pointer">
                  FPT (Fabric Physical Test)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="GPT" id="gpt" />
                <Label htmlFor="gpt" className="cursor-pointer">
                  GPT (Garment Physical Test)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Required Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Required Parameters *</CardTitle>
          <CardDescription>Parameters that must be tested (at least one required)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newRequiredParam}
              onChange={(e) => setNewRequiredParam(e.target.value)}
              placeholder="e.g., GSM, Shrinkage, Color Fastness"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRequiredParam();
                }
              }}
            />
            <Button type="button" onClick={addRequiredParam} variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {requiredParams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {requiredParams.map((param) => (
                <Badge key={param} variant="secondary" className="gap-1">
                  {param}
                  <button onClick={() => removeRequiredParam(param)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {requiredParams.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add parameters like: GSM, Shrinkage Length, Shrinkage Width, Color Fastness, Tensile Strength, etc.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Optional Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Optional Parameters</CardTitle>
          <CardDescription>Additional parameters that may be tested</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newOptionalParam}
              onChange={(e) => setNewOptionalParam(e.target.value)}
              placeholder="e.g., Pilling, Spirality, Appearance"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOptionalParam();
                }
              }}
            />
            <Button type="button" onClick={addOptionalParam} variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {optionalParams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {optionalParams.map((param) => (
                <Badge key={param} variant="outline" className="gap-1">
                  {param}
                  <button onClick={() => removeOptionalParam(param)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tolerance Ranges */}
      <Card>
        <CardHeader>
          <CardTitle>Tolerance Ranges</CardTitle>
          <CardDescription>Acceptable min/max values for key parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* GSM Tolerance */}
            <div className="space-y-2">
              <Label>GSM Tolerance</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={toleranceGSMMin ?? ''}
                  onChange={(e) => setToleranceGSMMin(e.target.value ? parseFloat(e.target.value) : undefined)}
                />
                <span className="self-center">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={toleranceGSMMax ?? ''}
                  onChange={(e) => setToleranceGSMMax(e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            {/* Shrinkage Length */}
            <div className="space-y-2">
              <Label>Shrinkage Length (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={toleranceShrinkageLengthMin ?? ''}
                  onChange={(e) =>
                    setToleranceShrinkageLengthMin(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                />
                <span className="self-center">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={toleranceShrinkageLengthMax ?? ''}
                  onChange={(e) =>
                    setToleranceShrinkageLengthMax(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                />
              </div>
            </div>

            {/* Shrinkage Width */}
            <div className="space-y-2">
              <Label>Shrinkage Width (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={toleranceShrinkageWidthMin ?? ''}
                  onChange={(e) =>
                    setToleranceShrinkageWidthMin(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                />
                <span className="self-center">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={toleranceShrinkageWidthMax ?? ''}
                  onChange={(e) =>
                    setToleranceShrinkageWidthMax(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description & Standards */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
          <CardDescription>Description and testing standards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and scope of this test template..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testingStandards">Testing Standards</Label>
            <Input
              id="testingStandards"
              value={testingStandards}
              onChange={(e) => setTestingStandards(e.target.value)}
              placeholder="e.g., ASTM D3776, ISO 5084"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/test-templates')}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            createMutation.isPending || !templateCode.trim() || !templateName.trim() || requiredParams.length === 0
          }
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Template
        </Button>
      </div>
    </div>
  );
}
