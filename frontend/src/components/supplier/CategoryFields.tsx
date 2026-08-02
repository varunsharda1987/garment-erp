// Category-Specific Fields for Supplier Form
// BUG-SP2: All 17 supplier categories are implemented (verified 2026-08-02).
// Categories: FABRIC_SUPPLIER, GREIGE_SUPPLIER, LACE_SUPPLIER, TRIMS_SUPPLIER,
// THREAD_SUPPLIER, PACKAGING_SUPPLIER, DYEING_PRINTING, EMBROIDERY, HAND_WORK,
// SMOCKING, CMT_UNIT, OTHER_SERVICES, FINISHING_CONTRACTOR, STITCHING_CONTRACTOR,
// WASHING, DORI_PIPING_CONTRACTOR, MACHINE_PARTS_SUPPLIER
import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { greigeService, fabricService } from '../../services/fabricGreigeService';
import { logError } from '../../lib/logger';
import type { GreigeMaster, FabricMaster } from '../../types/fabric-greige.types';
import type { SupplierCategory, TrimsSupplierItem } from '../../types/supplier.types';

// Normalized fabric type for unified display
interface NormalizedFabric {
  id: string;
  code: string;
  name: string;
  type: 'Greige' | 'Finished';
  width: number | string | null;
}

// Category field value types - must be compatible with all possible field values
type FieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | Record<string, unknown>[]
  | (string | Record<string, unknown>)[];

// Category data type - a record of field names to their values
type SupplierCategoryData = Record<string, FieldValue | Record<string, FieldValue>>;

// Helper functions to safely extract typed values from SupplierCategoryData
type DataValue = FieldValue | Record<string, FieldValue>;

const asInputValue = (value: DataValue): string | number => {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'object') return '';
  return value;
};

const asBoolean = (value: DataValue): boolean => {
  if (typeof value === 'boolean') return value;
  return false;
};

const asArray = <T,>(value: DataValue): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const asObject = <T,>(value: DataValue): T | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  return undefined;
};

interface CategoryFieldsProps {
  category: SupplierCategory;
  data: SupplierCategoryData;
  onChange: (data: SupplierCategoryData) => void;
}

// Props interface for basic category field components
interface BasicCategoryFieldProps {
  data: SupplierCategoryData;
  updateField: (field: string, value: FieldValue) => void;
}

// Array item type for addArrayItem/updateArrayItem
type ArrayItemValue = string | Record<string, unknown>;

// Props interface for category fields with array operations
interface ArrayCategoryFieldProps extends BasicCategoryFieldProps {
  addArrayItem: (field: string, defaultValue: ArrayItemValue) => void;
  updateArrayItem: (field: string, index: number, value: ArrayItemValue) => void;
  removeArrayItem: (field: string, index: number) => void;
}

// Props interface for category fields with nested operations
interface NestedCategoryFieldProps extends ArrayCategoryFieldProps {
  updateNestedField: (parent: string, field: string, value: FieldValue) => void;
}

