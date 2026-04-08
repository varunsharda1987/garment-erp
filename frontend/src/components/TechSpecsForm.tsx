/**
 * Tech Specs Form Component
 * Form for editing style technical specifications
 */

import { useState, useEffect, useCallback } from 'react';
import { Ruler, Shirt, Save, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { techSpecsService } from '@/services/techSpecs.service';
import type { SleeveType, CollarType, FitType, ClosureType } from '@/types/techSpecs.types';

interface TechSpecsFormProps {
  styleId: string;
  styleCode: string;
  editable?: boolean;
}

// Import labels
import {
  SLEEVE_TYPE_LABELS as sleeveLabels,
  COLLAR_TYPE_LABELS as collarLabels,
  FIT_TYPE_LABELS as fitLabels,
  CLOSURE_TYPE_LABELS as closureLabels,
} from '@/types/techSpecs.types';

export function TechSpecsForm({ styleId, styleCode, editable = true }: TechSpecsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [overallLength, setOverallLength] = useState<string>('');
  const [topLength, setTopLength] = useState<string>('');
  const [bottomLength, setBottomLength] = useState<string>('');
  const [lengthUnit, setLengthUnit] = useState<string>('inches');
  const [sleeveType, setSleeveType] = useState<SleeveType | ''>('');
  const [collarType, setCollarType] = useState<CollarType | ''>('');
  const [fitType, setFitType] = useState<FitType | ''>('');
  const [closureType, setClosureType] = useState<ClosureType | ''>('');
  const [designNotes, setDesignNotes] = useState<string>('');
  const [constructionNotes, setConstructionNotes] = useState<string>('');

  // Load existing specs
  const loadSpecs = useCallback(async () => {
    try {
      setLoading(true);
      const specs = await techSpecsService.getByStyleId(styleId);
      if (specs) {
        setOverallLength(specs.overallLength?.toString() || '');
        setTopLength(specs.topLength?.toString() || '');
        setBottomLength(specs.bottomLength?.toString() || '');
        setLengthUnit(specs.lengthUnit || 'inches');
        setSleeveType(specs.sleeveType || '');
        setCollarType(specs.collarType || '');
        setFitType(specs.fitType || '');
        setClosureType(specs.closureType || '');
        setDesignNotes(specs.designNotes || '');
        setConstructionNotes(specs.constructionNotes || '');
      }
    } catch (error) {
      console.error('Failed to load tech specs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load technical specifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [styleId, toast]);

  useEffect(() => {
    loadSpecs();
  }, [loadSpecs]);

  // Mark changes
  const handleChange = () => {
    setHasChanges(true);
  };

  // Save specs
  const handleSave = async () => {
    try {
      setSaving(true);
      await techSpecsService.save(styleId, {
        overallLength: overallLength ? parseFloat(overallLength) : null,
        topLength: topLength ? parseFloat(topLength) : null,
        bottomLength: bottomLength ? parseFloat(bottomLength) : null,
        lengthUnit,
        sleeveType: sleeveType || null,
        collarType: collarType || null,
        fitType: fitType || null,
        closureType: closureType || null,
        designNotes: designNotes || null,
        constructionNotes: constructionNotes || null,
      });
      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Technical specifications saved',
      });
    } catch (error) {
      console.error('Failed to save tech specs:', error);
      toast({
        title: 'Error',
        description: 'Failed to save technical specifications',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate Tech Pack PDF
  const handleGeneratePDF = async () => {
    try {
      setGenerating(true);
      await techSpecsService.downloadTechPackPDF(styleId, styleCode);
      toast({
        title: 'Success',
        description: 'Tech Pack PDF downloaded',
      });
    } catch (error) {
      console.error('Failed to generate tech pack:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate Tech Pack PDF',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Technical Specifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Technical Specifications
          </CardTitle>
          <CardDescription>Basic measurements and style details for production</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGeneratePDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Tech Pack PDF
          </Button>
          {editable && (
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Measurements Section */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Basic Measurements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Overall Length</Label>
              <Input
                type="number"
                step="0.5"
                value={overallLength}
                onChange={(e) => {
                  setOverallLength(e.target.value);
                  handleChange();
                }}
                placeholder="e.g., 28"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Top Length</Label>
              <Input
                type="number"
                step="0.5"
                value={topLength}
                onChange={(e) => {
                  setTopLength(e.target.value);
                  handleChange();
                }}
                placeholder="For two-part"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Bottom Length</Label>
              <Input
                type="number"
                step="0.5"
                value={bottomLength}
                onChange={(e) => {
                  setBottomLength(e.target.value);
                  handleChange();
                }}
                placeholder="For two-part"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={lengthUnit}
                onValueChange={(v) => {
                  setLengthUnit(v);
                  handleChange();
                }}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inches">Inches</SelectItem>
                  <SelectItem value="cm">Centimeters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Style Details Section */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Shirt className="h-4 w-4" />
            Style Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Sleeve Type</Label>
              <Select
                value={sleeveType}
                onValueChange={(v) => {
                  setSleeveType(v as SleeveType);
                  handleChange();
                }}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {Object.entries(sleeveLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Collar/Neckline</Label>
              <Select
                value={collarType}
                onValueChange={(v) => {
                  setCollarType(v as CollarType);
                  handleChange();
                }}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {Object.entries(collarLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fit Type</Label>
              <Select
                value={fitType}
                onValueChange={(v) => {
                  setFitType(v as FitType);
                  handleChange();
                }}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {Object.entries(fitLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Closure Type</Label>
              <Select
                value={closureType}
                onValueChange={(v) => {
                  setClosureType(v as ClosureType);
                  handleChange();
                }}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {Object.entries(closureLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Notes Section */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Design Notes</Label>
              <Textarea
                value={designNotes}
                onChange={(e) => {
                  setDesignNotes(e.target.value);
                  handleChange();
                }}
                placeholder="Design intent, inspiration, special features..."
                rows={4}
                disabled={!editable}
              />
            </div>

            <div className="space-y-2">
              <Label>Construction Notes</Label>
              <Textarea
                value={constructionNotes}
                onChange={(e) => {
                  setConstructionNotes(e.target.value);
                  handleChange();
                }}
                placeholder="Seam allowances, finishing instructions..."
                rows={4}
                disabled={!editable}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TechSpecsForm;
