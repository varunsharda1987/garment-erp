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
export const CostSheetPOGenerationPage = lazy(() => import('../pages/CostSheetPOGenerationPage'));
export const FabricCostingPage = lazy(() => import('../pages/FabricCostingPage'));
export const FabricCostingOptionsPage = lazy(() => import('../pages/FabricCostingOptionsPage'));
export const StyleFabricCostingOptionsPage = lazy(() => import('../pages/StyleFabricCostingOptionsPage'));
export const ProcessorRateCardPage = lazy(() => import('../pages/ProcessorRateCardPage'));
export const ChartOfAccountsList = lazy(() => import('../pages/ChartOfAccountsList'));

// ============================================================================
// Financial Management (Invoices & Quotations)
// ============================================================================
export const InvoiceList = lazy(() => import('../pages/InvoiceList'));
export const InvoiceForm = lazy(() => import('../pages/InvoiceForm'));
export const InvoiceDetail = lazy(() => import('../pages/InvoiceDetail'));
export const QuotationList = lazy(() => import('../pages/QuotationList'));
export const QuotationForm = lazy(() => import('../pages/QuotationForm'));
export const QuotationDetail = lazy(() => import('../pages/QuotationDetail'));

// ============================================================================
// Inventory & Warehouse Management
// ============================================================================
export const StockDashboard = lazy(() => import('../pages/StockDashboard'));
export const WarehouseList = lazy(() => import('../pages/WarehouseList'));
export const WarehouseForm = lazy(() => import('../pages/WarehouseForm'));
export const StockLevelList = lazy(() => import('../pages/StockLevelList'));
export const StockMovementList = lazy(() => import('../pages/StockMovementList'));
export const StockInForm = lazy(() => import('../pages/StockInForm'));
export const StockOutForm = lazy(() => import('../pages/StockOutForm'));
export const StockTransferForm = lazy(() => import('../pages/StockTransferForm'));
export const StockAdjustmentForm = lazy(() => import('../pages/StockAdjustmentForm'));
export const StockCountList = lazy(() => import('../pages/StockCountList'));
export const StockCountForm = lazy(() => import('../pages/StockCountForm'));

// ============================================================================
// Production Planning
// ============================================================================
export const WorkOrderList = lazy(() => import('../pages/WorkOrderList'));
export const WorkOrderDetail = lazy(() => import('../pages/WorkOrderDetail'));
export const WorkOrderForm = lazy(() => import('../pages/WorkOrderForm'));

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
export const MRPDashboard = lazy(() => import('../pages/MRPDashboard'));
export const MaterialRequirementsList = lazy(() => import('../pages/MaterialRequirementsList'));

// ============================================================================
// Service Requirements (Work Order Service PO Management)
// ============================================================================
export const ServiceRequirementsDashboard = lazy(() => import('../pages/ServiceRequirementsDashboard'));
export const ServiceRequirementsList = lazy(() => import('../pages/ServiceRequirementsList'));

// ============================================================================
// Job Work Processing (Multi-Stage)
// ============================================================================
export const JobWorkDashboard = lazy(() => import('../pages/JobWorkDashboard'));
export const ProcessingBatchList = lazy(() => import('../pages/ProcessingBatchList'));
export const ProcessingBatchDetail = lazy(() => import('../pages/ProcessingBatchDetail'));

// ============================================================================
// Fabric & Greige Management
// ============================================================================
export const GreigeList = lazy(() => import('../pages/GreigeList'));
export const GreigeDetail = lazy(() => import('../pages/GreigeDetail'));
export const GreigeForm = lazy(() => import('../pages/GreigeForm'));
export const GreigeBulkImport = lazy(() => import('../pages/GreigeBulkImport'));
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
export const MaterialMasterList = lazy(() => import('../pages/MaterialMasterList'));
export const MaterialMasterForm = lazy(() => import('../pages/MaterialMasterForm'));

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

// ============================================================================
// Dyeing (Manufacturing - Fabric Processing)
// ============================================================================
export const DyeingList = lazy(() => import('../pages/DyeingList'));

// ============================================================================
// Cutting (Manufacturing - Production)
// ============================================================================
export const CuttingList = lazy(() => import('../pages/CuttingList'));
export const CuttingForm = lazy(() => import('../pages/CuttingForm'));
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
// ============================================================================
export const DispatchList = lazy(() => import('../pages/DispatchList'));
export const DispatchPODForm = lazy(() => import('../pages/DispatchPODForm'));

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

// ============================================================================
// Debug/Test Pages
// ============================================================================
export const SelectTest = lazy(() => import('../pages/SelectTest'));

// ============================================================================
// Testing Module (FPT/GPT)
// ============================================================================
export const TestingDashboard = lazy(() => import('../pages/TestingDashboard'));
export const FabricPhysicalTests = lazy(() => import('../pages/FabricPhysicalTests'));
export const GarmentPhysicalTests = lazy(() => import('../pages/GarmentPhysicalTests'));
export const TestingLabs = lazy(() => import('../pages/TestingLabs'));
export const TestTemplates = lazy(() => import('../pages/TestTemplates'));

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
// Error Pages
// ============================================================================
export const NotFound = lazy(() => import('../pages/NotFound'));
