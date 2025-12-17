/**
 * Indexing Service
 *
 * Handles indexing of ERP data and documentation for RAG.
 * Creates embeddings for styles, process guides, and help documents.
 */

import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { embeddingService, DocumentChunk } from './embedding.service';

const prisma = new PrismaClient();

// Types
export interface IndexingResult {
  documentType: string;
  indexed: number;
  failed: number;
  duration: number;
}

export interface IndexingStats {
  totalDocuments: number;
  byType: Record<string, number>;
  lastIndexed?: Date;
}

// Process guides - static content about how to use the ERP
const PROCESS_GUIDES: DocumentChunk[] = [
  {
    documentType: 'process_guide',
    sourceId: 'guide-create-style',
    title: 'How to Create a New Style',
    content: `Creating a New Style in Kashaya Fabs ERP:

1. Navigate to Styles > New Style in the sidebar
2. Fill in the basic information:
   - Style Code: Unique identifier (auto-generated or manual)
   - Style Name: Descriptive name for the garment
   - Category: Select garment type (Shirt, Dress, Pants, etc.)
   - Customer: Select the customer this style is for
3. Add style specifications:
   - Description: Detailed description of the style
   - Season: Spring/Summer, Fall/Winter, etc.
   - Images: Upload reference images
4. Save the style as Draft or set to Active
5. After creating the style, add BOM (Bill of Materials) for material requirements
6. Create Cost Sheet to calculate production costs

Tips:
- Always link styles to a customer for better organization
- Add detailed specifications to help production team
- Use consistent naming conventions for style codes`,
    metadata: { priority: 'high', category: 'styles' },
  },
  {
    documentType: 'process_guide',
    sourceId: 'guide-create-bom',
    title: 'How to Create a Bill of Materials (BOM)',
    content: `Creating a Bill of Materials (BOM) in Kashaya Fabs ERP:

1. Open the style you want to add BOM to
2. Navigate to the BOM tab or click "Add BOM"
3. Add fabric requirements:
   - Select fabric type from master list
   - Enter consumption per piece (meters/yards)
   - Specify wastage percentage
4. Add trim requirements:
   - Buttons, zippers, threads, labels, etc.
   - Enter quantity per piece
5. Add packaging materials:
   - Poly bags, hangers, cartons, etc.
6. Review total material requirements
7. Save the BOM

Important Notes:
- BOM is linked to the style and used for costing
- Update BOM if design changes affect material consumption
- BOM quantities are used for Material Requirement Planning (MRP)
- Accurate BOM is essential for correct costing and procurement`,
    metadata: { priority: 'high', category: 'bom' },
  },
  {
    documentType: 'process_guide',
    sourceId: 'guide-create-cost-sheet',
    title: 'How to Create a Cost Sheet',
    content: `Creating a Cost Sheet in Kashaya Fabs ERP:

1. Open the style you want to cost
2. Navigate to Cost Sheet tab or click "Create Cost Sheet"
3. The system automatically pulls:
   - Material costs from BOM
   - Current material prices from masters
4. Add additional costs:
   - Labor costs: Cutting, stitching, finishing
   - Overhead costs: Factory overhead, utilities
   - Other costs: Embroidery, printing, washing
5. Add profit margin percentage
6. Review total cost and selling price
7. Save the cost sheet

Cost Components:
- Fabric Cost = Consumption × Price per unit
- Trim Cost = Sum of all trim items
- CMT (Cut-Make-Trim) = Labor costs
- Overhead = Factory overhead allocation
- Profit Margin = Percentage markup

Tips:
- Update cost sheets when material prices change
- Use cost sheets for customer quotations
- Compare cost sheets across similar styles`,
    metadata: { priority: 'high', category: 'costing' },
  },
  {
    documentType: 'process_guide',
    sourceId: 'guide-create-order',
    title: 'How to Create a Customer Order',
    content: `Creating a Customer Order in Kashaya Fabs ERP:

1. Navigate to Orders > New Order
2. Select customer from the dropdown
3. Add order details:
   - Order Number: Auto-generated or manual
   - Order Date: Date of order receipt
   - Delivery Date: Expected delivery date
4. Add style and quantities:
   - Select style from customer's styles
   - Enter quantity per size (S, M, L, XL, etc.)
   - Specify colors if applicable
5. Pricing:
   - Unit price (from cost sheet or manual)
   - Total amount calculated automatically
6. Save the order

Order Statuses:
- Draft: Order being prepared
- Confirmed: Order accepted
- In Production: Production started
- Ready: Production completed
- Shipped: Dispatched to customer
- Delivered: Order delivered

Important:
- Orders trigger production planning
- Orders are linked to work orders for manufacturing
- Track order status for delivery management`,
    metadata: { priority: 'high', category: 'orders' },
  },
  {
    documentType: 'process_guide',
    sourceId: 'guide-production-workflow',
    title: 'Production Workflow Overview',
    content: `Production Workflow in Kashaya Fabs ERP:

1. Order Received
   - Customer order is confirmed
   - Quantities and delivery date set

2. Material Planning
   - MRP generates material requirements
   - Purchase orders created for missing materials

3. Material Receipt
   - Fabric and trims received
   - GRN (Goods Receipt Note) recorded
   - Stock updated

4. Work Order Creation
   - Production work order created from order
   - Assigned to production floor

5. Cutting
   - Fabric issued to cutting department
   - Cut pieces tracked

6. Stitching
   - Cut pieces sent to stitching lines
   - Production progress tracked

7. Quality Check
   - In-line and final inspection
   - Defects recorded

8. Finishing
   - Ironing, folding, packing
   - Final presentation

9. Dispatch
   - Delivery note created
   - Goods dispatched
   - Order marked as shipped`,
    metadata: { priority: 'high', category: 'production' },
  },
  {
    documentType: 'process_guide',
    sourceId: 'guide-inventory-management',
    title: 'Inventory Management Guide',
    content: `Inventory Management in Kashaya Fabs ERP:

Stock Types:
1. Fabric Stock
   - Raw fabric inventory
   - Track by lot, color, width

2. Trim Stock
   - Buttons, zippers, threads, labels
   - Track by item, color, size

3. Finished Goods
   - Completed garments
   - Track by style, size, color

Key Operations:
1. Stock Receipt
   - Record GRN when materials arrive
   - Update stock levels

2. Stock Issue
   - Issue materials to production
   - Reduce stock levels

3. Stock Transfer
   - Move between warehouses
   - Track transfers

4. Stock Count
   - Physical inventory verification
   - Reconcile differences

Stock Alerts:
- Low stock warnings when below reorder point
- Out of stock alerts
- Slow-moving stock identification

Reports:
- Stock Summary Report
- Stock Movement Report
- Stock Valuation Report`,
    metadata: { priority: 'high', category: 'inventory' },
  },
  {
    documentType: 'faq',
    sourceId: 'faq-general',
    title: 'Frequently Asked Questions',
    content: `Common Questions about Kashaya Fabs ERP:

Q: How do I reset my password?
A: Go to Profile > Change Password, or use "Forgot Password" on login.

Q: How do I add a new user?
A: Admin users can go to Settings > Users > Add New User.

Q: What are the user roles?
A: ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE, FACTORY_SUPERVISOR, MERCHANDISER

Q: How do I export data?
A: Most list pages have an Export button to download data as Excel.

Q: How do I import data?
A: Go to Settings > Import, select data type, and upload Excel file.

Q: Can I undo a mistake?
A: Most operations can be edited. For deletions, contact Admin.

Q: How do I contact support?
A: Use the Help menu or email support.

Q: How often is data backed up?
A: Data is automatically backed up daily.

Q: Can I customize reports?
A: Some reports have filter options. Custom reports can be requested.

Q: How do I print a document?
A: Click the Print button on document pages or use browser print.`,
    metadata: { priority: 'medium', category: 'help' },
  },
  {
    documentType: 'help',
    sourceId: 'help-navigation',
    title: 'Navigating the ERP System',
    content: `Navigation Guide for Kashaya Fabs ERP:

Main Sidebar Sections:
1. Dashboard - Overview and key metrics
2. Styles - Style management, BOM, cost sheets
3. Orders - Customer orders and delivery tracking
4. Materials - Fabric, trims, and accessories masters
5. Inventory - Stock levels and movements
6. Production - Work orders and production tracking
7. Customers - Customer management
8. Suppliers - Supplier management
9. Reports - Various business reports
10. Settings - System configuration

Quick Tips:
- Use search bar (Ctrl+K) to find anything quickly
- Breadcrumbs show your current location
- Click logo to return to dashboard
- Recent items appear in sidebar
- Star important items for quick access

Keyboard Shortcuts:
- Ctrl+K: Global search
- Ctrl+N: New item (context-sensitive)
- Ctrl+S: Save current form
- Esc: Close modal or cancel`,
    metadata: { priority: 'medium', category: 'help' },
  },
];

