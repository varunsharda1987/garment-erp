# Icon Usage Guide for Garment ERP

This guide explains how to use, add, and customize icons in our Garment ERP project using Lucide React, which is the icon library recommended by shadcn/ui.

## 📢 What's New (January 2025)

We've significantly expanded our icon system! Check out these new resources:

- ✅ **Tabler Icons** installed (v3.35.0) - 5,963+ additional icons!
- ✅ **29 Custom Icons** added - Garment industry-specific designs
- ✅ **Comprehensive Resources Guide** - 240K+ clothing icons cataloged
- ✅ **Integration Guide** - Step-by-step instructions for adding more icons
- ✅ **Enhanced Icon Library** - Better organization with 11 categories

### New Documentation
- **[ICON_RESOURCES.md](ICON_RESOURCES.md)** - Complete catalog of 10+ icon sources with 240K+ garment icons
- **[ICON_INTEGRATION_GUIDE.md](ICON_INTEGRATION_GUIDE.md)** - Detailed step-by-step integration instructions
- **[icon-library.ts](../frontend/src/lib/icon-library.ts)** - Organized icon groups for easy imports

## Current Icon Setup

Your project now includes:

### Lucide React (version 0.546.0)
- 1,500+ beautiful, consistent icons
- Tree-shakeable (only imports what you use)
- Fully customizable
- TypeScript support
- Perfect integration with shadcn/ui

