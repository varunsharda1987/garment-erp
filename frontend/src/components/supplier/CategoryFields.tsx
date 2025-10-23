// Category-Specific Fields for Supplier Form
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type {
  SupplierCategory,
  FabricSupplierData,
  TrimsAccessoriesData,
  DyeingPrintingData,
  EmbroideryData,
  HandWorkData,
  CMTUnitData,
  PackagingData,
  TrimsAccessoriesItem,
  PackagingItem,
} from '../../types/supplier.types';

interface CategoryFieldsProps {
  category: SupplierCategory;
  data: any;
  onChange: (data: any) => void;
}

export default function CategoryFields({ category, data, onChange }: CategoryFieldsProps) {
  const updateField = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    onChange({
      ...data,
      [parent]: {
        ...(data[parent] || {}),
        [field]: value,
      },
    });
  };

  const addArrayItem = (field: string, defaultValue: any) => {
    const current = data[field] || [];
    onChange({ ...data, [field]: [...current, defaultValue] });
  };

  const updateArrayItem = (field: string, index: number, value: any) => {
    const current = [...(data[field] || [])];
    current[index] = value;
    onChange({ ...data, [field]: current });
  };

  const removeArrayItem = (field: string, index: number) => {
    const current = data[field] || [];
    onChange({ ...data, [field]: current.filter((_: any, i: number) => i !== index) });
  };

  // Render fields based on category
  switch (category) {
    case 'FABRIC_SUPPLIER':
      return <FabricFields data={data} updateField={updateField} updateNestedField={updateNestedField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'TRIMS_ACCESSORIES':
      return <TrimsFields data={data} updateField={updateField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'DYEING_PRINTING':
      return <DyeingPrintingFields data={data} updateField={updateField} updateNestedField={updateNestedField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'EMBROIDERY':
      return <EmbroideryFields data={data} updateField={updateField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'HAND_WORK':
      return <HandWorkFields data={data} updateField={updateField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'CMT_UNIT':
      return <CMTFields data={data} updateField={updateField} updateNestedField={updateNestedField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    case 'PACKAGING':
      return <PackagingFields data={data} updateField={updateField} addArrayItem={addArrayItem} updateArrayItem={updateArrayItem} removeArrayItem={removeArrayItem} />;

    default:
      return null;
  }
}

// 1. FABRIC SUPPLIER FIELDS
function FabricFields({ data, updateField, updateNestedField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const fabricCategories = data.fabricCategories || { greige: false, ready: false };
  const greigeFabricTypes = data.greigeFabricTypes || [];
  const readyFabricTypes = data.readyFabricTypes || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Fabric Supplier Details</h3>

      {/* Fabric Categories */}
      <div>
        <Label>Fabric Categories Supplied</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fabricCategories.greige}
              onChange={(e) => updateNestedField('fabricCategories', 'greige', e.target.checked)}
            />
            <span>Greige Fabric</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fabricCategories.ready}
              onChange={(e) => updateNestedField('fabricCategories', 'ready', e.target.checked)}
            />
            <span>Ready Fabric</span>
          </label>
        </div>
      </div>

      {/* Greige Fabric Types */}
      {fabricCategories.greige && (
        <div>
          <Label>Greige Fabric Types</Label>
          <div className="space-y-2 mt-2">
            {greigeFabricTypes.map((type: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={type}
                  onChange={(e) => updateArrayItem('greigeFabricTypes', index, e.target.value)}
                  placeholder="e.g., Cotton 40x40, Polyester"
                  className="flex-1"
                />
                {greigeFabricTypes.length > 1 && (
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('greigeFabricTypes', index)} className="px-3">×</Button>
                )}
                {index === greigeFabricTypes.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => addArrayItem('greigeFabricTypes', '')} className="px-3">+</Button>
                )}
              </div>
            ))}
            {greigeFabricTypes.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('greigeFabricTypes', '')}>+ Add Greige Fabric Type</Button>
            )}
          </div>
        </div>
      )}

      {/* Ready Fabric Types */}
      {fabricCategories.ready && (
        <div>
          <Label>Ready Fabric Types</Label>
          <div className="space-y-2 mt-2">
            {readyFabricTypes.map((type: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={type}
                  onChange={(e) => updateArrayItem('readyFabricTypes', index, e.target.value)}
                  placeholder="e.g., Printed Cotton, Dyed Polyester"
                  className="flex-1"
                />
                {readyFabricTypes.length > 1 && (
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('readyFabricTypes', index)} className="px-3">×</Button>
                )}
                {index === readyFabricTypes.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => addArrayItem('readyFabricTypes', '')} className="px-3">+</Button>
                )}
              </div>
            ))}
            {readyFabricTypes.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('readyFabricTypes', '')}>+ Add Ready Fabric Type</Button>
            )}
          </div>
        </div>
      )}

      {/* Width Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Width Range From (inches)</Label>
          <Input type="number" value={data.widthRangeFrom || ''} onChange={(e) => updateField('widthRangeFrom', Number(e.target.value))} />
        </div>
        <div>
          <Label>Width Range To (inches)</Label>
          <Input type="number" value={data.widthRangeTo || ''} onChange={(e) => updateField('widthRangeTo', Number(e.target.value))} />
        </div>
      </div>

      {/* GSM Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>GSM Range From</Label>
          <Input type="number" value={data.gsmRangeFrom || ''} onChange={(e) => updateField('gsmRangeFrom', Number(e.target.value))} />
        </div>
        <div>
          <Label>GSM Range To</Label>
          <Input type="number" value={data.gsmRangeTo || ''} onChange={(e) => updateField('gsmRangeTo', Number(e.target.value))} />
        </div>
      </div>

      {/* Quality Certifications */}
      <div>
        <Label>Quality Certifications</Label>
        <div className="flex gap-4 mt-2">
          {['GOTS', 'OEKO-TEX', 'BCI'].map((cert) => (
            <label key={cert} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(data.qualityCertifications || []).includes(cert)}
                onChange={(e) => {
                  const current = data.qualityCertifications || [];
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField('qualityCertifications', current.filter((c: string) => c !== cert));
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
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// Continue with other category components in next message due to token limit...
// I'll create simplified versions of the remaining categories

function TrimsFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const items = data.items || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Trims & Accessories Details</h3>

      <div>
        <Label>Items Supplied</Label>
        <div className="space-y-2 mt-2">
          {items.map((item: TrimsAccessoriesItem, index: number) => (
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
                <Button type="button" variant="outline" onClick={() => removeArrayItem('items', index)} className="px-3">×</Button>
              )}
              {index === items.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('items', { itemName: '', unit: '' })} className="px-3">+</Button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('items', { itemName: '', unit: '' })}>+ Add Item</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.customizationAvailable} onChange={(e) => updateField('customizationAvailable', e.target.checked)} />
          <span>Customization Available</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.designColorMatching} onChange={(e) => updateField('designColorMatching', e.target.checked)} />
          <span>Design/Color Matching</span>
        </label>
      </div>

      <div>
        <Label>Specialty/Notes</Label>
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// 3. DYEING & PRINTING FIELDS
function DyeingPrintingFields({ data, updateField, updateNestedField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const services = data.services || { dyeing: false, printing: false };
  const dyeingTechniques = data.dyeingTechniques || [];
  const printingTechniques = data.printingTechniques || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Dyeing & Printing Details</h3>

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
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('dyeingTechniques', index)} className="px-3">×</Button>
                )}
                {index === dyeingTechniques.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => addArrayItem('dyeingTechniques', '')} className="px-3">+</Button>
                )}
              </div>
            ))}
            {dyeingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('dyeingTechniques', '')}>+ Add Dyeing Technique</Button>
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
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('printingTechniques', index)} className="px-3">×</Button>
                )}
                {index === printingTechniques.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')} className="px-3">+</Button>
                )}
              </div>
            ))}
            {printingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')}>+ Add Printing Technique</Button>
            )}
          </div>
        </div>
      )}

      {/* Production Capacity */}
      <div>
        <Label>Production Capacity (meters/day)</Label>
        <Input
          type="number"
          value={data.productionCapacityMetersPerDay || ''}
          onChange={(e) => updateField('productionCapacityMetersPerDay', Number(e.target.value))}
        />
      </div>

      {/* Services Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.colorMatching} onChange={(e) => updateField('colorMatching', e.target.checked)} />
          <span>Color Matching</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.pantoneMatching} onChange={(e) => updateField('pantoneMatching', e.target.checked)} />
          <span>Pantone Matching</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.sampleDevelopment} onChange={(e) => updateField('sampleDevelopment', e.target.checked)} />
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
                checked={(data.qualityCertifications || []).includes(cert)}
                onChange={(e) => {
                  const current = data.qualityCertifications || [];
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField('qualityCertifications', current.filter((c: string) => c !== cert));
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
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// 4. EMBROIDERY FIELDS
function EmbroideryFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const embroideryTypes = data.embroideryTypes || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Embroidery Details</h3>

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
                <Button type="button" variant="outline" onClick={() => removeArrayItem('embroideryTypes', index)} className="px-3">×</Button>
              )}
              {index === embroideryTypes.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('embroideryTypes', '')} className="px-3">+</Button>
              )}
            </div>
          ))}
          {embroideryTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('embroideryTypes', '')}>+ Add Embroidery Type</Button>
          )}
        </div>
      </div>

      {/* Production Capacity and Number of Machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={data.productionCapacityPiecesPerDay || ''}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Machines</Label>
          <Input
            type="number"
            value={data.numberOfMachines || ''}
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
              value={data.stitchCountFrom || ''}
              onChange={(e) => updateField('stitchCountFrom', Number(e.target.value))}
              placeholder="From"
            />
          </div>
          <div>
            <Input
              type="number"
              value={data.stitchCountTo || ''}
              onChange={(e) => updateField('stitchCountTo', Number(e.target.value))}
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Design Complexity */}
      <div>
        <Label>Design Complexity</Label>
        <Select value={data.designComplexity || ''} onValueChange={(value) => updateField('designComplexity', value)}>
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
          <input type="checkbox" checked={data.designDevelopment} onChange={(e) => updateField('designDevelopment', e.target.checked)} />
          <span>Design Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.punchingServices} onChange={(e) => updateField('punchingServices', e.target.checked)} />
          <span>Punching Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.sampleDevelopment} onChange={(e) => updateField('sampleDevelopment', e.target.checked)} />
          <span>Sample Development</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// 5. HAND WORK FIELDS
function HandWorkFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const handWorkTypes = data.handWorkTypes || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Hand Work Details</h3>

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
                <Button type="button" variant="outline" onClick={() => removeArrayItem('handWorkTypes', index)} className="px-3">×</Button>
              )}
              {index === handWorkTypes.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('handWorkTypes', '')} className="px-3">+</Button>
              )}
            </div>
          ))}
          {handWorkTypes.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('handWorkTypes', '')}>+ Add Hand Work Type</Button>
          )}
        </div>
      </div>

      {/* Production Capacity and Number of Workers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={data.productionCapacityPiecesPerDay || ''}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={data.numberOfWorkers || ''}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Design Complexity */}
      <div>
        <Label>Design Complexity</Label>
        <Select value={data.designComplexity || ''} onValueChange={(value) => updateField('designComplexity', value)}>
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
          <input type="checkbox" checked={data.designDevelopment} onChange={(e) => updateField('designDevelopment', e.target.checked)} />
          <span>Design Development</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.sampleDevelopment} onChange={(e) => updateField('sampleDevelopment', e.target.checked)} />
          <span>Sample Development</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// 6. CMT UNIT FIELDS
function CMTFields({ data, updateField, updateNestedField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const garmentCategories = data.garmentCategories || [];
  const machineCount = data.machineCount || {};

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">CMT Unit Details</h3>

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
                <Button type="button" variant="outline" onClick={() => removeArrayItem('garmentCategories', index)} className="px-3">×</Button>
              )}
              {index === garmentCategories.length - 1 && (
                <Button type="button" variant="outline" onClick={() => addArrayItem('garmentCategories', '')} className="px-3">+</Button>
              )}
            </div>
          ))}
          {garmentCategories.length === 0 && (
            <Button type="button" variant="outline" onClick={() => addArrayItem('garmentCategories', '')}>+ Add Garment Category</Button>
          )}
        </div>
      </div>

      {/* Production Capacity, Workers, and Factory Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Production Capacity (pieces/day)</Label>
          <Input
            type="number"
            value={data.productionCapacityPiecesPerDay || ''}
            onChange={(e) => updateField('productionCapacityPiecesPerDay', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Number of Workers</Label>
          <Input
            type="number"
            value={data.numberOfWorkers || ''}
            onChange={(e) => updateField('numberOfWorkers', Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Factory Area (sq. ft.)</Label>
          <Input
            type="number"
            value={data.factoryAreaSqFt || ''}
            onChange={(e) => updateField('factoryAreaSqFt', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Machine Counts */}
      <div>
        <Label>Machine Counts</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
          <div>
            <Label htmlFor="singleNeedle" className="text-sm">Single Needle</Label>
            <Input
              id="singleNeedle"
              type="number"
              value={machineCount.singleNeedle || ''}
              onChange={(e) => updateNestedField('machineCount', 'singleNeedle', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="overlock" className="text-sm">Overlock</Label>
            <Input
              id="overlock"
              type="number"
              value={machineCount.overlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'overlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="flatlock" className="text-sm">Flatlock</Label>
            <Input
              id="flatlock"
              type="number"
              value={machineCount.flatlock || ''}
              onChange={(e) => updateNestedField('machineCount', 'flatlock', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="buttonHole" className="text-sm">Button Hole</Label>
            <Input
              id="buttonHole"
              type="number"
              value={machineCount.buttonHole || ''}
              onChange={(e) => updateNestedField('machineCount', 'buttonHole', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="buttonStitch" className="text-sm">Button Stitch</Label>
            <Input
              id="buttonStitch"
              type="number"
              value={machineCount.buttonStitch || ''}
              onChange={(e) => updateNestedField('machineCount', 'buttonStitch', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="other" className="text-sm">Other</Label>
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
                checked={(data.qualityCertifications || []).includes(cert)}
                onChange={(e) => {
                  const current = data.qualityCertifications || [];
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField('qualityCertifications', current.filter((c: string) => c !== cert));
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
          <input type="checkbox" checked={data.inspectionServices} onChange={(e) => updateField('inspectionServices', e.target.checked)} />
          <span>Inspection Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.packagingServices} onChange={(e) => updateField('packagingServices', e.target.checked)} />
          <span>Packaging Services</span>
        </label>
      </div>

      {/* Specialty Notes */}
      <div>
        <Label>Specialty/Notes</Label>
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}

// 7. PACKAGING FIELDS
function PackagingFields({ data, updateField, addArrayItem, updateArrayItem, removeArrayItem }: any) {
  const items = data.items || [];
  const printingTechniques = data.printingTechniques || [];

  const updateItemField = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    updateField('items', updatedItems);
  };

  const addItem = () => {
    updateField('items', [...items, { itemType: '', customization: false }]);
  };

  const removeItem = (index: number) => {
    updateField('items', items.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Packaging Details</h3>

      {/* Packaging Items - Array with itemType and customization */}
      <div>
        <Label>Packaging Items *</Label>
        <div className="space-y-2 mt-2">
          {items.map((item: any, index: number) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  value={item.itemType || ''}
                  onChange={(e) => updateItemField(index, 'itemType', e.target.value)}
                  placeholder="e.g., Polybags, Hangtags, RFID Stickers, Price Tags"
                />
              </div>
              <label className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={item.customization || false}
                  onChange={(e) => updateItemField(index, 'customization', e.target.checked)}
                />
                <span className="text-sm">Customization</span>
              </label>
              {items.length > 1 && (
                <Button type="button" variant="outline" onClick={() => removeItem(index)} className="px-3">×</Button>
              )}
              {index === items.length - 1 && (
                <Button type="button" variant="outline" onClick={addItem} className="px-3">+</Button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <Button type="button" variant="outline" onClick={addItem}>+ Add Packaging Item</Button>
          )}
        </div>
      </div>

      {/* Printing Services */}
      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.printingServices} onChange={(e) => updateField('printingServices', e.target.checked)} />
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
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('printingTechniques', index)} className="px-3">×</Button>
                )}
                {index === printingTechniques.length - 1 && (
                  <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')} className="px-3">+</Button>
                )}
              </div>
            ))}
            {printingTechniques.length === 0 && (
              <Button type="button" variant="outline" onClick={() => addArrayItem('printingTechniques', '')}>+ Add Printing Technique</Button>
            )}
          </div>
        </div>
      )}

      {/* Additional Services Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.designServices} onChange={(e) => updateField('designServices', e.target.checked)} />
          <span>Design Services</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.rfidProgramming} onChange={(e) => updateField('rfidProgramming', e.target.checked)} />
          <span>RFID Programming</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={data.barcodeGeneration} onChange={(e) => updateField('barcodeGeneration', e.target.checked)} />
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
                checked={(data.qualityCertifications || []).includes(cert)}
                onChange={(e) => {
                  const current = data.qualityCertifications || [];
                  if (e.target.checked) {
                    updateField('qualityCertifications', [...current, cert]);
                  } else {
                    updateField('qualityCertifications', current.filter((c: string) => c !== cert));
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
        <Textarea value={data.specialtyNotes || ''} onChange={(e) => updateField('specialtyNotes', e.target.value)} rows={3} />
      </div>
    </div>
  );
}
