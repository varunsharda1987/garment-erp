# Module Relationships & Integration Guide

> **The Definitive Reference for Module Interlinking**
> **Last Updated:** January 12, 2026
> **Version:** 1.0
> **Coverage:** 150+ Models, 200+ Relationships, 15+ Major Modules

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Core Module Relationships](#3-core-module-relationships)
4. [Comprehensive Relationship Matrix](#4-comprehensive-relationship-matrix)
5. [Polymorphic Relationships](#5-polymorphic-relationships)
6. [Hierarchical Relationships](#6-hierarchical-relationships)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Integration Points by Module](#8-integration-points-by-module)
9. [Critical Workflow Integrations](#9-critical-workflow-integrations)
10. [Database Patterns & Cascades](#10-database-patterns--cascades)
11. [API Integration Patterns](#11-api-integration-patterns)
12. [Cross-Module Business Rules](#12-cross-module-business-rules)
13. [Quick Reference: "How Do I..."](#13-quick-reference-how-do-i)
14. [Related Documentation](#14-related-documentation)

---

## 1. Overview

### 1.1 Purpose

This guide serves as the **single source of truth** for understanding how modules in the Garment ERP system interconnect, integrate, and exchange data. It consolidates relationship information scattered across multiple documentation files into one comprehensive reference.

### 1.2 Who Should Use This Guide

- **Developers** - Understanding module dependencies before making changes
- **Architects** - Designing new features that integrate with existing modules
- **Database Administrators** - Understanding foreign key relationships
- **QA Engineers** - Testing integration points between modules
- **Business Analysts** - Understanding data flow through the system

### 1.3 How to Use This Guide

1. **Quick Lookups** - Use Section 13 ("How Do I...") for common integration questions
2. **Module Integration** - See Section 8 for specific module integration points
3. **Data Flows** - See Section 7 for visual workflow diagrams
4. **Complete Reference** - See Section 4 for comprehensive relationship matrix

### 1.4 Relationship Types

| Type | Symbol | Description | Example |
|------|--------|-------------|---------|
| **One-to-Many** | 1:N | One record relates to many | 1 Style → N Orders |
| **Many-to-One** | N:1 | Many records relate to one | N Orders → 1 Customer |
| **One-to-One** | 1:1 | One-to-one relationship | 1 Order Item → 1 Order Item Costing |
| **Polymorphic** | Poly | Flexible foreign key | Materials → 13 material types |
| **Hierarchical** | Tree | Parent-child structure | Chart of Accounts |
| **Many-to-Many** | M:N | Junction table relationship | Styles ↔ Suppliers (via style_fabrics) |

---

## 2. System Architecture

### 2.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│              React + TypeScript + Vite                       │
│                    (Port 5173)                               │
│                                                              │
│  Components → Services → API Calls                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST (JSON)
                          │ camelCase responses
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND LAYER                         │
│              Express + Prisma ORM                            │
│                    (Port 5000)                               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Routes   │→ │Controllers│→ │ Services │→ │  Prisma  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Serializer (snake_case → camelCase transformation) │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ Prisma Client
                          │ snake_case queries
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                         │
│                    PostgreSQL 15+                            │
│                    (Port 5432)                               │
│                                                              │
│  150+ Tables | 200+ Relationships | Foreign Keys            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Critical: API Response Serialization

**⚠️ IMPORTANT:** The backend uses automatic serialization that converts all snake_case keys to camelCase before sending responses to the frontend.

```typescript
// Database/Prisma (snake_case)
style_variants
style_components
style_material_bom

// API Responses (camelCase)
styleVariants
styleComponents
styleMaterialBom
```

**Frontend Code Must Use camelCase:**
```typescript
// ✅ CORRECT
const components = style.styleComponents;
const bom = style.styleMaterialBom;

// ❌ WRONG - Won't work
const components = style.style_components;
const bom = style.style_material_bom;
```

See [CLAUDE.md](../CLAUDE.md) for complete serialization documentation.

### 2.3 Data Flow Between Layers

```
User Action (Frontend)
      ↓
React Component
      ↓
API Service Call
      ↓
Backend Route
      ↓
Controller (validation)
      ↓
Service (business logic)
      ↓
Prisma Query (snake_case)
      ↓
PostgreSQL Database
      ↓
Prisma Response (snake_case)
      ↓
Serializer (→ camelCase)
      ↓
JSON Response
      ↓
Frontend State Update
      ↓
UI Re-render
```

---

## 3. Core Module Relationships

### 3.1 Style → Order → Production Flow

The most critical data flow in the system:

```
┌──────────────┐
│   styles     │  ← Core product definition
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│   orders     │  ← Customer order
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ work_orders  │  ← Production execution
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│  cutting_    │  ← Manufacturing phases
│  batches     │
└──────────────┘
```

**Relationships:**
- `orders.styleId` → `styles.id` (Style as template)
- `work_orders.orderId` → `orders.id` (Production trigger)
- `cutting_batches.workOrderId` → `work_orders.id` (Manufacturing)

### 3.2 Material → BOM → MRP → PO Flow

Material requirement and procurement workflow:

```
┌──────────────┐
│   styles     │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ style_       │  ← Bill of Materials
│ material_bom │
└──────┬───────┘
       │ triggered by order
       ▼
┌──────────────┐
│ material_    │  ← MRP calculation
│ requirements │
└──────┬───────┘
       │ M:N (via requirement_po_links)
       ▼
┌──────────────┐
│ purchase_    │  ← Procurement
│ orders       │
└──────┬───────┘
       │ 1:1
       ▼
┌──────────────┐
│ goods_       │  ← Receipt & Stock
│ receiving_   │
│ notes (GRN)  │
└──────────────┘
```

**Relationships:**
- `style_material_bom.styleId` → `styles.id`
- `material_requirements.materialId` → `materials.id`
- `requirement_po_links.requirementId` → `material_requirements.id`
- `purchase_orders.supplierId` → `suppliers.id`
- `goods_receiving_notes.poId` → `purchase_orders.id`

### 3.3 Fabric Procurement → Processing → Stock Flow

Fabric lifecycle from greige to finished stock:

```
┌──────────────┐
│ greige_      │  ← Raw fabric definition
│ master       │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ fabric_      │  ← Purchase greige
│ procurement  │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ fabric_      │  ← Dyeing/Printing
│ processing   │
└──────┬───────┘
       │ creates
       ▼
┌──────────────┐
│ fabric_      │  ← Finished fabric
│ master       │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ fabric_stock │  ← Inventory
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│ cutting_     │  ← Production usage
│ batches      │
└──────────────┘
```

**Relationships:**
- `fabric_procurement.greigeId` → `greige_master.id`
- `fabric_processing.procurementId` → `fabric_procurement.id`
- `fabric_processing.finishedFabricId` → `fabric_master.id`
- `fabric_stock.fabricId` → `fabric_master.id`
- `cutting_batches.fabricStockId` → `fabric_stock.id`

---

## 4. Comprehensive Relationship Matrix

### 4.1 Style Ecosystem Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| styles | brand_categories | N:1 | styles.brandCategoryId | Style belongs to brand |
| styles | product_category_master | N:1 | styles.productCategoryId | Product classification |
| styles | users | N:1 | styles.createdById | Created by user |
| style_variants | styles | N:1 | style_variants.styleId | Color/size combinations |
| style_variants | color_options | N:1 | style_variants.colorId | Variant color |
| style_variants | size_options | N:1 | style_variants.sizeId | Variant size |
| style_components | styles | N:1 | style_components.styleId | Style pattern parts |
| style_components | component_masters | N:1 | style_components.componentMasterId | Component definition |
| style_fabrics | style_components | N:1 | style_fabrics.componentId | Fabric per component |
| style_fabrics | fabric_master | N:1 | style_fabrics.fabricId | Selected fabric |
| style_fabrics | embroidery_master | N:1 | style_fabrics.embroideryId | Embroidery design |
| style_material_bom | styles | N:1 | style_material_bom.styleId | Material requirements |
| style_material_bom | materials | N:1 | style_material_bom.materialId | Generic material |
| style_material_bom | lace_master | N:1 | style_material_bom.laceId | Specific lace |
| style_material_bom | button_master | N:1 | style_material_bom.buttonId | Specific button |
| style_material_bom | thread_master | N:1 | style_material_bom.threadId | Specific thread |
| style_material_bom | zipper_master | N:1 | style_material_bom.zipperId | Specific zipper |
| style_material_bom | elastic_master | N:1 | style_material_bom.elasticId | Specific elastic |
| style_material_bom | label_master | N:1 | style_material_bom.labelId | Specific label |
| style_material_bom | packaging_master | N:1 | style_material_bom.packagingId | Specific packaging |
| style_costing | styles | N:1 | style_costing.styleId | Cost calculation |
| fabric_width_cad | styles | N:1 | fabric_width_cad.costingStyleId | CAD for costing |
| fabric_width_cad | fabric_master | N:1 | fabric_width_cad.fabricId | Fabric width plan |
| fabric_width_cad | greige_master | N:1 | fabric_width_cad.greigeId | Greige width plan |
| cad_size_breakdown | fabric_width_cad | N:1 | cad_size_breakdown.cadId | Pieces per size |

### 4.2 Order Ecosystem Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| orders | customers | N:1 | orders.customerId | Buyer information |
| orders | users | N:1 | orders.createdById | Order created by |
| orders | users | N:1 | orders.approvedById | Order approved by |
| order_items | orders | N:1 | order_items.orderId | Line items |
| order_items | styles | N:1 | order_items.styleId | Style ordered |
| order_items | fabric_width_cad | N:1 | order_items.selectedCadId | CAD for order |
| order_item_breakup | order_items | N:1 | order_item_breakup.orderItemId | SKU breakdown |
| order_item_breakup | color_options | N:1 | order_item_breakup.colorId | Color SKU |
| order_item_breakup | size_options | N:1 | order_item_breakup.sizeId | Size SKU |
| order_item_breakup | style_variants | N:1 | order_item_breakup.variantId | Variant reference |
| order_item_costing | order_items | 1:1 | order_item_costing.orderItemId | Order-specific cost |
| order_item_costing | fabric_width_cad | N:1 | order_item_costing.selectedCadId | CAD for costing |
| order_item_costing | style_costing | N:1 | order_item_costing.baseCostingId | Base cost reference |
| order_samples | order_items | N:1 | order_samples.orderItemId | Sample for order |
| order_inspections | order_items | N:1 | order_inspections.orderItemId | Inspection record |

### 4.3 Material & BOM Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| materials | material_categories | N:1 | materials.categoryId | Material classification |
| materials | greige_master | N:1 | materials.greigeId | For GREIGE_FABRIC type |
| materials | fabric_master | N:1 | materials.fabricId | For FINISHED_FABRIC type |
| materials | lace_master | N:1 | materials.laceId | For LACE type |
| materials | button_master | N:1 | materials.buttonId | For BUTTON type |
| materials | thread_master | N:1 | materials.threadId | For THREAD type |
| materials | zipper_master | N:1 | materials.zipperId | For ZIPPER type |
| materials | elastic_master | N:1 | materials.elasticId | For ELASTIC type |
| materials | label_master | N:1 | materials.labelId | For LABEL type |
| materials | packaging_master | N:1 | materials.packagingId | For PACKAGING type |
| material_requirements | materials | N:1 | material_requirements.materialId | Required material |
| material_requirements | orders | N:1 | material_requirements.orderId | Triggered by order |
| material_requirements | order_items | N:1 | material_requirements.orderItemId | Specific item |
| material_requirements | bom_items | N:1 | material_requirements.bomItemId | BOM reference |
| material_requirements | suppliers | N:1 | material_requirements.preferredSupplierId | Preferred supplier |
| requirement_po_links | material_requirements | N:1 | requirement_po_links.requirementId | Requirement linked |
| requirement_po_links | purchase_orders | N:1 | requirement_po_links.purchaseOrderId | PO generated |
| requirement_po_links | purchase_order_items | N:1 | requirement_po_links.purchaseOrderItemId | PO item |

### 4.4 Procurement Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| purchase_orders | suppliers | N:1 | purchase_orders.supplierId | Supplier for PO |
| purchase_orders | users | N:1 | purchase_orders.createdById | PO created by |
| purchase_orders | users | N:1 | purchase_orders.approvedById | PO approved by |
| purchase_order_items | purchase_orders | N:1 | purchase_order_items.poId | Items in PO |
| purchase_order_items | materials | N:1 | purchase_order_items.materialId | Material ordered |
| goods_receiving_notes | purchase_orders | N:1 | goods_receiving_notes.poId | Receipt for PO |
| goods_receiving_notes | suppliers | N:1 | goods_receiving_notes.supplierId | Supplier verification |
| goods_receiving_notes | warehouses | N:1 | goods_receiving_notes.warehouseId | Target warehouse |
| goods_receiving_notes | users | N:1 | goods_receiving_notes.receivedById | Received by |
| goods_receiving_notes | users | N:1 | goods_receiving_notes.approvedById | Approved by |
| grn_items | goods_receiving_notes | N:1 | grn_items.grnId | Items received |
| grn_items | purchase_order_items | N:1 | grn_items.poItemId | PO item reference |
| grn_items | materials | N:1 | grn_items.materialId | Material received |

### 4.5 Inventory & Stock Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| stock_levels | materials | N:1 | stock_levels.materialId | Material in stock |
| stock_levels | warehouses | N:1 | stock_levels.warehouseId | Warehouse location |
| stock_movements | materials | N:1 | stock_movements.materialId | Material moved |
| stock_movements | warehouses | N:1 | stock_movements.warehouseId | Warehouse |
| stock_movements | users | N:1 | stock_movements.performedById | Performed by |
| stock_transactions | materials | N:1 | stock_transactions.materialId | Transaction record |
| stock_transactions | warehouses | N:1 | stock_transactions.warehouseId | Warehouse |
| stock_reservations | materials | N:1 | stock_reservations.materialId | Reserved material |
| stock_reservations | warehouses | N:1 | stock_reservations.warehouseId | Warehouse |
| stock_reservations | users | N:1 | stock_reservations.reservedById | Reserved by |
| inventory_stock | materials | N:1 | inventory_stock.materialId | Inventory record |
| inventory_stock | locations | N:1 | inventory_stock.locationId | Storage location |
| finished_goods_stock | styles | N:1 | finished_goods_stock.styleId | Finished style |
| finished_goods_stock | color_options | N:1 | finished_goods_stock.colorId | Color |
| finished_goods_stock | size_options | N:1 | finished_goods_stock.sizeId | Size |
| finished_goods_stock | locations | N:1 | finished_goods_stock.locationId | Storage location |
| finished_goods_stock | work_orders | N:1 | finished_goods_stock.workOrderId | Produced by |

### 4.6 Fabric Stock Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| fabric_stock | fabric_master | N:1 | fabric_stock.fabricId | Fabric type |
| fabric_stock | embroidery_master | N:1 | fabric_stock.embroideryId | Embroidered fabric |
| fabric_stock | fabric_procurement | N:1 | fabric_stock.procurementId | Procurement source |
| fabric_stock | styles | N:1 | fabric_stock.originStyleId | Original style |
| fabric_stock | orders | N:1 | fabric_stock.originOrderId | Original order |
| fabric_stock | users | N:1 | fabric_stock.createdById | Created by |
| fabric_stock_allocation | fabric_stock | N:1 | fabric_stock_allocation.stockId | Stock allocated |
| fabric_stock_allocation | orders | N:1 | fabric_stock_allocation.orderId | Allocated to order |
| fabric_stock_allocation | styles | N:1 | fabric_stock_allocation.styleId | Allocated to style |
| fabric_stock_allocation | fabric_width_cad | N:1 | fabric_stock_allocation.productionCadId | Production CAD |
| fabric_stock_allocation | users | N:1 | fabric_stock_allocation.createdById | Created by |
| fabric_stock_transaction | fabric_stock | N:1 | fabric_stock_transaction.stockId | Stock transaction |
| fabric_stock_transaction | users | N:1 | fabric_stock_transaction.createdById | Performed by |

### 4.7 Production Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| work_orders | orders | N:1 | work_orders.orderId | Order for production |
| work_orders | order_items | N:1 | work_orders.orderItemId | Specific item |
| work_orders | styles | N:1 | work_orders.styleId | Style to produce |
| work_orders | locations | N:1 | work_orders.locationId | Production location |
| work_orders | users | N:1 | work_orders.createdById | Created by |
| work_orders | users | N:1 | work_orders.approvedById | Approved by |
| work_order_breakup | work_orders | N:1 | work_order_breakup.workOrderId | SKU breakdown |
| work_order_breakup | color_options | N:1 | work_order_breakup.colorId | Color |
| work_order_breakup | size_options | N:1 | work_order_breakup.sizeId | Size |
| cutting_batches | work_orders | N:1 | cutting_batches.workOrderId | Cutting for WO |
| cutting_batches | style_components | N:1 | cutting_batches.componentId | Component cut |
| cutting_batches | fabric_stock | N:1 | cutting_batches.fabricStockId | Fabric used |
| cutting_batches | users | N:1 | cutting_batches.createdById | Created by |
| cutting_batch_skus | cutting_batches | N:1 | cutting_batch_skus.cuttingBatchId | SKU cut |
| cutting_batch_skus | color_options | N:1 | cutting_batch_skus.colorId | Color |
| cutting_batch_skus | size_options | N:1 | cutting_batch_skus.sizeId | Size |
| stitching_issues | work_orders | N:1 | stitching_issues.workOrderId | Stitching WO |
| stitching_issues | users | N:1 | stitching_issues.managerId | Stitching manager |
| stitching_issue_components | stitching_issues | N:1 | stitching_issue_components.stitchingIssueId | Components |
| stitching_issue_components | style_components | N:1 | stitching_issue_components.componentId | Component stitched |
| stitching_issue_skus | stitching_issues | N:1 | stitching_issue_skus.stitchingIssueId | SKU stitched |
| finishing_issues | work_orders | N:1 | finishing_issues.workOrderId | Finishing WO |
| finishing_issues | users | N:1 | finishing_issues.managerId | Finishing manager |
| finishing_issue_components | finishing_issues | N:1 | finishing_issue_components.finishingIssueId | Components |
| finishing_issue_skus | finishing_issues | N:1 | finishing_issue_skus.finishingIssueId | SKU finished |

### 4.8 Processing (Job Work) Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| processing_batch | greige_master | N:1 | processing_batch.greigeId | Greige to process |
| processing_batch | fabric_master | N:1 | processing_batch.fabricId | Fabric to process |
| processing_batch | users | N:1 | processing_batch.createdById | Created by |
| processing_stage | processing_batch | N:1 | processing_stage.batchId | Stage in batch |
| processing_stage | suppliers | N:1 | processing_stage.processorId | Processor (dyer/printer) |
| processing_movement | processing_batch | N:1 | processing_movement.batchId | Batch moved |
| processing_movement | processing_stage | N:1 | processing_movement.stageId | Stage moved |
| processing_movement | users | N:1 | processing_movement.performedById | Performed by |
| processing_delivery | processing_batch | N:1 | processing_delivery.batchId | Batch delivered |
| processing_delivery | processing_stage | N:1 | processing_delivery.stageId | Stage delivered |
| processing_delivery | users | N:1 | processing_delivery.receivedById | Received by |
| fabric_processing | fabric_procurement | N:1 | fabric_processing.procurementId | Procurement to process |
| fabric_processing | suppliers | N:1 | fabric_processing.processingMillId | Processing mill |
| fabric_processing | greige_master | N:1 | fabric_processing.greigeId | Greige processed |
| fabric_processing | fabric_master | N:1 | fabric_processing.finishedFabricId | Finished fabric |
| fabric_processing | users | N:1 | fabric_processing.createdById | Created by |

### 4.9 Financial Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| invoices | orders | N:1 | invoices.orderId | Invoice for order |
| invoices | customers | N:1 | invoices.customerId | Customer invoiced |
| invoices | indian_states | N:1 | invoices.placeOfSupplyId | GST place of supply |
| invoices | users | N:1 | invoices.createdById | Created by |
| payments | invoices | N:1 | payments.invoiceId | Payment for invoice |
| payments | users | N:1 | payments.receivedById | Received by |
| quotations | customers | N:1 | quotations.customerId | Quotation for customer |
| quotations | indian_states | N:1 | quotations.placeOfSupplyId | GST place of supply |
| quotations | users | N:1 | quotations.createdById | Created by |
| quotations | users | N:1 | quotations.approvedById | Approved by |
| quotation_items | quotations | N:1 | quotation_items.quotationId | Items in quotation |
| quotation_items | styles | N:1 | quotation_items.styleId | Style quoted |
| chart_of_accounts | chart_of_accounts | N:1 | chart_of_accounts.parentAccountId | Account hierarchy |
| chart_of_accounts | users | N:1 | chart_of_accounts.createdById | Created by |
| cost_centers | locations | N:1 | cost_centers.departmentId | Department |
| cost_centers | locations | N:1 | cost_centers.locationId | Location |
| cost_centers | users | N:1 | cost_centers.createdById | Created by |
| expense_types | chart_of_accounts | N:1 | expense_types.accountId | Linked account |
| expense_types | users | N:1 | expense_types.createdById | Created by |

### 4.10 Quality & Testing Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| quality_inspections | work_orders | N:1 | quality_inspections.workOrderId | Inspection for WO |
| quality_inspections | styles | N:1 | quality_inspections.styleId | Style inspected |
| quality_inspections | users | N:1 | quality_inspections.inspectedById | Inspector |
| quality_inspections | users | N:1 | quality_inspections.approvedById | Approver |
| quality_defects | quality_inspections | N:1 | quality_defects.inspectionId | Defects found |
| fabric_physical_tests | fabric_master | N:1 | fabric_physical_tests.fabricId | Fabric tested |
| fabric_physical_tests | fabric_procurement | N:1 | fabric_physical_tests.fabricProcurementId | Procurement batch |
| fabric_physical_tests | fabric_stock | N:1 | fabric_physical_tests.fabricStockLotId | Stock lot tested |
| fabric_physical_tests | styles | N:1 | fabric_physical_tests.styleId | Context style |
| fabric_physical_tests | customers | N:1 | fabric_physical_tests.customerId | Customer requirement |
| fabric_physical_tests | testing_labs | N:1 | fabric_physical_tests.testingLabId | Testing lab |
| fabric_physical_tests | users | N:1 | fabric_physical_tests.createdById | Created by |
| fabric_physical_tests | users | N:1 | fabric_physical_tests.approvedById | Approved by |
| garment_physical_tests | work_orders | N:1 | garment_physical_tests.workOrderId | Work order tested |
| garment_physical_tests | styles | N:1 | garment_physical_tests.styleId | Style tested |
| garment_physical_tests | customers | N:1 | garment_physical_tests.customerId | Customer requirement |
| garment_physical_tests | testing_labs | N:1 | garment_physical_tests.testingLabId | Testing lab |
| garment_physical_tests | users | N:1 | garment_physical_tests.createdById | Created by |

### 4.11 Sample & Embroidery Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| samples | customers | N:1 | samples.customerId | Sample for customer |
| samples | styles | N:1 | samples.styleId | Sample of style |
| samples | users | N:1 | samples.createdById | Created by |
| sample_measurements | samples | N:1 | sample_measurements.sampleId | Measurements |
| sample_measurements | size_options | N:1 | sample_measurements.sizeId | Size measured |
| sample_colorways | samples | N:1 | sample_colorways.sampleId | Colorways |
| sample_colorways | color_options | N:1 | sample_colorways.colorId | Color |
| sample_size_sets | samples | N:1 | sample_size_sets.sampleId | Size set |
| sample_size_sets | size_options | N:1 | sample_size_sets.sizeId | Size |
| sample_size_sets | color_options | N:1 | sample_size_sets.colorId | Color |
| embroidery_master | suppliers | N:1 | embroidery_master.supplierId | Embroidery supplier |
| embroidery_master | styles | N:1 | embroidery_master.originalStyleId | Original style |
| embroidery_send_out | fabric_stock | N:1 | embroidery_send_out.sourceFabricStockId | Plain fabric |
| embroidery_send_out | embroidery_master | N:1 | embroidery_send_out.embroideryId | Embroidery design |
| embroidery_send_out | suppliers | N:1 | embroidery_send_out.supplierId | Processor |
| embroidery_send_out | fabric_stock | 1:1 | embroidery_send_out.resultFabricStockId | Embroidered stock |
| embroidery_send_out | styles | N:1 | embroidery_send_out.forStyleId | For style |
| embroidery_send_out | orders | N:1 | embroidery_send_out.forOrderId | For order |
| embroidery_send_out | users | N:1 | embroidery_send_out.createdById | Created by |

### 4.12 Customer & Supplier Relationships

| Source Module | Target Module | Type | Foreign Key | Description |
|---------------|---------------|------|-------------|-------------|
| customers | indian_states | N:1 | customers.billingStateId | Billing state |
| customers | indian_cities | N:1 | customers.billingCityId | Billing city |
| customers | indian_states | N:1 | customers.shippingStateId | Shipping state |
| customers | indian_cities | N:1 | customers.shippingCityId | Shipping city |
| customers | payment_terms | N:1 | customers.paymentTermsId | Payment terms |
| customers | test_templates | N:1 | customers.fptTemplateId | FPT template |
| customers | test_templates | N:1 | customers.gptTemplateId | GPT template |
| customers | testing_labs | N:1 | customers.defaultTestingLabId | Default lab |
| customers | users | N:1 | customers.createdById | Created by |
| brand_categories | customers | N:1 | brand_categories.customerId | Brand for customer |
| brand_categories | product_category_master | N:1 | brand_categories.productCategoryId | Product category |
| customer_gst_numbers | customers | N:1 | customer_gst_numbers.customerId | GST numbers |
| customer_gst_numbers | indian_states | N:1 | customer_gst_numbers.stateId | State |
| customer_gst_numbers | indian_cities | N:1 | customer_gst_numbers.billingCityId | City |
| suppliers | indian_states | N:1 | suppliers.billingStateId | Billing state |
| suppliers | indian_cities | N:1 | suppliers.billingCityId | Billing city |
| suppliers | indian_states | N:1 | suppliers.shippingStateId | Shipping state |
| suppliers | indian_cities | N:1 | suppliers.shippingCityId | Shipping city |
| suppliers | payment_terms | N:1 | suppliers.paymentTermsId | Payment terms |
| suppliers | users | N:1 | suppliers.createdById | Created by |
| supplier_gst_numbers | suppliers | N:1 | supplier_gst_numbers.supplierId | GST numbers |
| supplier_gst_numbers | indian_states | N:1 | supplier_gst_numbers.stateId | State |

---

## 5. Polymorphic Relationships

Polymorphic relationships allow flexible foreign keys that can reference multiple different tables. The Garment ERP uses polymorphic patterns extensively for materials, stock movements, and processing.

### 5.1 Material Masters (13 Types)

The `materials` table uses a polymorphic design where a single material record can link to one of 13 specialized master tables:

```typescript
// materials table structure
materials {
  id: UUID
  materialType: Enum  // Determines which *Id field is populated

  // Polymorphic foreign keys (only ONE is populated)
  greigeId?: String        // → greige_master
  fabricId?: String        // → fabric_master
  laceId?: String          // → lace_master
  buttonId?: String        // → button_master
  threadId?: String        // → thread_master
  zipperId?: String        // → zipper_master
  elasticId?: String       // → elastic_master
  labelId?: String         // → label_master
  packagingId?: String     // → packaging_master
  machinePartId?: String   // → machine_part_master
  otherMaterialId?: String // → other_material_master
}
```

**Material Type Mapping:**

| materialType | Populates | References | Example |
|--------------|-----------|------------|---------|
| `GREIGE_FABRIC` | greigeId | greige_master | Raw cotton fabric |
| `FINISHED_FABRIC` | fabricId | fabric_master | Dyed/printed fabric |
| `LACE` | laceId | lace_master | Decorative lace trim |
| `BUTTON` | buttonId | button_master | Shirt buttons |
| `THREAD` | threadId | thread_master | Stitching thread |
| `ZIPPER` | zipperId | zipper_master | Metal/plastic zippers |
| `ELASTIC` | elasticId | elastic_master | Waistband elastic |
| `LABEL` | labelId | label_master | Brand labels |
| `PACKAGING` | packagingId | packaging_master | Polybags, cartons |
| `MACHINE_PART` | machinePartId | machine_part_master | Needles, bobbins |
| `OTHER` | otherMaterialId | other_material_master | Miscellaneous |

**Query Pattern:**
```typescript
// Get material with specific master
const material = await prisma.materials.findUnique({
  where: { id },
  include: {
    lace_master: true,    // Only populated if materialType = LACE
    button_master: true,  // Only populated if materialType = BUTTON
    thread_master: true,  // etc.
  }
});

// Check materialType to determine which relation is populated
if (material.materialType === 'LACE') {
  console.log(material.lace_master.laceName);
} else if (material.materialType === 'BUTTON') {
  console.log(material.button_master.buttonName);
}
```

See [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) for complete material master documentation.

### 5.2 Stock Movements (Reference Pattern)

Stock movements use a flexible reference pattern to track movements triggered by various sources:

```typescript
stock_movements {
  id: UUID
  materialId: String       // Material moved
  warehouseId: String      // Warehouse
  referenceType: String    // What triggered the movement
  referenceId?: String     // ID of triggering record
  movementType: Enum       // IN or OUT
}
```

**Reference Type Mapping:**

| referenceType | referenceId Points To | Description |
|---------------|----------------------|-------------|
| `GRN` | goods_receiving_notes.id | Stock received via GRN |
| `REQUISITION` | material_requisitions.id | Material issued to production |
| `JOB_WORK_SEND` | processing_batch.id | Sent for processing |
| `JOB_WORK_RETURN` | processing_delivery.id | Returned from processing |
| `TRANSFER` | stock_transactions.id | Inter-warehouse transfer |
| `ADJUSTMENT` | stock_count_items.id | Inventory adjustment |
| `DIRECT_ENTRY` | null | Manual stock entry |

**Query Pattern:**
```typescript
// Get all movements for a GRN
const movements = await prisma.stock_movements.findMany({
  where: {
    referenceType: 'GRN',
    referenceId: grnId
  }
});

// Get source record dynamically
if (movement.referenceType === 'GRN') {
  const grn = await prisma.goods_receiving_notes.findUnique({
    where: { id: movement.referenceId }
  });
} else if (movement.referenceType === 'REQUISITION') {
  const requisition = await prisma.material_requisitions.findUnique({
    where: { id: movement.referenceId }
  });
}
```

### 5.3 Processing Batch Flexibility

Processing batches can process either greige or finished fabric:

```typescript
processing_batch {
  id: UUID
  batchType: Enum         // Determines which field is populated
  greigeId?: String       // → greige_master (for greige dyeing/printing)
  fabricId?: String       // → fabric_master (for re-dyeing/reprocessing)
}
```

See [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 7 for job work processing details.

---

## 6. Hierarchical Relationships

Hierarchical (tree) relationships allow parent-child structures for classification and organization.

### 6.1 Chart of Accounts

Self-referential hierarchy for accounting structure:

```typescript
chart_of_accounts {
  id: UUID
  accountCode: String
  accountName: String
  parentAccountId?: String  // → chart_of_accounts.id
}
```

**Example Structure:**
```
Assets (parent)
├── Current Assets (child of Assets)
│   ├── Cash (child of Current Assets)
│   ├── Bank Accounts (child of Current Assets)
│   └── Inventory (child of Current Assets)
└── Fixed Assets (child of Assets)
    ├── Machinery (child of Fixed Assets)
    └── Buildings (child of Fixed Assets)
```

**Query Pattern:**
```typescript
// Get account with parent
const account = await prisma.chart_of_accounts.findUnique({
  where: { id },
  include: {
    parentAccount: true,     // Get parent
    childAccounts: true      // Get children
  }
});

// Recursive query for full tree
function buildAccountTree(accounts, parentId = null) {
  return accounts
    .filter(acc => acc.parentAccountId === parentId)
    .map(acc => ({
      ...acc,
      children: buildAccountTree(accounts, acc.id)
    }));
}
```

See [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) Section 2 for Chart of Accounts details.

### 6.2 Fabric Master → Greige Master

Finished fabric hierarchy linking to raw greige:

```typescript
fabric_master {
  id: UUID
  fabricName: String
  greigeId?: String  // → greige_master.id (raw fabric source)
}
```

**Relationship:**
- One greige → Many finished fabrics (different colors/finishes)
- Finished fabric tracks its greige source for procurement

**Example:**
```
Greige: "Cotton 60s Plain"
├── Finished: "Cotton 60s Red Solid"
├── Finished: "Cotton 60s Blue Solid"
└── Finished: "Cotton 60s Printed Floral"
```

See [FABRIC_COSTING_GUIDE.md](./FABRIC_COSTING_GUIDE.md) Section 3 for fabric hierarchy details.

### 6.3 Component Groups

Component hierarchy for pattern parts:

```typescript
component_group_master {
  id: UUID
  groupName: String
}

component_masters {
  id: UUID
  componentName: String
  componentGroupId?: String  // → component_group_master.id
}
```

**Example:**
```
Upper Body (group)
├── Front (component)
├── Back (component)
└── Sleeve (component)

Lower Body (group)
├── Pant Front (component)
└── Pant Back (component)
```

See PROJECT_BIBLE.md Section 16 for component group details.

### 6.4 Product Categories

Product category hierarchy:

```typescript
product_category_master {
  id: UUID
  categoryName: String
  parentId?: String  // → product_category_master.id
}
```

**Example:**
```
Apparel (parent)
├── Men's Wear (child)
│   ├── Shirts (grandchild)
│   └── Pants (grandchild)
└── Women's Wear (child)
    ├── Tops (grandchild)
    └── Dresses (grandchild)
```

---

## 7. Data Flow Diagrams

### 7.1 Complete Production Flow (15 Stages)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Style       │ →   │  2. Sample      │ →   │  3. BOM         │
│  Creation       │     │  Development    │     │  Finalization   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  4. Costing     │ →   │  5. Quotation   │ →   │  6. Order       │
│  & Pricing      │     │  Approval       │     │  Entry          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  7. Material    │ →   │  8. Procurement │ →   │  9. Production  │
│  Planning (MRP) │     │  (PO/GRN)       │     │  Planning (WO)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  10. Cutting    │ →   │  11. Stitching  │ →   │  12. Finishing  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  13. Quality    │ →   │  14. Packing    │ →   │  15. Dispatch   │
│  Control (QC)   │     │  (Polybag/CTN)  │     │  & Invoicing    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Stage Relationships:**

| Stage | Trigger Module | Result Module | Key Tables |
|-------|---------------|---------------|------------|
| 1. Style Creation | Manual | styles | styles, style_variants, style_components |
| 2. Sample Development | Style approved | samples | samples, sample_measurements |
| 3. BOM Finalization | Sample approved | style_material_bom | style_material_bom, materials |
| 4. Costing & Pricing | BOM complete | style_costing | style_costing, fabric_width_cad |
| 5. Quotation Approval | Cost approved | quotations | quotations, quotation_items |
| 6. Order Entry | Quotation accepted | orders | orders, order_items, order_item_breakup |
| 7. Material Planning | Order confirmed | material_requirements | material_requirements, bom_items |
| 8. Procurement | Requirements generated | purchase_orders | purchase_orders, goods_receiving_notes |
| 9. Production Planning | GRN received | work_orders | work_orders, work_order_breakup |
| 10. Cutting | Work order approved | cutting_batches | cutting_batches, cutting_batch_skus |
| 11. Stitching | Cutting complete | stitching_issues | stitching_issues, stitching_daily_outputs |
| 12. Finishing | Stitching complete | finishing_issues | finishing_issues, finishing_daily_outputs |
| 13. Quality Control | Finishing complete | quality_inspections_mfg | quality_inspections_mfg, polybag_entries |
| 14. Packing | QC passed | carton_packings | carton_packings, carton_skus |
| 15. Dispatch | Packing complete | delivery_notes | delivery_notes, invoices |

See PROJECT_BIBLE.md Section 14 for complete workflow details.

### 7.2 Stock Movement Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     STOCK INWARD METHODS                      │
└──────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ GRN Receipt │    │ Direct      │    │ Transfer    │
│             │    │ Stock In    │    │ IN          │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │ stock_      │
                    │ levels      │
                    │ (INCREASE)  │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Material    │    │ Job Work    │    │ Transfer    │
│ Requisition │    │ Send        │    │ OUT         │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ stock_      │
                    │ levels      │
                    │ (DECREASE)  │
                    └─────────────┘
┌──────────────────────────────────────────────────────────────┐
│                    STOCK OUTWARD METHODS                      │
└──────────────────────────────────────────────────────────────┘
```

**Stock Movement Types:**

**INWARD (Stock Increase):**
1. **GRN Receipt** - `goods_receiving_notes` → `stock_movements` (type: IN)
2. **Direct Stock In** - Manual entry via `stock_transactions`
3. **Transfer IN** - From another warehouse via `stock_movements`
4. **Stock Adjustment IN** - Physical count correction via `stock_counts`
5. **Job Work Return** - `processing_delivery` → `stock_movements`
6. **Production Return** - Excess materials returned

**OUTWARD (Stock Decrease):**
1. **Material Requisition** - `material_requisitions` → `stock_movements` (type: OUT)
2. **Job Work Send** - `processing_batch` → `stock_movements`
3. **Transfer OUT** - To another warehouse via `stock_movements`
4. **Sales Dispatch** - `delivery_notes` → `stock_movements`
5. **Stock Adjustment OUT** - Physical count correction
6. **Wastage/Scrap** - Write-off via `stock_transactions`

See [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) for complete stock flow documentation.

### 7.3 Fabric Lifecycle Flow

```
┌─────────────────┐
│ greige_master   │  ← Raw fabric specification
│ (Template)      │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ fabric_         │  ← Purchase raw fabric
│ procurement     │     - greigeId set
│ (Transaction)   │     - supplierId
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ fabric_         │  ← Send for dyeing/printing
│ processing      │     - procurementId
│ (Job Work)      │     - processingMillId
└────────┬────────┘
         │ creates
         ▼
┌─────────────────┐
│ fabric_master   │  ← Finished fabric created
│ (Template)      │     - greigeId (source)
│                 │     - color, finish
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ fabric_stock    │  ← Physical inventory
│ (Inventory)     │     - fabricId
│                 │     - quantityAvailable
└────────┬────────┘
         │ N:1
         ▼
┌─────────────────┐
│ fabric_stock_   │  ← Reserve for order
│ allocation      │     - stockId
│ (Reservation)   │     - orderId, styleId
└────────┬────────┘
         │ consumption
         ▼
┌─────────────────┐
│ cutting_batches │  ← Use in production
│ (Usage)         │     - fabricStockId
│                 │     - quantityUsed
└─────────────────┘
```

**Key Relationships:**
- `fabric_procurement.greigeId` → `greige_master.id`
- `fabric_processing.procurementId` → `fabric_procurement.id`
- `fabric_processing.finishedFabricId` → `fabric_master.id` (creates)
- `fabric_master.greigeId` → `greige_master.id` (source reference)
- `fabric_stock.fabricId` → `fabric_master.id`
- `fabric_stock.procurementId` → `fabric_procurement.id`
- `fabric_stock_allocation.stockId` → `fabric_stock.id`
- `cutting_batches.fabricStockId` → `fabric_stock.id`

See [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 3 for fabric stock details.

### 7.4 Order to Invoice Flow

```
┌─────────────────┐
│   quotations    │  ← Initial pricing
└────────┬────────┘
         │ acceptance
         ▼
┌─────────────────┐
│     orders      │  ← Customer order
│  (CONFIRMED)    │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│  order_items    │  ← Line items
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ order_item_     │  ← SKU-level detail
│   breakup       │
└────────┬────────┘
         │ triggers
         ▼
┌─────────────────┐
│  work_orders    │  ← Production
│ (APPROVED)      │
└────────┬────────┘
         │ production flow
         ▼
┌─────────────────┐
│  cutting →      │
│  stitching →    │  ← Manufacturing
│  finishing →    │
│  QC             │
└────────┬────────┘
         │ packing
         ▼
┌─────────────────┐
│ carton_packings │  ← Ready to ship
└────────┬────────┘
         │ dispatch
         ▼
┌─────────────────┐
│ delivery_notes  │  ← Shipment
│  (DISPATCHED)   │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐
│    invoices     │  ← Billing
│  (PENDING)      │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│    payments     │  ← Payment received
└─────────────────┘
```

**Status Progression:**
- Order: PENDING → CONFIRMED → IN_PRODUCTION → COMPLETED
- Work Order: PENDING → APPROVED → IN_PROGRESS → COMPLETED
- Delivery Note: PENDING → DISPATCHED → DELIVERED
- Invoice: PENDING → PARTIALLY_PAID → PAID

See [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) for complete order flow.

### 7.5 Material Requirement Flow (BOM → MRP → PO)

```
┌─────────────────┐
│  styles         │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ style_material_ │  ← Bill of Materials
│      bom        │     - quantityPerGarment
└────────┬────────┘
         │ triggered by order
         ▼
┌─────────────────┐
│    orders       │
│ orderQuantity   │
└────────┬────────┘
         │ calculation
         ▼
┌─────────────────┐
│  material_      │  ← MRP Calculation
│  requirements   │     BOM qty × Order qty
│                 │     - Check stock levels
└────────┬────────┘
         │ M:N (via requirement_po_links)
         ▼
┌─────────────────┐
│  purchase_      │  ← Consolidate requirements
│   orders        │     into PO
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ purchase_order_ │  ← PO line items
│     items       │
└────────┬────────┘
         │ receipt
         ▼
┌─────────────────┐
│  goods_         │  ← Receipt validation
│  receiving_     │
│  notes (GRN)    │
└────────┬────────┘
         │ automatic
         ▼
┌─────────────────┐
│ stock_          │  ← Inventory updated
│  movements      │     (type: IN)
│                 │
│ stock_levels    │  ← Quantity increased
└─────────────────┘
```

**MRP Calculation Example:**
```
Style BOM:
- Button: 5 pcs per garment
- Thread: 200m per garment

Order:
- Quantity: 1000 garments

Material Requirements:
- Button: 5 × 1000 = 5000 pcs
- Thread: 200 × 1000 = 200,000m

Stock Check:
- Button available: 3000 pcs → Shortage: 2000 pcs
- Thread available: 150,000m → Shortage: 50,000m

Purchase Order:
- Button: 2000 pcs (+ 10% buffer = 2200 pcs)
- Thread: 50,000m (+ 10% buffer = 55,000m)
```

See [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) for complete MRP documentation.

---

## 8. Integration Points by Module

This section documents how each major module integrates with other modules, including foreign keys, triggered events, and related guides.

### 8.1 Style Module

**Primary Tables:** `styles`, `style_variants`, `style_components`, `style_fabrics`, `style_material_bom`, `style_costing`

**Integrates With:**
- **Customers** (via `brand_categories.customerId`) - Customer-specific brands and styling
- **Product Categories** (via `styles.productCategoryId`) - Classification
- **Color Master** (via `style_variants.colorId`) - Color options
- **Size Master** (via `style_variants.sizeId`) - Size options
- **Component Masters** (via `style_components.componentMasterId`) - Pattern parts
- **Fabric Master** (via `style_fabrics.fabricId`) - Fabric selections
- **Material Masters** (via `style_material_bom.*Id`) - BOM items (13 material types)
- **Orders** (via `orders.styleId`) - Customer orders using this style
- **Samples** (via `samples.styleId`) - Sample development
- **CAD Planning** (via `fabric_width_cad.costingStyleId`) - Fabric consumption
- **Costing** (via `style_costing.styleId`) - Price calculation

**Foreign Keys Out:**
- `styles.categoryId` → `style_categories.id`
- `styles.brandCategoryId` → `brand_categories.id`
- `styles.productCategoryId` → `product_category_master.id`
- `styles.createdById` → `users.id`
- `style_variants.styleId` → `styles.id`
- `style_components.styleId` → `styles.id`
- `style_fabrics.componentId` → `style_components.id`
- `style_material_bom.styleId` → `styles.id`

**Triggered By:**
- Manual style creation
- Style import via `style_import_staging`

**Triggers:**
- Order creation (style as template)
- Sample development
- BOM creation
- Cost calculation
- Material requirement planning (via orders)

**Related Guides:**
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) Section 5.1 - Style Management
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) - BOM creation
- [FABRIC_COSTING_GUIDE.md](./FABRIC_COSTING_GUIDE.md) - Style costing
- [CAD_PLANNING_GUIDE.md](./CAD_PLANNING_GUIDE.md) - CAD planning

### 8.2 Order Module

**Primary Tables:** `orders`, `order_items`, `order_item_breakup`, `order_item_costing`

**Integrates With:**
- **Customers** (via `orders.customerId`) - Buyer information
- **Styles** (via `order_items.styleId`) - Product ordered
- **Work Orders** (via `work_orders.orderId`) - Production trigger
- **Material Requirements** (via `material_requirements.orderId`) - MRP calculation
- **Invoices** (via `invoices.orderId`) - Billing
- **Delivery Notes** (via `delivery_notes.orderId`) - Shipment
- **Samples** (via `order_samples.orderItemId`) - Order-specific samples
- **Quality Inspections** (via `order_inspections.orderItemId`) - QC records
- **GST** (via `orders` state calculations) - Tax compliance

**Foreign Keys Out:**
- `orders.customerId` → `customers.id`
- `orders.createdById` → `users.id`
- `orders.approvedById` → `users.id`
- `order_items.orderId` → `orders.id`
- `order_items.styleId` → `styles.id`
- `order_item_breakup.orderItemId` → `order_items.id`
- `order_item_breakup.colorId` → `color_options.id`
- `order_item_breakup.sizeId` → `size_options.id`

**Triggered By:**
- Quotation acceptance (`quotations` → `orders`)
- Direct order entry

**Triggers:**
- Work order creation (`work_orders.orderId`)
- Material requirement generation (`material_requirements.orderId`)
- Invoice creation (`invoices.orderId`)
- Delivery note creation (`delivery_notes.orderId`)

**Related Guides:**
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) - Complete order lifecycle
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) Section 5.3 - Order management
- [GST_GUIDE.md](./GST_GUIDE.md) - Tax compliance

### 8.3 Material Module

**Primary Tables:** `materials`, `lace_master`, `button_master`, `thread_master`, `zipper_master`, `elastic_master`, `label_master`, `packaging_master`, and 9 more specialized masters

**Integrates With:**
- **Material Categories** (via `materials.categoryId`) - Classification
- **Suppliers** (via 16 `*_suppliers` junction tables) - Supplier linking
- **Style BOM** (via `style_material_bom.*Id`) - Material requirements
- **Stock Levels** (via `stock_levels.materialId`) - Inventory tracking
- **Purchase Orders** (via `purchase_order_items.materialId`) - Procurement
- **Material Requirements** (via `material_requirements.materialId`) - MRP
- **Customers** (for labels/packaging) (via `label_master.customerId`) - Customer-specific
- **Brands** (for labels/packaging) (via `label_master.brandCategoryId`) - Brand-specific

**Foreign Keys Out (Polymorphic):**
- `materials.greigeId` → `greige_master.id`
- `materials.fabricId` → `fabric_master.id`
- `materials.laceId` → `lace_master.id`
- `materials.buttonId` → `button_master.id`
- `materials.threadId` → `thread_master.id`
- `materials.zipperId` → `zipper_master.id`
- `materials.elasticId` → `elastic_master.id`
- `materials.labelId` → `label_master.id`
- `materials.packagingId` → `packaging_master.id`
- (+ 4 more specialized types)

**Triggered By:**
- Manual material master creation
- Material import

**Triggers:**
- Stock level creation (`stock_levels.materialId`)
- BOM item creation (`style_material_bom.*Id`)
- Purchase order item creation (`purchase_order_items.materialId`)

**Related Guides:**
- [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) - Complete material documentation
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 3 - Style Material BOM

### 8.4 BOM Module

**Primary Tables:** `style_material_bom`, `bill_of_materials` (deprecated), `bom_items` (deprecated)

**Integrates With:**
- **Styles** (via `style_material_bom.styleId`) - BOM for style
- **Materials** (via `style_material_bom.materialId`) - Generic material
- **Material Masters** (via `style_material_bom.*Id`) - Specific material (polymorphic)
- **Material Requirements** (via `material_requirements.bomItemId`) - MRP trigger
- **Cost Calculation** (BOM drives material costs in `style_costing`)

**Foreign Keys Out:**
- `style_material_bom.styleId` → `styles.id`
- `style_material_bom.materialId` → `materials.id`
- `style_material_bom.laceId` → `lace_master.id`
- `style_material_bom.buttonId` → `button_master.id`
- `style_material_bom.threadId` → `thread_master.id`
- (+ 6 more specialized material types)

**Triggered By:**
- Style creation
- Sample approval

**Triggers:**
- Material requirement calculation (BOM qty × Order qty)
- Cost calculation (material costs in `style_costing`)

**Related Guides:**
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) - Complete BOM documentation
- [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) - Material linking

### 8.5 Stock Module

**Primary Tables:** `stock_levels`, `stock_movements`, `stock_transactions`, `inventory_stock`, `fabric_stock`, `finished_goods_stock`

**Integrates With:**
- **Materials** (via `stock_levels.materialId`) - Material tracked
- **Warehouses** (via `stock_levels.warehouseId`) - Storage location
- **GRN** (via `stock_movements` reference) - Stock inward
- **Material Requisitions** (via `stock_movements` reference) - Stock outward
- **Processing Batches** (via `stock_movements` reference) - Job work send/return
- **Fabric Master** (via `fabric_stock.fabricId`) - Fabric inventory
- **Embroidery** (via `fabric_stock.embroideryId`) - Embroidered fabric tracking
- **Cutting Batches** (via `cutting_batches.fabricStockId`) - Production usage

**Foreign Keys Out:**
- `stock_levels.materialId` → `materials.id`
- `stock_levels.warehouseId` → `warehouses.id`
- `stock_movements.materialId` → `materials.id`
- `stock_movements.warehouseId` → `warehouses.id`
- `stock_movements.referenceId` → (polymorphic: GRN, Requisition, etc.)
- `fabric_stock.fabricId` → `fabric_master.id`
- `fabric_stock.embroideryId` → `embroidery_master.id`
- `fabric_stock.procurementId` → `fabric_procurement.id`

**Triggered By:**
- GRN receipt (`goods_receiving_notes` → auto-create `stock_movements`)
- Material requisition (`material_requisitions` → deduct stock)
- Processing send/return (`processing_batch`, `processing_delivery` → stock movements)
- Stock adjustments (`stock_counts` → adjust `stock_levels`)

**Triggers:**
- Material availability checks (before creating work orders)
- Stock reservation for orders (`stock_reservations`)
- Fabric allocation to orders (`fabric_stock_allocation`)

**Related Guides:**
- [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) - Complete stock documentation
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 6 - Material requisitions

### 8.6 Procurement Module

**Primary Tables:** `purchase_orders`, `purchase_order_items`, `goods_receiving_notes`, `grn_items`

**Integrates With:**
- **Suppliers** (via `purchase_orders.supplierId`) - Supplier for PO
- **Materials** (via `purchase_order_items.materialId`) - Materials ordered
- **Material Requirements** (via `requirement_po_links`) - MRP to PO linking
- **Stock** (via automatic `stock_movements` on GRN) - Inventory update
- **Warehouses** (via `goods_receiving_notes.warehouseId`) - Target warehouse
- **Users** (via approval workflow) - PO approval, GRN receipt

**Foreign Keys Out:**
- `purchase_orders.supplierId` → `suppliers.id`
- `purchase_orders.createdById` → `users.id`
- `purchase_orders.approvedById` → `users.id`
- `purchase_order_items.poId` → `purchase_orders.id`
- `purchase_order_items.materialId` → `materials.id`
- `goods_receiving_notes.poId` → `purchase_orders.id`
- `goods_receiving_notes.supplierId` → `suppliers.id`
- `goods_receiving_notes.warehouseId` → `warehouses.id`
- `grn_items.grnId` → `goods_receiving_notes.id`
- `grn_items.poItemId` → `purchase_order_items.id`
- `requirement_po_links.requirementId` → `material_requirements.id`
- `requirement_po_links.purchaseOrderId` → `purchase_orders.id`

**Triggered By:**
- Material requirements generation (`material_requirements` → create PO)
- Manual PO creation

**Triggers:**
- GRN receipt → automatic `stock_movements` (type: IN)
- GRN approval → update PO status
- Stock level increase

**Related Guides:**
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) - Complete procurement workflow
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 8 - Requirement to PO linking

### 8.7 Work Order Module

**Primary Tables:** `work_orders`, `work_order_breakup`

**Integrates With:**
- **Orders** (via `work_orders.orderId`) - Production for order
- **Order Items** (via `work_orders.orderItemId`) - Specific line item
- **Styles** (via `work_orders.styleId`) - Style to produce
- **Locations** (via `work_orders.locationId`) - Production facility
- **Cutting Batches** (via `cutting_batches.workOrderId`) - Cutting phase
- **Stitching Issues** (via `stitching_issues.workOrderId`) - Stitching phase
- **Finishing Issues** (via `finishing_issues.workOrderId`) - Finishing phase
- **Material Requisitions** (via `material_requisitions.workOrderId`) - Material issue
- **Quality Inspections** (via `quality_inspections.workOrderId`) - QC

**Foreign Keys Out:**
- `work_orders.orderId` → `orders.id`
- `work_orders.orderItemId` → `order_items.id`
- `work_orders.styleId` → `styles.id`
- `work_orders.locationId` → `locations.id`
- `work_orders.createdById` → `users.id`
- `work_orders.approvedById` → `users.id`
- `work_order_breakup.workOrderId` → `work_orders.id`
- `work_order_breakup.colorId` → `color_options.id`
- `work_order_breakup.sizeId` → `size_options.id`

**Triggered By:**
- Order confirmation and approval
- Material availability check passed

**Triggers:**
- Cutting batch creation (`cutting_batches.workOrderId`)
- Material requisition (`material_requisitions.workOrderId`)
- Production tracking records

**Related Guides:**
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) - Complete production workflow
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 11 - Order to Work Order

### 8.8 Cutting Module

**Primary Tables:** `cutting_batches`, `cutting_batch_skus`, `cutting_batch_defects`

**Integrates With:**
- **Work Orders** (via `cutting_batches.workOrderId`) - Production WO
- **Style Components** (via `cutting_batches.componentId`) - Component being cut
- **Fabric Stock** (via `cutting_batches.fabricStockId`) - Fabric consumed
- **Transfer Slips** (via `transfer_slips.cuttingBatchId`) - Transfer to stitching
- **Users** (via `cutting_batches.cuttingOperatorId`) - Operator assignment

**Foreign Keys Out:**
- `cutting_batches.workOrderId` → `work_orders.id`
- `cutting_batches.componentId` → `style_components.id`
- `cutting_batches.fabricStockId` → `fabric_stock.id`
- `cutting_batches.cuttingTableId` → `users.id` (or machine)
- `cutting_batches.cuttingOperatorId` → `users.id`
- `cutting_batches.createdById` → `users.id`
- `cutting_batch_skus.cuttingBatchId` → `cutting_batches.id`
- `cutting_batch_skus.colorId` → `color_options.id`
- `cutting_batch_skus.sizeId` → `size_options.id`

**Triggered By:**
- Work order approval
- Fabric stock allocation
- Material requisition approval

**Triggers:**
- Fabric stock deduction (via `fabric_stock_transaction`)
- Transfer slip creation (`transfer_slips.cuttingBatchId`)
- Stitching issue creation (via transfer slip)

**Related Guides:**
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 3 - Cutting Phase

### 8.9 Stitching Module

**Primary Tables:** `stitching_issues`, `stitching_issue_components`, `stitching_issue_skus`, `stitching_daily_outputs`

**Integrates With:**
- **Work Orders** (via `stitching_issues.workOrderId`) - Production WO
- **Style Components** (via `stitching_issue_components.componentId`) - Components stitched
- **Transfer Slips** (via `transfer_slips.stitchingIssueId`) - Receive from cutting, transfer to finishing
- **Users** (via `stitching_issues.managerId`) - Stitching manager

**Foreign Keys Out:**
- `stitching_issues.workOrderId` → `work_orders.id`
- `stitching_issues.managerId` → `users.id` (stitching manager)
- `stitching_issues.createdById` → `users.id`
- `stitching_issue_components.stitchingIssueId` → `stitching_issues.id`
- `stitching_issue_components.componentId` → `style_components.id`
- `stitching_issue_skus.stitchingIssueId` → `stitching_issues.id`
- `stitching_daily_outputs.stitchingIssueId` → `stitching_issues.id`

**Triggered By:**
- Transfer slip from cutting (stage receipt)
- Stitching manager allocation

**Triggers:**
- Daily output recording (`stitching_daily_outputs`)
- Transfer slip to finishing (`transfer_slips.stitchingIssueId`)
- Finishing issue creation

**Related Guides:**
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 4 - Stitching Phase

### 8.10 Finishing Module

**Primary Tables:** `finishing_issues`, `finishing_issue_components`, `finishing_issue_skus`, `finishing_daily_outputs`

**Integrates With:**
- **Work Orders** (via `finishing_issues.workOrderId`) - Production WO
- **Style Components** (via `finishing_issue_components.componentId`) - Components finished
- **Transfer Slips** (via `transfer_slips.finishingIssueId`) - Receive from stitching
- **Quality Inspections** (via `quality_inspections_mfg.finishingIssueId`) - QC after finishing
- **Polybag Entries** (via `polybag_entries.finishingIssueId`) - Packing
- **Carton Packings** (via `carton_packings.finishingIssueId`) - Final packing

**Foreign Keys Out:**
- `finishing_issues.workOrderId` → `work_orders.id`
- `finishing_issues.managerId` → `users.id` (finishing manager)
- `finishing_issues.createdById` → `users.id`
- `finishing_issue_components.finishingIssueId` → `finishing_issues.id`
- `finishing_issue_components.componentId` → `style_components.id`
- `finishing_issue_skus.finishingIssueId` → `finishing_issues.id`
- `finishing_daily_outputs.finishingIssueId` → `finishing_issues.id`

**Triggered By:**
- Transfer slip from stitching
- Finishing manager allocation

**Triggers:**
- Daily output recording (`finishing_daily_outputs`)
- Quality inspection (`quality_inspections_mfg`)
- Polybag entry (`polybag_entries.finishingIssueId`)
- Carton packing (`carton_packings.finishingIssueId`)

**Related Guides:**
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 5 - Finishing Phase

### 8.11 Processing (Job Work) Module

**Primary Tables:** `processing_batch`, `processing_stage`, `processing_movement`, `processing_delivery`

**Integrates With:**
- **Greige Master** (via `processing_batch.greigeId`) - Raw fabric processed
- **Fabric Master** (via `processing_batch.fabricId`) - Finished fabric processed
- **Suppliers** (via `processing_stage.processorId`) - Processor (dyer/printer)
- **Stock Movements** (via polymorphic `stock_movements.referenceId`) - Job work send/return
- **Fabric Processing** (via `fabric_processing.procurementId`) - Procurement to processing

**Foreign Keys Out:**
- `processing_batch.greigeId` → `greige_master.id`
- `processing_batch.fabricId` → `fabric_master.id`
- `processing_batch.createdById` → `users.id`
- `processing_stage.batchId` → `processing_batch.id`
- `processing_stage.processorId` → `suppliers.id`
- `processing_movement.batchId` → `processing_batch.id`
- `processing_movement.stageId` → `processing_stage.id`
- `processing_movement.performedById` → `users.id`
- `processing_delivery.batchId` → `processing_batch.id`
- `processing_delivery.stageId` → `processing_stage.id`
- `processing_delivery.receivedById` → `users.id`

**Triggered By:**
- Fabric procurement (greige purchase → send for dyeing/printing)
- Job work order creation (`job_work_orders`)
- Manual processing batch creation

**Triggers:**
- Stock movement on send (`stock_movements.referenceType = JOB_WORK_SEND`)
- Stock movement on return (`stock_movements.referenceType = JOB_WORK_RETURN`)
- Fabric master creation (finished fabric after processing)
- Fabric stock creation (processed fabric inventory)

**Related Guides:**
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 7 - Processing (Job Work)
- [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 5 - Job work stock movements

### 8.12 Quality Module

**Primary Tables:** `quality_inspections`, `quality_defects`, `quality_inspections_mfg`, `fabric_physical_tests`, `garment_physical_tests`

**Integrates With:**
- **Work Orders** (via `quality_inspections.workOrderId`) - Production QC
- **Styles** (via `quality_inspections.styleId`) - Style inspected
- **Finishing Issues** (via `quality_inspections_mfg.finishingIssueId`) - Manufacturing QC
- **Fabric Master** (via `fabric_physical_tests.fabricId`) - Fabric testing
- **Fabric Procurement** (via `fabric_physical_tests.fabricProcurementId`) - Procurement batch testing
- **Fabric Stock** (via `fabric_physical_tests.fabricStockLotId`) - Stock lot testing
- **Testing Labs** (via `*_tests.testingLabId`) - External lab testing
- **Customers** (via `*_tests.customerId`) - Customer-required tests
- **Test Templates** (via `customers.fptTemplateId`, `customers.gptTemplateId`) - Standard test procedures

**Foreign Keys Out:**
- `quality_inspections.workOrderId` → `work_orders.id`
- `quality_inspections.styleId` → `styles.id`
- `quality_inspections.inspectedById` → `users.id`
- `quality_inspections.approvedById` → `users.id`
- `quality_defects.inspectionId` → `quality_inspections.id`
- `fabric_physical_tests.fabricId` → `fabric_master.id`
- `fabric_physical_tests.testingLabId` → `testing_labs.id`
- `garment_physical_tests.workOrderId` → `work_orders.id`
- `garment_physical_tests.styleId` → `styles.id`

**Triggered By:**
- Finishing completion (manufacturing QC)
- Fabric receipt (fabric testing)
- Customer requirement (compliance testing)

**Triggers:**
- Work order status update (PASS → ready for packing, FAIL → rework)
- Fabric stock approval (test results affect stock acceptance)
- Quality report generation

**Related Guides:**
- [TESTING_QUALITY_GUIDE.md](./TESTING_QUALITY_GUIDE.md) - Complete quality documentation
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 6 - Quality Control

### 8.13 Dispatch Module

**Primary Tables:** `delivery_notes`, `delivery_note_items`, `delivery_notes_ext`, `dispatch_cartons`, `dispatch_transports`, `dispatch_pods`, `asn_applications`

**Integrates With:**
- **Orders** (via `delivery_notes.orderId`) - Shipment for order
- **Customers** (via `delivery_notes.customerId`) - Ship to customer
- **Carton Packings** (via `dispatch_cartons.cartonId`) - Cartons shipped
- **ASN** (via `delivery_notes_ext.asnId`) - Advanced Shipment Notice
- **Invoices** (link not in schema, but business flow) - Billing on dispatch

**Foreign Keys Out:**
- `delivery_notes.orderId` → `orders.id`
- `delivery_notes.customerId` → `customers.id`
- `delivery_notes.createdById` → `users.id`
- `delivery_note_items.deliveryNoteId` → `delivery_notes.id`
- `delivery_note_items.orderItemId` → `order_items.id`
- `delivery_notes_ext.deliveryNoteId` → `delivery_notes.id`
- `delivery_notes_ext.asnId` → `asn_applications.id`
- `dispatch_cartons.deliveryNoteExtId` → `delivery_notes_ext.id`
- `dispatch_cartons.cartonId` → `carton_packings.id`
- `dispatch_transports.deliveryNoteExtId` → `delivery_notes_ext.id`
- `dispatch_pods.deliveryNoteExtId` → `delivery_notes_ext.id`

**Triggered By:**
- QC passed and packing complete
- Customer shipping request
- ASN submission

**Triggers:**
- Invoice creation (`invoices.orderId`)
- Finished goods stock deduction
- POD (Proof of Delivery) upload

**Related Guides:**
- [DISPATCH_LOGISTICS_GUIDE.md](./DISPATCH_LOGISTICS_GUIDE.md) - Complete dispatch documentation
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 8 - Dispatch

### 8.14 Invoice Module

**Primary Tables:** `invoices`, `payments`, `quotations`, `quotation_items`

**Integrates With:**
- **Orders** (via `invoices.orderId`) - Invoice for order
- **Customers** (via `invoices.customerId`) - Customer billed
- **Delivery Notes** (business flow link) - Invoice on dispatch
- **GST** (via `invoices.placeOfSupplyId`) - Tax calculation (CGST+SGST or IGST)
- **Payments** (via `payments.invoiceId`) - Payment tracking
- **Indian States** (via `invoices.placeOfSupplyId`) - Place of supply for GST

**Foreign Keys Out:**
- `invoices.orderId` → `orders.id`
- `invoices.customerId` → `customers.id`
- `invoices.placeOfSupplyId` → `indian_states.id`
- `invoices.createdById` → `users.id`
- `payments.invoiceId` → `invoices.id`
- `payments.receivedById` → `users.id`
- `quotations.customerId` → `customers.id`
- `quotations.placeOfSupplyId` → `indian_states.id`
- `quotations.createdById` → `users.id`
- `quotation_items.quotationId` → `quotations.id`
- `quotation_items.styleId` → `styles.id`

**Triggered By:**
- Delivery note dispatch
- Manual invoice creation

**Triggers:**
- Payment recording (`payments.invoiceId`)
- Invoice status update (PENDING → PARTIALLY_PAID → PAID)
- Accounts receivable update

**Related Guides:**
- [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) Section 8 - Invoice management
- [GST_GUIDE.md](./GST_GUIDE.md) - Tax compliance

### 8.15 Sample Module

**Primary Tables:** `samples`, `sample_measurements`, `sample_colorways`, `sample_size_sets`, `order_samples`

**Integrates With:**
- **Customers** (via `samples.customerId`) - Sample for customer
- **Styles** (via `samples.styleId`) - Sample of style
- **Orders** (via `order_samples.orderItemId`) - Sample for order
- **Color Options** (via `sample_colorways.colorId`) - Colorway variations
- **Size Options** (via `sample_measurements.sizeId`, `sample_size_sets.sizeId`) - Size variations
- **Users** (via `samples.createdById`) - Created by

**Foreign Keys Out:**
- `samples.customerId` → `customers.id`
- `samples.styleId` → `styles.id`
- `samples.createdById` → `users.id`
- `sample_measurements.sampleId` → `samples.id`
- `sample_measurements.sizeId` → `size_options.id`
- `sample_colorways.sampleId` → `samples.id`
- `sample_colorways.colorId` → `color_options.id`
- `sample_size_sets.sampleId` → `samples.id`
- `sample_size_sets.sizeId` → `size_options.id`
- `sample_size_sets.colorId` → `color_options.id`
- `order_samples.orderItemId` → `order_items.id`

**Triggered By:**
- Style development
- Customer inquiry
- Order confirmation (size set sample)

**Triggers:**
- Style approval (fit sample approved → move to costing)
- Order placement (sample approved → customer orders)
- BOM finalization (sample measurements drive material quantities)

**Related Guides:**
- [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) - Complete sample documentation
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) Section 14 Stage 2 - Sample Development

---

## 9. Critical Workflow Integrations

This section documents key workflows that span multiple modules, showing how data flows through integration points.

### 9.1 Order → Work Order Conversion

**Workflow:**
1. Order confirmed (`orders.status = CONFIRMED`)
2. Order item breakup complete (`order_item_breakup` has all SKUs)
3. Material requirements generated (via `material_requirements`)
4. Material availability checked (`stock_levels`)
5. Work order created (`work_orders`)
6. Work order breakup created (`work_order_breakup` mirrors `order_item_breakup`)
7. Work order approved (`work_orders.approvedById` set)

**Integration Points:**
```typescript
// Step 1: Order confirmation triggers work order creation
orders {
  id: "order-123"
  status: CONFIRMED
  customerId: "customer-1"
}

// Step 2: Get order items
order_items {
  id: "item-1"
  orderId: "order-123"
  styleId: "style-1"
  orderQuantity: 1000
}

// Step 3: Get SKU breakdown
order_item_breakup {
  orderItemId: "item-1"
  colorId: "red"
  sizeId: "M"
  quantity: 300
}

// Step 4: Create work order
work_orders {
  id: "wo-1"
  orderId: "order-123"
  orderItemId: "item-1"
  styleId: "style-1"
  status: PENDING
}

// Step 5: Mirror SKU breakdown
work_order_breakup {
  workOrderId: "wo-1"
  colorId: "red"
  sizeId: "M"
  quantity: 300
}
```

**Service Code Pattern:**
```typescript
async function convertOrderToWorkOrder(orderId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get order with items
    const order = await tx.orders.findUnique({
      where: { id: orderId },
      include: { order_items: { include: { order_item_breakup: true } } }
    });

    // 2. Check material availability
    for (const item of order.order_items) {
      const availability = await checkMaterialAvailability(item.styleId, item.orderQuantity);
      if (!availability.canFulfill) {
        throw new Error(`Material shortage: ${availability.shortages.map(s => s.materialCode).join(', ')}`);
      }
    }

    // 3. Create work orders
    for (const item of order.order_items) {
      const workOrder = await tx.work_orders.create({
        data: {
          orderId: order.id,
          orderItemId: item.id,
          styleId: item.styleId,
          status: 'PENDING',
          createdById: userId
        }
      });

      // 4. Create work order breakup (mirror order breakup)
      for (const breakup of item.order_item_breakup) {
        await tx.work_order_breakup.create({
          data: {
            workOrderId: workOrder.id,
            colorId: breakup.colorId,
            sizeId: breakup.sizeId,
            quantity: breakup.quantity
          }
        });
      }
    }

    return { success: true };
  });
}
```

See [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 11 for complete workflow.

### 9.2 BOM → Purchase Order Generation via MRP

**Workflow:**
1. Style BOM finalized (`style_material_bom`)
2. Order placed (`orders.status = CONFIRMED`)
3. Material requirements calculated (BOM qty × Order qty)
4. Stock levels checked (`stock_levels`)
5. Shortages identified
6. Purchase order created (`purchase_orders`)
7. Requirement-PO link created (`requirement_po_links`)

**Integration Points:**
```typescript
// Step 1: BOM definition
style_material_bom {
  styleId: "style-1"
  materialId: "mat-button-1"
  buttonId: "btn-001"
  quantityPerGarment: 5
  unit: "PCS"
}

// Step 2: Order triggers MRP
orders {
  id: "order-123"
  orderQuantity: 1000  // via order_items
}

// Step 3: Calculate requirement
material_requirements {
  id: "req-1"
  orderId: "order-123"
  orderItemId: "item-1"
  materialId: "mat-button-1"
  requiredQuantity: 5000  // 5 pcs × 1000 garments
  bomItemId: "bom-1"
}

// Step 4: Check stock
stock_levels {
  materialId: "mat-button-1"
  quantityAvailable: 3000
}
// Shortage: 5000 - 3000 = 2000 pcs

// Step 5: Create PO
purchase_orders {
  id: "po-1"
  supplierId: "supplier-1"
  status: DRAFT
}

purchase_order_items {
  poId: "po-1"
  materialId: "mat-button-1"
  orderedQuantity: 2200  // 2000 + 10% buffer
}

// Step 6: Link requirement to PO
requirement_po_links {
  requirementId: "req-1"
  purchaseOrderId: "po-1"
  purchaseOrderItemId: "po-item-1"
}
```

**Service Code Pattern:**
```typescript
async function generatePurchaseOrderFromRequirements(requirementIds: string[]) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get requirements
    const requirements = await tx.material_requirements.findMany({
      where: { id: { in: requirementIds } },
      include: { materials: { include: { button_master: true } } }
    });

    // 2. Group by supplier
    const bySupplier = groupBy(requirements, r => r.preferredSupplierId);

    // 3. Create PO per supplier
    for (const [supplierId, reqs] of Object.entries(bySupplier)) {
      const po = await tx.purchase_orders.create({
        data: {
          poNumber: await generatePONumber(),
          supplierId,
          status: 'DRAFT',
          createdById: userId
        }
      });

      // 4. Create PO items
      for (const req of reqs) {
        // Add 10% buffer
        const orderQty = req.requiredQuantity * 1.1;

        const poItem = await tx.purchase_order_items.create({
          data: {
            poId: po.id,
            materialId: req.materialId,
            orderedQuantity: orderQty,
            unitPrice: req.materials.button_master.pricePerPiece
          }
        });

        // 5. Link requirement to PO
        await tx.requirement_po_links.create({
          data: {
            requirementId: req.id,
            purchaseOrderId: po.id,
            purchaseOrderItemId: poItem.id
          }
        });
      }
    }

    return { success: true };
  });
}
```

See [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 8 for complete MRP to PO workflow.

### 9.3 GRN → Stock Automatic Creation

**Workflow:**
1. Purchase order created (`purchase_orders`)
2. Materials received at warehouse
3. GRN created (`goods_receiving_notes`)
4. GRN items recorded (`grn_items`)
5. **AUTOMATIC:** Stock movement created (`stock_movements` type: IN)
6. **AUTOMATIC:** Stock level updated (`stock_levels.quantityAvailable` increased)

**Integration Points:**
```typescript
// Step 1: PO item
purchase_order_items {
  id: "po-item-1"
  poId: "po-1"
  materialId: "mat-button-1"
  orderedQuantity: 2200
}

// Step 2: Create GRN
goods_receiving_notes {
  id: "grn-1"
  poId: "po-1"
  grnNumber: "GRN-2026-001"
  warehouseId: "warehouse-1"
  status: RECEIVED
}

// Step 3: Record GRN items
grn_items {
  id: "grn-item-1"
  grnId: "grn-1"
  poItemId: "po-item-1"
  materialId: "mat-button-1"
  receivedQuantity: 2200
}

// Step 4: AUTOMATIC - Stock movement created
stock_movements {
  id: "movement-1"
  materialId: "mat-button-1"
  warehouseId: "warehouse-1"
  movementType: IN
  quantity: 2200
  referenceType: "GRN"
  referenceId: "grn-1"
}

// Step 5: AUTOMATIC - Stock level updated
stock_levels {
  materialId: "mat-button-1"
  warehouseId: "warehouse-1"
  quantityAvailable: 5200  // 3000 + 2200
}
```

**Service Code Pattern:**
```typescript
async function receiveGRN(grnData: CreateGRNDTO) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create GRN
    const grn = await tx.goods_receiving_notes.create({
      data: {
        grnNumber: await generateGRNNumber(),
        poId: grnData.poId,
        supplierId: grnData.supplierId,
        warehouseId: grnData.warehouseId,
        status: 'RECEIVED',
        receivedById: userId
      }
    });

    // 2. Create GRN items
    for (const item of grnData.items) {
      await tx.grn_items.create({
        data: {
          grnId: grn.id,
          poItemId: item.poItemId,
          materialId: item.materialId,
          receivedQuantity: item.receivedQuantity
        }
      });

      // 3. AUTOMATIC - Create stock movement (IN)
      await tx.stock_movements.create({
        data: {
          materialId: item.materialId,
          warehouseId: grnData.warehouseId,
          movementType: 'IN',
          quantity: item.receivedQuantity,
          referenceType: 'GRN',
          referenceId: grn.id,
          performedById: userId
        }
      });

      // 4. AUTOMATIC - Update stock level
      await tx.stock_levels.upsert({
        where: {
          materialId_warehouseId: {
            materialId: item.materialId,
            warehouseId: grnData.warehouseId
          }
        },
        update: {
          quantityAvailable: { increment: item.receivedQuantity }
        },
        create: {
          materialId: item.materialId,
          warehouseId: grnData.warehouseId,
          quantityAvailable: item.receivedQuantity,
          minimumLevel: 0,
          maximumLevel: 999999
        }
      });
    }

    return grn;
  });
}
```

See [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 9 for GRN details.

### 9.4 Invoice → Payment Linking

**Workflow:**
1. Delivery note dispatched (`delivery_notes.status = DISPATCHED`)
2. Invoice created (`invoices` with auto GST calculation)
3. Payment received (`payments`)
4. **AUTOMATIC:** Invoice status updated (PENDING → PARTIALLY_PAID → PAID)
5. **AUTOMATIC:** Balance amount recalculated

**Integration Points:**
```typescript
// Step 1: Invoice created
invoices {
  id: "inv-1"
  invoiceNumber: "INV-2026-001"
  orderId: "order-123"
  customerId: "customer-1"
  subtotal: 100000.00
  taxAmount: 12000.00  // 12% GST
  totalAmount: 112000.00
  paidAmount: 0.00
  balanceAmount: 112000.00
  status: PENDING
}

// Step 2: Payment received
payments {
  id: "payment-1"
  invoiceId: "inv-1"
  amount: 50000.00
  paymentMethod: "BANK_TRANSFER"
  receivedById: "user-1"
}

// Step 3: AUTOMATIC - Invoice updated
invoices {
  id: "inv-1"
  paidAmount: 50000.00       // 0 + 50000
  balanceAmount: 62000.00    // 112000 - 50000
  status: PARTIALLY_PAID     // Auto-updated
}

// Step 4: Second payment
payments {
  id: "payment-2"
  invoiceId: "inv-1"
  amount: 62000.00
}

// Step 5: AUTOMATIC - Invoice fully paid
invoices {
  id: "inv-1"
  paidAmount: 112000.00      // 50000 + 62000
  balanceAmount: 0.00        // 112000 - 112000
  status: PAID               // Auto-updated
}
```

**Service Code Pattern:**
```typescript
async function recordPayment(paymentData: RecordPaymentDTO) {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoices.findUnique({
      where: { id: paymentData.invoiceId }
    });

    // 1. Create payment record
    const payment = await tx.payments.create({
      data: {
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        referenceNumber: paymentData.referenceNumber,
        receivedById: userId
      }
    });

    // 2. Calculate new amounts
    const newPaidAmount = parseFloat(invoice.paidAmount.toString()) + paymentData.amount;
    const newBalanceAmount = parseFloat(invoice.totalAmount.toString()) - newPaidAmount;

    // 3. Determine new status
    let newStatus: InvoiceStatus = 'PENDING';
    if (newBalanceAmount <= 0) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      // Check if overdue
      newStatus = new Date() > invoice.dueDate ? 'OVERDUE' : 'PARTIALLY_PAID';
    }

    // 4. AUTOMATIC - Update invoice
    const updatedInvoice = await tx.invoices.update({
      where: { id: paymentData.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus
      }
    });

    return { payment, invoice: updatedInvoice };
  });
}
```

See [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) Section 8 for invoice/payment details.

### 9.5 Sample Approval → Order Linking

**Workflow:**
1. FIT sample created and approved (`samples.sampleType = FIT_SAMPLE`, `status = APPROVED`)
2. PP sample created and approved (`samples.sampleType = PP_SAMPLE`, `status = APPROVED`)
3. Size set sample created (`samples.sampleType = SIZE_SET_SAMPLE`)
4. Customer approves samples
5. Order placed (`orders` with reference to approved samples)
6. Order sample link created (`order_samples.orderItemId` → `samples.id` link via business logic)

**Integration Points:**
```typescript
// Step 1: FIT sample
samples {
  id: "sample-fit-1"
  customerId: "customer-1"
  styleId: "style-1"
  sampleType: FIT_SAMPLE
  version: 1
  status: APPROVED
}

