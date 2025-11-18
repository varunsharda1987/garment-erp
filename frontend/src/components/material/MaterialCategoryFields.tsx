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

  // Render fields based on child category name
  switch (categoryName) {
    // FABRICS Parent Category - 4 Children
    case 'Greige Fabric':
      return <GreigeFabricFields data={data} updateField={updateField} />;

    case 'Ready Fabric':
      return <ReadyFabricFields data={data} updateField={updateField} />;

    case 'Lining & Pocketing':
      return <LiningPocketingFields data={data} updateField={updateField} />;

    case 'Interlining & Fusibles':
      return <InterliningFusiblesFields data={data} updateField={updateField} />;

    // TRIMS & NOTIONS Parent Category - 5 Children
    case 'Closures':
      return <ClosuresFields data={data} updateField={updateField} />;

    case 'Labels & Tags':
      return <LabelsTagsFields data={data} updateField={updateField} />;

    case 'Elastic & Tapes':
      return <ElasticTapesFields data={data} updateField={updateField} />;

    case 'Decorative':
      return <DecorativeFields data={data} updateField={updateField} />;

    case 'Hardware':
      return <HardwareFields data={data} updateField={updateField} />;

    // THREADS Parent Category - 3 Children
    case 'Sewing Thread':
      return <SewingThreadFields data={data} updateField={updateField} />;

    case 'Embroidery Thread':
      return <EmbroideryThreadFields data={data} updateField={updateField} />;

    case 'Specialty Thread':
      return <SpecialtyThreadFields data={data} updateField={updateField} />;

    // PACKAGING Parent Category - 3 Children
    case 'Primary Packaging':
      return <PrimaryPackagingFields data={data} updateField={updateField} />;

    case 'Secondary Packaging':
      return <SecondaryPackagingFields data={data} updateField={updateField} />;

    case 'Labeling':
      return <LabelingFields data={data} updateField={updateField} />;

    default:
      return null;
  }
}

// ============================================================================
// FABRICS CATEGORY (4 Children)
// ============================================================================

// 1. GREIGE FABRIC FIELDS
function GreigeFabricFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Greige Fabric Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fabricType">Fabric Type *</Label>
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
          <Label htmlFor="composition">Composition *</Label>
          <Input
            id="composition"
            value={data.composition || ''}
            onChange={(e) => updateField('composition', e.target.value)}
            placeholder="e.g., 100% Cotton, 65% Poly 35% Cotton"
          />
        </div>

        <div>
          <Label htmlFor="count">Count *</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40s, 30x30"
          />
        </div>

        <div>
          <Label htmlFor="construction">Construction *</Label>
          <Input
            id="construction"
            value={data.construction || ''}
            onChange={(e) => updateField('construction', e.target.value)}
            placeholder="e.g., Plain, Twill, Single Jersey"
          />
        </div>

        <div>
          <Label htmlFor="gsm">GSM (Grams per Square Meter) *</Label>
          <Input
            id="gsm"
            type="number"
            value={data.gsm || ''}
            onChange={(e) => updateField('gsm', Number(e.target.value))}
            placeholder="e.g., 180"
          />
        </div>

        <div>
          <Label htmlFor="width">Width (inches) *</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            value={data.width || ''}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 60"
          />
        </div>
      </div>
    </div>
  );
}

// 2. READY FABRIC FIELDS
function ReadyFabricFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Ready Fabric Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fabricType">Fabric Type *</Label>
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
          <Label htmlFor="composition">Composition *</Label>
          <Input
            id="composition"
            value={data.composition || ''}
            onChange={(e) => updateField('composition', e.target.value)}
            placeholder="e.g., 100% Cotton"
          />
        </div>

        <div>
          <Label htmlFor="count">Count</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40s, 30x30"
          />
        </div>

        <div>
          <Label htmlFor="construction">Construction</Label>
          <Input
            id="construction"
            value={data.construction || ''}
            onChange={(e) => updateField('construction', e.target.value)}
            placeholder="e.g., Plain, Twill"
          />
        </div>

        <div>
          <Label htmlFor="gsm">GSM (Grams per Square Meter) *</Label>
          <Input
            id="gsm"
            type="number"
            value={data.gsm || ''}
            onChange={(e) => updateField('gsm', Number(e.target.value))}
            placeholder="e.g., 180"
          />
        </div>

        <div>
          <Label htmlFor="width">Width (inches) *</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            value={data.width || ''}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 60"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Navy Blue, White, Red"
          />
        </div>

        <div>
          <Label htmlFor="finish">Finish *</Label>
          <Select value={data.finish || ''} onValueChange={(value) => updateField('finish', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select finish" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Dyed">Dyed</SelectItem>
              <SelectItem value="Printed">Printed</SelectItem>
              <SelectItem value="Enzyme Washed">Enzyme Washed</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// 3. LINING & POCKETING FIELDS
function LiningPocketingFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Lining & Pocketing Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Polyester">Polyester</SelectItem>
              <SelectItem value="Viscose">Viscose</SelectItem>
              <SelectItem value="Cotton">Cotton</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="weight">Weight (GSM) *</Label>
          <Input
            id="weight"
            type="number"
            value={data.weight || ''}
            onChange={(e) => updateField('weight', Number(e.target.value))}
            placeholder="e.g., 80"
          />
        </div>

        <div>
          <Label htmlFor="width">Width (inches) *</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            value={data.width || ''}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 58"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Beige"
          />
        </div>
      </div>
    </div>
  );
}

