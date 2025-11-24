# Custom Icons for Garment ERP

This directory contains custom SVG icons specifically designed for the garment manufacturing industry.

## 📊 Current Status

- **Total Custom Icons**: 29
- **Categories**: Materials, Garment Details, Production, Quality
- **Style**: Outline, consistent with Lucide design system
- **License**: Project-owned, free to use

## Quick Start

### Using Custom Icons

```tsx
import { SewingMachineIcon, FabricRollIcon, ZipperIcon } from '@/components/icons/CustomIcons';

function MyComponent() {
  return (
    <div>
      <SewingMachineIcon size={24} className="text-blue-500" />
      <FabricRollIcon size={32} className="text-green-600" />
      <ZipperIcon size={20} className="text-purple-500" />
    </div>
  );
}
```

### Using Organized Icon Library (Recommended)

```tsx
import { ProductionIcons, MaterialIcons, StyleDetailIcons } from '@/lib/icon-library';

function MyComponent() {
  return (
    <div>
      <ProductionIcons.SewingMachine className="h-6 w-6 text-purple-500" />
      <MaterialIcons.ThreadSpool className="h-5 w-5 text-blue-500" />
      <MaterialIcons.Zipper size={24} />
      <StyleDetailIcons.Collar className="h-5 w-5" />
    </div>
  );
}
```

## Available Custom Icons (29 Total)

### Production & Equipment (7 icons)
| Icon | Component | Use Case |
|------|-----------|----------|
| Sewing Machine | `SewingMachineIcon` | Production processes, sewing operations |
| Fabric Roll | `FabricRollIcon` | Fabric inventory, greige fabric, finished fabric |
| Measuring Tape | `MeasuringTapeIcon` | Measurements, size charts, CAD operations |
| Pattern | `PatternIcon` | Pattern making, templates, style templates |
| Hanger | `HangerIcon` | Finished goods, garment storage, style display |
| Needle | `NeedleIcon` | Sewing, stitching, embroidery |
| Cutting Table | `CuttingTableIcon` | Cutting operations, production floor |

### Materials & Trims (8 icons)
| Icon | Component | Use Case |
|------|-----------|----------|
| Thread Spool | `ThreadSpoolIcon` | Thread inventory (better than Cable icon) |
| Zipper | `ZipperIcon` | Zipper inventory, zipper details |
| Button | `ButtonIcon` | Button inventory, button details |
| Elastic | `ElasticIcon` | Elastic inventory, elastic details |
| Lace | `LaceIcon` | Lace inventory, lace details |
| Packaging | `PackagingIcon` | Packaging materials, packaging details |
| Label | `LabelIcon` | Price tags, care labels, brand labels |
| Color Swatch | `ColorSwatchIcon` | Color management, color selection |

### Garment Details (7 icons)
| Icon | Component | Use Case |
|------|-----------|----------|
| Collar | `CollarIcon` | Collar types, style details |
| Sleeve | `SleeveIcon` | Sleeve types, style details |
| Pocket | `PocketIcon` | Pocket types, style details |
| Cuff | `CuffIcon` | Cuff types, sleeve details |
| Embroidery | `EmbroideryIcon` | Embroidery details, decorations |
| Screen Print | `ScreenPrintIcon` | Printing details, screen print |
| Mannequin | `MannequinIcon` | Display, fitting, style presentation |

### Quality & Operations (7 icons)
| Icon | Component | Use Case |
|------|-----------|----------|
| Quality Badge | `QualityBadgeIcon` | Quality assurance, certification |
| Washing | `WashingIcon` | Care labels, washing instructions |
| Iron | `IronIcon` | Pressing, finishing operations |
| Size Chart | `SizeChartIcon` | Size specifications, grading, size management |
| Barcode | `BarcodeIcon` | Product codes, tracking, inventory |
| Sample | `SampleIcon` | Sample management, sample approvals |
| Batch | `BatchIcon` | Batch processing, batch management |

## Icon Props

All custom icons accept the following props:

```tsx
interface IconProps {
  size?: number;        // Size in pixels (default: 24)
  color?: string;       // Color (default: 'currentColor')
  className?: string;   // Tailwind classes
  ...SVGProps          // All standard SVG props
}
```

## Design Guidelines

All custom icons follow Lucide React's design system:
- **ViewBox**: 24x24
- **Stroke Width**: 2px
- **Stroke Line Cap**: Round
- **Stroke Line Join**: Round
- **Style**: Outline/stroke (not filled)

## Creating New Icons

1. **Design** your icon in Figma/Inkscape with:
   - 24x24px canvas
   - 2px stroke
   - Round caps and joins
   - Outline style

2. **Export** as SVG

3. **Optimize** using [SVGOMG](https://jakearchibald.github.io/svgomg/)

4. **Add** to `CustomIcons.tsx`:

```tsx
export const YourIconName: FC<IconProps> = ({
  size = 24,
  color = 'currentColor',
  className = '',
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Your SVG paths */}
  </svg>
);
```

5. **Update** `icon-library.ts` to include in appropriate group

## Files

- **CustomIcons.tsx** - All custom icon components
- **IconExamples.tsx** - Usage examples and demos
- **README.md** - This file

## Related Files

- **[../lib/icon-library.ts](../../lib/icon-library.ts)** - Organized icon groups
- **[../../docs/ICON_USAGE_GUIDE.md](../../../docs/ICON_USAGE_GUIDE.md)** - Complete icon guide

## Resources

- Lucide Icons: [lucide.dev](https://lucide.dev)
- Icon Design: [iconhandbook.co.uk](https://iconhandbook.co.uk)
- SVG Optimization: [jakearchibald.github.io/svgomg](https://jakearchibald.github.io/svgomg)
