// Style Master TypeScript types

export enum ProductionStage {
  ORDER_RECEIVED = 'ORDER_RECEIVED',
  PENDING_COSTING = 'PENDING_COSTING',
  PENDING_GREIGE_ORDER = 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED = 'TRIMS_NOT_ORDERED',
  IN_PRINTING = 'IN_PRINTING',
  IN_DYING = 'IN_DYING',
  IN_EMBROIDERY = 'IN_EMBROIDERY',
  IN_HANDWORK = 'IN_HANDWORK',
  IN_CUTTING = 'IN_CUTTING',
  IN_STITCHING = 'IN_STITCHING',
  IN_FINISHING = 'IN_FINISHING',
  READY_TO_SHIP = 'READY_TO_SHIP',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
}

export interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  buyerName: string;
  brandName: string;
  imageUrl: string | null;
  description: string | null;
  season: string | null;
  orderQuantity: number | null;
  orderDate: string | null;
  deliveryDate: string | null;
  orderValue: number | null;
  components: StyleComponent[];
  processes: StyleProcess[];
  costing: StyleCosting | null;
  sizeBreakdown: StyleSizeBreakdown[];
  productionTracking: StyleProductionTracking[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    components: number;
    processes: number;
  };
}

export interface StyleComponent {
  id: string;
  styleId: string;
  componentName: string;
  componentType: string;
  sortOrder: number;
  fabrics: StyleFabric[];
  accessories: StyleAccessory[];
  createdAt: string;
  updatedAt: string;
}

