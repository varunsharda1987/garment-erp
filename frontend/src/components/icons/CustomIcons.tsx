/**
 * Custom Icons for Garment ERP
 *
 * Industry-specific icons that are not available in Lucide React.
 * All icons follow Lucide's design system:
 * - 24x24 viewBox
 * - 2px stroke width
 * - Rounded line caps and joins
 * - Outline/stroke style
 */

import type { FC, SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Sewing Machine Icon
 * Use for: Production processes, sewing operations
 */
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
    <path d="M4 18h16M6 18v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    <path d="M8 14V8a4 4 0 0 1 8 0v6" />
    <circle cx="12" cy="8" r="2" />
    <path d="M14 18v2a2 2 0 0 1-4 0v-2" />
  </svg>
);

/**
 * Fabric Roll Icon
 * Use for: Fabric inventory, fabric masters, greige fabric
 */
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

/**
 * Measuring Tape Icon
 * Use for: Measurements, size charts, CAD operations
 */
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
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M4 12h16M4 8h.01M4 16h.01M8 8h.01M8 16h.01M12 8h.01M12 16h.01M16 8h.01M16 16h.01M20 8h.01M20 16h.01" />
  </svg>
);

/**
 * Thread Spool Icon
 * Use for: Thread inventory (better than Cable icon)
 */
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

/**
 * Pattern/Template Icon
 * Use for: Pattern making, templates, style templates
 */
