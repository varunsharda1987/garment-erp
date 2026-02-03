/**
 * ERP Context Service
 *
 * Provides real-time ERP data context for AI responses.
 * Fetches relevant data based on user questions and role.
 */

import { UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { logError } from '../../utils/logger';
import { aiPermissionService } from './ai-permission.service';

// Context types that can be fetched
type ContextType =
  | 'orders'
  | 'styles'
  | 'inventory'
  | 'production'
  | 'customers'
  | 'suppliers'
  | 'summary';

// Keywords that trigger specific context types
const CONTEXT_KEYWORDS: Record<ContextType, string[]> = {
  orders: [
    'order',
    'orders',
    'delivery',
    'deliveries',
    'pending',
    'shipment',
    'dispatch',
    'due',
    'overdue',
    'shipped',
  ],
  styles: [
    'style',
    'styles',
    'design',
    'garment',
    'product',
    'bom',
    'bill of materials',
    'cost sheet',
    'costing',
  ],
  inventory: [
    'stock',
    'inventory',
    'material',
    'fabric',
    'trim',
    'warehouse',
    'quantity',
    'low stock',
    'reorder',
  ],
  production: [
    'production',
    'work order',
    'cutting',
    'stitching',
    'finishing',
    'manufacturing',
    'progress',
    'schedule',
  ],
  customers: ['customer', 'customers', 'buyer', 'buyers', 'client', 'clients'],
  suppliers: ['supplier', 'suppliers', 'vendor', 'vendors'],
  summary: ['summary', 'overview', 'dashboard', 'statistics', 'stats', 'report', 'how many', 'total'],
};

interface ERPContext {
  type: ContextType;
  data: Record<string, unknown>;
  summary: string;
}

class ERPContextService {
  /**
   * Detect what context types are needed based on the question
   */
  detectContextNeeds(question: string): ContextType[] {
    const lowerQuestion = question.toLowerCase();
    const detectedTypes: ContextType[] = [];

    for (const [contextType, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
      if (keywords.some((keyword) => lowerQuestion.includes(keyword))) {
        detectedTypes.push(contextType as ContextType);
      }
    }

    // Default to summary if no specific context detected
    if (detectedTypes.length === 0) {
      detectedTypes.push('summary');
    }

    return detectedTypes;
  }

  /**
   * Get ERP context based on question and user role
   */
  async getContext(question: string, userRole: UserRole): Promise<ERPContext[]> {
    const contextTypes = this.detectContextNeeds(question);
    const contexts: ERPContext[] = [];

    for (const contextType of contextTypes) {
      try {
        const context = await this.fetchContextByType(contextType, userRole);
        if (context) {
          contexts.push(context);
        }
      } catch (error) {
        logError(`[ERPContext] Failed to fetch ${contextType} context:`, error);
      }
    }

    return contexts;
  }

  /**
   * Fetch specific context type
   */
  private async fetchContextByType(type: ContextType, userRole: UserRole): Promise<ERPContext | null> {
    switch (type) {
      case 'orders':
        return this.fetchOrdersContext(userRole);
      case 'styles':
        return this.fetchStylesContext(userRole);
      case 'inventory':
        return this.fetchInventoryContext(userRole);
      case 'production':
        return this.fetchProductionContext(userRole);
      case 'customers':
        return this.fetchCustomersContext(userRole);
      case 'suppliers':
        return this.fetchSuppliersContext(userRole);
      case 'summary':
        return this.fetchSummaryContext(userRole);
      default:
        return null;
    }
  }

  /**
   * Fetch orders context
   */
  private async fetchOrdersContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'orders')) {
      return null;
    }

    try {
      const [recentOrders, pendingCount, totalOrders] = await Promise.all([
        prisma.orders.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalQuantity: true,
            expectedDeliveryDate: true,
            createdAt: true,
            customers: { select: { name: true } },
          },
        }),
        prisma.orders.count({
          where: { status: { in: ['PENDING', 'IN_PRODUCTION'] } },
        }),
        prisma.orders.count(),
      ]);

      // Filter financial data if not authorized
      const filteredOrders = recentOrders.map((order) => {
        const filtered = aiPermissionService.filterPricingData(order as unknown as Record<string, unknown>, userRole);
        return filtered;
      });

      return {
        type: 'orders',
        data: {
          recentOrders: filteredOrders,
          pendingCount,
          totalOrders,
        },
        summary: `Orders: ${totalOrders} total, ${pendingCount} pending/in production`,
      };
    } catch (error) {
      logError('[ERPContext] Orders fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch styles context
   */
  private async fetchStylesContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'styles')) {
      return null;
    }

    try {
      const [recentStyles, activeCount, draftCount, totalStyles] = await Promise.all([
        prisma.styles.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            status: true,
            createdAt: true,
            customerName: true,
          },
        }),
        prisma.styles.count({ where: { status: 'ACTIVE' } }),
        prisma.styles.count({ where: { status: 'DRAFT' } }),
        prisma.styles.count(),
      ]);

      return {
        type: 'styles',
        data: {
          recentStyles,
          activeCount,
          draftCount,
          totalStyles,
        },
        summary: `Styles: ${totalStyles} total, ${activeCount} active, ${draftCount} drafts`,
      };
    } catch (error) {
      logError('[ERPContext] Styles fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch inventory context
   */
  private async fetchInventoryContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'inventoryQuantities')) {
      return null;
    }

    try {
      // Get fabric stock
      const [fabricStock, totalMaterials] = await Promise.all([
        prisma.fabric_stock.findMany({
          take: 10,
          orderBy: { quantityAvailable: 'asc' },
          where: { quantityAvailable: { gt: 0 } },
          select: {
            id: true,
            quantityAvailable: true,
            quantityReserved: true,
            unit: true,
          },
        }),
        prisma.fabric_stock.count(),
      ]);

      const lowStockCount = await prisma.fabric_stock.count({
        where: { quantityAvailable: { lt: 100 } },
      });

      return {
        type: 'inventory',
        data: {
          fabricStock,
          lowStockCount,
          totalMaterials,
        },
        summary: `Inventory: ${totalMaterials} fabric items, ${lowStockCount} low stock alerts`,
      };
    } catch (error) {
      logError('[ERPContext] Inventory fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch production context
   */
  private async fetchProductionContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'productionStatus')) {
      return null;
    }

    try {
      const [activeWorkOrders, pendingCount, completedCount] = await Promise.all([
        prisma.work_orders.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { status: { in: ['PENDING', 'IN_PRODUCTION'] } },
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            totalQuantity: true,
            completedQuantity: true,
            plannedStartDate: true,
            plannedEndDate: true,
            styles: { select: { styleCode: true, styleName: true } },
          },
        }),
        prisma.work_orders.count({
          where: { status: 'PENDING' },
        }),
        prisma.work_orders.count({
          where: { status: 'COMPLETED' },
        }),
      ]);

      return {
        type: 'production',
        data: {
          activeWorkOrders,
          pendingCount,
          completedCount,
        },
        summary: `Production: ${activeWorkOrders.length} active work orders, ${pendingCount} pending, ${completedCount} completed`,
      };
    } catch (error) {
      logError('[ERPContext] Production fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch customers context
   */
  private async fetchCustomersContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'customerContacts')) {
      return null;
    }

    try {
      const [recentCustomers, activeCount, totalCustomers] = await Promise.all([
        prisma.customers.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            phone: true,
            _count: { select: { orders: true } },
          },
        }),
        prisma.customers.count({ where: { isActive: true } }),
        prisma.customers.count(),
      ]);

      return {
        type: 'customers',
        data: {
          recentCustomers,
          activeCount,
          totalCustomers,
        },
        summary: `Customers: ${totalCustomers} total, ${activeCount} active`,
      };
    } catch (error) {
      logError('[ERPContext] Customers fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch suppliers context
   */
  private async fetchSuppliersContext(userRole: UserRole): Promise<ERPContext | null> {
    if (!aiPermissionService.canAccess(userRole, 'supplierPricing')) {
      return null;
    }

    try {
      const [recentSuppliers, activeCount, totalSuppliers] = await Promise.all([
        prisma.suppliers.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            phone: true,
            email: true,
          },
        }),
        prisma.suppliers.count({ where: { isActive: true } }),
        prisma.suppliers.count(),
      ]);

      return {
        type: 'suppliers',
        data: {
          recentSuppliers,
          activeCount,
          totalSuppliers,
        },
        summary: `Suppliers: ${totalSuppliers} total, ${activeCount} active`,
      };
    } catch (error) {
      logError('[ERPContext] Suppliers fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch summary/dashboard context
   */
  private async fetchSummaryContext(userRole: UserRole): Promise<ERPContext | null> {
    try {
      const data: Record<string, unknown> = {};
      const summaryParts: string[] = [];

      // Orders summary (if authorized)
      if (aiPermissionService.canAccess(userRole, 'orders')) {
        const [totalOrders, pendingOrders] = await Promise.all([
          prisma.orders.count(),
          prisma.orders.count({ where: { status: { in: ['PENDING', 'IN_PRODUCTION'] } } }),
        ]);
        data.orders = { total: totalOrders, pending: pendingOrders };
        summaryParts.push(`${totalOrders} orders (${pendingOrders} pending)`);
      }

      // Styles summary (if authorized)
      if (aiPermissionService.canAccess(userRole, 'styles')) {
        const [totalStyles, activeStyles] = await Promise.all([
          prisma.styles.count(),
          prisma.styles.count({ where: { status: 'ACTIVE' } }),
        ]);
        data.styles = { total: totalStyles, active: activeStyles };
        summaryParts.push(`${totalStyles} styles (${activeStyles} active)`);
      }

      // Customers summary (if authorized)
      if (aiPermissionService.canAccess(userRole, 'customerContacts')) {
        const totalCustomers = await prisma.customers.count({ where: { isActive: true } });
        data.customers = { active: totalCustomers };
        summaryParts.push(`${totalCustomers} active customers`);
      }

      // Production summary (if authorized)
      if (aiPermissionService.canAccess(userRole, 'productionStatus')) {
        const activeWorkOrders = await prisma.work_orders.count({
          where: { status: { in: ['PENDING', 'IN_PRODUCTION'] } },
        });
        data.production = { activeWorkOrders };
        summaryParts.push(`${activeWorkOrders} active work orders`);
      }

      return {
        type: 'summary',
        data,
        summary: `ERP Summary: ${summaryParts.join(', ')}`,
      };
    } catch (error) {
      logError('[ERPContext] Summary fetch error:', error);
      return null;
    }
  }

  /**
   * Format contexts into a string for the AI prompt
   */
  formatContextForPrompt(contexts: ERPContext[]): string {
    if (contexts.length === 0) {
      return '';
    }

    const lines: string[] = ['\n\n=== CURRENT ERP DATA ==='];

    for (const context of contexts) {
      lines.push(`\n[${context.type.toUpperCase()}]`);
      lines.push(context.summary);

      // Add detailed data for certain types
      if (context.type === 'orders' && context.data.recentOrders) {
        const orders = context.data.recentOrders as Array<Record<string, unknown>>;
        if (orders.length > 0) {
          lines.push('\nRecent Orders:');
          orders.slice(0, 5).forEach((order) => {
            const customer = order.customers as { name: string } | null;
            lines.push(
              `- ${order.orderNumber}: Qty ${order.totalQuantity} for ${customer?.name || 'N/A'} - Status: ${order.status}`
            );
          });
        }
      }

      if (context.type === 'styles' && context.data.recentStyles) {
        const styles = context.data.recentStyles as Array<Record<string, unknown>>;
        if (styles.length > 0) {
          lines.push('\nRecent Styles:');
          styles.slice(0, 5).forEach((style) => {
            const customer = style.customers as { name: string } | null;
            lines.push(`- ${style.styleCode}: ${style.styleName} for ${customer?.name || 'N/A'} - ${style.status}`);
          });
        }
      }

      if (context.type === 'production' && context.data.activeWorkOrders) {
        const workOrders = context.data.activeWorkOrders as Array<Record<string, unknown>>;
        if (workOrders.length > 0) {
          lines.push('\nActive Work Orders:');
          workOrders.slice(0, 5).forEach((wo) => {
            const style = wo.styles as { styleCode: string; styleName: string } | null;
            lines.push(`- ${wo.workOrderNumber}: ${style?.styleCode || 'N/A'} - Qty: ${wo.totalQuantity} - ${wo.status}`);
          });
        }
      }
    }

    lines.push('\n=== END ERP DATA ===\n');

    return lines.join('\n');
  }
}

export const erpContextService = new ERPContextService();