### Tabler Icons (version 3.35.0) - NEW! ⭐
- 5,963+ additional icons
- MIT License (free commercial use)
- Similar style to Lucide
- Perfect for extending coverage
- Browse at: [tabler.io/icons](https://tabler.io/icons)

### Custom Garment Icons (29 icons) - NEW! ⭐
- Industry-specific designs
- Zipper, Button, Elastic, Lace, Packaging
- Collar, Sleeve, Pocket, Cuff
- Embroidery, Screen Print, Washing
- Sewing Machine, Fabric Roll, Thread Spool
- And 15+ more!

## 1. Using Existing Lucide Icons

### Browse Available Icons
Visit [lucide.dev](https://lucide.dev/icons/) to browse all available icons.

### Basic Usage

```tsx
import { PackageIcon, ScissorsIcon, RulerIcon } from 'lucide-react';

function MyComponent() {
  return (
    <div>
      <PackageIcon className="h-5 w-5 text-blue-500" />
      <ScissorsIcon className="h-6 w-6 text-gray-700" />
    </div>
  );
}
```

### Common Props

```tsx
<IconName
  size={24}                    // Size in pixels
  color="currentColor"         // Color
  strokeWidth={2}              // Line thickness (1-3)
  className="h-5 w-5"         // Tailwind classes
  absoluteStrokeWidth={false}  // Maintain stroke width when scaled
/>
```

## 2. Industry-Specific Icons for Garment ERP

Here are recommended Lucide icons for garment/textile industry:

### Garment Production
```tsx
import {
  Shirt,           // Garments, styles
  Scissors,        // Cutting, trims
  Ruler,           // Measurements, CAD
  PackageCheck,    // Quality control
  Layers,          // Fabric layers
  Pen,             // Design, sketching
  PenTool,         // Pattern making
  Palette,         // Colors
  Sparkles,        // Finishing, embellishments
} from 'lucide-react';
```

### Materials & Trims
```tsx
import {
  Cable,           // Thread (current usage)
  CircleDot,       // Buttons (current usage)
  Scissors,        // Lace (current usage)
  Zip,             // Zippers
  Disc,            // Rivets, metal accessories
  Badge,           // Labels, badges
  Tag,             // Price tags, labels
  Stamp,           // Printing, embossing
} from 'lucide-react';
```

### Inventory & Stock
```tsx
import {
  Package,         // General inventory
  PackagePlus,     // Stock in
  PackageMinus,    // Stock out
  PackageCheck,    // Verified stock
  PackageX,        // Damaged stock
  Warehouse,       // Storage
  BoxSelect,       // Batch selection
  Boxes,           // Multiple packages
} from 'lucide-react';
```

### Production Process
```tsx
import {
  Factory,         // Manufacturing
  Workflow,        // Production flow
  GitBranch,       // Process branching
  Timer,           // Production time
  Gauge,           // Efficiency metrics
  Activity,        // Production activity
  TrendingUp,      // Performance
  BarChart,        // Analytics
} from 'lucide-react';
```

### Quality & Inspection
```tsx
import {
  CheckCircle,     // Approved
  XCircle,         // Rejected
  AlertCircle,     // Warning
  Search,          // Inspection
  Eye,             // Visual check
  ScanLine,        // Barcode scanning
  Shield,          // Quality assurance
  Award,           // Quality certification
} from 'lucide-react';
```

### Orders & Customers
```tsx
import {
  ShoppingCart,    // Orders
  Users,           // Customers
  Building,        // Companies
  FileText,        // Documents
  Receipt,         // Invoices
  CreditCard,      // Payments
  Truck,           // Shipping
  MapPin,          // Locations
} from 'lucide-react';
```

## 3. Creating Custom Icons

When you need industry-specific icons not available in Lucide:

### Method 1: Using Custom SVG with Lucide Wrapper

```tsx
// frontend/src/components/icons/CustomIcons.tsx
import { FC, SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  className?: string;
}

// Example: Sewing Machine Icon
export const SewingMachineIcon: FC<IconProps> = ({
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
    {/* Add your custom SVG paths here */}
    <path d="M4 18h16M6 18v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    <path d="M8 14V8a4 4 0 0 1 8 0v6" />
    <circle cx="12" cy="8" r="2" />
    <path d="M14 18v2a2 2 0 0 1-4 0v-2" />
  </svg>
);

// Example: Fabric Roll Icon
export const FabricRollIcon: FC<IconProps> = ({
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
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
  </svg>
);

// Example: Measuring Tape Icon
export const MeasuringTapeIcon: FC<IconProps> = ({
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
    <path d="M4 12h16M4 8h.01M4 16h.01M8 8h.01M8 16h.01M12 8h.01M12 16h.01M16 8h.01M16 16h.01M20 8h.01M20 16h.01" />
    <rect x="2" y="6" width="20" height="12" rx="2" />
  </svg>
);

// Example: Thread Spool Icon (Better than Cable)
export const ThreadSpoolIcon: FC<IconProps> = ({
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
    <ellipse cx="12" cy="7" rx="6" ry="3" />
    <path d="M6 7v10c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
    <ellipse cx="12" cy="17" rx="6" ry="3" />
    <line x1="12" y1="2" x2="12" y2="7" />
  </svg>
);
```

### Usage:

```tsx
import { SewingMachineIcon, FabricRollIcon, MeasuringTapeIcon } from '@/components/icons/CustomIcons';

function ProductionDashboard() {
  return (
    <div>
      <SewingMachineIcon size={32} className="text-blue-500" />
      <FabricRollIcon size={24} color="green" />
      <MeasuringTapeIcon className="h-6 w-6" />
    </div>
  );
}
```

## 4. Icon Sources & Resources

### Free Icon Sets for Custom Icons

1. **Heroicons** - [heroicons.com](https://heroicons.com/)
   - Copy SVG code and adapt to your format

2. **Tabler Icons** - [tabler-icons.io](https://tabler-icons.io/)
   - Similar style to Lucide

3. **Iconoir** - [iconoir.com](https://iconoir.com/)
   - Outline style icons

4. **Icon Sets** - [iconsets.io](https://iconsets.io/)
   - Aggregator of free icon sets

5. **Create Your Own**
   - Use [Figma](https://figma.com) or [Inkscape](https://inkscape.org)
   - Export as SVG
   - Optimize with [SVGOMG](https://jakearchibald.github.io/svgomg/)

## 5. Best Practices

### Consistent Sizing
```tsx
// Define size constants
const ICON_SIZES = {
  xs: 'h-3 w-3',    // 12px
  sm: 'h-4 w-4',    // 16px
  md: 'h-5 w-5',    // 20px
  lg: 'h-6 w-6',    // 24px
  xl: 'h-8 w-8',    // 32px
} as const;
```

### Reusable Icon Component
```tsx
// frontend/src/components/ui/icon.tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconWrapperProps {
  icon: LucideIcon;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Icon({ icon: IconComponent, size = 'md', className }: IconWrapperProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  };

  return <IconComponent className={cn(sizeClasses[size], className)} />;
}
```

Usage:
```tsx
import { Icon } from '@/components/ui/icon';
import { Package, Shirt } from 'lucide-react';

<Icon icon={Package} size="lg" className="text-blue-500" />
<Icon icon={Shirt} size="md" />
```

## 6. Icon Library Structure

Create an organized icon library:

```tsx
// frontend/src/lib/icons.ts
import {
  // Production
  Shirt,
  Scissors,
  Ruler,
  Factory,

  // Materials
  Cable,
  CircleDot,
  Package,

  // Actions
  Plus,
  Edit,
  Trash2,
  Save,

  // Status
  CheckCircle,
  XCircle,
  AlertCircle,

  // Navigation
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Export organized groups
export const ProductionIcons = {
  Shirt,
  Scissors,
  Ruler,
  Factory,
};

export const MaterialIcons = {
  Thread: Cable,
  Button: CircleDot,
  Package,
};

export const ActionIcons = {
  Plus,
  Edit,
  Delete: Trash2,
  Save,
};

export const StatusIcons = {
  Success: CheckCircle,
  Error: XCircle,
  Warning: AlertCircle,
};

export const NavigationIcons = {
  Right: ChevronRight,
  Left: ChevronLeft,
  Down: ChevronDown,
  Up: ChevronUp,
};
```

## 7. Industry-Specific Recommendations

### Garment Types
- **Shirt** - Basic garment
- **ShirtIcon + variants** - Different styles
- Use custom icons for: Pants, Dresses, Jackets, etc.

### Measurements
- **Ruler** - General measurements
- **RulerSquare** - Pattern measurements
- **ScanLine** - Size scanning
- Custom: Measuring tape, size chart

### Processes
- **Scissors** - Cutting
- **Layers** - Layering fabric
- **Sparkles** - Finishing
- **Package** - Packaging
- Custom: Sewing machine, iron, steamer

### Quality Indicators
```tsx
// Color-coded quality icons
<CheckCircle className="h-5 w-5 text-green-500" />  // Pass
<XCircle className="h-5 w-5 text-red-500" />        // Fail
<AlertCircle className="h-5 w-5 text-yellow-500" /> // Warning
```

## 8. Installation of Additional Icon Libraries (Optional)

If you need more specialized icons:

```bash
# Install additional icon libraries
npm install @radix-ui/react-icons    # Already installed
npm install react-icons               # 50,000+ icons
npm install @iconify/react            # 200,000+ icons
```

### Using Multiple Libraries:
```tsx
import { Package } from 'lucide-react';           // Lucide
import { GearIcon } from '@radix-ui/react-icons'; // Radix (installed)
// import { GiSewingMachine } from 'react-icons/gi'; // Game Icons (if installed)
```

## 9. Animated Icons

For loading states and interactions:

```tsx
import { Loader2, RefreshCw } from 'lucide-react';

// Spinning loader (built into Lucide)
<Loader2 className="h-5 w-5 animate-spin" />

// Rotating refresh
<RefreshCw className="h-5 w-5 animate-spin" />

// Custom animation
<Package className="h-5 w-5 animate-pulse" />
```

## 10. Quick Reference: Current Usage in Project

```tsx
// Sidebar Navigation Icons
LayoutDashboard   // Main Dashboard
Users            // Masters group
Building2        // Customers
Package          // Generic items
Shirt            // Production
Calculator       // Cost sheets
Warehouse        // Inventory
BarChart3        // Reports
Wallet           // Finance

// Materials (Trims & Accessories)
Scissors         // Lace
CircleDot        // Buttons
Cable            // Threads

// Actions
Plus             // Add
Edit             // Edit
Trash2           // Delete
Upload           // Upload
Save             // Save

// Status
CheckCircle      // Success
XCircle          // Error
AlertCircle      // Warning
```

## Example: Adding a New Material Type

Let's say you want to add "Zippers" to your materials:

1. Choose an icon from Lucide: `Zip`

2. Update Sidebar:
```tsx
import { Zip } from 'lucide-react';

// In sidebar navGroups
{ title: '  Zippers', path: '/materials/zipper', icon: <Zip className="h-4 w-4" /> },
```

3. Create zipper service/types/pages following the same pattern as buttons/lace/threads

## Need Help?

- Browse icons: [lucide.dev](https://lucide.dev)
- Lucide React docs: [lucide.dev/guide/packages/lucide-react](https://lucide.dev/guide/packages/lucide-react)
- shadcn/ui icons: [ui.shadcn.com/docs/components/button#icon](https://ui.shadcn.com/docs/components/button)

---

**Pro Tip**: When designing custom icons, maintain consistency with Lucide's design principles:
- 24x24px viewBox
- 2px stroke width
- Rounded line caps
- Rounded line joins
- Outline/stroke style (not filled)