class IndexingService {
  /**
   * Index all process guides (static content)
   */
  async indexProcessGuides(): Promise<IndexingResult> {
    const startTime = Date.now();
    let indexed = 0;
    let failed = 0;

    if (!embeddingService.isInitialized()) {
      logWarn('[IndexingService] Embedding service not initialized');
      return { documentType: 'process_guide', indexed: 0, failed: 0, duration: 0 };
    }

    // Clear existing process guides
    await embeddingService.deleteDocumentsByType('process_guide');
    await embeddingService.deleteDocumentsByType('faq');
    await embeddingService.deleteDocumentsByType('help');

    for (const guide of PROCESS_GUIDES) {
      try {
        const id = await embeddingService.storeDocument(guide);
        if (id) {
          indexed++;
        } else {
          failed++;
        }
      } catch (error) {
        logError(`[IndexingService] Failed to index guide: ${guide.title}`, error);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    logInfo(`[IndexingService] Indexed ${indexed} process guides in ${duration}ms`);

    return {
      documentType: 'process_guide',
      indexed,
      failed,
      duration,
    };
  }

  /**
   * Index styles from the database
   */
  async indexStyles(): Promise<IndexingResult> {
    const startTime = Date.now();
    let indexed = 0;
    let failed = 0;

    if (!embeddingService.isInitialized()) {
      logWarn('[IndexingService] Embedding service not initialized');
      return { documentType: 'style', indexed: 0, failed: 0, duration: 0 };
    }

    try {
      // Clear existing style documents
      await embeddingService.deleteDocumentsByType('style');

      // Fetch styles with related data
      const styles = await prisma.styles.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          customerName: true,
          description: true,
          season: true,
          status: true,
        },
        take: 500, // Limit for performance
      });

      for (const style of styles) {
        try {
          const content = this.formatStyleContent(style);
          const chunk: DocumentChunk = {
            documentType: 'style',
            sourceId: style.id,
            title: `Style: ${style.styleCode} - ${style.styleName}`,
            content,
            metadata: {
              styleCode: style.styleCode,
              customer: style.customerName || undefined,
              status: style.status,
            },
          };

          const id = await embeddingService.storeDocument(chunk);
          if (id) {
            indexed++;
          } else {
            failed++;
          }
        } catch (error) {
          logError(`[IndexingService] Failed to index style: ${style.styleCode}`, error);
          failed++;
        }
      }
    } catch (error) {
      logError('[IndexingService] Failed to fetch styles:', error);
    }

