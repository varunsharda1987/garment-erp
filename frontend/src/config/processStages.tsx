import {
  Shirt,
  TestTube,
  Ruler,
  Calculator,
  ClipboardList,
  Factory,
  ShoppingCart,
  Droplets,
  Beaker,
  Scissors,
  Package,
  CheckSquare,
  FlaskConical,
  Box,
  Send,
  Wallet,
  Building2,
  Warehouse,
  FolderTree,
  Layers,
  Palette,
  Tag,
  Sparkles,
  UserCircle,
  PackageOpen,
  FileBarChart,
} from 'lucide-react';
import type { ProcessStage, MasterDataItem, ProcessCategoryInfo } from '@/types/processGuide.types';

export const processCategoryInfo: ProcessCategoryInfo[] = [
  {
    id: 'pre-production',
    title: 'Pre-Production Stages',
    description: 'Style creation, sampling, planning, and costing',
    color: 'blue',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-600',
  },
  {
    id: 'order-management',
    title: 'Order Management',
    description: 'Customer orders and work order generation',
    color: 'green',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-emerald-600',
  },
  {
    id: 'production',
    title: 'Production Stages',
    description: 'Material procurement through quality control',
    color: 'orange',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-amber-600',
  },
  {
    id: 'fulfillment',
    title: 'Fulfillment Stages',
    description: 'Packing, dispatch, and invoicing',
    color: 'purple',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-violet-600',
  },
];