export default function CategoryFields({ category, data, onChange }: CategoryFieldsProps) {
  const updateField = (field: string, value: FieldValue) => {
    onChange({ ...data, [field]: value });
  };

  const updateNestedField = (parent: string, field: string, value: FieldValue) => {
    const parentObj = data[parent] as Record<string, FieldValue> | undefined;
    onChange({
      ...data,
      [parent]: {
        ...(parentObj || {}),
        [field]: value,
      },
    });
  };

  const addArrayItem = (field: string, defaultValue: ArrayItemValue) => {
    const current = (data[field] || []) as ArrayItemValue[];
    onChange({ ...data, [field]: [...current, defaultValue] });
  };

  const updateArrayItem = (field: string, index: number, value: ArrayItemValue) => {
    const current = [...((data[field] || []) as ArrayItemValue[])];
    current[index] = value;
    onChange({ ...data, [field]: current });
  };

  const removeArrayItem = (field: string, index: number) => {
    const current = (data[field] || []) as ArrayItemValue[];
    onChange({ ...data, [field]: current.filter((_, i: number) => i !== index) });
  };

  // Render fields based on category
  switch (category) {
    case 'FABRIC_SUPPLIER':
      return <FabricFields data={data} updateField={updateField} />;

    case 'GREIGE_SUPPLIER':
      return <GreigeFields data={data} updateField={updateField} />;

    case 'LACE_SUPPLIER':
      return (
        <LaceFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'TRIMS_SUPPLIER':
      return (
        <TrimsFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'THREAD_SUPPLIER':
      return (
        <ThreadFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'PACKAGING_SUPPLIER':
      return (
        <PackagingFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'DYEING_PRINTING':
      return (
        <DyeingPrintingFields
          data={data}
          updateField={updateField}
          updateNestedField={updateNestedField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'EMBROIDERY':
      return (
        <EmbroideryFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'HAND_WORK':
      return (
        <HandWorkFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'SMOCKING':
      return (
        <SmockingFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'CMT_UNIT':
      return (
        <CMTFields
          data={data}
          updateField={updateField}
          updateNestedField={updateNestedField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'OTHER_SERVICES':
      return (
        <OtherServicesFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'FINISHING_CONTRACTOR':
      return (
        <FinishingContractorFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'STITCHING_CONTRACTOR':
      return (
        <StitchingContractorFields
          data={data}
          updateField={updateField}
          updateNestedField={updateNestedField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'WASHING':
      return (
        <WashingFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'DORI_PIPING_CONTRACTOR':
      return (
        <DoriPipingContractorFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    case 'MACHINE_PARTS_SUPPLIER':
      return (
        <MachinePartsSupplierFields
          data={data}
          updateField={updateField}
          addArrayItem={addArrayItem}
          updateArrayItem={updateArrayItem}
          removeArrayItem={removeArrayItem}
        />
      );

    default:
      return null;
  }
}

// 1. FABRIC SUPPLIER FIELDS
function FabricFields({ data, updateField }: BasicCategoryFieldProps) {
  const [greigeFabrics, setGreigeFabrics] = useState<GreigeMaster[]>([]);
  const [finishedFabrics, setFinishedFabrics] = useState<FabricMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fabricIds = (data.fabricIds || []) as string[];

  // Load all fabrics
  useEffect(() => {
    const loadFabrics = async () => {
      try {
        setIsLoading(true);
        const [greigeResponse, finishedResponse] = await Promise.all([
          greigeService.getAll({ limit: 100 }),
          fabricService.getAll({ limit: 100 }),
        ]);
        setGreigeFabrics(greigeResponse.data);
        setFinishedFabrics(finishedResponse.data);
      } catch (error) {
        logError('Failed to load fabrics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFabrics();
  }, []);

  // Combine and filter fabrics
  const allFabrics: NormalizedFabric[] = [
    ...greigeFabrics.map((g) => ({
      id: g.id,
      code: g.greigeCode,
      name: g.greigeName,
      type: 'Greige' as const,
      width: g.greigeWidth,
    })),
    ...finishedFabrics.map((f) => ({
      id: f.id,
      code: f.fabricCode,
      name: f.fabricName,
      type: 'Finished' as const,
      width: f.actualWidth,
    })),
  ];

  const filteredFabrics = searchTerm
    ? allFabrics.filter(
        (f) =>
          f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allFabrics;

  const toggleFabric = (fabricId: string) => {
    const newFabricIds = fabricIds.includes(fabricId)
      ? fabricIds.filter((id: string) => id !== fabricId)
      : [...fabricIds, fabricId];
    updateField('fabricIds', newFabricIds);
  };

  const removeFabric = (fabricId: string) => {
    updateField(
      'fabricIds',
      fabricIds.filter((id: string) => id !== fabricId)
    );
  };

  // Get selected fabric details
  const selectedFabrics = fabricIds
    .map((id: string) => allFabrics.find((f) => f.id === id))
    .filter((f): f is NormalizedFabric => f !== undefined);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Fabric Supplier Details</h3>

      {/* Selected Fabrics */}
      <div>
        <Label>Fabrics Supplied ({selectedFabrics.length})</Label>
        {selectedFabrics.length > 0 ? (
          <div className="mt-2 space-y-2">
            {selectedFabrics.map((fabric) => (
              <div key={fabric.id} className="flex items-center justify-between bg-muted p-3 rounded-md">
                <div>
                  <span className="font-medium">{fabric.code}</span>
                  <span className="text-muted-foreground ml-2">{fabric.name}</span>
                  <span className="text-xs ml-2 px-2 py-1 rounded bg-info-muted text-info">{fabric.type}</span>
                  <span className="text-xs text-muted-foreground ml-2">Width: {Number(fabric.width)}"</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeFabric(fabric.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">No fabrics selected. Search and select fabrics below.</p>
        )}
      </div>

      {/* Fabric Search & Selection */}
      <div>
        <Label>Add Fabrics from Greige/Finished Fabric Masters</Label>
        <Input
          type="text"
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-2"
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground mt-2">Loading fabrics...</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto border rounded-md">
            {filteredFabrics.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No fabrics found</p>
            ) : (
              <div className="divide-y">
                {filteredFabrics.slice(0, 50).map((fabric) => (
                  <label key={fabric.id} className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fabricIds.includes(fabric.id)}
                      onChange={() => toggleFabric(fabric.id)}
                    />
                    <div className="flex-1">
                      <div>
                        <span className="font-medium">{fabric.code}</span>
                        <span className="text-muted-foreground ml-2">{fabric.name}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-info-muted text-info">{fabric.type}</span>
                        <span className="text-xs text-muted-foreground">Width: {Number(fabric.width)}"</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {filteredFabrics.length > 50 && (
          <p className="text-xs text-muted-foreground mt-1">Showing first 50 results. Use search to narrow down.</p>
        )}
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
          placeholder="Any special notes about this supplier's fabric capabilities..."
        />
      </div>
    </div>
  );
}

// Continue with other category components in next message due to token limit...
// I'll create simplified versions of the remaining categories

function TrimsFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: ArrayCategoryFieldProps) {
  const items = asArray<TrimsSupplierItem>(data.items);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Trims Supplier Details</h3>

      <div>
        <Label>Items Supplied</Label>
        <div className="space-y-2 mt-2">
          {items.map((item: TrimsSupplierItem, index: number) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  value={item.itemName}
                  onChange={(e) => updateArrayItem('items', index, { ...item, itemName: e.target.value })}
                  placeholder="Item name (e.g., Buttons, Thread)"
                />
              </div>
              <div className="w-32">
                <Input
                  value={item.unit}
                  onChange={(e) => updateArrayItem('items', index, { ...item, unit: e.target.value })}
                  placeholder="Unit"
                />
              </div>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('items', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === items.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('items', { itemName: '', unit: '' })}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('items', { itemName: '', unit: '' })}>
              + Add Item
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.customizationAvailable)}
            onChange={(e) => updateField('customizationAvailable', e.target.checked)}
          />
          <span>Customization Available</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.designColorMatching)}
            onChange={(e) => updateField('designColorMatching', e.target.checked)}
          />
          <span>Design/Color Matching</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 3. DYEING & PRINTING FIELDS
interface DyeingPrintingServices {
  dyeing: boolean;
  printing: boolean;
}
function DyeingPrintingFields({
  data,
  updateField,
  updateNestedField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: NestedCategoryFieldProps) {
  const services = asObject<DyeingPrintingServices>(data.services) || { dyeing: false, printing: false };
  const dyeingTechniques = asArray<string>(data.dyeingTechniques);
  const printingTechniques = asArray<string>(data.printingTechniques);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Dyeing & Printing Details</h3>

      {/* Services */}
      <div>
        <Label>Services Offered</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={services.dyeing}
              onChange={(e) => updateNestedField('services', 'dyeing', e.target.checked)}
            />
            <span>Dyeing</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={services.printing}
              onChange={(e) => updateNestedField('services', 'printing', e.target.checked)}
            />
            <span>Printing</span>
          </label>
        </div>
      </div>

      {/* Dyeing Techniques */}
      {services.dyeing && (
        <div>
          <Label>Dyeing Techniques</Label>
          <div className="space-y-2 mt-2">
            {dyeingTechniques.map((technique: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={technique}
                  onChange={(e) => updateArrayItem('dyeingTechniques', index, e.target.value)}
                  placeholder="e.g., Piece Dyeing, Yarn Dyeing"
                  className="flex-1"
                />
                {dyeingTechniques.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeArrayItem('dyeingTechniques', index)}
                    className="px-3"
                  >
                    ×
                  </Button>
                )}
                {index === dyeingTechniques.length - 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addArrayItem('dyeingTechniques', '')}
                    className="px-3"
                  >
                    +
                  </Button>
                )}
              </div>
            ))}
            {dyeingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('dyeingTechniques', '')}>
                + Add Dyeing Technique
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Printing Techniques */}
      {services.printing && (
        <div>
          <Label>Printing Techniques</Label>
          <div className="space-y-2 mt-2">
            {printingTechniques.map((technique: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={technique}
                  onChange={(e) => updateArrayItem('printingTechniques', index, e.target.value)}
                  placeholder="e.g., Digital, Screen, Block"
                  className="flex-1"
                />
                {printingTechniques.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeArrayItem('printingTechniques', index)}
                    className="px-3"
                  >
                    ×
                  </Button>
                )}
                {index === printingTechniques.length - 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addArrayItem('printingTechniques', '')}
                    className="px-3"
                  >
                    +
                  </Button>
                )}
              </div>
            ))}
            {printingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')}>
                + Add Printing Technique
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Production Capacity */}
      <div>
        <Label>Production Capacity (meters/day)</Label>
        <Input
          type="number"
          value={asInputValue(data.productionCapacityMetersPerDay)}
          onChange={(e) => updateField('productionCapacityMetersPerDay', Number(e.target.value))}
        />
      </div>

      {/* Services Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.colorMatching)}
            onChange={(e) => updateField('colorMatching', e.target.checked)}
          />
          <span>Color Matching</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.pantoneMatching)}
            onChange={(e) => updateField('pantoneMatching', e.target.checked)}
          />
          <span>Pantone Matching</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
      </div>

      {/* Quality Certifications */}
      <div>
        <Label>Quality Certifications</Label>
        <div className="flex gap-4 mt-2">
          {['AZO Free', 'GOTS', 'OEKO-TEX'].map((cert) => (
            <label key={cert} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asArray<string>(data.qualityCertifications).includes(cert)}
                onChange={(e) => {
                  const current = asArray<string>(data.qualityCertifications);
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField(
                      'qualityCertifications',
                      current.filter((c: string) => c !== cert)
                    );
                  }
                }}
              />
              <span>{cert}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 4. EMBROIDERY FIELDS
function EmbroideryFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const embroideryTypes = asArray<string>(data.embroideryTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Embroidery Details</h3>

      {/* Embroidery Types - Array */}
      <div>
        <Label>Embroidery Types *</Label>
        <div className="space-y-2 mt-2">
          {embroideryTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('embroideryTypes', index, e.target.value)}
                placeholder="e.g., Machine, Computerized, Hand, Zari, Stone, Aari"
                className="flex-1"
              />
              {embroideryTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('embroideryTypes', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === embroideryTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('embroideryTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {embroideryTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('embroideryTypes', '')}>
              + Add Embroidery Type
            </Button>
          )}
        </div>
      </div>

      {/* Production Capacity and Number of Machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Machines</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfMachines)}
            onChange={(e) => updateField('numberOfMachines', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Stitch Count Range */}
      <div>
        <Label>Stitch Count Range</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Input
              type="number"
              value={asInputValue(data.stitchCountFrom)}
              onChange={(e) => updateField('stitchCountFrom', Number(e.target.value))}
              placeholder="From"
            />
          </div>
          <div>
            <Input
              type="number"
              value={asInputValue(data.stitchCountTo)}
              onChange={(e) => updateField('stitchCountTo', Number(e.target.value))}
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Design Complexity */}
      <div>
        <Label>Design Complexity</Label>
        <Select
          value={String(data.designComplexity || '')}
          onValueChange={(value) => updateField('designComplexity', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select complexity level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Simple">Simple</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Complex">Complex</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Service Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.designDevelopment)}
            onChange={(e) => updateField('designDevelopment', e.target.checked)}
          />
          <span>Design Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.punchingServices)}
            onChange={(e) => updateField('punchingServices', e.target.checked)}
          />
          <span>Punching Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 5. HAND WORK FIELDS
function HandWorkFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const handWorkTypes = asArray<string>(data.handWorkTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Hand Work Details</h3>

      {/* Hand Work Types - Array */}
      <div>
        <Label>Hand Work Types *</Label>
        <div className="space-y-2 mt-2">
          {handWorkTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('handWorkTypes', index, e.target.value)}
                placeholder="e.g., Beading, Sequin, Stone, Mirror, Zardozi"
                className="flex-1"
              />
              {handWorkTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('handWorkTypes', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === handWorkTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('handWorkTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {handWorkTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('handWorkTypes', '')}>
              + Add Hand Work Type
            </Button>
          )}
        </div>
      </div>

      {/* Production Capacity and Number of Workers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Design Complexity */}
      <div>
        <Label>Design Complexity</Label>
        <Select
          value={String(data.designComplexity || '')}
          onValueChange={(value) => updateField('designComplexity', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select complexity level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Simple">Simple</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Complex">Complex</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Service Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.designDevelopment)}
            onChange={(e) => updateField('designDevelopment', e.target.checked)}
          />
          <span>Design Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 6. CMT UNIT FIELDS
interface MachineCount {
  singleNeedle?: number;
  overlock?: number;
  flatlock?: number;
  buttonHole?: number;
  buttonStitch?: number;
  other?: number;
}
function CMTFields({
  data,
  updateField,
  updateNestedField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: NestedCategoryFieldProps) {
  const garmentCategories = asArray<string>(data.garmentCategories);
  const machineCount = asObject<MachineCount>(data.machineCount) || {};

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">CMT Unit Details</h3>

      {/* Garment Categories - Array */}
      <div>
        <Label>Garment Categories *</Label>
        <div className="space-y-2 mt-2">
          {garmentCategories.map((category: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={category}
                onChange={(e) => updateArrayItem('garmentCategories', index, e.target.value)}
                placeholder="e.g., Western Wear - Men, Ethnic Wear - Women"
                className="flex-1"
              />
              {garmentCategories.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('garmentCategories', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === garmentCategories.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('garmentCategories', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {garmentCategories.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('garmentCategories', '')}>
              + Add Garment Category
            </Button>
          )}
        </div>
      </div>

      {/* Production Capacity, Workers, and Factory Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Factory Area (sq. ft.)</Label>
          <Input
            type="number"
            value={asInputValue(data.factoryAreaSqFt)}
            onChange={(e) => updateField('factoryAreaSqFt', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Machine Counts */}
      <div>
        <Label>Machine Counts</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
          <div>
            <Label htmlFor="singleNeedle" className="text-sm">
              Single Needle
            </Label>
            <Input
              id="singleNeedle"
              type="number"
              value={machineCount.singleNeedle || ''}
              onChange={(e) => updateNestedField('machineCount', 'singleNeedle', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="overlock" className="text-sm">
              Overlock
            </Label>
            <Input
              id="overlock"
              type="number"
              value={machineCount.overlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'overlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="flatlock" className="text-sm">
              Flatlock
            </Label>
            <Input
              id="flatlock"
              type="number"
              value={machineCount.flatlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'flatlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="buttonHole" className="text-sm">
              Button Hole
            </Label>
            <Input
              id="buttonHole"
              type="number"
              value={machineCount.buttonHole || ''}
              onChange={(e) => updateNestedField('machineCount', 'buttonHole', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="buttonStitch" className="text-sm">
              Button Stitch
            </Label>
            <Input
              id="buttonStitch"
              type="number"
              value={machineCount.buttonStitch || ''}
              onChange={(e) => updateNestedField('machineCount', 'buttonStitch', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="other" className="text-sm">
              Other
            </Label>
            <Input
              id="other"
              type="number"
              value={machineCount.other || ''}
              onChange={(e) => updateNestedField('machineCount', 'other', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Quality Certifications */}
      <div>
        <Label>Quality Certifications</Label>
        <div className="flex gap-4 mt-2">
          {['ISO 9001', 'WRAP', 'SA8000'].map((cert) => (
            <label key={cert} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asArray<string>(data.qualityCertifications).includes(cert)}
                onChange={(e) => {
                  const current = asArray<string>(data.qualityCertifications);
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField(
                      'qualityCertifications',
                      current.filter((c: string) => c !== cert)
                    );
                  }
                }}
              />
              <span>{cert}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Service Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.inspectionServices)}
            onChange={(e) => updateField('inspectionServices', e.target.checked)}
          />
          <span>Inspection Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.packagingServices)}
            onChange={(e) => updateField('packagingServices', e.target.checked)}
          />
          <span>Packaging Services</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 7. THREAD SUPPLIER FIELDS
function ThreadFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: ArrayCategoryFieldProps) {
  const threadTypes = asArray<string>(data.threadTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Thread Supplier Details</h3>

      {/* Thread Types - Array */}
      <div>
        <Label>Thread Types *</Label>
        <div className="space-y-2 mt-2">
          {threadTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('threadTypes', index, e.target.value)}
                placeholder="e.g., Sewing Thread, Embroidery Thread, Specialty Thread"
                className="flex-1"
              />
              {threadTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('threadTypes', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === threadTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('threadTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {threadTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('threadTypes', '')}>
              + Add Thread Type
            </Button>
          )}
        </div>
      </div>

      {/* Count Range */}
      <div>
        <Label>Count Range</Label>
        <Input
          value={String(data.countRange || '')}
          onChange={(e) => updateField('countRange', e.target.value)}
          placeholder="e.g., 40/2 to 120D"
        />
      </div>

      {/* Colors Available */}
      <div>
        <Label>Colors Available</Label>
        <Input
          value={String(data.colors || '')}
          onChange={(e) => updateField('colors', e.target.value)}
          placeholder="e.g., All colors available, 200+ colors"
        />
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 8. OTHER SERVICES FIELDS
function OtherServicesFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const services = asArray<string>(data.services);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Other Services Details</h3>

      {/* Services - Array */}
      <div>
        <Label>Services Offered *</Label>
        <div className="space-y-2 mt-2">
          {services.map((service: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={service}
                onChange={(e) => updateArrayItem('services', index, e.target.value)}
                placeholder="e.g., Quality Testing, Sample Making, Consulting"
                className="flex-1"
              />
              {services.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('services', index)}
                  className="px-3"
                >
                  ×
                </Button>
              )}
              {index === services.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('services', '')} className="px-3">
                  +
                </Button>
              )}
            </div>
          ))}
          {services.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('services', '')}>
              + Add Service
            </Button>
          )}
        </div>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 9. PACKAGING SUPPLIER FIELDS
interface PackagingItem {
  itemType?: string;
  customization?: boolean;
}
function PackagingFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const items = asArray<PackagingItem>(data.items);
  const printingTechniques = asArray<string>(data.printingTechniques);

  const updateItemField = (index: number, field: string, value: string | number | boolean) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    updateField('items', updatedItems as unknown as FieldValue);
  };

  const addItem = () => {
    updateField('items', [...items, { itemType: '', customization: false }] as unknown as FieldValue);
  };

  const removeItem = (index: number) => {
    updateField('items', items.filter((_: PackagingItem, i: number) => i !== index) as unknown as FieldValue);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Packaging Supplier Details</h3>

      {/* Packaging Items - Array with itemType and customization */}
      <div>
        <Label>Packaging Items *</Label>
        <div className="space-y-2 mt-2">
          {items.map((item: PackagingItem, index: number) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  value={String(item.itemType || '')}
                  onChange={(e) => updateItemField(index, 'itemType', e.target.value)}
                  placeholder="e.g., Polybags, Hangtags, RFID Stickers, Price Tags"
                />
              </div>
              <label className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={item.customization ?? false}
                  onChange={(e) => updateItemField(index, 'customization', e.target.checked)}
                />
                <span className="text-sm">Customization</span>
              </label>
              {items.length > 1 && (
                <Button type="button" variant="outline" onClick={() => removeItem(index)} className="px-3">
                  ×
                </Button>
              )}
              {index === items.length - 1 && (
                <Button type="button" variant="outline" onClick={addItem} className="px-3">
                  +
                </Button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <Button type="button" variant="outline" onClick={addItem}>
              + Add Packaging Item
            </Button>
          )}
        </div>
      </div>

      {/* Printing Services */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.printingServices)}
            onChange={(e) => updateField('printingServices', e.target.checked)}
          />
          <span className="font-medium">Printing Services Available</span>
        </label>
      </div>

      {/* Printing Techniques - Conditional array */}
      {data.printingServices && (
        <div>
          <Label>Printing Techniques</Label>
          <div className="space-y-2 mt-2">
            {printingTechniques.map((technique: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={technique}
                  onChange={(e) => updateArrayItem('printingTechniques', index, e.target.value)}
                  placeholder="e.g., Offset, Digital, Screen"
                  className="flex-1"
                />
                {printingTechniques.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeArrayItem('printingTechniques', index)}
                    className="px-3"
                  >
                    ×
                  </Button>
                )}
                {index === printingTechniques.length - 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addArrayItem('printingTechniques', '')}
                    className="px-3"
                  >
                    +
                  </Button>
                )}
              </div>
            ))}
            {printingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')}>
                + Add Printing Technique
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Additional Services Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.designServices)}
            onChange={(e) => updateField('designServices', e.target.checked)}
          />
          <span>Design Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.rfidProgramming)}
            onChange={(e) => updateField('rfidProgramming', e.target.checked)}
          />
          <span>RFID Programming</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.barcodeGeneration)}
            onChange={(e) => updateField('barcodeGeneration', e.target.checked)}
          />
          <span>Barcode Generation</span>
        </label>
      </div>

      {/* Quality Certifications */}
      <div>
        <Label>Quality Certifications</Label>
        <div className="flex gap-4 mt-2">
          {['FSC', 'Recyclable Materials'].map((cert) => (
            <label key={cert} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asArray<string>(data.qualityCertifications).includes(cert)}
                onChange={(e) => {
                  const current = asArray<string>(data.qualityCertifications);
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField(
                      'qualityCertifications',
                      current.filter((c: string) => c !== cert)
                    );
                  }
                }}
              />
              <span>{cert}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 10. GREIGE SUPPLIER FIELDS
function GreigeFields({ data, updateField }: BasicCategoryFieldProps) {
  const [greigeFabrics, setGreigeFabrics] = useState<GreigeMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const greigeIds = (data.greigeIds || []) as string[];

  useEffect(() => {
    const loadGreige = async () => {
      try {
        setIsLoading(true);
        const response = await greigeService.getAll({ limit: 100 });
        setGreigeFabrics(response.data);
      } catch (error) {
        logError('Failed to load greige fabrics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadGreige();
  }, []);

  const filteredGreige = searchTerm
    ? greigeFabrics.filter(
        (g) =>
          g.greigeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.greigeName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : greigeFabrics;

  const toggleGreige = (greigeId: string) => {
    const newGreigeIds = greigeIds.includes(greigeId)
      ? greigeIds.filter((id: string) => id !== greigeId)
      : [...greigeIds, greigeId];
    updateField('greigeIds', newGreigeIds);
  };

  const removeGreige = (greigeId: string) => {
    updateField(
      'greigeIds',
      greigeIds.filter((id: string) => id !== greigeId)
    );
  };

  const selectedGreige = greigeIds
    .map((id: string) => greigeFabrics.find((g) => g.id === id))
    .filter((g): g is GreigeMaster => g !== undefined);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Greige Supplier Details</h3>

      <div>
        <Label>Greige Fabrics Supplied ({selectedGreige.length})</Label>
        {selectedGreige.length > 0 ? (
          <div className="mt-2 space-y-2">
            {selectedGreige.map((greige) => (
              <div key={greige.id} className="flex items-center justify-between bg-muted p-3 rounded-md">
                <div>
                  <span className="font-medium">{greige.greigeCode}</span>
                  <span className="text-muted-foreground ml-2">{greige.greigeName}</span>
                  <span className="text-xs text-muted-foreground ml-2">Width: {Number(greige.greigeWidth)}"</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeGreige(greige.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">No greige fabrics selected.</p>
        )}
      </div>

      <div>
        <Label>Add Greige Fabrics</Label>
        <Input
          type="text"
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-2"
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground mt-2">Loading greige fabrics...</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto border rounded-md">
            {filteredGreige.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No greige fabrics found</p>
            ) : (
              <div className="divide-y">
                {filteredGreige.slice(0, 50).map((greige) => (
                  <label key={greige.id} className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={greigeIds.includes(greige.id)}
                      onChange={() => toggleGreige(greige.id)}
                    />
                    <div className="flex-1">
                      <div>
                        <span className="font-medium">{greige.greigeCode}</span>
                        <span className="text-muted-foreground ml-2">{greige.greigeName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Width: {Number(greige.greigeWidth)}"</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
          placeholder="Any special notes about this supplier's greige capabilities..."
        />
      </div>
    </div>
  );
}

// 11. LACE SUPPLIER FIELDS
function LaceFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: ArrayCategoryFieldProps) {
  const laceTypes = asArray<string>(data.laceTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Lace Supplier Details</h3>

      <div>
        <Label>Lace Types *</Label>
        <div className="space-y-2 mt-2">
          {laceTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('laceTypes', index, e.target.value)}
                placeholder="e.g., Cotton Lace, Crochet Lace, Guipure, Chantilly"
                className="flex-1"
              />
              {laceTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('laceTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === laceTypes.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('laceTypes', '')} className="px-3">
                  +
                </Button>
              )}
            </div>
          ))}
          {laceTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('laceTypes', '')}>
              + Add Lace Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Width Range</Label>
          <Input
            value={String(data.widthRange || '')}
            onChange={(e) => updateField('widthRange', e.target.value)}
            placeholder="e.g., 1-6 inches"
          />
        </div>
        <div>
          <Label>Colors Available</Label>
          <Input
            value={String(data.colors || '')}
            onChange={(e) => updateField('colors', e.target.value)}
            placeholder="e.g., All colors, 100+ options"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.customDesigns)}
            onChange={(e) => updateField('customDesigns', e.target.checked)}
          />
          <span>Custom Designs Available</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.colorMatching)}
            onChange={(e) => updateField('colorMatching', e.target.checked)}
          />
          <span>Color Matching</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 12. SMOCKING FIELDS
function SmockingFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const smockingTypes = asArray<string>(data.smockingTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Smocking Details</h3>

      <div>
        <Label>Smocking Types *</Label>
        <div className="space-y-2 mt-2">
          {smockingTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('smockingTypes', index, e.target.value)}
                placeholder="e.g., English Smocking, Honeycomb, Cable, Wave"
                className="flex-1"
              />
              {smockingTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('smockingTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === smockingTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('smockingTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {smockingTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('smockingTypes', '')}>
              + Add Smocking Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Design Complexity</Label>
        <Select
          value={String(data.designComplexity || '')}
          onValueChange={(value) => updateField('designComplexity', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select complexity level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Simple">Simple</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Complex">Complex</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.designDevelopment)}
            onChange={(e) => updateField('designDevelopment', e.target.checked)}
          />
          <span>Design Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 13. FINISHING CONTRACTOR FIELDS
function FinishingContractorFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const finishingTypes = asArray<string>(data.finishingTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Finishing Contractor Details</h3>

      <div>
        <Label>Finishing Types *</Label>
        <div className="space-y-2 mt-2">
          {finishingTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('finishingTypes', index, e.target.value)}
                placeholder="e.g., Pressing, Tagging, Folding, Quality Check"
                className="flex-1"
              />
              {finishingTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('finishingTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === finishingTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('finishingTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {finishingTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('finishingTypes', '')}>
              + Add Finishing Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.pressingServices)}
            onChange={(e) => updateField('pressingServices', e.target.checked)}
          />
          <span>Pressing Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.taggingServices)}
            onChange={(e) => updateField('taggingServices', e.target.checked)}
          />
          <span>Tagging Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.packagingServices)}
            onChange={(e) => updateField('packagingServices', e.target.checked)}
          />
          <span>Packaging Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.qualityCheck)}
            onChange={(e) => updateField('qualityCheck', e.target.checked)}
          />
          <span>Quality Check</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 14. STITCHING CONTRACTOR FIELDS
interface StitchingMachineCount {
  singleNeedle?: number;
  overlock?: number;
  flatlock?: number;
  other?: number;
}
function StitchingContractorFields({
  data,
  updateField,
  updateNestedField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: NestedCategoryFieldProps) {
  const garmentTypes = asArray<string>(data.garmentTypes);
  const machineCount = asObject<StitchingMachineCount>(data.machineCount) || {};

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Stitching Contractor Details</h3>

      <div>
        <Label>Garment Types *</Label>
        <div className="space-y-2 mt-2">
          {garmentTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('garmentTypes', index, e.target.value)}
                placeholder="e.g., Kurta, Salwar, Tops, Dresses"
                className="flex-1"
              />
              {garmentTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('garmentTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === garmentTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('garmentTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {garmentTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('garmentTypes', '')}>
              + Add Garment Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Factory Area (sq. ft.)</Label>
          <Input
            type="number"
            value={asInputValue(data.factoryAreaSqFt)}
            onChange={(e) => updateField('factoryAreaSqFt', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Machine Counts</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          <div>
            <Label htmlFor="stitchSingleNeedle" className="text-sm">
              Single Needle
            </Label>
            <Input
              id="stitchSingleNeedle"
              type="number"
              value={machineCount.singleNeedle || ''}
              onChange={(e) => updateNestedField('machineCount', 'singleNeedle', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="stitchOverlock" className="text-sm">
              Overlock
            </Label>
            <Input
              id="stitchOverlock"
              type="number"
              value={machineCount.overlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'overlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="stitchFlatlock" className="text-sm">
              Flatlock
            </Label>
            <Input
              id="stitchFlatlock"
              type="number"
              value={machineCount.flatlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'flatlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="stitchOther" className="text-sm">
              Other
            </Label>
            <Input
              id="stitchOther"
              type="number"
              value={machineCount.other || ''}
              onChange={(e) => updateNestedField('machineCount', 'other', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.bulkProduction)}
            onChange={(e) => updateField('bulkProduction', e.target.checked)}
          />
          <span>Bulk Production</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 15. WASHING FIELDS
function WashingFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: ArrayCategoryFieldProps) {
  const washTypes = asArray<string>(data.washTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Washing Details</h3>

      <div>
        <Label>Wash Types *</Label>
        <div className="space-y-2 mt-2">
          {washTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('washTypes', index, e.target.value)}
                placeholder="e.g., Normal Wash, Enzyme Wash, Stone Wash, Acid Wash"
                className="flex-1"
              />
              {washTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('washTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === washTypes.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('washTypes', '')} className="px-3">
                  +
                </Button>
              )}
            </div>
          ))}
          {washTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('washTypes', '')}>
              + Add Wash Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Machines</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfMachines)}
            onChange={(e) => updateField('numberOfMachines', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.colorTreatment)}
            onChange={(e) => updateField('colorTreatment', e.target.checked)}
          />
          <span>Color Treatment</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.softeningServices)}
            onChange={(e) => updateField('softeningServices', e.target.checked)}
          />
          <span>Softening Services</span>
        </label>
      </div>

      <div>
        <Label>Quality Certifications</Label>
        <div className="flex gap-4 mt-2">
          {['AZO Free', 'OEKO-TEX'].map((cert) => (
            <label key={cert} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asArray<string>(data.qualityCertifications).includes(cert)}
                onChange={(e) => {
                  const current = asArray<string>(data.qualityCertifications);
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField(
                      'qualityCertifications',
                      current.filter((c: string) => c !== cert)
                    );
                  }
                }}
              />
              <span>{cert}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 16. DORI/PIPING CONTRACTOR FIELDS
function DoriPipingContractorFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const serviceTypes = asArray<string>(data.serviceTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Dori/Piping Contractor Details</h3>

      <div>
        <Label>Service Types *</Label>
        <div className="space-y-2 mt-2">
          {serviceTypes.map((type: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={type}
                onChange={(e) => updateArrayItem('serviceTypes', index, e.target.value)}
                placeholder="e.g., Dori Work, Piping, Latkans, Tassels"
                className="flex-1"
              />
              {serviceTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('serviceTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === serviceTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('serviceTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {serviceTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('serviceTypes', '')}>
              + Add Service Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={asInputValue(data.productionCapacityPiecesPerDay)}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={asInputValue(data.numberOfWorkers)}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.customDesigns)}
            onChange={(e) => updateField('customDesigns', e.target.checked)}
          />
          <span>Custom Designs</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.colorMatching)}
            onChange={(e) => updateField('colorMatching', e.target.checked)}
          />
          <span>Color Matching</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.sampleDevelopment)}
            onChange={(e) => updateField('sampleDevelopment', e.target.checked)}
          />
          <span>Sample Development</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 17. MACHINE PARTS SUPPLIER FIELDS
function MachinePartsSupplierFields({
  data,
  updateField,
  addArrayItem,
  updateArrayItem,
  removeArrayItem,
}: ArrayCategoryFieldProps) {
  const partCategories = asArray<string>(data.partCategories);
  const machineTypes = asArray<string>(data.machineTypes);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Machine Parts Supplier Details</h3>

      <div>
        <Label>Part Categories *</Label>
        <div className="space-y-2 mt-2">
          {partCategories.map((category: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={category}
                onChange={(e) => updateArrayItem('partCategories', index, e.target.value)}
                placeholder="e.g., Needles, Bobbins, Presser Feet, Motors"
                className="flex-1"
              />
              {partCategories.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('partCategories', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === partCategories.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('partCategories', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {partCategories.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('partCategories', '')}>
              + Add Part Category
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label>Machine Types Supported</Label>
        <div className="space-y-2 mt-2">
          {machineTypes.map((machine: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={machine}
                onChange={(e) => updateArrayItem('machineTypes', index, e.target.value)}
                placeholder="e.g., JUKI, Brother, Singer, Typical"
                className="flex-1"
              />
              {machineTypes.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeArrayItem('machineTypes', index)}
                  className="px-3"
                >
                  x
                </Button>
              )}
              {index === machineTypes.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addArrayItem('machineTypes', '')}
                  className="px-3"
                >
                  +
                </Button>
              )}
            </div>
          ))}
          {machineTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('machineTypes', '')}>
              + Add Machine Type
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.genuineParts)}
            onChange={(e) => updateField('genuineParts', e.target.checked)}
          />
          <span>Genuine Parts</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.repairServices)}
            onChange={(e) => updateField('repairServices', e.target.checked)}
          />
          <span>Repair Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.bulkSupply)}
            onChange={(e) => updateField('bulkSupply', e.target.checked)}
          />
          <span>Bulk Supply</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={asBoolean(data.emergencySupply)}
            onChange={(e) => updateField('emergencySupply', e.target.checked)}
          />
          <span>Emergency Supply</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea
          value={asInputValue(data.specialtyNotes)}
          onChange={(e) => updateField('specialtyNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