    const duration = Date.now() - startTime;
    logInfo(`[IndexingService] Indexed ${indexed} styles in ${duration}ms`);

    return {
      documentType: 'style',
      indexed,
      failed,
      duration,
    };
  }

  /**
   * Format style data into searchable content
   */
  private formatStyleContent(style: Record<string, unknown>): string {
    const parts = [
      `Style Code: ${style.styleCode}`,
      `Style Name: ${style.styleName}`,
      `Customer: ${style.customerName || 'Not assigned'}`,
      `Status: ${style.status}`,
    ];

    if (style.description) {
      parts.push(`Description: ${style.description}`);
    }

    if (style.season) {
      parts.push(`Season: ${style.season}`);
    }

    return parts.join('\n');
  }

  /**
   * Index everything (full reindex)
   */
  async indexAll(): Promise<IndexingResult[]> {
    const results: IndexingResult[] = [];

    // Index process guides first
    results.push(await this.indexProcessGuides());

    // Index styles
    results.push(await this.indexStyles());

    return results;
  }

  /**
   * Get indexing statistics
   */
  async getStats(): Promise<IndexingStats> {
    const total = await embeddingService.getDocumentCount();

    const types = ['process_guide', 'faq', 'help', 'style'];
    const byType: Record<string, number> = {};

    for (const type of types) {
      byType[type] = await embeddingService.getDocumentCount(type);
    }

    return {
      totalDocuments: total,
      byType,
    };
  }
}

// Export singleton instance
export const indexingService = new IndexingService();
