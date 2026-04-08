// Category-Specific Fields for Material Form
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Category data type - a record of field names to their values
type CategoryFieldValue = string | number | boolean | null | undefined;
type CategoryFieldData = Record<string, CategoryFieldValue>;

// Helper functions to safely extract typed values from CategoryFieldData
const asString = (value: CategoryFieldValue): string => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return String(value);
};

const asInputValue = (value: CategoryFieldValue): string | number => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return value;
};

interface MaterialCategoryFieldsProps {
  categoryName: string;
  data: CategoryFieldData;
  onChange: (data: CategoryFieldData) => void;
}

// Props interface for individual category field components
interface CategoryFieldProps {
  data: CategoryFieldData;
  updateField: (field: string, value: string | number | boolean | null) => void;
}

export default function MaterialCategoryFields({ categoryName, data, onChange }: MaterialCategoryFieldsProps) {
  const updateField = (field: string, value: string | number | boolean | null) => {
    onChange({ ...data, [field]: value });
  };

  // Render fields based on child category name
  // Note: Fabric categories removed - use Fabric/Greige Master modules
  switch (categoryName) {
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
// TRIMS & NOTIONS CATEGORY (5 Children)
// ============================================================================

// 5. CLOSURES FIELDS
function ClosuresFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Closures Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="itemType">Item Type *</Label>
          <Select value={asString(data.itemType)} onValueChange={(value) => updateField('itemType', value)}>
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
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 20L, #5, 15mm"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={asInputValue(data.color)}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Silver, Gold, Black"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={asString(data.material)} onValueChange={(value) => updateField('material', value)}>
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
function LabelsTagsFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Labels & Tags Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="labelType">Label Type *</Label>
          <Select value={asString(data.labelType)} onValueChange={(value) => updateField('labelType', value)}>
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
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 2x4 inches, 50x25mm"
          />
        </div>

        <div>
          <Label htmlFor="printingColors">Printing Colors</Label>
          <Input
            id="printingColors"
            type="number"
            value={asInputValue(data.printingColors)}
            onChange={(e) => updateField('printingColors', Number(e.target.value))}
            placeholder="e.g., 4"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={asString(data.material)} onValueChange={(value) => updateField('material', value)}>
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
function ElasticTapesFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Elastic & Tapes Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.width)}
            onChange={(e) => updateField('width', Number(e.target.value))}
            placeholder="e.g., 25"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={asInputValue(data.color)}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Navy"
          />
        </div>

        <div>
          <Label htmlFor="stretchPercent">Stretch Percent (for elastic)</Label>
          <Input
            id="stretchPercent"
            type="number"
            value={asInputValue(data.stretchPercent)}
            onChange={(e) => updateField('stretchPercent', Number(e.target.value))}
            placeholder="e.g., 150"
          />
        </div>
      </div>
    </div>
  );
}

// 8. DECORATIVE FIELDS
function DecorativeFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Decorative Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.color)}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., Gold, Silver, Multi-color"
          />
        </div>

        <div>
          <Label htmlFor="size">Size *</Label>
          <Input
            id="size"
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 3mm, 1 inch wide"
          />
        </div>
      </div>
    </div>
  );
}

// 9. HARDWARE FIELDS
function HardwareFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Hardware Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 10mm, 1/2 inch"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={asString(data.material)} onValueChange={(value) => updateField('material', value)}>
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
          <Select value={asString(data.finish)} onValueChange={(value) => updateField('finish', value)}>
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
function SewingThreadFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Sewing Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={asString(data.threadType)} onValueChange={(value) => updateField('threadType', value)}>
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
            value={asInputValue(data.count)}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40/2, 120D"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={asInputValue(data.color)}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Black, Navy"
          />
        </div>

        <div>
          <Label htmlFor="composition">Composition</Label>
          <Input
            id="composition"
            value={asInputValue(data.composition)}
            onChange={(e) => updateField('composition', e.target.value)}
            placeholder="e.g., 100% Polyester, 100% Cotton"
          />
        </div>
      </div>
    </div>
  );
}

// 11. EMBROIDERY THREAD FIELDS
function EmbroideryThreadFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Embroidery Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={asString(data.threadType)} onValueChange={(value) => updateField('threadType', value)}>
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
            value={asInputValue(data.count)}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 40wt, 60wt"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={asInputValue(data.color)}
            onChange={(e) => updateField('color', e.target.value)}
            placeholder="e.g., White, Gold, Multi-color"
          />
        </div>
      </div>
    </div>
  );
}

// 12. SPECIALTY THREAD FIELDS
function SpecialtyThreadFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Specialty Thread Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="threadType">Thread Type *</Label>
          <Select value={asString(data.threadType)} onValueChange={(value) => updateField('threadType', value)}>
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
            value={asInputValue(data.count)}
            onChange={(e) => updateField('count', e.target.value)}
            placeholder="e.g., 30/3, 40/2"
          />
        </div>

        <div>
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={asInputValue(data.color)}
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
function PrimaryPackagingFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Primary Packaging Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 12x16 inches, 300x400mm"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={asString(data.material)} onValueChange={(value) => updateField('material', value)}>
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
          <Select
            value={asString(data.printingRequired) || 'No'}
            onValueChange={(value) => updateField('printingRequired', value)}
          >
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
function SecondaryPackagingFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Secondary Packaging Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.dimensions)}
            onChange={(e) => updateField('dimensions', e.target.value)}
            placeholder="e.g., 40x30x20 cm"
          />
        </div>

        <div>
          <Label htmlFor="material">Material *</Label>
          <Select value={asString(data.material)} onValueChange={(value) => updateField('material', value)}>
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
function LabelingFields({ data, updateField }: CategoryFieldProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Labeling Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={asString(data.type)} onValueChange={(value) => updateField('type', value)}>
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
            value={asInputValue(data.size)}
            onChange={(e) => updateField('size', e.target.value)}
            placeholder="e.g., 2x1 inch, 50x25mm"
          />
        </div>

        <div>
          <Label htmlFor="printingType">Printing Type *</Label>
          <Select value={asString(data.printingType)} onValueChange={(value) => updateField('printingType', value)}>
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