export interface StyleFabric {
  id: string;
  componentId: string;
  fabricName: string;
  fabricType: string;
  fabricColor: string | null;
  fabricGSM: string | null;
  fabricWidth: number | null;
  cadAverageMeters: number | null;
  cadAverageYards: number | null;
  supplierName: string | null;
  unitPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleAccessory {
  id: string;
  componentId: string;
  accessoryName: string;
  accessoryType: string;
  quantityPerPiece: number;
  unit: string;
  supplierName: string | null;
  unitPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProcess {
  id: string;
  styleId: string;
  processName: string;
  processType: string;
  isRequired: boolean;
  sortOrder: number;
  vendorName: string | null;
  estimatedCost: number | null;
  estimatedDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleCosting {
  id: string;
  styleId: string;
  totalFabricCost: number;
  totalAccessoryCost: number;
  totalMaterialCost: number;
  printingCost: number;
  dyingCost: number;
  embroideryCost: number;
  handworkCost: number;
  totalProcessingCost: number;
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  checkingCost: number;
  packingCost: number;
  totalProductionCost: number;
  overheadCost: number;
  profitMargin: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleSizeBreakdown {
  id: string;
  styleId: string;
  sizeName: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProductionTracking {
  id: string;
  styleId: string;
  currentStage: ProductionStage;
  piecesInStage: number;
  sizeName: string | null;
  piecesOrderReceived: number;
  piecesPendingCosting: number;
  piecesPendingGreige: number;
  piecesTrimsNotOrdered: number;
  piecesInPrinting: number;
  piecesInDying: number;
  piecesInEmbroidery: number;
  piecesInHandwork: number;
  piecesInCutting: number;
  piecesInStitching: number;
  piecesInFinishing: number;
  piecesReadyToShip: number;
  piecesShipped: number;
  piecesCompleted: number;
  lastUpdatedStage: ProductionStage | null;
  lastUpdatedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  preProduction: {
    ordersReceived: { styles: number; pieces: number };
    pendingCosting: { styles: number; pieces: number };
    pendingGreige: { styles: number; pieces: number };
    trimsNotOrdered: { styles: number; pieces: number };
  };
  processing: {
    inPrinting: { styles: number; pieces: number };
    inDying: { styles: number; pieces: number };
    inEmbroidery: { styles: number; pieces: number };
    inHandwork: { styles: number; pieces: number };
  };
  production: {
    inCutting: { styles: number; pieces: number };
    inStitching: { styles: number; pieces: number };
    inFinishing: { styles: number; pieces: number };
    readyToShip: { styles: number; pieces: number };
  };
}

// Form types for creating/updating styles
export interface CreateStyleFormData {
  styleCode: string;
  styleName: string;
  buyerName: string;
  brandName: string;
  description?: string;
  season?: string;
  orderQuantity?: number;
  orderDate?: string;
  deliveryDate?: string;
  orderValue?: number;
  components: ComponentFormData[];
  processes: ProcessFormData[];
}

export interface ComponentFormData {
  componentName: string;
  componentType: string;
  sortOrder?: number;
  fabrics?: FabricFormData[];
  accessories?: AccessoryFormData[];
}

export interface FabricFormData {
  fabricName: string;
  fabricType: string;
  fabricColor?: string;
  fabricGSM?: string;
  fabricWidth?: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  supplierName?: string;
  unitPrice?: number;
}

export interface AccessoryFormData {
  accessoryName: string;
  accessoryType: string;
  quantityPerPiece: number;
  unit: string;
  supplierName?: string;
  unitPrice?: number;
}

export interface ProcessFormData {
  processName: string;
  processType?: string;
  isRequired?: boolean;
  sortOrder?: number;
  vendorName?: string;
  estimatedCost?: number;
  estimatedDays?: number;
  notes?: string;
}

export interface CostingFormData {
  totalFabricCost?: number;
  totalAccessoryCost?: number;
  totalMaterialCost?: number;
  printingCost?: number;
  dyingCost?: number;
  embroideryCost?: number;
  handworkCost?: number;
  totalProcessingCost?: number;
  cuttingCost?: number;
  stitchingCost?: number;
  finishingCost?: number;
  checkingCost?: number;
  packingCost?: number;
  totalProductionCost?: number;
  overheadCost?: number;
  profitMargin?: number;
  totalCostPerPiece?: number;
  sellingPricePerPiece?: number;
  notes?: string;
}

// API Response types
export interface StylesListResponse {
  data: Style[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StyleResponse {
  data: Style;
  message?: string;
}

export interface DashboardSummaryResponse {
  data: DashboardSummary;
}

// Helper types for production stage display
export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  [ProductionStage.ORDER_RECEIVED]: 'Orders Received',
  [ProductionStage.PENDING_COSTING]: 'Pending Costing',
  [ProductionStage.PENDING_GREIGE_ORDER]: 'Pending Greige Order',
  [ProductionStage.TRIMS_NOT_ORDERED]: 'Trims Not Ordered',
  [ProductionStage.IN_PRINTING]: 'In Printing',
  [ProductionStage.IN_DYING]: 'In Dying',
  [ProductionStage.IN_EMBROIDERY]: 'In Embroidery',
  [ProductionStage.IN_HANDWORK]: 'In Handwork',
  [ProductionStage.IN_CUTTING]: 'In Cutting',
  [ProductionStage.IN_STITCHING]: 'In Stitching',
  [ProductionStage.IN_FINISHING]: 'In Finishing',
  [ProductionStage.READY_TO_SHIP]: 'Ready to Ship',
  [ProductionStage.SHIPPED]: 'Shipped',
  [ProductionStage.COMPLETED]: 'Completed',
};

// Fabric types dropdown options
export const FABRIC_TYPES = [
  'Cotton',
  'Silk',
  'Polyester',
  'Georgette',
  'Chiffon',
  'Crepe',
  'Linen',
  'Rayon',
  'Velvet',
  'Satin',
  'Jersey',
  'Other',
];

// Accessory types dropdown options
export const ACCESSORY_TYPES = [
  'Button',
  'Zipper',
  'Thread',
  'Label',
  'Lace',
  'Elastic',
  'Hook & Eye',
  'Snap Button',
  'Sequin',
  'Bead',
  'Tassel',
  'Other',
];

// Process names
export const PROCESS_NAMES = [
  'Printing',
  'Dying',
  'Embroidery',
  'Handwork',
];

// Unit options for accessories
export const UNIT_OPTIONS = [
  'pcs',
  'meters',
  'yards',
  'dozen',
  'grams',
  'kg',
];
