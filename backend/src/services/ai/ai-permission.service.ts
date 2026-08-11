/**
 * AI Permission Service
 *
 * Handles role-based data access filtering for AI responses.
 * Ensures AI only reveals data the user is authorized to see.
 */

import { UserRole } from '@prisma/client';
import { logWarn } from '../../utils/logger';

// Data access permissions by role
// Roles: ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE, FACTORY_SUPERVISOR, MERCHANDISER
const DATA_PERMISSIONS: Record<string, Record<UserRole, boolean>> = {
  // Order & Sales Data
  orders: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: true,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: true,
  },
  orderFinancials: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: true,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: true,
  },

  // Pricing Data
  costPrices: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: true,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: false,
  },
  sellingPrices: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: true,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: true,
  },
  profitMargins: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: false,
  },

  // Customer & Supplier Data
  customerContacts: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: true,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: true,
  },
  supplierPricing: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: false,
    INVENTORY: true,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: true,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: false,
  },

  // Inventory Data
  inventoryQuantities: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: false,
    INVENTORY: true,
    ACCOUNTS: false,
    QUALITY: false,
    PURCHASE: true,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: false,
  },
  stockMovements: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: false,
    INVENTORY: true,
    ACCOUNTS: false,
    QUALITY: false,
    PURCHASE: true,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: false,
  },

  // Production Data
  productionStatus: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: false,
    QUALITY: true,
    PURCHASE: false,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: true,
  },
  workOrders: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: false,
    QUALITY: true,
    PURCHASE: false,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: true,
  },

  // Style & Design Data
  styles: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: true,
    INVENTORY: true,
    ACCOUNTS: true,
    QUALITY: true,
    PURCHASE: true,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: true,
  },
  bomDetails: {
    ADMIN: true,
    PRODUCTION_MANAGER: true,
    SALES: false,
    INVENTORY: true,
    ACCOUNTS: true,
    QUALITY: true,
    PURCHASE: true,
    FACTORY_SUPERVISOR: true,
    MERCHANDISER: true,
  },

  // Financial Data
  financialReports: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: true,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: false,
  },
  userActivity: {
    ADMIN: true,
    PRODUCTION_MANAGER: false,
    SALES: false,
    INVENTORY: false,
    ACCOUNTS: false,
    QUALITY: false,
    PURCHASE: false,
    FACTORY_SUPERVISOR: false,
    MERCHANDISER: false,
  },
};

// Sensitive fields that should NEVER be exposed to AI
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'apiKey',
  'apiSecret',
  'token',
  'accessToken',
  'refreshToken',
  'einvClientId',
  'einvClientSecret',
  'einvApiPassword',
  'appKey',
  'sek',
  'authToken',
  'bankAccountNumber',
  'ifscCode',
  'upiId',
  'gstNumber',
  'panNumber',
  'salary',
  'compensation',
  'ssn',
  'socialSecurityNumber',
];

// Role-based suggested questions
const SUGGESTED_QUESTIONS: Record<UserRole, string[]> = {
  ADMIN: [
    'Show system statistics',
    'List pending approvals',
    'Generate monthly report',
    'Which orders are delayed?',
    'Show user activity summary',
  ],
  PRODUCTION_MANAGER: [
    'Orders due this week?',
    'Production bottlenecks?',
    'Styles pending BOM approval?',
    'Show inventory alerts',
    'Team workload summary',
  ],
  SALES: [
    'Pending customer orders?',
    'Customer order history for [customer]',
    'Quote for style [style code]',
    'Delivery status update',
    'Which orders need follow-up?',
  ],
  INVENTORY: [
    'Low stock materials?',
    'Pending material receipts?',
    'Stock movement report',
    'Warehouse utilization',
    'Materials to reorder',
  ],
  ACCOUNTS: [
    'Outstanding payments?',
    'Invoice summary this month',
    'Cost analysis for [style]',
    'Supplier payment due dates',
    'Financial dashboard overview',
  ],
  QUALITY: [
    'Quality issues summary',
    'Pending inspections?',
    'Defect rate this month',
    'Quality reports by style',
    'Testing status for orders',
  ],
  PURCHASE: [
    'Pending purchase orders?',
    'Supplier performance summary',
    'Material lead times',
    'GRN pending items',
    'Price comparison for materials',
  ],
  FACTORY_SUPERVISOR: [
    'Current work orders?',
    'Material availability for [style]?',
    'Production schedule this week',
    'Cutting progress report',
    'Worker allocation status',
  ],
  MERCHANDISER: [
    'Order status summary',
    'Delivery timeline for [order]',
    'Style development status',
    'Sample tracking status',
    'Customer communication pending',
  ],
};