// 4. INTERLINING & FUSIBLES FIELDS
function InterliningFusiblesFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Interlining & Fusibles Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
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
          <Label htmlFor="weight">Weight (GSM) *</Label>
          <Input
            id="weight"
            type="number"
            value={data.weight || ''}
            onChange={(e) => updateField('weight', Number(e.target.value))}
            placeholder="e.g., 50"
          />
        </div>

        <div>
          <Label htmlFor="width">Width (inches) *</Label>
          <Input
            id="width"
            type="number"
            step="0.1"
            value={data.width || ''}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 44"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Charcoal"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRIMS & NOTIONS CATEGORY (5 Children)
// ============================================================================

// 5. CLOSURES FIELDS
function ClosuresFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Closures Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="itemType">Item Type *</Label>
          <Select value={data.itemType || ''} onValueChange={(value) => updateField('itemType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Button">Button</SelectItem>
              <SelectItem value="Zipper">Zipper</SelectItem>
              <SelectItem value="Snap">Snap</SelectItem>
              <SelectItem value="Hook & Eye">Hook & Eye</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 20L, #5, 15mm"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Silver, Gold, Black"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Metal">Metal</SelectItem>
              <SelectItem value="Plastic">Plastic</SelectItem>
              <SelectItem value="Polyester">Polyester</SelectItem>
              <SelectItem value="Brass">Brass</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// 6. LABELS & TAGS FIELDS
function LabelsTagsFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Labels & Tags Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="labelType">Label Type *</Label>
          <Select value={data.labelType || ''} onValueChange={(value) => updateField('labelType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select label type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Woven Label">Woven Label</SelectItem>
              <SelectItem value="Printed Label">Printed Label</SelectItem>
              <SelectItem value="Care Label">Care Label</SelectItem>
              <SelectItem value="Hang Tag">Hang Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 2x4 inches, 50x25mm"
          />
        </div>

        <div>
          <Label htmlFor="printingColors">Printing Colors</Label>
          <Input
            id="printingColors"
            type="number"
            value={data.printingColors || ''}
            onChange={(e) => updateField('printingColors', Number(e.target.value))}
            placeholder="e.g., 4"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Polyester">Polyester</SelectItem>
              <SelectItem value="Cotton">Cotton</SelectItem>
              <SelectItem value="Paper">Paper</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// 7. ELASTIC & TAPES FIELDS
function ElasticTapesFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Elastic & Tapes Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Knitted Elastic">Knitted Elastic</SelectItem>
              <SelectItem value="Woven Elastic">Woven Elastic</SelectItem>
              <SelectItem value="Bias Tape">Bias Tape</SelectItem>
              <SelectItem value="Twill Tape">Twill Tape</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="width">Width (mm) *</Label>
          <Input
            id="width"
            type="number"
            value={data.width || ''}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 25"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Navy"
          />
        </div>

        <div>
          <Label htmlFor="stretchPercent">Stretch Percent (for elastic)</Label>
          <Input
            id="stretchPercent"
            type="number"
            value={data.stretchPercent || ''}
            onChange={(e) => updateField('stretchPercent', Number(e.target.value))}
            placeholder="e.g., 150"
          />
        </div>
      </div>
    </div>
  );
}

// 8. DECORATIVE FIELDS
function DecorativeFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Decorative Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ribbon">Ribbon</SelectItem>
              <SelectItem value="Lace">Lace</SelectItem>
              <SelectItem value="Bead">Bead</SelectItem>
              <SelectItem value="Sequin">Sequin</SelectItem>
              <SelectItem value="Applique">Applique</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Gold, Silver, Multi-color"
          />
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 3mm, 1 inch wide"
          />
        </div>
      </div>
    </div>
  );
}