// Step 2: PP sample
samples {
  id: "sample-pp-1"
  customerId: "customer-1"
  styleId: "style-1"
  sampleType: PP_SAMPLE
  status: APPROVED
}

// Step 3: Size set sample
samples {
  id: "sample-sizeset-1"
  customerId: "customer-1"
  styleId: "style-1"
  sampleType: SIZE_SET_SAMPLE
  status: APPROVED
}

sample_size_sets {
  sampleId: "sample-sizeset-1"
  sizeId: "S", colorId: "red", quantity: 1
  sizeId: "M", colorId: "red", quantity: 1
  sizeId: "L", colorId: "red", quantity: 1
}

// Step 4: Order placed
orders {
  id: "order-123"
  customerId: "customer-1"
  status: CONFIRMED
}

order_items {
  id: "item-1"
  orderId: "order-123"
  styleId: "style-1"
  orderQuantity: 1000
}

// Step 5: Link order to samples
order_samples {
  id: "order-sample-1"
  orderItemId: "item-1"
  fitSampleId: "sample-fit-1"
  ppSampleId: "sample-pp-1"
  sizeSetSampleId: "sample-sizeset-1"
}
```

**Sequential Approval Gate Validation:**
```typescript
async function validateSampleApprovalGate(styleId: string, requestedSampleType: string) {
  const samples = await prisma.samples.findMany({
    where: { styleId, isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  // Rule 1: FIT must be approved before PP
  if (requestedSampleType === 'PP_SAMPLE') {
    const fitSample = samples.find(s => s.sampleType === 'FIT_SAMPLE');
    if (!fitSample || fitSample.status !== 'APPROVED') {
      throw new Error('FIT sample must be approved before creating PP sample');
    }
  }

  // Rule 2: PP must be approved before SIZE_SET
  if (requestedSampleType === 'SIZE_SET_SAMPLE') {
    const ppSample = samples.find(s => s.sampleType === 'PP_SAMPLE');
    if (!ppSample || ppSample.status !== 'APPROVED') {
      throw new Error('PP sample must be approved before creating size set sample');
    }
  }

  return { valid: true };
}
```

See [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) Section 2 for complete sample workflow.

---

## 10. Database Patterns & Cascades

### 10.1 Soft Delete Pattern

All major tables use a soft delete pattern with `isActive` boolean flag.

**Pattern:**
```typescript
// Table structure
model styles {
  id        String   @id
  styleName String
  isActive  Boolean  @default(true)
  // ... other fields
}
```

**Query Pattern:**
```typescript
// Always filter by isActive
const activeStyles = await prisma.styles.findMany({
  where: { isActive: true }
});

// "Delete" operation (soft delete)
await prisma.styles.update({
  where: { id: styleId },
  data: { isActive: false }
});

// Restore operation
await prisma.styles.update({
  where: { id: styleId },
  data: { isActive: true }
});
```

**Benefits:**
- Preserves audit trail
- Enables data recovery
- Maintains referential integrity (foreign keys still valid)
- Historical reporting still works

**Tables Using Soft Delete:**
- styles, orders, work_orders, purchase_orders, invoices, materials, stock_levels, and 100+ more

See ARCHITECTURE.md Section 4.1 for soft delete design rationale.

### 10.2 Timestamp Pattern

All tables include automatic timestamps for audit tracking.

**Pattern:**
```typescript
model styles {
  id        String   @id
  styleName String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Behavior:**
- `createdAt` - Auto-set on record creation (never changes)
- `updatedAt` - Auto-updated on every record modification

**Query Pattern:**
```typescript
// Get recently modified styles
const recentStyles = await prisma.styles.findMany({
  where: {
    updatedAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    }
  },
  orderBy: { updatedAt: 'desc' }
});
```

### 10.3 User Tracking Pattern

Most tables track which user created or modified the record.

**Pattern:**
```typescript
model purchase_orders {
  id           String   @id
  poNumber     String
  createdById  String
  approvedById String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  createdBy  users @relation("POCreatedBy", fields: [createdById])
  approvedBy users? @relation("POApprovedBy", fields: [approvedById])
}
```

**Query Pattern:**
```typescript
// Get POs created by specific user
const myPOs = await prisma.purchase_orders.findMany({
  where: { createdById: userId },
  include: { createdBy: true, approvedBy: true }
});
```

**Approval Workflow Pattern:**
- `approvedById` starts as `null` (pending approval)
- When approved, set `approvedById` to approving user's ID
- `approvedAt` timestamp set simultaneously

### 10.4 Cascade Deletes (Limited Use)

The system **minimizes cascade deletes** to preserve referential integrity. Most foreign keys use `onDelete: Restrict` or `onDelete: SetNull`.

**Allowed Cascades:**
```prisma
// Child records deleted when parent deleted
model order_item_breakup {
  orderItemId String
  orderItem   order_items @relation(fields: [orderItemId], onDelete: Cascade)
}

// Child always belongs to parent - safe to cascade
```

**Restricted Deletes (Most Common):**
```prisma
// Prevent deletion if referenced
model orders {
  styleId String
  style   styles @relation(fields: [styleId], onDelete: Restrict)
}

// Cannot delete style if orders exist
```

**Set Null Pattern:**
```prisma
// Allow deletion, set FK to null
model styles {
  categoryId String?
  category   style_categories? @relation(fields: [categoryId], onDelete: SetNull)
}

// Delete category → styles.categoryId set to null
```

### 10.5 Status Transition Validations

Status fields have business logic validations enforced at service layer.

**Example: Order Status Transitions**
```typescript
// Valid transitions
PENDING → CONFIRMED
CONFIRMED → IN_PRODUCTION
IN_PRODUCTION → COMPLETED
ANY → CANCELLED

// Invalid transitions (blocked)
COMPLETED → IN_PRODUCTION  // Cannot un-complete
CANCELLED → CONFIRMED      // Cannot un-cancel
```

**Service Layer Validation:**
```typescript
async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const order = await prisma.orders.findUnique({ where: { id: orderId } });

  // Validate transition
  const validTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
    IN_PRODUCTION: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],  // No transitions from COMPLETED
    CANCELLED: []   // No transitions from CANCELLED
  };

  if (!validTransitions[order.status].includes(newStatus)) {
    throw new Error(`Invalid status transition: ${order.status} → ${newStatus}`);
  }

  return await prisma.orders.update({
    where: { id: orderId },
    data: { status: newStatus }
  });
}
```

**Status Transition Override Table:**
```typescript
// For special cases requiring override
model stage_transition_overrides {
  id             String   @id
  workOrderId    String?
  orderItemId    String?
  fromStatus     String
  toStatus       String
  reason         String
  overriddenById String
  overriddenBy   users    @relation(fields: [overriddenById])
}
```

See PROJECT_BIBLE.md Section 4 for database design patterns.

---

## 11. API Integration Patterns

### 11.1 Frontend → Backend Service Layer Flow

```
┌────────────────────┐
│ React Component    │  User clicks button
└──────────┬─────────┘
           │ calls
           ▼
┌────────────────────┐
│ API Service        │  fabricCosting.service.ts
│ (Frontend)         │  - Builds request
└──────────┬─────────┘
           │ HTTP POST/GET
           ▼
┌────────────────────┐
│ Express Route      │  /api/fabric-costing
│ (Backend)          │  - Route definition
└──────────┬─────────┘
           │ passes to
           ▼
┌────────────────────┐
│ Controller         │  fabric-costing.controller.ts
│                    │  - Validates request
│                    │  - Extracts params
└──────────┬─────────┘
           │ calls
           ▼
┌────────────────────┐
│ Service            │  fabric-cost-calculation.service.ts
│                    │  - Business logic
│                    │  - Prisma queries
└──────────┬─────────┘
           │ queries
           ▼
┌────────────────────┐
│ Prisma Client      │  - Builds SQL
│                    │  - Executes query
└──────────┬─────────┘
           │ returns snake_case
           ▼
┌────────────────────┐
│ Serializer         │  serializer.ts
│                    │  - Converts to camelCase
│                    │  - Transforms BigInt
└──────────┬─────────┘
           │ returns camelCase JSON
           ▼
┌────────────────────┐
│ API Service        │  Receives response
│ (Frontend)         │  - Updates state
└──────────┬─────────┘
           │ triggers
           ▼
┌────────────────────┐
│ React Component    │  UI re-renders
└────────────────────┘
```

**Example Code Flow:**

**Frontend (React Component):**
```typescript
// FabricCostingPage.tsx
import { calculateFabricCost } from '@/services/fabricCosting.service';

const handleCalculate = async () => {
  const result = await calculateFabricCost({
    styleId,
    fabricId,
    greigeId,
    processorId
  });

  // result has camelCase keys
  console.log(result.totalCost);        // camelCase
  console.log(result.processorRates);   // camelCase
};
```

**Frontend (API Service):**
```typescript
// fabricCosting.service.ts
export async function calculateFabricCost(data: CalculateCostDTO) {
  const response = await fetch('/api/fabric-costing/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  return await response.json();  // Already camelCase from serializer
}
```

**Backend (Route):**
```typescript
// fabric-costing.routes.ts
router.post('/calculate', fabricCostingController.calculateCost);
```

**Backend (Controller):**
```typescript
// fabric-costing.controller.ts
export async function calculateCost(req: Request, res: Response) {
  try {
    // Validate request
    const { styleId, fabricId, greigeId, processorId } = req.body;

    // Call service
    const result = await fabricCostCalculationService.calculate({
      styleId,
      fabricId,
      greigeId,
      processorId
    });

    // Response automatically serialized to camelCase
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**Backend (Service):**
```typescript
// fabric-cost-calculation.service.ts
export async function calculate(data: CalculateDTO) {
  // Query with Prisma (snake_case)
  const fabric = await prisma.fabric_master.findUnique({
    where: { id: data.fabricId },
    include: {
      greige_master: true,          // snake_case relation
      processor_rate_card: true     // snake_case relation
    }
  });

  // Business logic
  const totalCost = calculateTotalCost(fabric);

  // Return snake_case (serializer will convert)
  return {
    fabric_id: fabric.id,
    greige_master: fabric.greige_master,
    processor_rate_card: fabric.processor_rate_card,
    total_cost: totalCost
  };
}
```

**Backend (Serializer - Automatic):**
```typescript
// serializer.ts (runs automatically on all responses)
function serialize(data: any) {
  // Recursively convert all keys to camelCase
  if (Array.isArray(data)) {
    return data.map(serialize);
  }

  if (data && typeof data === 'object') {
    return Object.keys(data).reduce((acc, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = serialize(data[key]);
      return acc;
    }, {});
  }

  return data;
}

// Result sent to frontend:
{
  fabricId: "...",              // camelCase
  greigeMaster: { ... },        // camelCase
  processorRateCard: { ... },   // camelCase
  totalCost: 1234.56            // camelCase
}
```

### 11.2 Transaction Boundaries

Critical operations use Prisma transactions to ensure data consistency.

**Pattern:**
```typescript
async function createOrderWithItems(orderData: CreateOrderDTO) {
  return await prisma.$transaction(async (tx) => {
    // All operations within this block are atomic

    // 1. Create order
    const order = await tx.orders.create({
      data: {
        customerId: orderData.customerId,
        orderNumber: await generateOrderNumber(),
        status: 'PENDING'
      }
    });

    // 2. Create order items
    for (const item of orderData.items) {
      const orderItem = await tx.order_items.create({
        data: {
          orderId: order.id,
          styleId: item.styleId,
          orderQuantity: item.quantity
        }
      });

      // 3. Create order item breakup
      for (const breakup of item.breakup) {
        await tx.order_item_breakup.create({
          data: {
            orderItemId: orderItem.id,
            colorId: breakup.colorId,
            sizeId: breakup.sizeId,
            quantity: breakup.quantity
          }
        });
      }
    }

    // 4. All succeed or all rollback
    return order;
  });
}
```

**Transaction Use Cases:**
- Order creation (order + items + breakup)
- GRN receipt (GRN + items + stock movements + stock levels)
- Work order creation (WO + breakup + material reservations)
- Invoice creation (invoice + items + tax calculations)
- Payment recording (payment + invoice update + balance recalc)

### 11.3 Error Propagation

Errors are caught at controller level and returned with consistent format.

**Pattern:**
```typescript
// Controller
export async function createOrder(req: Request, res: Response) {
  try {
    const result = await orderService.createOrder(req.body);
    res.json(result);
  } catch (error) {
    // Log error
    console.error('Error creating order:', error);

    // Return consistent error format
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Resource not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}
```

**Frontend Error Handling:**
```typescript
// Frontend service
try {
  const result = await createOrder(orderData);
  return { success: true, data: result };
} catch (error) {
  return {
    success: false,
    error: error.response?.data?.error || 'Unknown error'
  };
}
```

---

## 12. Cross-Module Business Rules

### 12.1 Order Cannot Be Created Without Approved Style

**Rule:** Orders can only reference styles with `status = ACTIVE`.

**Validation:**
```typescript
async function createOrder(orderData: CreateOrderDTO) {
  for (const item of orderData.items) {
    const style = await prisma.styles.findUnique({
      where: { id: item.styleId }
    });

    if (!style || !style.isActive) {
      throw new Error(`Style ${item.styleId} is not active`);
    }
  }

  // Proceed with order creation
}
```

### 12.2 Work Order Requires Confirmed Order

**Rule:** Work orders can only be created for orders with `status = CONFIRMED`.

**Validation:**
```typescript
async function createWorkOrder(workOrderData: CreateWorkOrderDTO) {
  const order = await prisma.orders.findUnique({
    where: { id: workOrderData.orderId }
  });

  if (order.status !== 'CONFIRMED') {
    throw new Error(`Order must be CONFIRMED to create work order (current: ${order.status})`);
  }

  // Proceed with work order creation
}
```

### 12.3 GRN Creates Stock Automatically

**Rule:** When a GRN is received, stock movements and stock levels are automatically created (not manual).

**Implementation:**
```typescript
async function receiveGRN(grnData: CreateGRNDTO) {
  return await prisma.$transaction(async (tx) => {
    const grn = await tx.goods_receiving_notes.create({ ... });

    for (const item of grnData.items) {
      // GRN item
      await tx.grn_items.create({ ... });

      // AUTOMATIC - Stock movement (cannot skip)
      await tx.stock_movements.create({
        data: {
          materialId: item.materialId,
          warehouseId: grnData.warehouseId,
          movementType: 'IN',
          quantity: item.receivedQuantity,
          referenceType: 'GRN',
          referenceId: grn.id
        }
      });

      // AUTOMATIC - Stock level update (cannot skip)
      await tx.stock_levels.upsert({ ... });
    }
  });
}
```

### 12.4 Material Requisition Checks Stock Levels

**Rule:** Material requisitions can only be issued if stock is available.

**Validation:**
```typescript
async function createMaterialRequisition(requisitionData: CreateRequisitionDTO) {
  for (const item of requisitionData.items) {
    const stockLevel = await prisma.stock_levels.findFirst({
      where: {
        materialId: item.materialId,
        warehouseId: requisitionData.warehouseId
      }
    });

    if (!stockLevel || stockLevel.quantityAvailable < item.requestedQuantity) {
      throw new Error(`Insufficient stock for material ${item.materialId}. Available: ${stockLevel?.quantityAvailable || 0}, Requested: ${item.requestedQuantity}`);
    }
  }

  // Proceed with requisition
}
```

### 12.5 Processing Batch Validates Stage Transitions

**Rule:** Processing batches must follow valid stage sequences (e.g., DYEING → PRINTING → WASHING, cannot skip).

**Validation:**
```typescript
async function createProcessingStage(stageData: CreateProcessingStageDTO) {
  const batch = await prisma.processing_batch.findUnique({
    where: { id: stageData.batchId },
    include: { processing_stage: { orderBy: { stageSequence: 'asc' } } }
  });

  const lastStage = batch.processing_stage[batch.processing_stage.length - 1];

  // Validate stage sequence
  const validNextStages = {
    DYEING: ['PRINTING', 'WASHING', 'RETURN'],
    PRINTING: ['WASHING', 'RETURN'],
    WASHING: ['RETURN']
  };

  if (!validNextStages[lastStage.stageType].includes(stageData.stageType)) {
    throw new Error(`Invalid stage transition: ${lastStage.stageType} → ${stageData.stageType}`);
  }

  // Proceed with stage creation
}
```

---

## 13. Quick Reference: "How Do I..."

This section answers common integration questions with direct solutions.

### 13.1 Style & Order Questions

**Q: How do I link a style to an order?**
**A:** Set `order_items.styleId` → `styles.id`
```typescript
await prisma.order_items.create({
  data: {
    orderId: "order-123",
    styleId: "style-1",  // ← Link here
    orderQuantity: 1000
  }
});
```
**Related Guide:** [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 2

---

**Q: How do I get all orders for a specific style?**
**A:** Query `order_items` by `styleId`
```typescript
const orders = await prisma.order_items.findMany({
  where: { styleId: "style-1" },
  include: { orders: true }
});
```
**Related Guide:** [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 2

---

**Q: How do I get all components for a style?**
**A:** Query `style_components` by `styleId`
```typescript
const components = await prisma.style_components.findMany({
  where: { styleId: "style-1", isActive: true },
  include: { component_masters: true }
});
```
**Related Guide:** [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) Section 5.1

---

### 13.2 Material & BOM Questions

**Q: How do I track material usage in a style?**
**A:** Use `style_material_bom` table
```typescript
const bom = await prisma.style_material_bom.findMany({
  where: { styleId: "style-1", isActive: true },
  include: {
    materials: true,
    lace_master: true,
    button_master: true,
    thread_master: true
    // Include relevant material masters
  }
});

// BOM shows:
// - Material type
// - Quantity per garment
// - Unit (PCS, METER, etc.)
```
**Related Guide:** [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 3

---

**Q: How do I calculate material requirements for an order?**
**A:** BOM quantity × Order quantity
```typescript
// Get BOM
const bom = await prisma.style_material_bom.findMany({
  where: { styleId: "style-1" }
});

// Get order quantity
const orderItem = await prisma.order_items.findUnique({
  where: { id: "item-1" }
});

// Calculate
for (const bomItem of bom) {
  const required = bomItem.quantityPerGarment * orderItem.orderQuantity;
  console.log(`${bomItem.materialId}: ${required} ${bomItem.unit}`);
}
```
**Related Guide:** [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 5

---

**Q: How do I link a material requirement to a purchase order?**
**A:** Use `requirement_po_links` junction table
```typescript
await prisma.requirement_po_links.create({
  data: {
    requirementId: "req-1",
    purchaseOrderId: "po-1",
    purchaseOrderItemId: "po-item-1"
  }
});
```
**Related Guide:** [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 8

---

### 13.3 Stock & Inventory Questions

**Q: How do I check if material is available in stock?**
**A:** Query `stock_levels`
```typescript
const stockLevel = await prisma.stock_levels.findFirst({
  where: {
    materialId: "mat-1",
    warehouseId: "warehouse-1"
  }
});

const available = stockLevel?.quantityAvailable || 0;
console.log(`Available: ${available}`);
```
**Related Guide:** [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 2

---

**Q: How do I track stock movements?**
**A:** Query `stock_movements` with `referenceType`
```typescript
// Get all movements for a GRN
const movements = await prisma.stock_movements.findMany({
  where: {
    referenceType: 'GRN',
    referenceId: "grn-1"
  }
});

// Get all movements for a material
const materialMovements = await prisma.stock_movements.findMany({
  where: { materialId: "mat-1" },
  orderBy: { movementDate: 'desc' }
});
```
**Related Guide:** [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 4

---

**Q: How do I reserve stock for an order?**
**A:** Create `stock_reservations`
```typescript
await prisma.stock_reservations.create({
  data: {
    materialId: "mat-1",
    warehouseId: "warehouse-1",
    referenceType: "WORK_ORDER",
    referenceId: "wo-1",
    reservedQuantity: 5000,
    reservedById: userId
  }
});
```
**Related Guide:** [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 6

---

### 13.4 Fabric Questions

**Q: How do I send fabric for processing (dyeing/printing)?**
**A:** Create `processing_batch` and `processing_stage`
```typescript
const batch = await prisma.processing_batch.create({
  data: {
    batchNumber: "BATCH-001",
    greigeId: "greige-1",
    batchType: "DYEING",
    createdById: userId
  }
});

await prisma.processing_stage.create({
  data: {
    batchId: batch.id,
    stageType: "DYEING",
    processorId: "supplier-dyer-1",
    stageSequence: 1
  }
});

// Automatic stock movement created
```
**Related Guide:** [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 7

---

**Q: How do I receive processed fabric?**
**A:** Create `processing_delivery`
```typescript
await prisma.processing_delivery.create({
  data: {
    batchId: "batch-1",
    stageId: "stage-1",
    deliveredQuantity: 500,
    deliveryStatus: "COMPLETED",
    receivedById: userId
  }
});

// Automatic stock movement (type: IN) created
// Finished fabric stock created
```
**Related Guide:** [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 7

---

**Q: How do I allocate fabric to an order?**
**A:** Create `fabric_stock_allocation`
```typescript
await prisma.fabric_stock_allocation.create({
  data: {
    stockId: "fabric-stock-1",
    orderId: "order-123",
    styleId: "style-1",
    allocatedQuantity: 50,  // meters
    createdById: userId
  }
});
```
**Related Guide:** [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) Section 3

---

### 13.5 Production Questions

**Q: How do I convert an order to a work order?**
**A:** Create `work_orders` and `work_order_breakup`
```typescript
const workOrder = await prisma.work_orders.create({
  data: {
    orderId: "order-123",
    orderItemId: "item-1",
    styleId: "style-1",
    status: "PENDING",
    createdById: userId
  }
});

// Mirror order_item_breakup
const breakup = await prisma.order_item_breakup.findMany({
  where: { orderItemId: "item-1" }
});

for (const item of breakup) {
  await prisma.work_order_breakup.create({
    data: {
      workOrderId: workOrder.id,
      colorId: item.colorId,
      sizeId: item.sizeId,
      quantity: item.quantity
    }
  });
}
```
**Related Guide:** [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 11

---

**Q: How do I track cutting progress?**
**A:** Query `cutting_batches` and `cutting_batch_skus`
```typescript
const cuttingBatches = await prisma.cutting_batches.findMany({
  where: { workOrderId: "wo-1" },
  include: { cutting_batch_skus: true }
});

for (const batch of cuttingBatches) {
  console.log(`Batch ${batch.batchNumber}:`);
  for (const sku of batch.cutting_batch_skus) {
    console.log(`  ${sku.colorId}-${sku.sizeId}: ${sku.quantityCut} pcs`);
  }
}
```
**Related Guide:** [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 3

---

**Q: How do I transfer cut pieces to stitching?**
**A:** Create `transfer_slips`
```typescript
await prisma.transfer_slips.create({
  data: {
    slipNumber: "TS-001",
    workOrderId: "wo-1",
    cuttingBatchId: "cut-batch-1",
    fromStage: "CUTTING",
    toStage: "STITCHING",
    preparedById: userId
  }
});

// Create transfer_slip_skus for each color/size
```
**Related Guide:** [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) Section 3

---

### 13.6 Sample & Embroidery Questions

**Q: How do I create a sample for a style?**
**A:** Create `samples`
```typescript
await prisma.samples.create({
  data: {
    sampleNumber: "FIT-STYLE1-v1",
    customerId: "customer-1",
    styleId: "style-1",
    sampleType: "FIT_SAMPLE",
    version: 1,
    status: "REQUESTED",
    createdById: userId
  }
});
```
**Related Guide:** [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) Section 2

---

**Q: How do I send fabric for embroidery?**
**A:** Create `embroidery_send_out`
```typescript
await prisma.embroidery_send_out.create({
  data: {
    sourceFabricStockId: "fabric-stock-1",  // Plain fabric
    embroideryId: "embroidery-1",
    supplierId: "supplier-embroidery-1",
    quantitySent: 50,  // meters
    createdById: userId
  }
});

// Automatic:
// - Stock deduction (plain fabric)
// - Stock movement (type: OUT, reference: EMBROIDERY_SEND)
```
**Related Guide:** [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) Section 8

---

**Q: How do I receive embroidered fabric?**
**A:** Update `embroidery_send_out` and create result stock
```typescript
await prisma.embroidery_send_out.update({
  where: { id: "send-out-1" },
  data: {
    quantityReceived: 48,  // May be less due to wastage
    status: "RECEIVED",
    resultFabricStockId: "fabric-stock-embroidered-1"  // Created stock
  }
});

// Automatic:
// - Embroidered fabric stock created
// - Cost = Plain fabric cost + Embroidery cost
// - Stock movement (type: IN, reference: EMBROIDERY_RETURN)
```
**Related Guide:** [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) Section 8

---

### 13.7 Financial Questions

**Q: How do I generate a purchase order from requirements?**
**A:** Group requirements by supplier, create PO
```typescript
// Get requirements
const requirements = await prisma.material_requirements.findMany({
  where: { status: "PENDING" },
  include: { materials: true }
});

// Group by supplier
const bySupplier = groupBy(requirements, r => r.preferredSupplierId);

// Create PO per supplier
for (const [supplierId, reqs] of Object.entries(bySupplier)) {
  const po = await prisma.purchase_orders.create({
    data: {
      poNumber: await generatePONumber(),
      supplierId,
      status: "DRAFT",
      createdById: userId
    }
  });

  // Create PO items and link requirements
  for (const req of reqs) {
    const poItem = await prisma.purchase_order_items.create({
      data: {
        poId: po.id,
        materialId: req.materialId,
        orderedQuantity: req.requiredQuantity * 1.1  // 10% buffer
      }
    });

    await prisma.requirement_po_links.create({
      data: {
        requirementId: req.id,
        purchaseOrderId: po.id,
        purchaseOrderItemId: poItem.id
      }
    });
  }
}
```
**Related Guide:** [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) Section 7

---

**Q: How do I create an invoice with auto GST calculation?**
**A:** Create `invoices` with state-based tax calculation
```typescript
const customer = await prisma.customers.findUnique({
  where: { id: customerId },
  include: { billingState: true }
});

const companyStateId = process.env.COMPANY_STATE_ID;
const isIntrastate = customer.billingStateId === companyStateId;

const taxRate = 12;  // 12% for garments
const taxAmount = (subtotal * taxRate) / 100;

let cgst = 0, sgst = 0, igst = 0;
if (isIntrastate) {
  cgst = taxAmount / 2;
  sgst = taxAmount / 2;
} else {
  igst = taxAmount;
}

await prisma.invoices.create({
  data: {
    invoiceNumber: await generateInvoiceNumber(),
    orderId,
    customerId,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    taxRate,
    status: "PENDING",
    createdById: userId
  }
});
```
**Related Guide:** [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) Section 8

---

**Q: How do I record a payment for an invoice?**
**A:** Create `payments` (invoice status auto-updates)
```typescript
await prisma.payments.create({
  data: {
    invoiceId: "inv-1",
    amount: 50000,
    paymentMethod: "BANK_TRANSFER",
    referenceNumber: "TXN-123456",
    receivedById: userId
  }
});

// Automatic:
// - invoices.paidAmount updated
// - invoices.balanceAmount recalculated
// - invoices.status updated (PENDING → PARTIALLY_PAID → PAID)
```
**Related Guide:** [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) Section 9

---

### 13.8 Quality & Testing Questions

**Q: How do I create a quality inspection?**
**A:** Create `quality_inspections`
```typescript
await prisma.quality_inspections.create({
  data: {
    workOrderId: "wo-1",
    styleId: "style-1",
    inspectionType: "FINAL",
    inspectedQuantity: 1000,
    passedQuantity: 980,
    failedQuantity: 20,
    inspectionResult: "PASS",
    inspectedById: userId
  }
});
```
**Related Guide:** [TESTING_QUALITY_GUIDE.md](./TESTING_QUALITY_GUIDE.md) Section 3

---

**Q: How do I link fabric test results to procurement?**
**A:** Create `fabric_physical_tests`
```typescript
await prisma.fabric_physical_tests.create({
  data: {
    testNumber: "FPT-001",
    fabricId: "fabric-1",
    fabricProcurementId: "procurement-1",
    testingLabId: "lab-1",
    testResult: "PASS",
    createdById: userId
  }
});
```
**Related Guide:** [TESTING_QUALITY_GUIDE.md](./TESTING_QUALITY_GUIDE.md) Section 4

---

### 13.9 Customer & Supplier Questions

**Q: How do I add multiple GST numbers for a customer?**
**A:** Create `customer_gst_numbers`
```typescript
// Customer in Maharashtra
await prisma.customer_gst_numbers.create({
  data: {
    customerId: "customer-1",
    stateId: "state-maharashtra",
    gstNumber: "27AAACT1234E1Z5",
    billingAddress: "123 Mumbai Street",
    isPrimary: true
  }
});

// Customer branch in Gujarat
await prisma.customer_gst_numbers.create({
  data: {
    customerId: "customer-1",
    stateId: "state-gujarat",
    gstNumber: "24AAACT1234E1Z5",
    billingAddress: "456 Ahmedabad Road",
    isPrimary: false
  }
});
```
**Related Guide:** [GST_GUIDE.md](./GST_GUIDE.md) Section 5

---

**Q: How do I link multiple suppliers to a material?**
**A:** Use `*_suppliers` junction tables
```typescript
// Link button to multiple suppliers
await prisma.button_suppliers.create({
  data: {
    buttonId: "button-1",
    supplierId: "supplier-1"
  }
});

await prisma.button_suppliers.create({
  data: {
    buttonId: "button-1",
    supplierId: "supplier-2"
  }
});
```
**Related Guide:** [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) Section 5

---

## 14. Recent Module Additions (Feb 2026)

### 14.1 MRP Workflow Automation

**Module:** Material Requirement Planning enhancements (Phases 1-4)
**Status:** ✅ Production Ready
**Impact:** 70% time reduction in procurement workflow

**Key Relationships:**

1. **BOM → MRP Trigger:**
   ```typescript
   // Semi-automatic MRP calculation after BOM approval
   order_bom (approved) → material_requirements (auto-created)
   ```

2. **Vendor Suggestion System:**
   ```typescript
   // 3-tier intelligent vendor allocation
   material_requirements → material_suppliers (isPreferred = true) → HIGH confidence
   material_requirements → purchase_order_items (most frequent) → MEDIUM confidence
   material_requirements → manual assignment → LOW confidence
   ```

3. **Bulk PO Generation:**
   ```typescript
   // Transaction-safe bulk PO creation
   material_requirements (grouped by preferredSupplierId) → purchase_orders (bulk)
   ```

**New Components:**
- `MRPCalculationPrompt.tsx` - BOM approval trigger
- `VendorAllocationDialog.tsx` - Vendor suggestion UI
- `BulkPOGenerationDialog.tsx` - Bulk PO generation (334 lines)

**Cross-Navigation:**
```
Order → BOM → MRP Requirements → Purchase Orders
   ↑                                      ↓
   └──────── Seamless Navigation ─────────┘
```

**Related Guide:** [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) Section 13

---

### 14.2 Thread Module Integration

**Module:** Thread Material Management (complete)
**Status:** ✅ All Phases Complete
**Frontend:** 2,349 lines of production-ready code

**Key Relationships:**

1. **Thread Master Extensions:**
   ```typescript
   thread_master {
     ply → ThreadPly (TWO_PLY, THREE_PLY)
     materialComposition → ThreadMaterial (POLYESTER, COTTON)
     colorId → color_master
     unitsPerBox → thread_packaging_specs (auto-calculated)
   }
   ```

2. **Thread Supplier Linking:**
   ```typescript
   thread_master ↔ thread_suppliers ↔ suppliers
   // Many-to-many: One thread can have multiple suppliers
   ```

3. **Thread in Cost Sheets:**
   ```typescript
   style_costing → style_costing_thread_items → thread_master
   // Default ₹4 per garment, editable
   ```

4. **Order Thread Requirements:**
   ```typescript
   orders → order_thread_requirements → thread_master
   // Multi-line thread entry with UNITS or BOXES input
   // Auto-conversion: boxes ↔ units ↔ meters
   ```

5. **Thread Packaging Specs:**
   ```typescript
   thread_packaging_specs {
     (ply, packagingType) → UNIQUE
     unitsPerBox, metersPerUnit
   }
   // 6 combinations: 2-Ply/3-Ply × Spool/Cone5K/Cone10K
   ```

**Data Flow:**
```
Thread Master (with ply, material, color)
    ↓
Thread Packaging Specs (conversion rules)
    ↓
Order Thread Requirements (boxes → units → meters)
    ↓
Inventory Stock (cross-warehouse aggregation)
    ↓
Shortage Detection (required vs available)
```

**Related Guide:** [THREAD_MODULE_IMPLEMENTATION.md](./THREAD_MODULE_IMPLEMENTATION.md)

---

### 14.3 Season Module

**Module:** Seasonal Collection Management
**Status:** ✅ Production Ready
**Types:** SS (Spring/Summer), AW (Autumn/Winter)

**Key Relationships:**

1. **Season → Styles:**
   ```typescript
   season_master ↔ styles (seasonId)
   // Organize style collections by season
   ```

2. **Season → Orders (indirect):**
   ```typescript
   orders → order_items → styles → season_master
   // Track orders by seasonal collection
   ```

3. **Season Hierarchy:**
   ```typescript
   season_master {
     code: "SS26", "AW25"
     year: 2026, 2025
     seasonType: SS, AW
     sortOrder: auto-calculated chronologically
   }
   ```

**Use Cases:**
- Organize styles into seasonal collections
- Filter reports by season
- Plan production timelines (AW production in Q2-Q3, SS in Q4-Q1)
- Track seasonal trends and performance

**Bulk Generation:**
```typescript
// Generate seasons for year range
generateSeasons(2025, 2030) → 12 seasons (SS25, AW25, ..., SS30, AW30)
// Idempotent: Safe to re-run (skips existing)
```

**Related Guide:** [SEASON_MODULE_GUIDE.md](./SEASON_MODULE_GUIDE.md)

---

### 14.4 Cost Sheet PO Generation

**Module:** Direct PO from Approved Cost Sheets
**Status:** ✅ Production Ready
**Categories:** Fabric, Greige, Processing, Trims

**Key Relationships:**

1. **Cost Sheet → Requirements:**
   ```typescript
   style_costing (approved) + totalOrderQty →
     fabricItems, greigeItems, trimsItems, processingItems
   // Calculated: requiredQty = orderQty × consumptionPerUnit
   ```

2. **Requirements → Stock:**
   ```typescript
   calculatedRequirements → inventory_stock (check availability)
   // Shortfall = requiredQty - availableStock
   ```

3. **Requirements → PO:**
   ```typescript
   calculatedRequirements (with allowance) → purchase_orders
   // Separate POs by category: FABRIC, GREIGE, PROCESSING, TRIMS
   ```

**Allowance System:**
```typescript
requiredQty = totalOrderQty × consumptionPerUnit
orderQty = requiredQty × (1 + allowancePercent / 100)
// Default: 3% allowance for wastage
```

**Integration:**
```
Cost Sheet (Approved)
    ↓
Calculate Requirements (with stock check)
    ↓
Apply Allowance (default 3%)
    ↓
Generate PO by Category
    ├─> Fabric PO
    ├─> Greige PO
    ├─> Processing PO (linked to Greige PO)
    └─> Trims PO
```

**Comparison with MRP:**
- **Cost Sheet PO:** Direct, fast, single order
- **MRP PO:** Consolidated, multi-order, vendor-optimized

**Related Guide:** [COST_SHEET_PO_GENERATION_GUIDE.md](./COST_SHEET_PO_GENERATION_GUIDE.md)

---

### 14.5 Updated Relationship Counts

**Total Module Relationships:** 200+ (original)
**New Additions (Feb 2026):**
- MRP Workflow Automation: 15+ relationships
- Thread Module: 20+ relationships
- Season Module: 8+ relationships
- Cost Sheet PO Generation: 12+ relationships

**Total (Updated):** **255+ documented relationships**

---

## 15. Related Documentation

### 14.1 Comprehensive Guides

All guides are located in `docs/` folder:

| Guide | Focus | When to Use |
|-------|-------|-------------|
| [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) | Complete system overview | Start here for system understanding |
| **MODULE_RELATIONSHIPS_GUIDE.md** | **This guide** - Module interlinking | Understanding relationships & data flows |
| [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) | Material masters & suppliers | Working with materials, BOM, procurement |
| [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) | BOM & Material Requirements | Material requirement planning, BOM creation |
| [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) | Order lifecycle & procurement | Order management, PO, GRN |
| [SAMPLE_EMBROIDERY_GUIDE.md](./SAMPLE_EMBROIDERY_GUIDE.md) | Samples & embroidery | Sample development, embroidery workflow |
| [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md) | Financial & accounting | Invoicing, payments, chart of accounts |
| [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) | Production workflow | Work orders, cutting, stitching, finishing |
| [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) | Inventory & stock | Stock levels, movements, reservations |
| [DISPATCH_LOGISTICS_GUIDE.md](./DISPATCH_LOGISTICS_GUIDE.md) | Shipping & delivery | Delivery notes, ASN, POD, transport |
| [TESTING_QUALITY_GUIDE.md](./TESTING_QUALITY_GUIDE.md) | Quality control | Inspections, testing, AQL |
| [FABRIC_COSTING_GUIDE.md](./FABRIC_COSTING_GUIDE.md) | Fabric costing | Costing strategies, processor rates |
| [CAD_PLANNING_GUIDE.md](./CAD_PLANNING_GUIDE.md) | CAD planning | Fabric consumption, width planning |
| [GST_GUIDE.md](./GST_GUIDE.md) | GST compliance | Indian tax compliance, state codes |
| [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md) | AI integration | AI features, context management |
| [GLOSSARY.md](./GLOSSARY.md) | Industry terminology | 180+ garment industry terms |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Development standards | Code style, patterns, conventions |

### 14.2 Developer Reference

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | **Critical developer instructions** - API serialization, skills, hooks |
| `docs/archive/ARCHITECTURE.md` | Architecture Decision Records (ADRs), design rationale |
| `docs/archive/SYSTEM_GUIDE.md` | Technical implementation details (polymorphic design, stock flows) |

### 14.3 Archive Folder

The `docs/archive/` folder contains 34 original detailed documentation files preserved for historical reference. All content has been consolidated into the guides above, but archive files remain available for deep-dive technical details.

### 14.4 Navigation Guide

**If you want to:**
- **Understand module relationships** → You're in the right place (MODULE_RELATIONSHIPS_GUIDE.md)
- **Understand end-to-end workflow** → [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) Section 14
- **Work with materials** → [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md)
- **Work with BOM/MRP** → [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md)
- **Work with orders** → [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md)
- **Work with production** → [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md)
- **Work with stock** → [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md)
- **Work with quality** → [TESTING_QUALITY_GUIDE.md](./TESTING_QUALITY_GUIDE.md)
- **Work with invoicing** → [FINANCIAL_ACCOUNTING_GUIDE.md](./FINANCIAL_ACCOUNTING_GUIDE.md)
- **Understand serialization** → [CLAUDE.md](../CLAUDE.md)

---

**Last Updated:** February 6, 2026
**Version:** 1.1
**Maintained By:** Development Team
**Status:** Production Ready (Updated with Feb 2026 enhancements)

**For questions or updates, refer to PROJECT_BIBLE.md or contact the development team.**
