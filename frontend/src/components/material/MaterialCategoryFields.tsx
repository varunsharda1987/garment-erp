// Category-Specific Fields for Material Form
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface MaterialCategoryFieldsProps {
  categoryName: string;
  data: any;
  onChange: (data: any) => void;
}

export default function MaterialCategoryFields({ categoryName, data, onChange }: MaterialCategoryFieldsProps) {
  const updateField = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Render fields based on material category
  switch (categoryName) {
    case 'Fabric':
      return <FabricFields data={data} updateField={updateField} />;

    case 'Trims':
      return <TrimsFields data={data} updateField={updateField} />;

    case 'Accessories':
      return <AccessoriesFields data={data} updateField={updateField} />;

    case 'Thread & Yarn':
      return <ThreadYarnFields data={data} updateField={updateField} />;

    case 'Interlining':
      return <InterliningFields data={data} updateField={updateField} />;

    case 'Elastic':
      return <ElasticFields data={data} updateField={updateField} />;

    case 'Packaging':
      return <PackagingFields data={data} updateField={updateField} />;

    default:
      return null;
  }
}

// FABRIC FIELDS
function FabricFields({ data, updateField }: any) {
  const fabricCategory = data.fabricCategory || '';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Fabric Details</h3>

      {/* Fabric Category Selection */}
      <div>
        <Label htmlFor="fabricCategory">Fabric Category *</Label>
        <Select value={fabricCategory} onValueChange={(value) => updateField('fabricCategory', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select fabric category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Greige">Greige</SelectItem>
            <SelectItem value="Ready">Ready</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Common Fields for both Greige and Ready */}
      {fabricCategory && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fabricType">Fabric Type</Label>
              <Select value={data.fabricType || ''} onValueChange={(value) => updateField('fabricType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fabric type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Woven">Woven</SelectItem>
                  <SelectItem value="Knit">Knit</SelectItem>
                  <SelectItem value="Non-Woven">Non-Woven</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="composition">Composition</Label>
              <Input
                id="composition"
                value={data.composition || ''}
                onChange={(e) => updateField('composition', e.target.value)}
                placeholder="e.g., 100% Cotton, 65% Poly 35% Cotton"
              />
            </div>

            <div>
              <Label htmlFor="count">Count</Label>
              <Input
                id="count"
                value={data.count || ''}
                onChange={(e) => updateField('count', e.target.value)}
                placeholder="e.g., 40s, 30x30, Ne 20/1"
              />
            </div>

            <div>
              <Label htmlFor="construction">Construction</Label>
              <Input
                id="construction"
                value={data.construction || ''}
                onChange={(e) => updateField('construction', e.target.value)}
                placeholder="e.g., Plain, Twill 2/1, Single Jersey"
              />
            </div>
          </div>

          {/* Greige-Specific Fields */}
          {fabricCategory === 'Greige' && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="text-md font-semibold text-gray-700 mb-4">Greige Fabric Specifications</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gsm">GSM (Grams per Square Meter)</Label>
                    <Input
                      id="gsm"
                      type="number"
                      value={data.gsm || ''}
                      onChange={(e) => updateField('gsm', e.target.value)}
                      placeholder="e.g., 180"
                    />
                  </div>

                  <div>
                    <Label htmlFor="width">Width (inches)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      value={data.width || ''}
                      onChange={(e) => updateField('width', e.target.value)}
                      placeholder="e.g., 60"
                    />
                  </div>

                  <div>
                    <Label htmlFor="postProcessing">Post Processing</Label>
                    <Input
                      id="postProcessing"
                      value={data.postProcessing || ''}
                      onChange={(e) => updateField('postProcessing', e.target.value)}
                      placeholder="e.g., Dyeing, Printing, Washing"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Ready Fabric-Specific Fields */}
          {fabricCategory === 'Ready' && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="text-md font-semibold text-gray-700 mb-4">Ready Fabric Specifications</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gsm">GSM (Grams per Square Meter)</Label>
                    <Input
                      id="gsm"
                      type="number"
                      value={data.gsm || ''}
                      onChange={(e) => updateField('gsm', e.target.value)}
                      placeholder="e.g., 180"
                    />
                  </div>

                  <div>
                    <Label htmlFor="width">Width (inches)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      value={data.width || ''}
                      onChange={(e) => updateField('width', e.target.value)}
                      placeholder="e.g., 60"
                    />
                  </div>

                  <div>
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      value={data.color || ''}
                      onChange={(e) => updateField('color', e.target.value)}
                      placeholder="e.g., White, Black, Navy"
                    />
                  </div>

                  <div>
                    <Label htmlFor="finish">Finish</Label>
                    <Input
                      id="finish"
                      value={data.finish || ''}
                      onChange={(e) => updateField('finish', e.target.value)}
                      placeholder="e.g., Dyed, Printed, Enzyme Washed"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// TRIMS FIELDS
function TrimsFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Trim Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="trimType">Trim Type</Label>
          <Select value={data.trimType || ''} onValueChange={(value) => updateField('trimType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select trim type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Button">Button</SelectItem>
              <SelectItem value="Zipper">Zipper</SelectItem>
              <SelectItem value="Label">Label</SelectItem>
              <SelectItem value="Tag">Tag</SelectItem>
              <SelectItem value="Hook">Hook & Eye</SelectItem>
              <SelectItem value="Snap">Snap Button</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 5mm, 20L, #5"
          />
        </div>

        <div>
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Silver, Gold, Black"
          />
        </div>

        <div>
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={data.material || ''}
            onChange={(e) => updateField('material', e.target.value)}
            placeholder="e.g., Metal, Plastic, Polyester"
          />
        </div>
      </div>
    </div>
  );
}

// ACCESSORIES FIELDS
function AccessoriesFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Accessory Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="accessoryType">Accessory Type</Label>
          <Input
            id="accessoryType"
            value={data.accessoryType || ''}
            onChange={(e) => updateField('accessoryType', e.target.value)}
            placeholder="e.g., Ribbon, Lace, Bead"
          />
        </div>

        <div>
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Multi-color"
          />
        </div>

        <div>
          <Label htmlFor="size">Size/Width</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 1 inch, 5mm"
          />
        </div>
      </div>
    </div>
  );
}

// THREAD & YARN FIELDS
function ThreadYarnFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Thread/Yarn Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Type</Label>
          <Select value={data.threadType || ''} onValueChange={(value) => updateField('threadType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sewing Thread">Sewing Thread</SelectItem>
              <SelectItem value="Embroidery Thread">Embroidery Thread</SelectItem>
              <SelectItem value="Yarn">Yarn</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="count">Count/Weight</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40/2, 120D"
          />
        </div>

        <div>
          <Label htmlFor="composition">Composition</Label>
          <Input
            id="composition"
            value={data.composition || ''}
            onChange={(e) => updateField('composition', e.target.value)}
            placeholder="e.g., 100% Polyester"
          />
        </div>

        <div>
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Navy"
          />
        </div>
      </div>
    </div>
  );
}

// INTERLINING FIELDS
function InterliningFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Interlining Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="interliningType">Interlining Type</Label>
          <Select value={data.interliningType || ''} onValueChange={(value) => updateField('interliningType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fusible">Fusible</SelectItem>
              <SelectItem value="Non-Fusible">Non-Fusible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="weight">Weight (GSM)</Label>
          <Input
            id="weight"
            type="number"
            value={data.weight || ''}
            onChange={(e) => updateField('weight', e.target.value)}
            placeholder="e.g., 50"
          />
        </div>

        <div>
          <Label htmlFor="width">Width (inches)</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            value={data.width || ''}
            onChange={(e) => updateField('width', e.target.value)}
            placeholder="e.g., 44"
          />
        </div>

        <div>
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black"
          />
        </div>
      </div>
    </div>
  );
}

// ELASTIC FIELDS
function ElasticFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Elastic Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="elasticType">Elastic Type</Label>
          <Select value={data.elasticType || ''} onValueChange={(value) => updateField('elasticType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Knitted">Knitted</SelectItem>
              <SelectItem value="Woven">Woven</SelectItem>
              <SelectItem value="Braided">Braided</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="width">Width (mm)</Label>
          <Input
            id="width"
            type="number"
            value={data.width || ''}
            onChange={(e) => updateField('width', e.target.value)}
            placeholder="e.g., 25"
          />
        </div>

        <div>
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black"
          />
        </div>

        <div>
          <Label htmlFor="stretch">Stretch %</Label>
          <Input
            id="stretch"
            type="number"
            value={data.stretch || ''}
            onChange={(e) => updateField('stretch', e.target.value)}
            placeholder="e.g., 150"
          />
        </div>
      </div>
    </div>
  );
}

// PACKAGING FIELDS
function PackagingFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Packaging Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="packagingType">Packaging Type</Label>
          <Select value={data.packagingType || ''} onValueChange={(value) => updateField('packagingType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Poly Bag">Poly Bag</SelectItem>
              <SelectItem value="Carton">Carton</SelectItem>
              <SelectItem value="Hanger">Hanger</SelectItem>
              <SelectItem value="Tissue Paper">Tissue Paper</SelectItem>
              <SelectItem value="Sticker">Sticker/Barcode</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size/Dimension</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 12x16 inches, 40x30x20 cm"
          />
        </div>

        <div>
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={data.material || ''}
            onChange={(e) => updateField('material', e.target.value)}
            placeholder="e.g., LDPE, Corrugated"
          />
        </div>

        <div>
          <Label htmlFor="printingRequired">Printing</Label>
          <Select value={data.printingRequired || 'No'} onValueChange={(value) => updateField('printingRequired', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Printing required?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