export const PatternIcon: FC<IconProps> = ({
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h2m-2 4h6m-6-8h1" />
  </svg>
);

/**
 * Hanger Icon
 * Use for: Finished goods, garment storage, style display
 */
export const HangerIcon: FC<IconProps> = ({
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
    <path d="M12 2a3 3 0 0 0-3 3v2" />
    <path d="M3 14h18l-2 6H5l-2-6z" />
    <path d="M9 7l3-3 3 3" />
    <circle cx="12" cy="5" r="1" />
  </svg>
);

/**
 * Needle Icon
 * Use for: Sewing, stitching operations, embroidery
 */
export const NeedleIcon: FC<IconProps> = ({
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
    <path d="M21 3L3 21" />
    <path d="M17 7l-4-4" />
    <circle cx="19" cy="5" r="2" />
  </svg>
);

/**
 * Iron Icon
 * Use for: Pressing, finishing operations
 */
export const IronIcon: FC<IconProps> = ({
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
    <path d="M3 14h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2z" />
    <path d="M5 14V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" />
    <path d="M12 6V4" />
  </svg>
);

/**
 * Size Chart Icon
 * Use for: Size specifications, grading, size management
 */
export const SizeChartIcon: FC<IconProps> = ({
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
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
    <path d="M13 13h4m-4 4h4" />
  </svg>
);

/**
 * Label/Tag Icon
 * Use for: Price tags, care labels, brand labels
 */
export const LabelIcon: FC<IconProps> = ({
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
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <circle cx="7" cy="7" r="1" />
  </svg>
);

/**
 * Zipper Icon
 * Use for: Zipper inventory, zipper details
 */
export const ZipperIcon: FC<IconProps> = ({
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
    <rect x="9" y="2" width="6" height="20" rx="1" />
    <path d="M9 6h6M9 10h6M9 14h6M9 18h6" />
    <path d="M12 2v2m0 16v2" />
  </svg>
);

/**
 * Button Icon
 * Use for: Button inventory, button details
 */
export const ButtonIcon: FC<IconProps> = ({
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
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2m0 14v2M3 12h2m14 0h2" />
  </svg>
);

/**
 * Elastic Icon
 * Use for: Elastic inventory, elastic details
 */
export const ElasticIcon: FC<IconProps> = ({
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
    <path d="M3 12c0-3 2-5 4-5s4 2 4 5-2 5-4 5-4-2-4-5z" />
    <path d="M13 12c0-3 2-5 4-5s4 2 4 5-2 5-4 5-4-2-4-5z" />
  </svg>
);

/**
 * Lace Icon
 * Use for: Lace inventory, lace details
 */
export const LaceIcon: FC<IconProps> = ({
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
    <path d="M3 12h3l1.5-3L9 12l1.5-3L12 12l1.5-3L15 12l1.5-3L18 12h3" />
    <path d="M3 8h18M3 16h18" />
  </svg>
);

/**
 * Packaging Icon
 * Use for: Packaging materials, packaging details
 */
export const PackagingIcon: FC<IconProps> = ({
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
    <path d="M12 2l8 4v12l-8 4-8-4V6l8-4z" />
    <path d="M12 22V12M4 6l8 4m8-4l-8 4" />
    <path d="M16 8v4" />
  </svg>
);

/**
 * Mannequin Icon
 * Use for: Display, fitting, style presentation
 */
export const MannequinIcon: FC<IconProps> = ({
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
    <circle cx="12" cy="5" r="2" />
    <path d="M9 7l-1 3v8m7-11l1 3v8M8 18h8" />
    <path d="M12 7v11" />
    <path d="M10 22h4" />
  </svg>
);

/**
 * Collar Icon
 * Use for: Collar types, style details
 */
export const CollarIcon: FC<IconProps> = ({
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
    <path d="M12 2L4 6v4l8 4 8-4V6l-8-4z" />
    <path d="M12 14v8" />
    <path d="M4 10l8 4m0-4l8-4" />
  </svg>
);

/**
 * Sleeve Icon
 * Use for: Sleeve types, style details
 */
export const SleeveIcon: FC<IconProps> = ({
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
    <path d="M3 8h6l3-3 3 3h6" />
    <path d="M9 8v10a2 2 0 0 1-4 0V8M15 8v10a2 2 0 0 0 4 0V8" />
  </svg>
);

/**
 * Pocket Icon
 * Use for: Pocket types, style details
 */
export const PocketIcon: FC<IconProps> = ({
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
    <path d="M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M8 4v6h8V4" />
  </svg>
);

/**
 * Cuff Icon
 * Use for: Cuff types, sleeve details
 */
export const CuffIcon: FC<IconProps> = ({
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
    <rect x="4" y="8" width="16" height="8" rx="1" />
    <path d="M8 12h8M8 14h8" />
  </svg>
);

/**
 * Embroidery Icon
 * Use for: Embroidery details, decorations
 */
export const EmbroideryIcon: FC<IconProps> = ({
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
    <path d="M12 2l2 4 4 2-2 4-4 2-2-4-4-2 2-4 4-2z" />
    <path d="M12 14l2 4 4 2-2 4-4 2-2-4-4-2 2-4 4-2z" />
  </svg>
);

/**
 * Print Icon (Screen Printing)
 * Use for: Printing details, screen print
 */
export const ScreenPrintIcon: FC<IconProps> = ({
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
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h4" />
    <circle cx="16" cy="16" r="2" />
  </svg>
);

/**
 * Cutting Table Icon
 * Use for: Cutting operations, production floor
 */
export const CuttingTableIcon: FC<IconProps> = ({
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
    <rect x="2" y="6" width="20" height="3" />
    <path d="M4 9v10M8 9v10M16 9v10M20 9v10" />
    <path d="M2 19h20" />
  </svg>
);

/**
 * Quality Badge Icon
 * Use for: Quality assurance, certification
 */
export const QualityBadgeIcon: FC<IconProps> = ({
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
    <path d="M12 2l2.5 5 5.5.75-4 4 1 5.75L12 15l-5 2.5 1-5.75-4-4 5.5-.75L12 2z" />
    <path d="M12 8v4m0 2h.01" />
  </svg>
);

/**
 * Washing Instructions Icon
 * Use for: Care labels, washing instructions
 */
export const WashingIcon: FC<IconProps> = ({
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
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="13" r="5" />
    <path d="M8 7h.01M12 7h.01M16 7h.01" />
  </svg>
);

/**
 * Color Swatch Icon
 * Use for: Color management, color selection
 */
export const ColorSwatchIcon: FC<IconProps> = ({
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
    <path d="M4 4l4 16 4-4 4 4 4-16H4z" />
    <path d="M8 4v4M12 4v4M16 4v4" />
  </svg>
);

/**
 * Barcode Icon
 * Use for: Product codes, tracking, inventory
 */
export const BarcodeIcon: FC<IconProps> = ({
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
    <path d="M3 6v12M7 6v12M10 6v12M14 6v12M17 6v12M21 6v12" />
    <path d="M3 18h18M3 6h18" />
  </svg>
);

/**
 * Sample Icon
 * Use for: Sample management, sample approvals
 */
export const SampleIcon: FC<IconProps> = ({
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
    <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
    <path d="M12 12l-8-4m8 4l8-4m-8 4v9" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

/**
 * Batch Icon
 * Use for: Batch processing, batch management
 */
export const BatchIcon: FC<IconProps> = ({
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
    <rect x="2" y="2" width="8" height="8" rx="1" />
    <rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" />
    <rect x="14" y="14" width="8" height="8" rx="1" />
  </svg>
);

// Export all icons as a collection for easy import
export const GarmentIcons = {
  SewingMachine: SewingMachineIcon,
  FabricRoll: FabricRollIcon,
  MeasuringTape: MeasuringTapeIcon,
  ThreadSpool: ThreadSpoolIcon,
  Pattern: PatternIcon,
  Hanger: HangerIcon,
  Needle: NeedleIcon,
  Iron: IronIcon,
  SizeChart: SizeChartIcon,
  Label: LabelIcon,
  Zipper: ZipperIcon,
  Button: ButtonIcon,
  Elastic: ElasticIcon,
  Lace: LaceIcon,
  Packaging: PackagingIcon,
  Mannequin: MannequinIcon,
  Collar: CollarIcon,
  Sleeve: SleeveIcon,
  Pocket: PocketIcon,
  Cuff: CuffIcon,
  Embroidery: EmbroideryIcon,
  ScreenPrint: ScreenPrintIcon,
  CuttingTable: CuttingTableIcon,
  QualityBadge: QualityBadgeIcon,
  Washing: WashingIcon,
  ColorSwatch: ColorSwatchIcon,
  Barcode: BarcodeIcon,
  Sample: SampleIcon,
  Batch: BatchIcon,
};
