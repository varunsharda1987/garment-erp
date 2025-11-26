/**
 * Centralized Icon Library for Garment ERP
 *
 * This file organizes all icons (Lucide + Tabler + Custom) into logical groups
 * for easy import and consistent usage across the application.
 *
 * Usage:
 * import { ProductionIcons, MaterialIcons } from '@/lib/icon-library';
 * <ProductionIcons.Shirt className="h-5 w-5" />
 * <MaterialIcons.ThreadSpool size={24} />
 */

// ==================== LUCIDE ICONS ====================
import {
  // Production & Manufacturing
  Shirt,
  Factory,
  TrendingUp,
  Workflow,
  Timer,
  Gauge,
  Activity,
  Sparkles,

  // Materials & Supplies
  Package,
  PackagePlus,
  PackageMinus,
  PackageCheck,
  PackageX,
  Boxes,
  Warehouse,
  BoxSelect,

  // Tools & Equipment
  Scissors,
  Ruler,
  Cable,
  CircleDot,
  Layers,
  Pen,
  PenTool,

  // Actions
  Plus,
  Edit,
  Trash2,
  Save,
  Download,
  Upload,
  Copy,
  Search,
  Filter,
  RefreshCw,

  // Status Indicators
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,

  // Navigation
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Home,
  Menu,
  X,

  // User & Organization
  User,
  UserCircle,
  Users,
  Building,
  Building2,
  Mail,
  Phone,
  MapPin,

  // Financial
  CreditCard,
  Wallet,
  Receipt,
  Calculator,
  DollarSign,

  // Inventory & Stock
  BarChart3,
  TrendingDown,
  ArrowRightLeft,
  ClipboardCheck,
  ClipboardList,
  ListChecks,

  // Documents & Reports
  FileText,
  FileSpreadsheet,
  FilePlus,
  FileCheck,
  FolderOpen,
  Folder,

  // Quality & Inspection
  Eye,
  ScanLine,
  Shield,
  Award,
  Star,
  Target,

  // Settings & Config
  Settings,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Lock,
  Unlock,

  // Shipping & Logistics
  Truck,
  Package2,
  MapPinned,
  Calendar,

  // UI Elements
  Loader2,
  Check,
  MoreHorizontal,
  MoreVertical,

  // Design & Colors
  Palette,
  Paintbrush,
  Droplet,
  Image,

  // Special
  Stamp,
  Tag,
  Badge,
  Disc,
} from 'lucide-react';

// ==================== TABLER ICONS ====================
// Import select Tabler icons that complement Lucide
import {
  IconShirt as TablerShirt,
  IconRuler2 as TablerRuler,
  IconHanger as TablerHanger,
  IconColorSwatch as TablerColorSwatch,
  IconBarcode as TablerBarcode,
  IconPackage as TablerPackage,
  IconBoxSeam as TablerBox,
  IconZoomScan as TablerZoomScan,
  IconCertificate as TablerCertificate,
  IconWashMachine as TablerWashMachine,
} from '@tabler/icons-react';

// ==================== CUSTOM ICONS ====================
import {
  SewingMachineIcon,
  FabricRollIcon,
  MeasuringTapeIcon,
  ThreadSpoolIcon,
  PatternIcon,
  HangerIcon,
  NeedleIcon,
  IronIcon,
  SizeChartIcon,
  LabelIcon,
  ZipperIcon,
  ButtonIcon,
  ElasticIcon,
  LaceIcon,
  PackagingIcon,
  MannequinIcon,
  CollarIcon,
  SleeveIcon,
  PocketIcon,
  CuffIcon,
  EmbroideryIcon,
  ScreenPrintIcon,
  CuttingTableIcon,
  QualityBadgeIcon,
  WashingIcon,
  ColorSwatchIcon,
  BarcodeIcon,
  SampleIcon,
  BatchIcon,
} from '@/components/icons/CustomIcons';

/**
 * Production & Manufacturing Icons
 */