// 9. HARDWARE FIELDS
function HardwareFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Hardware Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Grommet">Grommet</SelectItem>
              <SelectItem value="Rivet">Rivet</SelectItem>
              <SelectItem value="Buckle">Buckle</SelectItem>
              <SelectItem value="D-Ring">D-Ring</SelectItem>
              <SelectItem value="Slider">Slider</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 10mm, 1/2 inch"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Metal">Metal</SelectItem>
              <SelectItem value="Brass">Brass</SelectItem>
              <SelectItem value="Plastic">Plastic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="finish">Finish *</Label>
          <Select value={data.finish || ''} onValueChange={(value) => updateField('finish', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select finish" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Nickel">Nickel</SelectItem>
              <SelectItem value="Antique">Antique</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// THREADS CATEGORY (3 Children)
// ============================================================================

// 10. SEWING THREAD FIELDS
function SewingThreadFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Sewing Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={data.threadType || ''} onValueChange={(value) => updateField('threadType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select thread type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Core-spun">Core-spun</SelectItem>
              <SelectItem value="Spun Polyester">Spun Polyester</SelectItem>
              <SelectItem value="Cotton">Cotton</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="count">Count *</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40/2, 120D"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Navy"
          />
        </div>

        <div>
          <Label htmlFor="composition">Composition</Label>
          <Input
            id="composition"
            value={data.composition || ''}
            onChange={(e) => updateField('composition', e.target.value)}
            placeholder="e.g., 100% Polyester, 100% Cotton"
          />
        </div>
      </div>
    </div>
  );
}

// 11. EMBROIDERY THREAD FIELDS
function EmbroideryThreadFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Embroidery Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={data.threadType || ''} onValueChange={(value) => updateField('threadType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select thread type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Rayon">Rayon</SelectItem>
              <SelectItem value="Polyester">Polyester</SelectItem>
              <SelectItem value="Metallic">Metallic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="count">Count *</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40wt, 60wt"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={data.color || ''}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Gold, Multi-color"
          />
        </div>
      </div>
    </div>
  );
}

// 12. SPECIALTY THREAD FIELDS
function SpecialtyThreadFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Specialty Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={data.threadType || ''} onValueChange={(value) => updateField('threadType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select thread type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Buttonhole">Buttonhole</SelectItem>
              <SelectItem value="Overlock">Overlock</SelectItem>
              <SelectItem value="Blind Stitch">Blind Stitch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="count">Count *</Label>
          <Input
            id="count"
            value={data.count || ''}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 30/3, 40/2"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
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

// ============================================================================
// PACKAGING CATEGORY (3 Children)
// ============================================================================

// 13. PRIMARY PACKAGING FIELDS
function PrimaryPackagingFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Primary Packaging Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Poly Bag">Poly Bag</SelectItem>
              <SelectItem value="Hanger">Hanger</SelectItem>
              <SelectItem value="Price Tag">Price Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 12x16 inches, 300x400mm"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LDPE">LDPE</SelectItem>
              <SelectItem value="PP">PP</SelectItem>
              <SelectItem value="Recycled">Recycled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="printingRequired">Printing Required *</Label>
          <Select value={data.printingRequired || 'No'} onValueChange={(value) => updateField('printingRequired', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
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

// 14. SECONDARY PACKAGING FIELDS
function SecondaryPackagingFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Secondary Packaging Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Carton">Carton</SelectItem>
              <SelectItem value="Tissue Paper">Tissue Paper</SelectItem>
              <SelectItem value="Inner Box">Inner Box</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dimensions">Dimensions *</Label>
          <Input
            id="dimensions"
            value={data.dimensions || ''}
            onChange={(e) => updateField('dimensions', e.target.value)}
            placeholder="e.g., 40x30x20 cm"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={data.material || ''} onValueChange={(value) => updateField('material', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Corrugated">Corrugated</SelectItem>
              <SelectItem value="Kraft Paper">Kraft Paper</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// 15. LABELING FIELDS
function LabelingFields({ data, updateField }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Labeling Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={data.type || ''} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Barcode Sticker">Barcode Sticker</SelectItem>
              <SelectItem value="Size Sticker">Size Sticker</SelectItem>
              <SelectItem value="Price Label">Price Label</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={data.size || ''}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 2x1 inch, 50x25mm"
          />
        </div>

        <div>
          <Label htmlFor="printingType">Printing Type *</Label>
          <Select value={data.printingType || ''} onValueChange={(value) => updateField('printingType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select printing type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Thermal">Thermal</SelectItem>
              <SelectItem value="Inkjet">Inkjet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