class AIPermissionService {
  /**
   * Check if user role has access to specific data type
   */
  canAccess(role: UserRole, dataType: string): boolean {
    const permissions = DATA_PERMISSIONS[dataType];
    if (!permissions) {
      logWarn(`[AIPermission] Unknown data type: ${dataType}`);
      return false;
    }
    return permissions[role] || false;
  }

  /**
   * Get all data types user can access
   */
  getAccessibleDataTypes(role: UserRole): string[] {
    return Object.entries(DATA_PERMISSIONS)
      .filter(([_, permissions]) => permissions[role])
      .map(([dataType]) => dataType);
  }

  /**
   * Filter data object to remove sensitive fields
   */
  filterSensitiveData<T extends Record<string, unknown>>(data: T): Partial<T> {
    const filtered: Partial<T> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        continue;
      }

      // Recursively filter nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        filtered[key as keyof T] = this.filterSensitiveData(value as Record<string, unknown>) as T[keyof T];
      } else if (Array.isArray(value)) {
        filtered[key as keyof T] = value.map((item) =>
          typeof item === 'object' ? this.filterSensitiveData(item as Record<string, unknown>) : item
        ) as T[keyof T];
      } else {
        filtered[key as keyof T] = value as T[keyof T];
      }
    }

    return filtered;
  }

  /**
   * Filter pricing data based on role
   */
  filterPricingData<T extends Record<string, unknown>>(data: T, role: UserRole): Partial<T> {
    const filtered = { ...data };

    // Remove cost prices if not authorized
    if (!this.canAccess(role, 'costPrices')) {
      const costFields = ['costPrice', 'costPerUnit', 'materialCost', 'laborCost', 'overheadCost', 'totalCost'];
      for (const field of costFields) {
        delete filtered[field];
      }
    }

    // Remove selling prices if not authorized
    if (!this.canAccess(role, 'sellingPrices')) {
      const priceFields = ['sellingPrice', 'unitPrice', 'price', 'amount'];
      for (const field of priceFields) {
        delete filtered[field];
      }
    }

    // Remove margin data if not authorized
    if (!this.canAccess(role, 'profitMargins')) {
      const marginFields = ['margin', 'profit', 'profitMargin', 'grossMargin', 'netMargin'];
      for (const field of marginFields) {
        delete filtered[field];
      }
    }

    return filtered;
  }

  /**
   * Get suggested questions for user's role
   */
  getSuggestedQuestions(role: UserRole): string[] {
    return SUGGESTED_QUESTIONS[role] || SUGGESTED_QUESTIONS.MERCHANDISER;
  }

  /**
   * Generate permission context string for AI system prompt
   */
  getPermissionContext(role: UserRole): string {
    const accessible = this.getAccessibleDataTypes(role);
    const restricted = Object.keys(DATA_PERMISSIONS).filter((dt) => !accessible.includes(dt));

    return `
USER ROLE: ${role}

DATA ACCESS PERMISSIONS:
- Can access: ${accessible.join(', ') || 'Limited access'}
- Cannot access: ${restricted.join(', ') || 'Full access'}

IMPORTANT RESTRICTIONS:
- Never reveal cost prices, profit margins, or financial data unless explicitly authorized
- Never expose sensitive information like passwords, API keys, bank details
- If user asks for restricted data, politely explain they don't have permission
- Suggest they contact their manager or admin for access
`;
  }

  /**
   * Check if a question is asking for restricted data
   */
  isRestrictedQuery(question: string, role: UserRole): { restricted: boolean; reason?: string } {
    const lowerQuestion = question.toLowerCase();

    // Check for cost/pricing queries
    const costKeywords = ['cost', 'margin', 'profit', 'expense', 'pricing breakdown'];
    if (costKeywords.some((kw) => lowerQuestion.includes(kw))) {
      if (!this.canAccess(role, 'costPrices') && !this.canAccess(role, 'profitMargins')) {
        return {
          restricted: true,
          reason: 'Cost and margin data is restricted for your role. Please contact Accounts or Admin.',
        };
      }
    }

    // Check for user activity queries
    const activityKeywords = ['user activity', 'audit log', 'who logged', 'user actions'];
    if (activityKeywords.some((kw) => lowerQuestion.includes(kw))) {
      if (!this.canAccess(role, 'userActivity')) {
        return {
          restricted: true,
          reason: 'User activity data is restricted to Admin only.',
        };
      }
    }

    // Check for financial report queries
    const financeKeywords = ['financial report', 'revenue', 'income statement', 'balance sheet'];
    if (financeKeywords.some((kw) => lowerQuestion.includes(kw))) {
      if (!this.canAccess(role, 'financialReports')) {
        return {
          restricted: true,
          reason: 'Financial reports are restricted for your role. Please contact Accounts.',
        };
      }
    }

    return { restricted: false };
  }
}

export const aiPermissionService = new AIPermissionService();