export const ProductionIcons = {
  // Garments
  Shirt,
  Hanger: HangerIcon,
  TablerShirt, // Alternative from Tabler

  // Machines & Equipment
  SewingMachine: SewingMachineIcon,
  Factory,
  Iron: IronIcon,
  Needle: NeedleIcon,
  CuttingTable: CuttingTableIcon,

  // Processes
  Scissors, // Cutting
  Workflow,
  Activity,

  // Measurements
  Ruler,
  MeasuringTape: MeasuringTapeIcon,
  Pattern: PatternIcon,
  SizeChart: SizeChartIcon,
  TablerRuler, // Alternative ruler

  // Performance
  TrendingUp,
  Timer,
  Gauge,

  // AI & Advanced
  Sparkles,
} as const;

/**
 * Materials & Trims Icons
 */
export const MaterialIcons = {
  // Fabric
  FabricRoll: FabricRollIcon,
  Layers,

  // Trims & Accessories
  Thread: Cable, // Current usage (Lucide)
  ThreadSpool: ThreadSpoolIcon, // Better custom alternative
  Button: ButtonIcon,
  ButtonSimple: CircleDot, // Simpler button from Lucide
  Lace: LaceIcon,
  LaceSimple: Scissors, // Alternative
  Zipper: ZipperIcon,
  Elastic: ElasticIcon,
  Label: LabelIcon,
  LabelSimple: Tag, // Lucide tag
  Badge,
  Stamp,
  Disc, // Rivets, metal accessories

  // Packaging
  Packaging: PackagingIcon,
  Package,
  TablerBox, // Alternative box

  // Special
  ColorSwatch: ColorSwatchIcon,
  TablerColorSwatch, // Alternative from Tabler
} as const;

/**
 * Style Details Icons
 */
export const StyleDetailIcons = {
  // Garment Parts
  Collar: CollarIcon,
  Sleeve: SleeveIcon,
  Pocket: PocketIcon,
  Cuff: CuffIcon,

  // Display & Fitting
  Mannequin: MannequinIcon,
  Hanger: HangerIcon,
  TablerHanger, // Alternative from Tabler

  // Decorations
  Embroidery: EmbroideryIcon,
  ScreenPrint: ScreenPrintIcon,
  Pattern: PatternIcon,
} as const;

/**
 * Inventory & Stock Icons
 */
export const InventoryIcons = {
  // Stock Operations
  Package,
  PackagePlus, // Stock in
  PackageMinus, // Stock out
  PackageCheck, // Verified stock
  PackageX, // Damaged stock
  Boxes,
  BoxSelect,
  TablerPackage, // Alternative from Tabler

  // Warehouse
  Warehouse,

  // Movements
  ArrowRightLeft,

  // Reports
  BarChart3,
  TrendingUp,
  TrendingDown,

  // Batch & Sample
  Batch: BatchIcon,
  Sample: SampleIcon,

  // Tracking
  Barcode: BarcodeIcon,
  TablerBarcode, // Alternative from Tabler
} as const;

/**
 * Action Icons (CRUD operations)
 */
export const ActionIcons = {
  // Create
  Plus,
  FilePlus,
  PackagePlus,

  // Read/View
  Eye,
  Search,
  FileText,
  TablerZoomScan, // Advanced search/scan

  // Update
  Edit,
  Pen,
  RefreshCw,

  // Delete
  Delete: Trash2,
  X,
  PackageX,

  // Other Actions
  Save,
  Download,
  Upload,
  Copy,
  Filter,
} as const;

/**
 * Status & State Icons
 */
export const StatusIcons = {
  // Success
  Success: CheckCircle,
  Check,
  Approved: FileCheck,
  Verified: PackageCheck,
  Award,

  // Error/Failure
  Error: XCircle,
  Failed: PackageX,

  // Warning
  Warning: AlertCircle,
  Alert: AlertTriangle,

  // Info
  Info,
  Help: HelpCircle,

  // Loading
  Loading: Loader2,

  // Special
  Star,
  Sparkles,
  Target,
} as const;

/**
 * Navigation Icons
 */