export const processStages: ProcessStage[] = [
  // PRE-PRODUCTION STAGES
  {
    id: 'style-creation',
    order: 1,
    title: 'Style Creation',
    icon: <Shirt className="h-5 w-5" />,
    category: 'pre-production',
    description: 'Create complete product specifications with fabrics, trims, and packaging',
    purpose:
      'Capture all product specifications - the foundation for everything that follows. Define style details, components, fabrics, trims, value additions, and packaging.',
    prerequisites: [
      {
        condition: 'Customers configured',
        required: true,
      },
      {
        condition: 'Product Categories defined',
        required: true,
      },
      {
        condition: 'Component Masters available',
        required: true,
      },
      {
        condition: 'Fabric and Trim Masters configured',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Style List',
        path: '/styles',
        icon: <Shirt className="h-4 w-4" />,
      },
      {
        title: 'Create New Style',
        path: '/styles/new',
        icon: <Shirt className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'DRAFT', to: 'APPROVED' },
      { from: 'APPROVED', to: 'IN_PRODUCTION' },
      { from: 'IN_PRODUCTION', to: 'COMPLETED' },
    ],
    databaseModels: [
      'styles',
      'style_components',
      'style_fabrics',
      'style_garment_trims',
      'style_value_additions',
      'style_packaging',
    ],
    keyFields: [
      'styleCode (Buyer-given)',
      'internalCode (Auto: STY-202506-0001)',
      'cadStatus (PENDING | IN_PROGRESS | APPROVED)',
      'numberOfComponents',
    ],
    tips: [
      'Use the 5-tab workflow: Basic Details, Fabrics & Components, Trims, Value Additions, Packaging',
      'Style code is buyer-provided, internal code is auto-generated',
      'Configure customer accessory presets to auto-populate common trims',
    ],
  },
  {
    id: 'sample-tracking',
    order: 2,
    title: 'Sample Tracking',
    icon: <TestTube className="h-5 w-5" />,
    category: 'pre-production',
    description: 'Track FIT → PP → Size Set sample approvals before production',
    purpose:
      'Manage sample approvals through the FIT → PP → Size Set workflow. Each sample type must be approved before proceeding to ensure quality and fit standards.',
    prerequisites: [
      {
        stage: 'style-creation',
        condition: 'Style must exist',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Sample List',
        path: '/samples',
        icon: <TestTube className="h-4 w-4" />,
      },
      {
        title: 'Create New Sample',
        path: '/samples/new',
        icon: <TestTube className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'REQUESTED', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'SUBMITTED' },
      { from: 'SUBMITTED', to: 'SENT' },
      { from: 'SENT', to: 'FEEDBACK_PENDING' },
      { from: 'FEEDBACK_PENDING', to: 'APPROVED' },
      { from: 'FEEDBACK_PENDING', to: 'REJECTED' },
      { from: 'REJECTED', to: 'REVISION_NEEDED' },
    ],
    databaseModels: ['samples', 'sample_measurements', 'sample_colorways', 'sample_size_sets'],
    keyFields: [
      'sampleType (FIT_SAMPLE | PP_SAMPLE | SIZE_SET_SAMPLE)',
      'version (v1, v2, v3...)',
      'status',
      'approvalDate',
    ],
    tips: [
      'FIT Sample: Verify fit and measurements first',
      'PP Sample: Pre-production colorway approval',
      'Size Set Sample: Full size range verification',
    ],
    gates: ['Size Set sample must be APPROVED before Work Orders can be created'],
  },
  {
    id: 'cad-planning',
    order: 3,
    title: 'CAD Planning & Averaging',
    icon: <Ruler className="h-5 w-5" />,
    category: 'pre-production',
    description: 'Calculate precise fabric consumption per garment piece',
    purpose:
      'Determine fabric consumption per piece across different fabric widths. Compare costs to find the most economical option for production.',
    prerequisites: [
      {
        stage: 'style-creation',
        condition: 'Style must exist with fabric assignments',
        required: true,
      },
    ],
    pages: [
      {
        title: 'CAD Planning',
        path: '/styles?cadStatus=PENDING',
        icon: <Ruler className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'APPROVED' },
    ],
    databaseModels: ['fabric_width_cad', 'style_fabrics'],
    keyFields: [
      'fabricWidth (36", 44", 54", 58", 60", 72", 108")',
      'cadInMeters / cadInYards',
      'wastagePercent',
      'markerEfficiency',
      'piecesPerMarker',
      'effectiveCad (calculated)',
    ],
    tips: [
      'Generate CAD options for all available fabric widths',
      'Compare effective cost per piece across widths',
      'Consider wastage percentage and marker efficiency',
      'Lock CAD planning by marking as APPROVED',
    ],
    gates: ['CAD must be APPROVED before Costing Sheet can be created'],
  },
  {
    id: 'costing',
    order: 4,
    title: 'Costing Sheet',
    icon: <Calculator className="h-5 w-5" />,
    category: 'pre-production',
    description: 'Calculate complete product cost breakdown with margins',
    purpose:
      'Determine total product cost including materials, processing, CMT, overheads, value loss, and markup. Essential for pricing and profitability.',
    prerequisites: [
      {
        stage: 'cad-planning',
        condition: 'CAD status must be APPROVED',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Cost Sheets',
        path: '/cost-sheets',
        icon: <Calculator className="h-4 w-4" />,
      },
      {
        title: 'Create Cost Sheet',
        path: '/cost-sheets/new',
        icon: <Calculator className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'DRAFT', to: 'PENDING_APPROVAL' },
      { from: 'PENDING_APPROVAL', to: 'APPROVED' },
      { from: 'APPROVED', to: 'ACTIVE' },
    ],
    databaseModels: ['style_costing', 'style_costing_fabric_items'],
    keyFields: [
      'fabricCost (from approved CAD)',
      'trimsCost',
      'processingCost (dyeing, printing, embroidery)',
      'cmtCost (cutting, stitching, finishing)',
      'overheadCost',
      'valueLoss (typically 2%)',
      'markup (typically 15%)',
      'totalCost',
    ],
    tips: [
      'Fabric cost auto-calculated from approved CAD',
      'Include all processing costs: dyeing, printing, washing, embroidery',
      'CMT includes cutting, stitching, finishing, checking, handwork',
      'Consider value loss and markup percentages',
    ],
  },

  // ORDER MANAGEMENT STAGES
  {
    id: 'order-creation',
    order: 5,
    title: 'Order Creation',
    icon: <ClipboardList className="h-5 w-5" />,
    category: 'order-management',
    description: 'Create customer orders with color × size breakdown matrix',
    purpose:
      'Capture customer orders with detailed quantity breakdowns by color and size. Links styles to production planning.',
    prerequisites: [
      {
        stage: 'style-creation',
        condition: 'Style should exist',
        required: false,
      },
    ],
    pages: [
      {
        title: 'Order List',
        path: '/orders',
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        title: 'Create New Order',
        path: '/orders/new',
        icon: <ClipboardList className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PRODUCTION' },
      { from: 'IN_PRODUCTION', to: 'COMPLETED' },
      { from: 'COMPLETED', to: 'DISPATCHED' },
    ],
    databaseModels: ['orders', 'order_items', 'order_item_breakup'],
    keyFields: [
      'orderNumber (ORD202512-0001)',
      'customerId',
      'orderDate',
      'expectedDeliveryDate',
      'totalQuantity',
      'totalAmount',
      'priority',
    ],
    tips: [
      'Use color × size matrix for granular SKU tracking',
      'Link order items to approved styles',
      'Set priority levels for production scheduling',
      'Expected delivery date drives production planning',
    ],
  },
  {
    id: 'work-order',
    order: 6,
    title: 'Work Order Generation',
    icon: <Factory className="h-5 w-5" />,
    category: 'order-management',
    description: 'Generate production work orders from customer orders',
    purpose:
      'Create production work orders for each order item. Work orders drive all downstream production activities.',
    prerequisites: [
      {
        stage: 'order-creation',
        condition: 'Order must exist',
        required: true,
      },
      {
        stage: 'sample-tracking',
        condition: 'Size Set sample must be APPROVED',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Work Orders',
        path: '/production/work-orders',
        icon: <Factory className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PRODUCTION' },
      { from: 'IN_PRODUCTION', to: 'COMPLETED' },
    ],
    databaseModels: ['work_orders', 'work_order_breakup', 'production_tracking'],
    keyFields: ['workOrderNumber', 'orderId', 'orderItemId', 'styleId', 'targetQuantity', 'status'],
    tips: [
      'One work order per order item',
      'Inherits color × size breakup from order item',
      'Tracks production progress through all stages',
      'Links to cutting, stitching, finishing batches',
    ],
    gates: ['Size Set sample approval is mandatory before work order creation'],
  },

  // PRODUCTION STAGES
  {
    id: 'material-requisition',
    order: 7,
    title: 'Material Requisition & Procurement',
    icon: <ShoppingCart className="h-5 w-5" />,
    category: 'production',
    description: 'Request materials from inventory or procure via purchase orders',
    purpose:
      'Ensure all required materials are available before production begins. Check stock, issue from inventory, or create purchase orders.',
    prerequisites: [
      {
        stage: 'work-order',
        condition: 'Work Order must exist',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Material Requirements',
        path: '/mrp/requirements',
        icon: <FileBarChart className="h-4 w-4" />,
      },
      {
        title: 'Purchase Orders',
        path: '/procurement/purchase-orders',
        icon: <ShoppingCart className="h-4 w-4" />,
      },
      {
        title: 'GRN (Goods Receipt)',
        path: '/procurement/grn',
        icon: <PackageOpen className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'ISSUED' },
      { from: 'ISSUED', to: 'RECEIVED' },
    ],
    databaseModels: [
      'material_requisitions',
      'material_requisition_items',
      'purchase_orders',
      'purchase_order_items',
      'goods_receiving_notes',
    ],
    keyFields: ['requisitionNumber (MRQ2512-0001)', 'workOrderId', 'status', 'requestedDate'],
    tips: [
      'System checks stock availability first',
      'If stock insufficient, auto-creates purchase order',
      'GRN records quality check: Accept/Reject/Partially Accept',
      'Auto updates inventory on GRN approval',
    ],
  },
  {
    id: 'fabric-processing',
    order: 8,
    title: 'Fabric Processing (Dyeing/Printing)',
    icon: <Droplets className="h-5 w-5" />,
    category: 'production',
    description: 'Lab dip approval → Job work for dyeing/printing → QC → Stock',
    purpose:
      'Process greige fabric through dyeing or printing. Includes lab dip approvals, job work orders to mills, and quality checks.',
    prerequisites: [
      {
        condition: 'Greige fabric available in stock',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Dyeing Jobs',
        path: '/manufacturing/dyeing',
        icon: <Droplets className="h-4 w-4" />,
      },
      {
        title: 'Printing Jobs',
        path: '/manufacturing/printing',
        icon: <Beaker className="h-4 w-4" />,
      },
      {
        title: 'Job Work Dashboard',
        path: '/processing/job-work',
        icon: <Factory className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'SUBMITTED' },
      { from: 'SUBMITTED', to: 'APPROVED' },
      { from: 'APPROVED', to: 'SENT' },
      { from: 'SENT', to: 'RECEIVED' },
      { from: 'RECEIVED', to: 'QC_DONE' },
      { from: 'QC_DONE', to: 'STOCK_UPDATED' },
    ],
    databaseModels: ['lab_dips', 'job_work_orders', 'fabric_stock'],
    keyFields: ['labDipNumber', 'sampleType (DYEING | PRINTING)', 'colorMatchRating', 'jobWorkStatus', 'qualityGrade'],
    tips: [
      'Lab dip approval required before bulk production',
      'Track color match ratings and resubmissions',
      'Job work orders track processing at external mills',
      'Quality check on receipt before adding to stock',
    ],
  },
  {
    id: 'cutting',
    order: 9,
    title: 'Cutting',
    icon: <Scissors className="h-5 w-5" />,
    category: 'production',
    description: 'Fabric cutting into garment pieces with SKU-level tracking',
    purpose:
      'Cut fabric into garment pieces based on approved markers. Track actual vs. planned consumption, defects, and generate transfer slips to stitching.',
    prerequisites: [
      {
        stage: 'work-order',
        condition: 'Work Order must exist',
        required: true,
      },
      {
        stage: 'fabric-processing',
        condition: 'Processed fabric in stock',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Cutting Batches',
        path: '/manufacturing/cutting',
        icon: <Scissors className="h-4 w-4" />,
      },
      {
        title: 'Create Cutting Batch',
        path: '/manufacturing/cutting/new',
        icon: <Scissors className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
    ],
    databaseModels: ['cutting_batches', 'cutting_batch_skus', 'cutting_batch_defects', 'transfer_slips'],
    keyFields: [
      'batchNumber (CB-WO2024-001-BODY-001)',
      'fabricConsumed (actual meters)',
      'layersPerLay',
      'numberOfLays',
      'actualAverage',
      'varianceFromCad',
      'wastagePercent',
    ],
    tips: [
      'Plan layers and lays based on order quantity',
      'Record cut qty, rejected qty, and defects per SKU',
      'Track variance from planned CAD consumption',
      'Generate transfer slip to move cut pieces to stitching',
    ],
  },
  {
    id: 'stitching',
    order: 10,
    title: 'Stitching',
    icon: <Factory className="h-5 w-5" />,
    category: 'production',
    description: 'Garment assembly with daily production tracking',
    purpose:
      'Assemble cut pieces into complete garments. Track daily production, quality checks, pass/fail rates, and generate transfer slips to finishing.',
    prerequisites: [
      {
        stage: 'cutting',
        condition: 'Transfer slip from cutting received',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Stitching Issues',
        path: '/manufacturing/stitching',
        icon: <Factory className="h-4 w-4" />,
      },
      {
        title: 'Create Stitching Record',
        path: '/manufacturing/stitching/new',
        icon: <Factory className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
    ],
    databaseModels: [
      'stitching_issues',
      'stitching_issue_skus',
      'stitching_daily_outputs',
      'stitching_output_skus',
      'stage_receipts',
    ],
    keyFields: ['producedQty', 'checkedQty', 'passedQty', 'rejectedQty', 'repairedQty', 'alterationQty', 'passRate'],
    tips: [
      'Record receipt of transfer slip from cutting',
      'Track daily production output per SKU',
      'Monitor pass rates and quality metrics',
      'Rejected pieces can be repaired or altered',
    ],
  },
  {
    id: 'finishing',
    order: 11,
    title: 'Finishing',
    icon: <CheckSquare className="h-5 w-5" />,
    category: 'production',
    description: 'Final touches: ironing, tagging, thread cutting, QC',
    purpose:
      'Apply final touches to garments including ironing, button/accessory attachment, tagging, and final quality checks.',
    prerequisites: [
      {
        stage: 'stitching',
        condition: 'Transfer slip from stitching received',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Finishing Issues',
        path: '/manufacturing/finishing',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        title: 'Create Finishing Record',
        path: '/manufacturing/finishing/new',
        icon: <CheckSquare className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
    ],
    databaseModels: ['finishing_issues', 'finishing_issue_skus', 'finishing_daily_outputs', 'finishing_output_skus'],
    keyFields: ['receivedQty', 'finishedQty', 'ironedQty', 'taggedQty', 'checkedQty', 'passedQty', 'packReadyQty'],
    tips: [
      'Track ironing, tagging, and final QC separately',
      'packReadyQty indicates garments ready for packing',
      'Final thread cutting and inspection before packing',
      'Generate transfer slip to dispatch/packing area',
    ],
  },
  {
    id: 'quality-control',
    order: 12,
    title: 'Quality Control & Testing',
    icon: <FlaskConical className="h-5 w-5" />,
    category: 'production',
    description: 'FPT, GPT, inline inspections, and AQL sampling',
    purpose:
      'Comprehensive quality testing including Fabric Physical Tests (FPT), Garment Physical Tests (GPT), and manufacturing inspections.',
    prerequisites: [
      {
        condition: 'Testing labs configured',
        required: false,
      },
    ],
    pages: [
      {
        title: 'Testing Dashboard',
        path: '/testing',
        icon: <FlaskConical className="h-4 w-4" />,
      },
      {
        title: 'Fabric Physical Tests',
        path: '/fabric-physical-tests',
        icon: <FlaskConical className="h-4 w-4" />,
      },
      {
        title: 'Garment Physical Tests',
        path: '/garment-physical-tests',
        icon: <FlaskConical className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
      { from: 'COMPLETED', to: 'PASS' },
      { from: 'COMPLETED', to: 'FAIL' },
    ],
    databaseModels: ['fabric_physical_tests', 'garment_physical_tests', 'quality_inspections_mfg', 'testing_labs'],
    keyFields: [
      'testNumber (FPT-xxx or GPT-xxx)',
      'testType',
      'testResult (PASS | FAIL)',
      'buyerApprovalRequired',
      'retestRequired',
    ],
    tips: [
      'FPT tests fabric properties: GSM, shrinkage, tensile strength, color fastness',
      'GPT tests finished garments: dimensional stability, seam strength',
      'Configure customer-specific testing requirements',
      'Some tests may require buyer approval before shipment',
    ],
  },

  // FULFILLMENT STAGES
  {
    id: 'packing',
    order: 13,
    title: 'Packing',
    icon: <Box className="h-5 w-5" />,
    category: 'fulfillment',
    description: 'Polybag packing and carton consolidation',
    purpose:
      'Pack finished garments into polybags and consolidate into cartons for shipment. Track SKU-level packing details.',
    prerequisites: [
      {
        stage: 'finishing',
        condition: 'Pack-ready garments available',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Dispatch Management',
        path: '/manufacturing/dispatch',
        icon: <Send className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
    ],
    databaseModels: ['polybag_entries', 'polybag_skus', 'carton_packings', 'carton_skus'],
    keyFields: [
      'polybagNumber (PB-WO2024-001-001)',
      'cartonNumber (CTN-WO2024-001-001)',
      'grossWeight',
      'netWeight',
      'dimensions (L × W × H)',
    ],
    tips: [
      'Polybag entries track individual garment wrapping',
      'Cartons consolidate multiple polybags',
      'Record weights and dimensions for logistics',
      'SKU-level tracking maintained through packing',
    ],
  },
  {
    id: 'dispatch',
    order: 14,
    title: 'Dispatch',
    icon: <Send className="h-5 w-5" />,
    category: 'fulfillment',
    description: 'ASN application → Delivery Note → Ship with documents',
    purpose:
      'Manage shipment process including ASN (Advance Shipping Notice) approvals, delivery notes, transport details, and proof of delivery.',
    prerequisites: [
      {
        stage: 'packing',
        condition: 'Cartons packed and ready',
        required: true,
      },
      {
        condition: 'ASN approval (if required by customer)',
        required: false,
      },
    ],
    pages: [
      {
        title: 'Dispatch List',
        path: '/manufacturing/dispatch',
        icon: <Send className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'APPLIED' },
      { from: 'APPLIED', to: 'APPROVED' },
      { from: 'APPROVED', to: 'IN_TRANSIT' },
      { from: 'IN_TRANSIT', to: 'DELIVERED' },
    ],
    databaseModels: [
      'asn_applications',
      'asn_skus',
      'delivery_notes_ext',
      'dispatch_cartons',
      'dispatch_documents',
      'dispatch_transports',
      'dispatch_pods',
    ],
    keyFields: [
      'asnNumber (ASN-ORD2024-001-001)',
      'appointmentDate',
      'deliveryNoteNumber',
      'vehicleNumber',
      'driverName',
      'ewayBillNumber',
    ],
    tips: [
      'ASN approval gets appointment date/time from buyer',
      'Generate documents: Challan, Packing List, Invoice, E-way Bill',
      'Track vehicle and driver details',
      'Record POD (Proof of Delivery) with signature',
    ],
    gates: ['ASN approval may be required before dispatch (customer-specific)'],
  },
  {
    id: 'invoicing',
    order: 15,
    title: 'Invoicing & Payment',
    icon: <Wallet className="h-5 w-5" />,
    category: 'fulfillment',
    description: 'Generate invoices and track payments',
    purpose:
      'Create invoices for dispatched goods and track payment collection. Supports partial invoicing and partial payments.',
    prerequisites: [
      {
        stage: 'dispatch',
        condition: 'Goods dispatched',
        required: true,
      },
    ],
    pages: [
      {
        title: 'Orders (Invoicing)',
        path: '/orders',
        icon: <ClipboardList className="h-4 w-4" />,
      },
    ],
    statusFlow: [
      { from: 'PENDING', to: 'PARTIALLY_PAID' },
      { from: 'PARTIALLY_PAID', to: 'PAID' },
      { from: 'PENDING', to: 'OVERDUE' },
    ],
    databaseModels: ['invoices', 'payments'],
    keyFields: [
      'invoiceNumber',
      'invoiceDate',
      'dueDate',
      'subtotal',
      'taxAmount (CGST, SGST, IGST)',
      'totalAmount',
      'paidAmount',
      'balanceAmount',
      'paymentMethod',
    ],
    tips: [
      'Multiple invoices per order supported (partial invoicing)',
      'Track multiple payments per invoice',
      'Payment methods: CASH, CHEQUE, BANK_TRANSFER, UPI',
      'Monitor due dates for overdue tracking',
    ],
  },
];

export const masterDataItems: MasterDataItem[] = [
  // Foundation Phase
  {
    id: 'users',
    title: 'Users & Roles',
    path: '/users',
    icon: <UserCircle className="h-4 w-4" />,
    phase: 'foundation',
    description: 'Create system users with appropriate roles and permissions',
    priority: 1,
  },
  {
    id: 'warehouses',
    title: 'Warehouses',
    path: '/inventory/warehouses',
    icon: <Warehouse className="h-4 w-4" />,
    phase: 'foundation',
    description: 'Define warehouse locations for inventory management (Raw Material, Finished Goods, WIP)',
    priority: 2,
  },

  // Business Phase
  {
    id: 'customers',
    title: 'Customers',
    path: '/customers',
    icon: <Building2 className="h-4 w-4" />,
    phase: 'business',
    description: 'Configure customers with brand categories, testing requirements, and accessory presets',
    priority: 3,
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    path: '/suppliers',
    icon: <Building2 className="h-4 w-4" />,
    phase: 'business',
    description: 'Add suppliers for fabrics, trims, and other materials',
    priority: 4,
  },

  // Masters Phase
  {
    id: 'product-categories',
    title: 'Product Categories',
    path: '/product-categories',
    icon: <FolderTree className="h-4 w-4" />,
    phase: 'masters',
    description: 'Define 3-level product hierarchy (Main Category → Sub-Category → Type)',
    priority: 5,
  },
  {
    id: 'component-masters',
    title: 'Component Masters',
    path: '/component-masters',
    icon: <Layers className="h-4 w-4" />,
    phase: 'masters',
    description: 'Create garment components (Body, Sleeves, Collar, etc.)',
    priority: 6,
  },
  {
    id: 'component-groups',
    title: 'Component Groups',
    path: '/component-groups',
    icon: <Layers className="h-4 w-4" />,
    phase: 'masters',
    description: 'Group related components for organization',
    priority: 7,
  },
  {
    id: 'size-categories',
    title: 'Size Categories',
    path: '/masters/size-categories',
    icon: <Ruler className="h-4 w-4" />,
    phase: 'masters',
    description: "Define sizing systems (Men's, Women's, Kids, etc.)",
    priority: 8,
  },
  {
    id: 'colors',
    title: 'Color Master',
    path: '/colors',
    icon: <Palette className="h-4 w-4" />,
    phase: 'masters',
    description: 'Create color palette with codes and hex values',
    priority: 9,
  },
  {
    id: 'fabric',
    title: 'Fabric & Greige Masters',
    path: '/fabric',
    icon: <Package className="h-4 w-4" />,
    phase: 'masters',
    description: 'Configure fabric types with GSM, width, and finish options',
    priority: 10,
  },
  {
    id: 'trims',
    title: 'Trims (Buttons, Zippers, etc.)',
    path: '/trim-masters',
    icon: <Scissors className="h-4 w-4" />,
    phase: 'masters',
    description: 'Add buttons, zippers, lace, elastic, thread, and other trims',
    priority: 11,
  },
  {
    id: 'labels',
    title: 'Labels',
    path: '/materials/label',
    icon: <Tag className="h-4 w-4" />,
    phase: 'masters',
    description: 'Configure labels with size variants',
    priority: 12,
  },
  {
    id: 'packaging',
    title: 'Packaging',
    path: '/materials/packaging',
    icon: <Box className="h-4 w-4" />,
    phase: 'masters',
    description: 'Define packaging materials (polybags, cartons, hangers)',
    priority: 13,
  },
  {
    id: 'embroidery',
    title: 'Embroidery Master',
    path: '/embroidery',
    icon: <Sparkles className="h-4 w-4" />,
    phase: 'masters',
    description: 'Add embroidery designs and specifications',
    priority: 14,
  },

  // Quality Phase
  {
    id: 'testing-labs',
    title: 'Testing Labs',
    path: '/testing',
    icon: <FlaskConical className="h-4 w-4" />,
    phase: 'quality',
    description: 'Configure testing labs for FPT and GPT',
    priority: 15,
  },

  // Finance Phase
  {
    id: 'chart-of-accounts',
    title: 'Chart of Accounts',
    path: '/chart-of-accounts',
    icon: <Wallet className="h-4 w-4" />,
    phase: 'finance',
    description: 'Set up financial account codes',
    priority: 16,
  },
];
