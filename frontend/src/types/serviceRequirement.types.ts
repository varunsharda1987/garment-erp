/**
 * Service Requirement Types
 * Frontend type definitions for work order service requirements management
 */

// ============================================
// ENUMS
// ============================================

export const ServiceType = {
  EMBROIDERY: 'EMBROIDERY',
  PRINTING: 'PRINTING',
  DYEING: 'DYEING',
  WASHING: 'WASHING',
  FINISHING: 'FINISHING',
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  HANDWORK: 'HANDWORK',
  SMOCKING: 'SMOCKING',
  TRANSPORTATION: 'TRANSPORTATION',
  OTHER: 'OTHER',
} as const;

export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const ServiceTypeLabels: Record<ServiceType, string> = {
  EMBROIDERY: 'Embroidery',
  PRINTING: 'Printing',
  DYEING: 'Dyeing',
  WASHING: 'Washing',
  FINISHING: 'Finishing',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  HANDWORK: 'Handwork',
  SMOCKING: 'Smocking',
  TRANSPORTATION: 'Transportation',
  OTHER: 'Other',
};

export const ServiceRequirementStatus = {
  PENDING: 'PENDING',
  PO_GENERATED: 'PO_GENERATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ServiceRequirementStatus = (typeof ServiceRequirementStatus)[keyof typeof ServiceRequirementStatus];

export const ServiceRequirementStatusLabels: Record<ServiceRequirementStatus, string> = {
  PENDING: 'Pending',
  PO_GENERATED: 'PO Generated',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const ServiceRequirementStatusColors: Record<ServiceRequirementStatus, string> = {
  PENDING: 'bg-orange-100 text-orange-800',
  PO_GENERATED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const RequirementSource = {
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;

export type RequirementSource = (typeof RequirementSource)[keyof typeof RequirementSource];

export const RequirementSourceLabels: Record<RequirementSource, string> = {
  WORK_ORDER: 'Work Order',
  MANUAL: 'Manual',
};

// ============================================
// SUMMARY TYPES
// ============================================

export interface WorkOrderSummary {
  id: string;
  workOrderNumber: string;
  orderId: string;
  status: string;
  styles?: {
    id: string;
    styleCode: string;
    styleName: string;
  };
}

export interface StyleProcessSummary {
  id: string;
  processType: string;
  processName: string;
}

export interface ProcessorSummary {
  id: string;
  supplierCode: string;
  supplierName: string;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
}

// ============================================
// SERVICE REQUIREMENT PO LINK
// ============================================

export interface ServiceRequirementPOLink {
  id: string;
  serviceRequirementId: string;
  purchaseOrderItemId: string;
  quantityLinked: number;
  createdAt: string;
  purchaseOrderItem?: {
    id: string;
    purchaseOrderId: string;
    orderedQuantity: number;
    unitPrice: number;
  };
}

// ============================================
// SERVICE REQUIREMENT
// ============================================

export interface ServiceRequirement {
  id: string;
  workOrderId: string;
  serviceType: ServiceType;
  processId: string | null;
  quantityRequired: number;
  unit: string;
  preferredProcessorId: string | null;
  assignedProcessorId: string | null;
  estimatedRate: number | null;
  estimatedTotal: number | null;
  status: ServiceRequirementStatus;
  purchaseOrderId: string | null;
  jobWorkOrderId: string | null;
  embroiderySendOutId: string | null;
  processingBatchId: string | null;
  source: RequirementSource;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;

  // Relations (serialized to camelCase)
  workOrder?: WorkOrderSummary;
  styleProcess?: StyleProcessSummary | null;
  preferredProcessor?: ProcessorSummary | null;
  assignedProcessor?: ProcessorSummary | null;
  purchaseOrder?: PurchaseOrderSummary | null;
  createdBy?: UserSummary;
  poLinks?: ServiceRequirementPOLink[];
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CalculateServicesRequest {
  workOrderId: string;
  userId: string;
}

export interface SuggestProcessorRequest {
  serviceType: ServiceType;
  styleId?: string;
}

export interface BulkProcessorAssignment {
  requirementId: string;
  processorId: string;
}

export interface GroupByProcessorRequest {
  requirementIds: string[];
}

export interface GenerateServicePORequest {
  processorId: string;
  requirementIds: string[];
  expectedDeliveryDate: string;
  remarks?: string;
}

export interface BulkGenerateServicePOsRequest {
  groups: Array<{
    processorId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
  }>;
}

export interface UpdateServiceExecutionRequest {
  jobWorkOrderId?: string;
  embroiderySendOutId?: string;
  processingBatchId?: string;
  actualQuantity?: number;
  actualCost?: number;
  status: ServiceRequirementStatus;
}

// ============================================
// FILTER TYPES
// ============================================

export interface ServiceRequirementFilters {
  orderId?: string;
  workOrderId?: string;
  serviceType?: ServiceType | ServiceType[];
  status?: ServiceRequirementStatus | ServiceRequirementStatus[];
  processorId?: string;
  source?: RequirementSource;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ServiceRequirementListResponse {
  success: boolean;
  data: ServiceRequirement[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total?: number;
}

export interface ServiceRequirementResponse {
  success: boolean;
  data: ServiceRequirement;
  message?: string;
}

export interface CalculationResultResponse {
  success: boolean;
  data: {
    requirements: ServiceRequirement[];
    summary: {
      totalServices: number;
      totalEstimatedCost: number;
      servicesWithPreferredProcessor: number;
      servicesWithoutProcessor: number;
    };
  };
  message?: string;
}

export interface ServicePOGenerationResponse {
  success: boolean;
  data: {
    purchaseOrder: {
      id: string;
      poNumber: string;
      totalAmount: number;
    };
    linkedRequirements: number;
  };
  message?: string;
}

export interface BulkServicePOGenerationResponse {
  success: boolean;
  data: {
    purchaseOrders: Array<{
      id: string;
      poNumber: string;
      processorId: string;
      totalAmount: number;
    }>;
    totalPOs: number;
    totalAmount: number;
    errors: Array<{
      processorId: string;
      error: string;
    }>;
  };
  message?: string;
}

// ============================================
// SUMMARY TYPES
// ============================================

export interface ServiceRequirementsSummary {
  totalServices: number;
  totalEstimatedCost: number;
  pendingCount: number;
  poGeneratedCount: number;
  inProgressCount: number;
  completedCount: number;
  servicesWithProcessor: number;
  servicesWithoutProcessor: number;
  byServiceType: Record<ServiceType, number>;
}

export interface ServiceDashboardStats {
  totalServices: number;
  pendingServices: number;
  poGeneratedServices: number;
  inProgressServices: number;
  completedServices: number;
  servicesWithoutProcessor: number;
  totalEstimatedCost: number;
  byServiceType: Array<{
    serviceType: ServiceType;
    count: number;
    estimatedCost: number;
  }>;
  byProcessor: Array<{
    processorId: string;
    processorName: string;
    requirementCount: number;
    totalValue: number;
  }>;
}

export interface DashboardStatsResponse {
  success: boolean;
  data: ServiceDashboardStats;
}

export interface WorkOrderServiceSummaryResponse {
  success: boolean;
  data: ServiceRequirementsSummary;
}

export interface OrderServiceRequirementsSummary {
  orderId: string;
  workOrderCount: number;
  totalServices: number;
  pendingServices: number;
  processorAssigned: number;
  poGenerated: number;
  completed: number;
  estimatedTotalCost: number;
  byServiceType: Record<string, { count: number; pending: number; poGenerated: number }>;
}

export interface OrderServiceSummaryResponse {
  success: boolean;
  data: OrderServiceRequirementsSummary;
}

// ============================================
// PROCESSOR SUGGESTION TYPES
// ============================================

export interface ProcessorSuggestion {
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: ProcessorAlternative[];
}

export interface ProcessorAlternative {
  processorId: string;
  processorName: string;
  lastOrderDate?: string;
  orderCount?: number;
  score?: number;
}

export interface ProcessorSuggestionForRequirement extends ProcessorSuggestion {
  requirementId: string;
  serviceType: ServiceType;
  workOrderId: string;
  workOrder?: WorkOrderSummary;
  currentProcessorId: string | null;
}

export interface ProcessorSuggestionsResponse {
  success: boolean;
  data: {
    suggestions: ProcessorSuggestionForRequirement[];
    stats: {
      total: number;
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
      withSuggestion: number;
      needsManual: number;
    };
  };
}

export interface BulkAssignResponse {
  updatedCount: number;
  requested: number;
}

export interface AutoAssignResponse {
  assigned: number;
  skipped: number;
}

// ============================================
// GROUPING TYPES
// ============================================

export interface ProcessorGroup {
  processorId: string;
  processorName: string;
  requirements: ServiceRequirement[];
  deliveryDate: string;
  remarks: string;
}

export interface GroupByProcessorResponse {
  success: boolean;
  data: {
    groups: Record<string, ServiceRequirement[]>;
    unassigned: ServiceRequirement[];
    summary: {
      totalRequirements: number;
      totalProcessors: number;
      unassignedCount: number;
      totalEstimatedCost: number;
    };
  };
}

// ============================================
// TABLE/LIST TYPES
// ============================================

export interface ServiceRequirementTableRow extends ServiceRequirement {
  workOrderNumber?: string;
  processorName?: string;
  serviceTypeLabel: string;
  statusLabel: string;
}
