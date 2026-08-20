/**
 * Lazy-loaded Route Components
 *
 * This file exports lazily loaded versions of page components.
 * This enables code splitting - each page is loaded only when needed,
 * reducing the initial bundle size and improving load time.
 *
 * Usage:
 * Import from here instead of direct page imports in App.tsx
 */

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading spinner shown while lazy components are loading
 */
export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/**
 * Higher-order component that wraps a lazy component with Suspense
 * Provides fallback loading state and error boundary
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withSuspense<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>
): React.FC<P> {
  return function SuspensedComponent(props: P) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// ============================================================================
// Core Pages
// ============================================================================
export const Dashboard = lazy(() => import('../pages/Dashboard'));
export const Users = lazy(() => import('../pages/Users'));
export const UserForm = lazy(() => import('../pages/UserForm'));
export const PendingUsersPage = lazy(() => import('../pages/PendingUsersPage'));
export const Profile = lazy(() => import('../pages/Profile'));
export const Settings = lazy(() => import('../pages/Settings'));
export const TallySettings = lazy(() => import('../pages/TallySettings'));
export const TallyCustomers = lazy(() => import('../pages/TallyCustomers'));
export const TallyInvoices = lazy(() => import('../pages/TallyInvoices'));
export const TallyOutstanding = lazy(() => import('../pages/TallyOutstanding'));
export const TallyCreditNotes = lazy(() => import('../pages/TallyCreditNotes'));
export const TallySuppliers = lazy(() => import('../pages/TallySuppliers'));
export const TallyDebitNotes = lazy(() => import('../pages/TallyDebitNotes'));
export const TallyPayments = lazy(() => import('../pages/TallyPayments'));
export const EInvoiceSettings = lazy(() => import('../pages/EInvoiceSettings'));
export const EInvoiceInvoices = lazy(() => import('../pages/EInvoiceInvoices'));
export const TemplateManager = lazy(() => import('../pages/TemplateManager'));

// ============================================================================
// Messaging (per-user WhatsApp)
// ============================================================================
export const WhatsAppLink = lazy(() => import('../pages/WhatsAppLink'));
export const MessageStaff = lazy(() => import('../pages/MessageStaff'));

// ============================================================================
// Role-Specific Dashboards
// ============================================================================
export const DashboardRouter = lazy(() => import('../pages/dashboards/DashboardRouter'));
export const GeneralDashboard = lazy(() => import('../pages/dashboards/GeneralDashboard'));
export const ProductionDashboard = lazy(() => import('../pages/dashboards/ProductionDashboard'));
export const SalesDashboard = lazy(() => import('../pages/dashboards/SalesDashboard'));
export const AccountsDashboard = lazy(() => import('../pages/dashboards/AccountsDashboard'));

// ============================================================================
// Style Management
// ============================================================================
export const StyleList = lazy(() => import('../pages/StyleList'));
export const StyleFormRedesigned = lazy(() => import('../pages/StyleFormRedesigned'));
export const StyleDetail = lazy(() => import('../pages/StyleDetail'));
export const StyleBulkImport = lazy(() => import('../pages/StyleBulkImport'));
export const StyleStockEntry = lazy(() => import('../pages/StyleStockEntry'));
export const StyleFabricReport = lazy(() => import('../pages/StyleFabricReport'));

// ============================================================================
// CAD Planning Module (Independent)
// ============================================================================
export const CADPlanningList = lazy(() => import('../pages/CADPlanningList'));
export const CADPlanningPage = lazy(() => import('../pages/CADPlanningPage'));

// ============================================================================
// Customer Management
// ============================================================================
export const CustomerList = lazy(() => import('../pages/CustomerList'));
export const CustomerForm = lazy(() => import('../pages/CustomerForm'));
export const CustomerDetail = lazy(() => import('../pages/CustomerDetail'));

// ============================================================================
// Agent Management
// ============================================================================
export const AgentList = lazy(() => import('../pages/AgentList'));

// ============================================================================
// Agency Management
// ============================================================================
export const AgencyList = lazy(() => import('../pages/AgencyList'));

// ============================================================================
// Supplier Management
// ============================================================================
export const SupplierList = lazy(() => import('../pages/SupplierList'));
export const SupplierForm = lazy(() => import('../pages/SupplierForm'));
export const SupplierDetail = lazy(() => import('../pages/SupplierDetail'));

// ============================================================================
// Material Management
// ============================================================================
export const MaterialList = lazy(() => import('../pages/MaterialList'));
export const MaterialForm = lazy(() => import('../pages/MaterialForm'));
export const MaterialDetail = lazy(() => import('../pages/MaterialDetail'));

// ============================================================================
// Order Management
// ============================================================================
export const OrderList = lazy(() => import('../pages/OrderList'));
export const OrderForm = lazy(() => import('../pages/OrderForm'));
export const OrderDetail = lazy(() => import('../pages/OrderDetail'));

// ============================================================================
// Order BOM
// ============================================================================
export const OrderBOMList = lazy(() => import('../pages/OrderBOMList'));
export const OrderBOMDetail = lazy(() => import('../pages/OrderBOMDetail'));

// ============================================================================
// Costing (Order BOM is created from Cost Sheet approval)
// ============================================================================
export const CostSheetList = lazy(() => import('../pages/CostSheetList'));
export const CostSheetForm = lazy(() => import('../pages/CostSheetForm'));
export const CostSheetDetail = lazy(() => import('../pages/CostSheetDetail'));
export const FabricCostingPage = lazy(() => import('../pages/FabricCostingPage'));
export const FabricCostingOptionsPage = lazy(() => import('../pages/FabricCostingOptionsPage'));
export const StyleFabricCostingOptionsPage = lazy(() => import('../pages/StyleFabricCostingOptionsPage'));
export const ProcessorRateCardPage = lazy(() => import('../pages/ProcessorRateCardPage'));
export const ChartOfAccountsList = lazy(() => import('../pages/ChartOfAccountsList'));

// ============================================================================
// Tax & GST Masters
// ============================================================================
export const HSNSACMasterList = lazy(() => import('../pages/HSNSACMasterList'));
export const TaxMasterList = lazy(() => import('../pages/TaxMasterList'));

// ============================================================================
// Financial Management (Invoices & Quotations)
// ============================================================================
export const InvoiceList = lazy(() => import('../pages/InvoiceList'));
export const InvoiceForm = lazy(() => import('../pages/InvoiceForm'));
export const InvoiceDetail = lazy(() => import('../pages/InvoiceDetail'));
export const QuotationList = lazy(() => import('../pages/QuotationList'));
export const QuotationForm = lazy(() => import('../pages/QuotationForm'));
export const QuotationDetail = lazy(() => import('../pages/QuotationDetail'));
export const CreditNoteList = lazy(() => import('../pages/CreditNoteList'));
export const CreditNoteDetail = lazy(() => import('../pages/CreditNoteDetail'));
export const DebitNoteList = lazy(() => import('../pages/DebitNoteList'));
export const GSTReports = lazy(() => import('../pages/GSTReports'));
export const TDSList = lazy(() => import('../pages/TDSList'));
export const TCSList = lazy(() => import('../pages/TCSList'));
export const TaxCompliancePage = lazy(() => import('../pages/TaxCompliancePage'));

// ============================================================================
// Inventory & Warehouse Management
// ============================================================================
export const StockDashboard = lazy(() => import('../pages/StockDashboard'));
export const WarehouseList = lazy(() => import('../pages/WarehouseList'));
export const WarehouseForm = lazy(() => import('../pages/WarehouseForm'));
export const StockLevelList = lazy(() => import('../pages/StockLevelList'));
export const StockMovementList = lazy(() => import('../pages/StockMovementList'));
export const StockMovementDashboard = lazy(() => import('../pages/StockMovementDashboard'));
export const StockInForm = lazy(() => import('../pages/StockInForm'));
export const StockOutForm = lazy(() => import('../pages/StockOutForm'));
export const StockTransferForm = lazy(() => import('../pages/StockTransferForm'));
export const StockAdjustmentForm = lazy(() => import('../pages/StockAdjustmentForm'));
export const StockCountList = lazy(() => import('../pages/StockCountList'));
export const StockCountForm = lazy(() => import('../pages/StockCountForm'));
export const StockCountDetail = lazy(() => import('../pages/StockCountDetail'));
// P6.3: Finished Goods Stock visibility
export const FGStockList = lazy(() => import('../pages/FGStockList'));

// ============================================================================
// Production Planning
// ============================================================================
export const WorkOrderList = lazy(() => import('../pages/WorkOrderList'));
export const WorkOrderDetail = lazy(() => import('../pages/WorkOrderDetail'));
export const WorkOrderForm = lazy(() => import('../pages/WorkOrderForm'));
export const WorkOrderCreate = lazy(() => import('../pages/WorkOrderCreate'));
export const StockProductionOrderList = lazy(() => import('../pages/StockProductionOrderList'));
export const StockProductionOrderDetail = lazy(() => import('../pages/StockProductionOrderDetail'));
export const SaleOrderList = lazy(() => import('../pages/SaleOrderList'));
export const SaleOrderDetail = lazy(() => import('../pages/SaleOrderDetail'));

// ============================================================================
// Production Status Dashboard
// ============================================================================
export const ProductionStatus = lazy(() => import('../pages/ProductionStatus'));

// ============================================================================
// Procurement (Purchase Orders & GRN)
// ============================================================================
export const PurchaseOrderList = lazy(() => import('../pages/PurchaseOrderList'));
export const PurchaseOrderForm = lazy(() => import('../pages/PurchaseOrderForm'));
export const PurchaseOrderDetail = lazy(() => import('../pages/PurchaseOrderDetail'));
export const GRNList = lazy(() => import('../pages/GRNList'));
export const GRNForm = lazy(() => import('../pages/GRNForm'));
export const GRNDetail = lazy(() => import('../pages/GRNDetail'));

// ============================================================================
// MRP (Material Requirement Planning)
// ============================================================================

// ============================================================================
// Service Requirements (Work Order Service PO Management)
// ============================================================================

// ============================================================================
// Unified Procurement Requirements (Material + Service combined)
// ============================================================================
export const UnifiedRequirementsPage = lazy(() => import('../pages/UnifiedRequirementsPage'));

// ============================================================================
// Job Work Processing (Multi-Stage)
// ============================================================================
export const JobWorkDashboard = lazy(() => import('../pages/JobWorkDashboard'));
export const ProcessingBatchList = lazy(() => import('../pages/ProcessingBatchList'));
export const ProcessingBatchDetail = lazy(() => import('../pages/ProcessingBatchDetail'));
export const ProcessingBatchCreateForm = lazy(() => import('../pages/ProcessingBatchCreateForm'));

// ============================================================================
// Job Work Orders (Unified - Phase 7)
// ============================================================================
export const JobWorkOrderList = lazy(() => import('../pages/JobWorkOrderList'));
export const JobWorkOrderDetail = lazy(() => import('../pages/JobWorkOrderDetail'));
export const DispatchToProcessor = lazy(() => import('../pages/DispatchToProcessor'));

// ============================================================================
// Fabric & Greige Management
// ============================================================================
export const GreigeList = lazy(() => import('../pages/GreigeList'));
export const GreigeDetail = lazy(() => import('../pages/GreigeDetail'));
export const GreigeForm = lazy(() => import('../pages/GreigeForm'));
export const GreigeBulkImport = lazy(() => import('../pages/GreigeBulkImport'));
export const ColorBulkImport = lazy(() => import('../pages/ColorBulkImport'));
export const GreigeStockEntry = lazy(() => import('../pages/GreigeStockEntry'));
export const GreigeAvailableStock = lazy(() => import('../pages/GreigeAvailableStock'));
export const FabricList = lazy(() => import('../pages/FabricList'));
export const FabricDetail = lazy(() => import('../pages/FabricDetail'));
export const FabricForm = lazy(() => import('../pages/FabricForm'));
export const FabricBulkImport = lazy(() => import('../pages/FabricBulkImport'));
export const FabricStockEntry = lazy(() => import('../pages/FabricStockEntry'));
export const FabricAvailableStock = lazy(() => import('../pages/FabricAvailableStock'));
export const FabricUsageReport = lazy(() => import('../pages/FabricUsageReport'));

// ============================================================================
// Trim Masters Dashboard
// ============================================================================
export const TrimMastersDashboard = lazy(() => import('../pages/TrimMastersDashboard'));

// ============================================================================
// Master Data Dashboard (Unified view of all masters)
// ============================================================================
export const MasterDataDashboard = lazy(() => import('../pages/MasterDataDashboard'));

// ============================================================================
// Generic Trim Masters (New trim types: hook_eye, snap_button, buckle, etc.)
// ============================================================================
export const GenericTrimList = lazy(() => import('../pages/GenericTrimList'));
export const GenericTrimForm = lazy(() => import('../pages/GenericTrimForm'));

// ============================================================================
// Material Masters - Unified (NEW)
// ============================================================================

// ============================================================================
// Material Masters (Phase 1 & 1B) - Legacy
// ============================================================================
export const LaceList = lazy(() => import('../pages/LaceList'));
export const LaceForm = lazy(() => import('../pages/LaceForm'));
export const LaceDetail = lazy(() => import('../pages/LaceDetail'));
export const LaceLabDipList = lazy(() => import('../pages/LaceLabDipList'));
export const LaceLabDipForm = lazy(() => import('../pages/LaceLabDipForm'));
export const LaceStockList = lazy(() => import('../pages/LaceStockList'));
export const LaceStockDetail = lazy(() => import('../pages/LaceStockDetail'));
export const LaceStockAging = lazy(() => import('../pages/LaceStockAging'));
export const LaceDefectList = lazy(() => import('../pages/LaceDefectList'));
export const LaceDefectForm = lazy(() => import('../pages/LaceDefectForm'));
export const ButtonList = lazy(() => import('../pages/ButtonList'));
export const ButtonForm = lazy(() => import('../pages/ButtonForm'));
export const ButtonDetail = lazy(() => import('../pages/ButtonDetail'));
export const ThreadList = lazy(() => import('../pages/ThreadList'));
export const ThreadForm = lazy(() => import('../pages/ThreadForm'));
export const ThreadDetail = lazy(() => import('../pages/ThreadDetail'));
export const ZipperList = lazy(() => import('../pages/ZipperList'));
export const ZipperForm = lazy(() => import('../pages/ZipperForm'));
export const ZipperDetail = lazy(() => import('../pages/ZipperDetail'));
export const ElasticList = lazy(() => import('../pages/ElasticList'));
export const ElasticForm = lazy(() => import('../pages/ElasticForm'));
export const ElasticDetail = lazy(() => import('../pages/ElasticDetail'));
export const LabelList = lazy(() => import('../pages/LabelList'));
export const LabelForm = lazy(() => import('../pages/LabelForm'));
export const LabelDetail = lazy(() => import('../pages/LabelDetail'));
export const SizeCategoryList = lazy(() => import('../pages/SizeCategoryList'));
export const SizeCategoryForm = lazy(() => import('../pages/SizeCategoryForm'));
export const PackagingList = lazy(() => import('../pages/PackagingList'));
export const PackagingForm = lazy(() => import('../pages/PackagingForm'));
export const PackagingDetail = lazy(() => import('../pages/PackagingDetail'));
export const MachinePartList = lazy(() => import('../pages/MachinePartList'));
export const MachinePartForm = lazy(() => import('../pages/MachinePartForm'));
export const OtherMaterialList = lazy(() => import('../pages/OtherMaterialList'));
export const OtherMaterialForm = lazy(() => import('../pages/OtherMaterialForm'));

// ============================================================================
// Color Master
// ============================================================================
export const ColorMasterList = lazy(() => import('../pages/ColorMasterList'));
export const ColorMasterForm = lazy(() => import('../pages/ColorMasterForm'));

// ============================================================================
// Season Master
// ============================================================================
export const SeasonMasterList = lazy(() => import('../pages/SeasonMasterList'));
export const SeasonMasterForm = lazy(() => import('../pages/SeasonMasterForm'));

// ============================================================================
// Embroidery Master
// ============================================================================
export const EmbroideryList = lazy(() => import('../pages/EmbroideryList'));
export const EmbroideryForm = lazy(() => import('../pages/EmbroideryForm'));
export const EmbroideryDetail = lazy(() => import('../pages/EmbroideryDetail'));

// ============================================================================
// Embroidery Stock Management
// ============================================================================
export const EmbroideryAvailableStock = lazy(() => import('../pages/EmbroideryAvailableStock'));
export const EmbroideryStockSendOut = lazy(() => import('../pages/EmbroideryStockSendOut'));
export const EmbroideryStockReceive = lazy(() => import('../pages/EmbroideryStockReceive'));

// ============================================================================
// Manufacturing Control Center (Alerts + Vendor Tracker)
// ============================================================================
export const ManufacturingControlCenter = lazy(() => import('../pages/ManufacturingControlCenter'));

// ============================================================================
// External Process (Smocking, Handwork)
// ============================================================================
export const SmockingDashboard = lazy(() => import('../pages/SmockingDashboard'));
export const SmockingSendOut = lazy(() => import('../pages/SmockingSendOut'));
export const SmockingReceive = lazy(() => import('../pages/SmockingReceive'));
export const HandworkDashboard = lazy(() => import('../pages/HandworkDashboard'));
export const HandworkSendOut = lazy(() => import('../pages/HandworkSendOut'));
export const HandworkReceive = lazy(() => import('../pages/HandworkReceive'));
export const EmbroideryPieceDashboard = lazy(() => import('../pages/EmbroideryPieceDashboard'));
export const EmbroideryPieceSendOut = lazy(() => import('../pages/EmbroideryPieceSendOut'));
export const EmbroideryPieceReceive = lazy(() => import('../pages/EmbroideryPieceReceive'));

// ============================================================================
// Component Masters
// ============================================================================
export const ComponentMasters = lazy(() => import('../pages/ComponentMasters'));
export const ComponentGroupMaster = lazy(() => import('../pages/ComponentGroupMaster'));
export const PatternPartMaster = lazy(() => import('../pages/PatternPartMaster'));

// ============================================================================
// Product Category Master
// ============================================================================
export const ProductCategoryMaster = lazy(() => import('../pages/ProductCategoryMaster'));

// ============================================================================
// Sample Tracking (Manufacturing)
// ============================================================================
export const SampleList = lazy(() => import('../pages/SampleList'));
export const SampleDetail = lazy(() => import('../pages/SampleDetail'));
export const SampleForm = lazy(() => import('../pages/SampleForm'));

// ============================================================================
// Printing (Manufacturing - Fabric Processing)
// ============================================================================
export const PrintingList = lazy(() => import('../pages/PrintingList'));
export const PrintLabDipCreate = lazy(() => import('../pages/printing/PrintLabDipCreate'));
export const PrintLabDipDetail = lazy(() => import('../pages/printing/PrintLabDipDetail'));
export const PrintProcessPOCreate = lazy(() => import('../pages/printing/PrintProcessPOCreate'));
export const PrintProcessPODetail = lazy(() => import('../pages/printing/PrintProcessPODetail'));

// ============================================================================
// Dyeing (Manufacturing - Fabric Processing)
// ============================================================================
export const DyeingList = lazy(() => import('../pages/DyeingList'));
export const DyeLabDipCreate = lazy(() => import('../pages/dyeing/DyeLabDipCreate'));
export const DyeLabDipDetail = lazy(() => import('../pages/dyeing/DyeLabDipDetail'));
export const DyeProcessPOCreate = lazy(() => import('../pages/dyeing/DyeProcessPOCreate'));
export const DyeProcessPODetail = lazy(() => import('../pages/dyeing/DyeProcessPODetail'));

// ============================================================================
// Unified Processing (Dyeing & Printing Combined)
// ============================================================================
export const ProcessingList = lazy(() => import('../pages/ProcessingList'));
// BUG-DASH4 fix: Add unified processing create/detail routes
export const UnifiedLabDipCreate = lazy(() => import('../pages/processing/UnifiedLabDipCreate'));
export const UnifiedProcessPOCreate = lazy(() => import('../pages/processing/UnifiedProcessPOCreate'));
export const UnifiedProcessPODetail = lazy(() => import('../pages/processing/UnifiedProcessPODetail'));

// ============================================================================
// Cutting (Manufacturing - Production)
// ============================================================================
export const CuttingList = lazy(() => import('../pages/CuttingList'));
export const CuttingForm = lazy(() => import('../pages/CuttingForm'));
export const CuttingChart = lazy(() => import('../pages/CuttingChart'));
export const CuttingDetail = lazy(() => import('../pages/CuttingDetail'));

// ============================================================================
// Stitching (Manufacturing - Production)
// ============================================================================
export const StitchingList = lazy(() => import('../pages/StitchingList'));
export const StitchingForm = lazy(() => import('../pages/StitchingForm'));
export const StitchingDetail = lazy(() => import('../pages/StitchingDetail'));

// ============================================================================
// Finishing (Manufacturing - Production)
// ============================================================================
export const FinishingList = lazy(() => import('../pages/FinishingList'));
export const FinishingForm = lazy(() => import('../pages/FinishingForm'));
export const FinishingDetail = lazy(() => import('../pages/FinishingDetail'));

// ============================================================================
// Dispatch (Manufacturing - Final Step)
// BUG-DASH10 fix: all dispatch components properly exported for Create/View functionality
// ============================================================================
export const DispatchList = lazy(() => import('../pages/DispatchList'));
export const DispatchDeliveryNoteForm = lazy(() => import('../pages/DispatchDeliveryNoteForm'));
export const DispatchDeliveryNoteDetail = lazy(() => import('../pages/DispatchDeliveryNoteDetail'));
export const DispatchPODForm = lazy(() => import('../pages/DispatchPODForm'));
export const ASNDetail = lazy(() => import('../pages/ASNDetail'));
export const ASNCreateForm = lazy(() => import('../pages/ASNCreateForm'));

// ============================================================================
// Document Generation
// ============================================================================
export const CatalogueGenerator = lazy(() => import('../pages/CatalogueGenerator'));

// ============================================================================
// Design Hub (Phase 1-4)
// ============================================================================
export const DesignDashboard = lazy(() => import('../pages/DesignDashboard'));
export const MoodBoardList = lazy(() => import('../pages/MoodBoardList'));
export const MoodBoardDetail = lazy(() => import('../pages/MoodBoardDetail'));

// ============================================================================
// AI & Tools
// ============================================================================
export const AIAssistant = lazy(() => import('../pages/AIAssistant'));
export const AISettings = lazy(() => import('../pages/AISettings'));
export const IssueReports = lazy(() => import('../pages/IssueReports'));

// ============================================================================
// Debug/Test Pages
// ============================================================================

// ============================================================================
// Testing Module (FPT/GPT)
// ============================================================================
export const TestingDashboard = lazy(() => import('../pages/TestingDashboard'));
export const FabricPhysicalTests = lazy(() => import('../pages/FabricPhysicalTests'));
export const FabricPhysicalTestForm = lazy(() => import('../pages/FabricPhysicalTestForm'));
export const GarmentPhysicalTests = lazy(() => import('../pages/GarmentPhysicalTests'));
export const GarmentPhysicalTestForm = lazy(() => import('../pages/GarmentPhysicalTestForm'));
export const TestingLabs = lazy(() => import('../pages/TestingLabs'));
export const TestTemplates = lazy(() => import('../pages/TestTemplates'));
export const TestTemplateForm = lazy(() => import('../pages/TestTemplateForm'));

// ============================================================================
// Process Guide
// ============================================================================
export const ProcessGuidePage = lazy(() => import('../pages/ProcessGuidePage'));

// ============================================================================
// Admin Pages
// ============================================================================
export const OverrideHistory = lazy(() => import('../pages/admin/OverrideHistory'));
export const PermissionManagement = lazy(() => import('../pages/PermissionManagement'));

// ============================================================================
// Challans (Material Movement)
// ============================================================================
export const ChallanList = lazy(() => import('../pages/ChallanList'));
export const ChallanForm = lazy(() => import('../pages/ChallanForm'));
export const ChallanDetail = lazy(() => import('../pages/ChallanDetail'));

// ============================================================================
// Error Pages
// ============================================================================
export const NotFound = lazy(() => import('../pages/NotFound'));