export const NavigationIcons = {
  // Arrows
  Left: ChevronLeft,
  Right: ChevronRight,
  Up: ChevronUp,
  Down: ChevronDown,
  ArrowLeft,
  ArrowRight,

  // Menu
  Menu,
  Close: X,
  Home,

  // More Options
  MoreHorizontal,
  MoreVertical,
} as const;

/**
 * User & Organization Icons
 */
export const UserIcons = {
  User,
  UserCircle,
  Users,
  Building,
  Building2,
  Mail,
  Phone,
  MapPin,
} as const;

/**
 * Financial Icons
 */
export const FinanceIcons = {
  Calculator,
  Wallet,
  CreditCard,
  Receipt,
  DollarSign,
} as const;

/**
 * Document & Report Icons
 */
export const DocumentIcons = {
  File: FileText,
  Spreadsheet: FileSpreadsheet,
  FilePlus,
  FileCheck,
  Folder,
  FolderOpen,
  BOM: ListChecks,
  Order: ClipboardList,
  Checklist: ClipboardCheck,
} as const;

/**
 * Quality & Inspection Icons
 */
export const QualityIcons = {
  Eye,
  Search,
  ScanLine,
  Shield,
  Award,
  Star,
  CheckCircle,
  XCircle,
  Target,
  QualityBadge: QualityBadgeIcon,
  TablerCertificate, // Certificate from Tabler
  TablerZoomScan, // Advanced inspection
} as const;

/**
 * Settings & Configuration Icons
 */
export const SettingsIcons = {
  Settings,
  Sliders,
  ToggleOn: ToggleRight,
  ToggleOff: ToggleLeft,
  Lock,
  Unlock,
} as const;

/**
 * Shipping & Logistics Icons
 */
export const ShippingIcons = {
  Truck,
  Package: Package2,
  MapPin: MapPinned,
  Calendar,
} as const;

/**
 * Design & Styling Icons
 */
export const DesignIcons = {
  Palette,
  Paintbrush,
  Color: Droplet,
  Image,
  Pen,
  PenTool,
  ColorSwatch: ColorSwatchIcon,
  TablerColorSwatch, // Alternative from Tabler
} as const;

/**
 * Care & Instructions Icons
 */
export const CareIcons = {
  Washing: WashingIcon,
  Iron: IronIcon,
  Label: LabelIcon,
  Tag,
  TablerWashMachine, // Alternative washing machine
} as const;

/**
 * All Icons - For browsing/reference
 */
export const AllIcons = {
  ...ProductionIcons,
  ...MaterialIcons,
  ...StyleDetailIcons,
  ...InventoryIcons,
  ...ActionIcons,
  ...StatusIcons,
  ...NavigationIcons,
  ...UserIcons,
  ...FinanceIcons,
  ...DocumentIcons,
  ...QualityIcons,
  ...SettingsIcons,
  ...ShippingIcons,
  ...DesignIcons,
  ...CareIcons,
} as const;

/**
 * Icon size constants for consistent usage
 */
export const ICON_SIZES = {
  xs: 'h-3 w-3', // 12px
  sm: 'h-4 w-4', // 16px
  md: 'h-5 w-5', // 20px - default
  lg: 'h-6 w-6', // 24px
  xl: 'h-8 w-8', // 32px
  '2xl': 'h-10 w-10', // 40px
  '3xl': 'h-12 w-12', // 48px
} as const;

/**
 * Common icon color classes
 */
export const ICON_COLORS = {
  primary: 'text-blue-500',
  secondary: 'text-gray-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  muted: 'text-gray-400',
  white: 'text-white',
  black: 'text-black',
} as const;

/**
 * Tabler icon props helper
 * Use this for consistent Tabler icon styling
 */
export const TABLER_PROPS = {
  size: 24,
  stroke: 2,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
export type IconColor = keyof typeof ICON_COLORS;

/**
 * Icon count summary
 * - Lucide: ~70+ icons used
 * - Tabler: ~12 specialty icons
 * - Custom: 29 garment-specific icons
 * Total: 110+ organized icons
 */
