import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  createCostSheet,
  getCostSheetById,
  updateCostSheet,
  getBudgetSuggestions,
} from '../services/costSheet.service';
import type { BudgetSuggestions } from '../types/costSheet.types';
import { ALL_TRIM_TYPES, TRIM_TYPE_REGISTRY } from '../config/trimTypeRegistry';
import { styleService } from '../services/style.service';
import { customerService } from '../services/customer.service';
// Traditional BOM removed - Order BOM is now created from Cost Sheet
import { fabricStockService } from '../services/fabricStock.service';
import { fabricCostingService } from '../services/fabricCosting.service';
import { getRunsByStyle, getRunById, type CostingRun } from '../services/fabricCostingRun.service';
import { StyleCombobox } from '../components/StyleCombobox';
import type { CostingOption } from '../types/fabricCosting.types';
import type { Style } from '../types/style.types';
import type { Customer } from '../types/customer.types';
import type {
  FabricDetail,
  TrimDetail,
  LaceDetail,
  EmbroideryDetail,
  AccessoryDetail,
  CMTCosts,
} from '../types/costSheet.types';
import { notify } from '../lib/notify';
import { formatCurrency } from '../lib/currency';
import { Trash2, Plus, Sparkles, AlertCircle, RefreshCw, Link2, Unlink } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { CADStatusBadge, getCADWorkflowMessage, isCADApproved } from '../components/cad/CADStatusBadge';
import FabricCostingRow from '../components/cost-sheet/FabricCostingRow';
import LaceCostingSection from '../components/cost-sheet/LaceCostingSection';
import CostComparisonTable from '../components/cost-sheet/CostComparisonTable';
import type { FabricCostCalculationResult } from '../types/fabricCosting.types';
import { TrimMasterCombobox, type TrimMasterSelection } from '../components/TrimMasterCombobox';
import { useDefaultSettings } from '../hooks/useDefaultSettings';

const CostSheetForm = () => {
  // Lace wastage comes from the system defaults registry, never a literal.
  const { laceWastagePercent } = useDefaultSettings();
  const laceWastagePercentDefault = laceWastagePercent ?? 0;
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedStyleId = searchParams.get('styleId');
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [, setFabricWidthComparisons] = useState<Map<string, unknown>>(new Map());
  const [fabricCostResults] = useState<FabricCostCalculationResult[]>([]);
  // Costing mode selector - determines which fabric costing data to pull
  // Auto-select from localStorage preference
  const [costingMode, setCostingMode] = useState<'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION'>(() => {
    const saved = localStorage.getItem('costSheet.fabricCostingMode');
    if (saved === 'RAW_MATERIAL_CALCULATION' || saved === 'PRODUCTION') return saved;
    return 'COSTING';
  });

  // Save costing mode preference to localStorage
  const handleCostingModeChange = (mode: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION') => {
    setCostingMode(mode);
    localStorage.setItem('costSheet.fabricCostingMode', mode);
  };

  // Basic Information
  const [numberOfComponents, setNumberOfComponents] = useState<number>(0);
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');

  // Fabric Details (Dynamic)
  const [fabricDetails, setFabricDetails] = useState<FabricDetail[]>([
    { fabricName: '', fabricWidth: 0, fabricAverage: 0, fabricRate: 0, fabricTotal: 0 },
  ]);

  // Trims Details (Dynamic - Thread is default)
  const [trimsDetails, setTrimsDetails] = useState<TrimDetail[]>([
    { trimName: 'Thread', trimQuantity: 0, trimRate: 0, trimTotal: 0, materialType: 'THREAD' },
  ]);

  // Lace Details (Dynamic)
  const [laceDetails, setLaceDetails] = useState<LaceDetail[]>([]);

  // CMT Costs
  const [cmtCosts, setCmtCosts] = useState<CMTCosts>({
    cuttingCost: 0,
    stitchingCost: 0,
    finishingCost: 0,
    buttonAttachmentCost: 0,
    handworkCost: 0,
    smockingCost: 0,
  });

  // Embroidery Details (Dynamic)
  const [embroideryDetails, setEmbroideryDetails] = useState<EmbroideryDetail[]>([]);

  // Accessories Details (Dynamic)
  const [accessoriesDetails, setAccessoriesDetails] = useState<AccessoryDetail[]>([]);

  // Value Loss & Markup
  const [valueLossPercent, setValueLossPercent] = useState(2);
  const [markupPercent, setMarkupPercent] = useState(15);

  const [notes, setNotes] = useState('');
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  // BUG-CS7 fix: Track if cost sheet is approved to disable fields
  const [isApprovedCostSheet, setIsApprovedCostSheet] = useState(false);
  // Track if user has manually edited the form - prevents auto-population from overwriting changes
  const [hasUserEdited, setHasUserEdited] = useState(false);

  // Closed Cost - Final agreed price with customer (exclusive of tax)
  const [closedCost, setClosedCost] = useState<number | null>(null);
  const [closedCostNotes, setClosedCostNotes] = useState('');

  // Budget Tracking (for RAW_MATERIAL_CALCULATION/PRODUCTION direct procurement)
  const [enableBudgetTracking, setEnableBudgetTracking] = useState(false);
  const [budgetSource, setBudgetSource] = useState<'manual' | 'auto'>('manual');
  const [fabricBudget, setFabricBudget] = useState<number>(0);
  const [trimsBudget, setTrimsBudget] = useState<number>(0);
  const [cmtBudget, setCmtBudget] = useState<number>(0);
  const [embroideryBudget, setEmbroideryBudget] = useState<number>(0);
  const [accessoriesBudget, setAccessoriesBudget] = useState<number>(0);
  const [fabricBufferPercent, setFabricBufferPercent] = useState<number>(5);
  const [trimsBufferPercent, setTrimsBufferPercent] = useState<number>(10);
  const [cmtBufferPercent, setCmtBufferPercent] = useState<number>(5);
  const [embroideryBufferPercent, setEmbroideryBufferPercent] = useState<number>(8);
  const [accessoriesBufferPercent, setAccessoriesBufferPercent] = useState<number>(10);
  const [budgetSuggestions, setBudgetSuggestions] = useState<BudgetSuggestions | null>(null);
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  // Costing Runs (groups of fabric CADs from Fabric Costing page)
  const [costingRuns, setCostingRuns] = useState<CostingRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Track if style has lace in BOM (to conditionally show Lace section)
  const [styleHasLace, setStyleHasLace] = useState<boolean>(false);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await customerService.getAllCustomers({ page: 1, limit: 100 });
        setCustomers(response.data);
      } catch {
        notify.error('Failed to load customers');
      }
    };
    fetchCustomers();
  }, []);

  // Load existing cost sheet data when in edit mode
  // BUG-CS10 fix: prevent race condition in style loading
  useEffect(() => {
    if (!isEditMode || !id || initialDataLoaded) return;

    let cancelled = false;

    const loadCostSheet = async () => {
      setLoading(true);
      try {
        const costSheet = await getCostSheetById(id);

        // BUG-CS10 fix: prevent race condition in style loading
        if (cancelled) return;

        // BUG-CS7 fix: Block editing of approved cost sheets
        if (costSheet.approvalStatus === 'APPROVED' || costSheet.isApproved) {
          // BUG-CS7 fix: Set approved state immediately before redirect
          setIsApprovedCostSheet(true);
          notify.warning('Approved cost sheets cannot be edited. Create a new version instead.');
          navigate(`/cost-sheets/${id}`);
          return;
        }

        // Populate all form fields with existing data
        if (costSheet.fabricDetails && costSheet.fabricDetails.length > 0) {
          setFabricDetails(costSheet.fabricDetails);
        }
        if (costSheet.trimsDetails && costSheet.trimsDetails.length > 0) {
          setTrimsDetails(costSheet.trimsDetails);
        }
        // Lace rows are stored relationally and returned as `laceItems` (column names match
        // the LaceDetail type 1:1). `laceDetails` never existed on the response — checking it
        // silently discarded saved lace and rebuilt from BOM defaults on every edit.
        const savedLaceItems = (costSheet as { laceItems?: LaceDetail[] }).laceItems;
        if (savedLaceItems && savedLaceItems.length > 0) {
          setLaceDetails(
            savedLaceItems.map((l) => ({
              ...l,
              // Decimal columns arrive as strings; the form expects numbers
              width: l.width != null ? Number(l.width) : undefined,
              quantityPerGarment: Number(l.quantityPerGarment || 0),
              wastagePercent: Number(l.wastagePercent || 0),
              effectiveQuantity: Number(l.effectiveQuantity || 0),
              greigeCost: l.greigeCost != null ? Number(l.greigeCost) : undefined,
              processingCost: l.processingCost != null ? Number(l.processingCost) : undefined,
              readyLaceCost: l.readyLaceCost != null ? Number(l.readyLaceCost) : undefined,
              stockCost: l.stockCost != null ? Number(l.stockCost) : undefined,
              costPerMeter: Number(l.costPerMeter || 0),
              totalCost: Number(l.totalCost || 0),
            }))
          );
        }
        setCmtCosts({
          cuttingCost: costSheet.cuttingCost || 0,
          stitchingCost: costSheet.stitchingCost || 0,
          finishingCost: costSheet.finishingCost || 0,
          buttonAttachmentCost: costSheet.buttonAttachmentCost || 0,
          handworkCost: costSheet.handworkCmtCost || 0,
          smockingCost: costSheet.smockingCost || 0,
        });
        if (costSheet.embroideryDetails && costSheet.embroideryDetails.length > 0) {
          setEmbroideryDetails(costSheet.embroideryDetails);
        }
        if (costSheet.accessoriesDetails && costSheet.accessoriesDetails.length > 0) {
          // Auto-detect materialType for accessories missing it (legacy data fix)
          const enrichedAccessories = costSheet.accessoriesDetails.map((acc: AccessoryDetail) => {
            if (acc.materialType) return acc;
            // Detect type based on name patterns
            const name = (acc.accessoryName || '').toLowerCase();
            let detectedType: string | undefined;
            if (name.includes('label') || name.includes('tag') || name.includes('sticker')) {
              detectedType = 'LABEL';
            } else if (
              name.includes('bag') ||
              name.includes('box') ||
              name.includes('hanger') ||
              name.includes('tissue') ||
              name.includes('polybag')
            ) {
              detectedType = 'PACKAGING';
            }
            return { ...acc, materialType: detectedType };
          });
          setAccessoriesDetails(enrichedAccessories);
        }
        setValueLossPercent(costSheet.valueLossPercent || 2);
        setMarkupPercent(costSheet.markupPercent || 15);
        setNotes(costSheet.notes || '');
        setClosedCost(costSheet.closedCost || null);
        setClosedCostNotes(costSheet.closedCostNotes || '');
        setNumberOfComponents(costSheet.numberOfComponents || 0);
        setCategory(costSheet.category || '');
        setSubCategory(costSheet.subCategory || '');

        // Set costing mode from loaded cost sheet (default to COSTING if not set)
        if (costSheet.purpose) {
          setCostingMode(costSheet.purpose as 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION');
        }

        // Set style ID and fetch full style details (including CAD status)
        if (costSheet.styleId) {
          setSelectedStyleId(costSheet.styleId);

          // Fetch full style details to get CAD status and other info
          try {
            const fullStyleDetails = await styleService.getStyleById(costSheet.styleId);

            // BUG-CS10 fix: prevent race condition in style loading
            if (cancelled) return;

            setSelectedStyle(fullStyleDetails);

            // Populate customer/brand display fields (also for edit mode)
            if (fullStyleDetails.customerName) {
              const matchedCustomer = customers.find(
                (c) => c.name.toLowerCase() === fullStyleDetails.customerName?.toLowerCase()
              );
              if (matchedCustomer) {
                setSelectedCustomerId(matchedCustomer.id); // Fix: Set customer ID so style selector shows the style
              }
            }

            // If accessories/trims/embroidery are empty in saved cost sheet,
            // extract them from the style's styleMaterialBom
            if (fullStyleDetails.styleMaterialBom && fullStyleDetails.styleMaterialBom.length > 0) {
              const extractedTrims: TrimDetail[] = [];
              const extractedAccessories: AccessoryDetail[] = [];
              const extractedEmbroidery: EmbroideryDetail[] = [];
              const extractedLaces: LaceDetail[] = [];

              // Capture existing lace IDs from loaded cost sheet to avoid duplicates
              // (saved lace rows come back as the relational `laceItems`)
              const savedLaces = ((costSheet as { laceItems?: LaceDetail[] }).laceItems || []) as LaceDetail[];
              const existingLaceIds = new Set(savedLaces.map((l: LaceDetail) => l.laceId));

              // Helper function to get unit based on material type
              const getUnitForMaterialType = (materialType: string): string => {
                const unitMapping: Record<string, string> = {
                  BUTTON: 'pcs',
                  ZIPPER: 'pcs',
                  THREAD: 'cone',
                  LACE: 'meters',
                  ELASTIC: 'meters',
                  LABEL: 'pcs',
                  HOOK_EYE: 'pair',
                  SNAP_BUTTON: 'pcs',
                  BUCKLE: 'pcs',
                  BELT: 'pcs',
                  VELCRO: 'meters',
                  DRAWSTRING: 'meters',
                  RIBBON: 'meters',
                  SEQUIN: 'pcs',
                  BEAD: 'pcs',
                  MOTIF: 'pcs',
                  INTERLINING: 'meters',
                  PADDING: 'meters',
                  OTHER_FASTENER: 'pcs',
                  OTHER_TAPE: 'meters',
                  OTHER_DECORATIVE: 'pcs',
                  OTHER_FUNCTIONAL: 'pcs',
                  PACKAGING: 'pcs',
                };
                return unitMapping[materialType] || 'pcs';
              };

              // Data-driven master extraction config (legacy + generic trims)
              const masterExtractors: Array<{ masterKey: string; nameField: string; priceField: string }> = [
                { masterKey: 'laceMaster', nameField: 'laceName', priceField: 'pricePerMeter' },
                { masterKey: 'buttonMaster', nameField: 'buttonName', priceField: 'pricePerPiece' },
                { masterKey: 'threadMaster', nameField: 'threadName', priceField: 'pricePerCone' },
                { masterKey: 'zipperMaster', nameField: 'zipperName', priceField: 'pricePerPiece' },
                { masterKey: 'elasticMaster', nameField: 'elasticName', priceField: 'pricePerMeter' },
                { masterKey: 'labelMaster', nameField: 'labelName', priceField: 'pricePerPiece' },
                { masterKey: 'packagingMaster', nameField: 'packagingName', priceField: 'pricePerPiece' },
                { masterKey: 'machinePartMaster', nameField: 'partName', priceField: 'costPerPiece' },
                { masterKey: 'otherMaterialMaster', nameField: 'materialName', priceField: 'costPerUnit' },
                // Generic trim masters
                { masterKey: 'hookEyeMaster', nameField: 'hookEyeName', priceField: 'pricePerPair' },
                { masterKey: 'snapButtonMaster', nameField: 'snapButtonName', priceField: 'pricePerPiece' },
                { masterKey: 'buckleMaster', nameField: 'buckleName', priceField: 'pricePerPiece' },
                { masterKey: 'beltMaster', nameField: 'beltName', priceField: 'pricePerPiece' },
                { masterKey: 'velcroMaster', nameField: 'velcroName', priceField: 'pricePerMeter' },
                { masterKey: 'drawstringMaster', nameField: 'drawstringName', priceField: 'pricePerMeter' },
                { masterKey: 'ribbonMaster', nameField: 'ribbonName', priceField: 'pricePerMeter' },
                { masterKey: 'sequinMaster', nameField: 'sequinName', priceField: 'pricePerMeter' },
                { masterKey: 'beadMaster', nameField: 'beadName', priceField: 'pricePerPack' },
                { masterKey: 'motifMaster', nameField: 'motifName', priceField: 'pricePerPiece' },
                { masterKey: 'interliningMaster', nameField: 'interliningName', priceField: 'pricePerMeter' },
                { masterKey: 'paddingMaster', nameField: 'paddingName', priceField: 'pricePerPair' },
                { masterKey: 'otherFastenerMaster', nameField: 'otherFastenerName', priceField: 'pricePerPiece' },
                { masterKey: 'otherTapeMaster', nameField: 'otherTapeName', priceField: 'pricePerMeter' },
                { masterKey: 'otherDecorativeMaster', nameField: 'otherDecorativeName', priceField: 'pricePerPiece' },
                { masterKey: 'otherFunctionalMaster', nameField: 'otherFunctionalName', priceField: 'pricePerPiece' },
              ];

              for (const bom of fullStyleDetails.styleMaterialBom) {
                // Type assertion for flexible property access
                const bomAny = bom as unknown as Record<string, unknown>;

                // Data-driven: find the first populated master relation
                let materialName: string = (bom.componentName as string) || (bom.materialType as string) || 'Unknown';
                let masterPrice: number | unknown = 0;

                for (const ext of masterExtractors) {
                  const master = bomAny[ext.masterKey] as Record<string, unknown> | undefined;
                  if (master) {
                    materialName = String(master[ext.nameField] || materialName);
                    masterPrice = master[ext.priceField] || 0;
                    break;
                  }
                }

                // Keep legacy variable for LACE special handling below
                const laceMaster = bomAny.laceMaster as Record<string, unknown> | undefined;

                const materialType = (bom.materialType as string) || 'UNKNOWN';
                const quantity = bom.quantityPerGarment || 0;
                const rate = bom.unitPrice || Number(masterPrice) || 0;
                const total = quantity * rate;
                const unit = (bom.unit as string) || getUnitForMaterialType(materialType);
                const bomId = bom.id as string;

                // ============================================
                // LACE EXTRACTION - Check materialType FIRST
                // Laces need special handling for 3 sourcing strategies
                // ============================================
                if (materialType === 'LACE' && laceMaster) {
                  const laceId = (bomAny.laceId as string) || (laceMaster.id as string);

                  // Skip if already loaded from saved cost sheet
                  if (existingLaceIds.has(laceId)) {
                    continue;
                  }

                  const quantityPerGarment = bom.quantityPerGarment || 0;
                  const wastagePercent = laceWastagePercentDefault;
                  const effectiveQuantity = quantityPerGarment * (1 + wastagePercent / 100);
                  const costPerMeter = Number(laceMaster.pricePerMeter) || 0;
                  const totalCost = effectiveQuantity * costPerMeter;

                  extractedLaces.push({
                    laceId: laceId,
                    laceName: String(laceMaster.laceName || 'Unknown Lace'),
                    colorName: laceMaster.color ? String(laceMaster.color) : undefined,
                    width: laceMaster.width ? Number(laceMaster.width) : undefined,
                    quantityPerGarment: quantityPerGarment,
                    wastagePercent: wastagePercent,
                    effectiveQuantity: effectiveQuantity,
                    sourcingStrategy: 'READY_LACE', // Default strategy
                    costPerMeter: costPerMeter,
                    totalCost: totalCost,
                  });

                  continue; // Skip usageCategory routing for LACE items
                }

                // Route to appropriate category based on usageCategory
                if (bom.usageCategory === 'GARMENT_TRIM') {
                  extractedTrims.push({
                    trimName: String(materialName),
                    trimQuantity: quantity,
                    trimRate: rate,
                    trimTotal: total,
                    unit,
                    bomId,
                    materialType,
                    // Preserve master IDs from style_material_bom (legacy)
                    threadId: bomAny.threadId as string | undefined,
                    buttonId: bomAny.buttonId as string | undefined,
                    zipperId: bomAny.zipperId as string | undefined,
                    elasticId: bomAny.elasticId as string | undefined,
                    labelId: bomAny.labelId as string | undefined,
                    packagingId: bomAny.packagingId as string | undefined,
                    materialId: bomAny.materialId as string | undefined,
                    // Generic trim FK IDs
                    hookEyeId: bomAny.hookEyeId as string | undefined,
                    snapButtonId: bomAny.snapButtonId as string | undefined,
                    buckleId: bomAny.buckleId as string | undefined,
                    beltId: bomAny.beltId as string | undefined,
                    velcroId: bomAny.velcroId as string | undefined,
                    drawstringId: bomAny.drawstringId as string | undefined,
                    ribbonId: bomAny.ribbonId as string | undefined,
                    sequinId: bomAny.sequinId as string | undefined,
                    beadId: bomAny.beadId as string | undefined,
                    motifId: bomAny.motifId as string | undefined,
                    interliningId: bomAny.interliningId as string | undefined,
                    paddingId: bomAny.paddingId as string | undefined,
                    otherFastenerId: bomAny.otherFastenerId as string | undefined,
                    otherTapeId: bomAny.otherTapeId as string | undefined,
                    otherDecorativeId: bomAny.otherDecorativeId as string | undefined,
                    otherFunctionalId: bomAny.otherFunctionalId as string | undefined,
                  });
                } else if (bom.usageCategory === 'PACKAGING') {
                  extractedAccessories.push({
                    accessoryName: String(materialName),
                    accessoryQuantity: quantity,
                    accessoryRate: rate,
                    accessoryTotal: total,
                    // Preserve master IDs from style_material_bom
                    labelId: bomAny.labelId as string | undefined,
                    packagingId: bomAny.packagingId as string | undefined,
                    materialId: bomAny.materialId as string | undefined,
                    materialType,
                  });
                } else if (bom.usageCategory === 'VALUE_ADDITION') {
                  extractedEmbroidery.push({
                    embroideryName: String(materialName),
                    embroideryAverage: quantity,
                    embroideryRate: rate,
                    embroideryTotal: total,
                  });
                } else {
                  // Uncategorized defaults to trims
                  extractedTrims.push({
                    trimName: String(materialName),
                    trimQuantity: quantity,
                    trimRate: rate,
                    trimTotal: total,
                    unit,
                    bomId,
                    materialType,
                  });
                }
              }

              // Only populate if the saved cost sheet doesn't have these items
              if ((!costSheet.trimsDetails || costSheet.trimsDetails.length === 0) && extractedTrims.length > 0) {
                setTrimsDetails(extractedTrims);
              }
              if (
                (!costSheet.accessoriesDetails || costSheet.accessoriesDetails.length === 0) &&
                extractedAccessories.length > 0
              ) {
                setAccessoriesDetails(extractedAccessories);
              }
              if (
                (!costSheet.embroideryDetails || costSheet.embroideryDetails.length === 0) &&
                extractedEmbroidery.length > 0
              ) {
                setEmbroideryDetails(extractedEmbroidery);
              }
              if (savedLaces.length === 0 && extractedLaces.length > 0) {
                setLaceDetails(extractedLaces);
              }
            }
          } catch (styleError) {
            console.error('Failed to load full style details:', styleError);
            // Fallback to basic style from cost sheet
            if (costSheet.style) {
              setSelectedStyle(costSheet.style as Style);
            }
          }
        }

        setInitialDataLoaded(true);
        notify.success('Cost sheet loaded successfully');
      } catch (error) {
        console.error('Failed to load cost sheet:', error);
        notify.error('Failed to load cost sheet');
        navigate('/cost-sheets');
      } finally {
        // BUG-CS10 fix: only update loading if not cancelled
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadCostSheet();

    // BUG-CS10 fix: cleanup to prevent race condition in style loading
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode, initialDataLoaded, navigate]);

  // Set customer in edit mode once customers and selectedStyle are loaded
  useEffect(() => {
    if (!isEditMode || !selectedStyle || customers.length === 0 || selectedCustomerId) return;

    // Find and set the customer based on style's customerName
    if (selectedStyle.customerName) {
      const matchingCustomer = customers.find(
        (c) => c.name.toLowerCase() === selectedStyle.customerName?.toLowerCase()
      );
      if (matchingCustomer) {
        setSelectedCustomerId(matchingCustomer.id);
      }
    }
  }, [isEditMode, selectedStyle, customers, selectedCustomerId]);

  // State to track pending styleId selection (set after styles load)
  const [pendingStyleId, setPendingStyleId] = useState<string | null>(null);

  // Handle preselected styleId from URL query params (e.g., from Fabric Costing page)
  // BUG-CS10 fix: prevent race condition in style loading
  useEffect(() => {
    if (!preselectedStyleId || isEditMode || customers.length === 0) return;

    let cancelled = false;

    const loadPreselectedStyle = async () => {
      try {
        // Fetch the style to get its customer name
        const styleDetails = await styleService.getStyleById(preselectedStyleId);

        // BUG-CS10 fix: prevent race condition in style loading
        if (cancelled || !styleDetails) return;

        // Find customer by matching customerName (style only has customerName string, not customer object)
        if (styleDetails.customerName) {
          const matchingCustomer = customers.find(
            (c) => c.name.toLowerCase() === styleDetails.customerName?.toLowerCase()
          );
          if (matchingCustomer) {
            // Set customer first, which will trigger styles fetch
            setSelectedCustomerId(matchingCustomer.id);
            // Store styleId to set after styles are loaded
            setPendingStyleId(preselectedStyleId);
            return;
          }
        }

        // Fallback: If no customer match, try to set styleId directly
        // (This might not work well since style dropdown depends on customer)
        setSelectedStyleId(preselectedStyleId);
      } catch (error) {
        console.error('Failed to load preselected style:', error);
        // Don't show error notification for invalid styleId - just ignore silently
      }
    };

    loadPreselectedStyle();

    // BUG-CS10 fix: cleanup to prevent race condition in style loading
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedStyleId, isEditMode, customers.length]);

  // Set pending styleId once styles are loaded
  useEffect(() => {
    if (pendingStyleId && styles.length > 0) {
      // Check if the style exists in the loaded styles
      const styleExists = styles.some((s) => s.id === pendingStyleId);
      if (styleExists) {
        setSelectedStyleId(pendingStyleId);
      }
      setPendingStyleId(null);
    }
  }, [pendingStyleId, styles]);

  // Fetch styles when customer is selected
  useEffect(() => {
    const fetchStyles = async () => {
      if (!selectedCustomerId) {
        setStyles([]);
        // Only clear style selection in create mode, not edit mode
        // In edit mode, styleId is loaded from the existing cost sheet
        if (!isEditMode) {
          setSelectedStyleId('');
        }
        return;
      }

      try {
        // Get the selected customer's name
        const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
        if (!selectedCustomer) {
          setStyles([]);
          return;
        }

        // Fetch styles filtered by customer name using API parameter
        const response = await styleService.getAllStyles(
          1,
          1000,
          undefined, // search
          undefined, // stage
          undefined, // cadStatus
          selectedCustomer.name, // customerName
          'ACTIVE' // status - only show published styles
        );
        setStyles(response.data);
      } catch (error: unknown) {
        console.error('Failed to load styles:', error);
        notify.error('Failed to load styles');
      }
    };
    fetchStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, customers]);

  // Track if mode change is from auto-detection (to avoid double fetch)
  const isAutoModeChange = useRef(false);

  // Fetch costing runs when style is selected
  // Auto-detect mode with priority: PRODUCTION > RAW_MATERIAL_CALCULATION > COSTING
  useEffect(() => {
    const fetchCostingRuns = async () => {
      if (!selectedStyleId) {
        setCostingRuns([]);
        setSelectedRunId(null);
        return;
      }

      try {
        setLoadingRuns(true);

        // Check all modes for available runs with priority order
        const modePriority: Array<'PRODUCTION' | 'RAW_MATERIAL_CALCULATION' | 'COSTING'> = [
          'PRODUCTION',
          'RAW_MATERIAL_CALCULATION',
          'COSTING',
        ];

        let bestMode = costingMode;
        let bestRuns: CostingRun[] = [];

        // Check each mode in priority order
        for (const mode of modePriority) {
          const runs = await getRunsByStyle(selectedStyleId, mode);
          if (runs.length > 0) {
            bestMode = mode;
            bestRuns = runs;
            break; // Found runs in highest priority mode
          }
        }

        // If best mode differs from current, switch to it
        if (bestMode !== costingMode && bestRuns.length > 0) {
          isAutoModeChange.current = true;
          handleCostingModeChange(bestMode);
        }

        // If no runs found in any mode, fetch for current mode (will be empty)
        if (bestRuns.length === 0) {
          bestRuns = await getRunsByStyle(selectedStyleId, costingMode);
        }

        setCostingRuns(bestRuns);
        setSelectedRunId(null);
      } catch (error) {
        console.error('Failed to fetch costing runs:', error);
        setCostingRuns([]);
      } finally {
        setLoadingRuns(false);
      }
    };

    fetchCostingRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyleId]); // Only trigger on style change

  // Refetch runs when mode is manually changed (not auto-detected)
  useEffect(() => {
    // Skip if this is an auto mode change (already fetched in style effect)
    if (isAutoModeChange.current) {
      isAutoModeChange.current = false;
      return;
    }

    const fetchRunsForMode = async () => {
      if (!selectedStyleId) return;

      try {
        const runs = await getRunsByStyle(selectedStyleId, costingMode);
        setCostingRuns(runs);
        setSelectedRunId(null);
      } catch (error) {
        console.error('Failed to fetch costing runs:', error);
        setCostingRuns([]);
      }
    };

    fetchRunsForMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costingMode]);

  // Fetch style details when style is selected and auto-populate data
  // Skip if user has manually edited (unless style itself changed, which resets hasUserEdited)
  useEffect(() => {
    let cancelled = false;

    const fetchStyleDetails = async () => {
      // Skip auto-population if user has manually edited the form
      // This prevents error retry or mode change from wiping user's work
      if (hasUserEdited) {
        return;
      }
      if (selectedStyleId && !isEditMode) {
        try {
          const styleDetails = await styleService.getStyleById(selectedStyleId);

          if (cancelled) {
            return;
          }

          setSelectedStyle(styleDetails);

          // Track what was populated
          const populated: string[] = [];
          let fabricsWithoutRate = 0;
          let ratesFromCosting = 0; // Rates fetched from approved costing options
          let ratesFromStock = 0; // Rates fetched from stock inventory lookup

          // Auto-populate basic information from style
          if (styleDetails.numberOfComponents) {
            setNumberOfComponents(styleDetails.numberOfComponents);
            populated.push(`${styleDetails.numberOfComponents} components`);
          }

          // Auto-populate category information
          if (styleDetails.brandCategories) {
            setCategory(styleDetails.brandCategories.category || '');
            setSubCategory(styleDetails.brandCategories.subCategory || '');
            populated.push('category info');
          } else if (styleDetails.specifications) {
            setCategory(styleDetails.specifications);
            populated.push('category info');
          }

          // Auto-populate customer/brand display fields
          // Match style.customerName to customers list to get full customer info
          // Auto-populate fabric details from style components
          if (styleDetails.components && styleDetails.components.length > 0) {
            const fabricDetailsFromStyle: FabricDetail[] = [];
            const widthComparisonsMap = new Map<string, unknown>();

            // First, fetch approved fabric costing for this style (filtered by selected mode)
            let costingOptions: Record<string, CostingOption[]> = {};
            let modeHasData = false; // Track if selected mode has any costing data
            try {
              const costingResponse = await fabricCostingService.getStyleCostingOptions(selectedStyleId, costingMode);
              // BUG-CS10 FIX: Check cancellation after async operation to prevent race condition
              if (cancelled) return;
              if (costingResponse.success && costingResponse.data) {
                costingOptions = costingResponse.data;
                modeHasData = Object.keys(costingOptions).length > 0;
              }
            } catch (error) {
              if (cancelled) return;
              console.warn(`No fabric costing found for style in ${costingMode} mode:`, error);
            }

            // Collect all fabric IDs to fetch rates in parallel (fallback only)
            const fabricRateFetchPromises: Promise<void>[] = [];

            for (const component of styleDetails.components) {
              if (component.fabrics && component.fabrics.length > 0) {
                for (const fabric of component.fabrics) {
                  // Initialize with defaults - only populate if mode has data or COSTING mode
                  let fabricRate = 0;
                  let fabricAverage = 0;

                  // For COSTING mode OR when mode has data, try to find approved options
                  if (modeHasData || costingMode === 'COSTING') {
                    // Set initial CAD value from style
                    fabricAverage = fabric.cadAverageMeters || fabric.quantityNeeded || 0;

                    // Backend groups embroidered fabrics as "ComponentName - Embroidered"
                    let componentKey = component.componentName;
                    if (fabric.hasEmbroidery) {
                      componentKey = `${component.componentName} - Embroidered`;
                    }

                    // IMPROVED MATCHING: Try component first, then fabricId, then 'unknown' fallback

                    // Step 1: Try component-based matching (without 'unknown' fallback)
                    // Ensure we always get an array, never null/undefined
                    const rawOptions = costingOptions[componentKey] || costingOptions[component.componentName];
                    const componentCostingOptions = Array.isArray(rawOptions) ? rawOptions : [];

                    // PART 2.9 FIX: Get ALL approved options, not just the first one
                    // This ensures multiple processor options appear as separate rows
                    let approvedOptions: CostingOption[] = [];

                    if (componentCostingOptions.length > 0) {
                      approvedOptions = componentCostingOptions.filter(
                        (opt: CostingOption) => opt.isPreferred || opt.approvalStatus === 'APPROVED'
                      );
                    }

                    // Step 2: If no component match, try to find by fabricId OR styleFabricId across all options
                    if (approvedOptions.length === 0 && (fabric.fabricId || fabric.id)) {
                      for (const [, options] of Object.entries(costingOptions)) {
                        // Ensure options is an array before filtering
                        if (!Array.isArray(options)) continue;
                        const matchByIds = options.filter(
                          (opt: CostingOption) =>
                            ((opt.fabricId && opt.fabricId === fabric.fabricId) ||
                              (opt.styleFabricId && opt.styleFabricId === fabric.id)) &&
                            (opt.isPreferred || opt.approvalStatus === 'APPROVED')
                        );
                        if (matchByIds.length > 0) {
                          approvedOptions = matchByIds;
                          break;
                        }
                      }
                    }

                    // Step 3: Only use 'unknown' fallback if nothing else matched
                    if (approvedOptions.length === 0) {
                      const rawUnknown = costingOptions['unknown'] || costingOptions['Unknown'];
                      const unknownOptions = Array.isArray(rawUnknown) ? rawUnknown : [];
                      approvedOptions = unknownOptions.filter(
                        (opt: CostingOption) => opt.isPreferred || opt.approvalStatus === 'APPROVED'
                      );
                    }

                    // If we have approved options, create a fabric row for EACH option
                    if (approvedOptions.length > 0) {
                      for (const opt of approvedOptions) {
                        const optFabricRate = opt.totalCostPerMeter ? Number(opt.totalCostPerMeter) : 0;
                        const optFabricAverage = opt.cadAverage
                          ? Number(opt.cadAverage)
                          : fabric.cadAverageMeters || fabric.quantityNeeded || 0;

                        if (optFabricRate > 0) {
                          ratesFromCosting++;
                        } else {
                          fabricsWithoutRate++;
                        }

                        fabricDetailsFromStyle.push({
                          fabricName: fabric.genericGreigeName || fabric.fabricName || '',
                          fabricWidth: opt.cutableWidth
                            ? Number(opt.cutableWidth)
                            : fabric.fabricWidth
                              ? Number(fabric.fabricWidth)
                              : fabric.cutableWidth
                                ? Number(fabric.cutableWidth)
                                : 0,
                          fabricAverage: optFabricAverage,
                          fabricRate: optFabricRate,
                          fabricTotal: optFabricAverage * optFabricRate,
                          fabricId: fabric.fabricId ?? undefined,
                          // Carry sourcing strategy from fabric costing
                          sourcingStrategy: opt.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
                          processorId: opt.processorId ?? undefined,
                          greigeCost: opt.greigeCostPerMeter ? Number(opt.greigeCostPerMeter) : undefined,
                          processingCost: opt.processingPricePerMeter ? Number(opt.processingPricePerMeter) : undefined,
                          isAutoPopulated: true,
                        });
                      }

                      // Build fabric width comparisons if CAD averages exist
                      if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                        widthComparisonsMap.set(fabric.fabricName, {
                          fabricName: fabric.fabricName,
                          cadAverages: fabric.cadAverages,
                        });
                      }

                      continue; // Skip the fallback logic below - we've added all approved options
                    }

                    // No approved costing options found - fallback to unitPrice for COSTING mode (backward compatibility)
                    if (!fabricRate && costingMode === 'COSTING') {
                      fabricRate = fabric.unitPrice || 0;
                    }
                  }
                  // For RAW_MATERIAL_CALCULATION and PRODUCTION modes with NO data:
                  // fabricRate and fabricAverage stay at 0 (don't use COSTING fallbacks)

                  // 3. Fallback to stock lookup - ONLY for COSTING mode (backward compatibility)
                  if (!fabricRate && fabric.fabricId && costingMode === 'COSTING') {
                    const fabricId = fabric.fabricId;
                    const fabricIndex = fabricDetailsFromStyle.length; // Track index for updating later

                    // Create placeholder entry
                    fabricDetailsFromStyle.push({
                      fabricName: fabric.genericGreigeName || fabric.fabricName || '',
                      fabricWidth: fabric.fabricWidth
                        ? Number(fabric.fabricWidth)
                        : fabric.cutableWidth
                          ? Number(fabric.cutableWidth)
                          : 0,
                      fabricAverage: fabricAverage,
                      fabricRate: 0, // Placeholder, will be updated
                      fabricTotal: 0,
                      fabricId: fabric.fabricId ?? undefined, // Include fabricId for sourcing strategy
                      isAutoPopulated: true,
                    });

                    // Fetch rate asynchronously from stock (fallback)
                    const fetchPromise = fabricStockService
                      .getStockByFabricId(fabricId)
                      .then((stockEntries) => {
                        if (stockEntries && stockEntries.length > 0) {
                          // Use weighted average cost from the first (most recent) stock entry
                          const latestStock = stockEntries[0];
                          const rate = latestStock.weightedAvgCost || latestStock.purchaseCost || 0;
                          if (rate > 0) {
                            fabricDetailsFromStyle[fabricIndex].fabricRate = rate;
                            fabricDetailsFromStyle[fabricIndex].fabricTotal = fabricAverage * rate;
                            ratesFromStock++; // Track as coming from stock
                          } else {
                            fabricsWithoutRate++;
                          }
                        } else {
                          fabricsWithoutRate++;
                        }
                      })
                      .catch((error) => {
                        console.error(`Failed to fetch rate for fabric ${fabricId}:`, error);
                        fabricsWithoutRate++;
                      });

                    fabricRateFetchPromises.push(fetchPromise);
                    continue; // Skip the push below since we already added it
                  }

                  // Mark as needing rate if still 0
                  if (!fabricRate) {
                    fabricsWithoutRate++;
                  }

                  fabricDetailsFromStyle.push({
                    fabricName: fabric.genericGreigeName || fabric.fabricName || '',
                    fabricWidth: fabric.fabricWidth
                      ? Number(fabric.fabricWidth)
                      : fabric.cutableWidth
                        ? Number(fabric.cutableWidth)
                        : 0,
                    fabricAverage: fabricAverage,
                    fabricRate: fabricRate,
                    fabricTotal: fabricAverage * fabricRate,
                    fabricId: fabric.fabricId ?? undefined, // Include fabricId for sourcing strategy
                    isAutoPopulated: true,
                  });

                  // Build fabric width comparisons if CAD averages exist
                  if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                    widthComparisonsMap.set(fabric.fabricName, {
                      fabricName: fabric.fabricName,
                      cadAverages: fabric.cadAverages,
                    });
                  }
                }
              }
            }

            // Wait for all rate fetches to complete
            await Promise.all(fabricRateFetchPromises);

            // BUG-CS10 FIX: Check cancellation after all async operations complete
            if (cancelled) return;

            // Show warning for non-COSTING modes when no costing data exists
            if (!modeHasData && costingMode !== 'COSTING') {
              const modeName = costingMode.replace(/_/g, ' ').toLowerCase();
              notify.warning(
                `No ${modeName} costing data found. Complete Fabric Costing in ${costingMode.replace(/_/g, ' ')} mode first.`,
                { duration: 6000 }
              );
            }

            if (fabricDetailsFromStyle.length > 0) {
              // BUG-FIX: Filter out invalid fabric rows BEFORE deduplication
              // Invalid rows have: no CAD average (0), no fabricId, and no rate
              // These come from duplicate style_fabrics entries that don't match any CAD data
              const validFabrics = fabricDetailsFromStyle.filter(
                (f) => f.fabricAverage > 0 || f.fabricId || f.fabricRate > 0
              );

              // PART 2.10 FIX: Deduplicate fabric rows that have identical values
              // This handles cases where multiple style components resolve to the same costing options
              // (e.g., "Body" and "Body - Embroidered" both matching the same approved options)
              // BUG-CS11 fix: refined duplicate detection
              // Only use IDENTITY fields (fabricId, name, width, sourcing, processor) for deduplication
              // Exclude calculated values (fabricRate, fabricAverage) which can differ for the same fabric
              // from different costing sources but should still be treated as one fabric entry
              const seenFabricKeys = new Set<string>();
              const deduplicatedFabrics: FabricDetail[] = [];

              for (const fabric of validFabrics) {
                // Create unique key using IDENTITY fields only
                // fabricId is primary identifier; if absent, use fabricName + fabricWidth
                // Include sourcingStrategy and processorId as they represent different procurement paths
                const identityPart = fabric.fabricId ? fabric.fabricId : `${fabric.fabricName}-${fabric.fabricWidth}`;
                const fabricKey = `${identityPart}-${fabric.sourcingStrategy || ''}-${fabric.processorId || ''}`;

                if (!seenFabricKeys.has(fabricKey)) {
                  seenFabricKeys.add(fabricKey);
                  deduplicatedFabrics.push(fabric);
                }
              }

              // Use deduplicated list
              setFabricDetails(deduplicatedFabrics);
              setFabricWidthComparisons(widthComparisonsMap);

              // Recalculate fabricsWithoutRate based on final deduplicated list
              // (the original counter includes invalid/filtered fabrics)
              fabricsWithoutRate = deduplicatedFabrics.filter((f) => f.fabricRate === 0).length;

              const ratesMessage = [];
              if (ratesFromCosting > 0) {
                ratesMessage.push(`${ratesFromCosting} from costing`);
              }
              if (ratesFromStock > 0) {
                ratesMessage.push(`${ratesFromStock} from stock`);
              }
              if (fabricsWithoutRate > 0) {
                ratesMessage.push(`${fabricsWithoutRate} need rate`);
              }

              // Show count with info about filtered/deduplicated items
              const invalidCount = fabricDetailsFromStyle.length - validFabrics.length;
              const duplicateCount = validFabrics.length - deduplicatedFabrics.length;
              const removedParts: string[] = [];
              if (invalidCount > 0) removedParts.push(`${invalidCount} invalid`);
              if (duplicateCount > 0) removedParts.push(`${duplicateCount} duplicate`);
              const fabricCountMsg =
                removedParts.length > 0
                  ? `${deduplicatedFabrics.length} fabrics (${removedParts.join(', ')} removed)`
                  : `${deduplicatedFabrics.length} fabrics`;

              if (ratesMessage.length > 0) {
                populated.push(`${fabricCountMsg} (${ratesMessage.join(', ')})`);
              } else {
                populated.push(`${fabricCountMsg} with rates`);
              }
            }
          }

          // Extract trims, accessories, and embroidery from styleMaterialBom
          if (styleDetails.styleMaterialBom && styleDetails.styleMaterialBom.length > 0) {
            const extractedTrims: TrimDetail[] = [];
            const extractedAccessories: AccessoryDetail[] = [];
            const extractedEmbroidery: EmbroideryDetail[] = [];
            const extractedLaces: LaceDetail[] = [];

            // Capture existing lace IDs to avoid duplicates with manually added laces
            const existingLaceIds = new Set(laceDetails.map((l) => l.laceId));

            // Helper function to get unit based on material type
            const getUnitForMaterialType = (materialType: string): string => {
              const unitMapping: Record<string, string> = {
                BUTTON: 'pcs',
                ZIPPER: 'pcs',
                THREAD: 'cone',
                LACE: 'meters',
                ELASTIC: 'meters',
                LABEL: 'pcs',
                HOOK_EYE: 'pair',
                SNAP_BUTTON: 'pcs',
                BUCKLE: 'pcs',
                BELT: 'pcs',
                VELCRO: 'meters',
                DRAWSTRING: 'meters',
                RIBBON: 'meters',
                SEQUIN: 'pcs',
                BEAD: 'pcs',
                MOTIF: 'pcs',
                INTERLINING: 'meters',
                PADDING: 'meters',
                OTHER_FASTENER: 'pcs',
                OTHER_TAPE: 'meters',
                OTHER_DECORATIVE: 'pcs',
                OTHER_FUNCTIONAL: 'pcs',
                PACKAGING: 'pcs',
              };
              return unitMapping[materialType] || 'pcs';
            };

            for (const bom of styleDetails.styleMaterialBom) {
              // Type assertion for flexible property access
              const bomAny = bom as unknown as Record<string, unknown>;

              // Get master relations (camelCase from serializer)
              const laceMaster = bomAny.laceMaster as Record<string, unknown> | undefined;
              const buttonMaster = bomAny.buttonMaster as Record<string, unknown> | undefined;
              const threadMaster = bomAny.threadMaster as Record<string, unknown> | undefined;
              const zipperMaster = bomAny.zipperMaster as Record<string, unknown> | undefined;
              const elasticMaster = bomAny.elasticMaster as Record<string, unknown> | undefined;
              const labelMaster = bomAny.labelMaster as Record<string, unknown> | undefined;
              const packagingMaster = bomAny.packagingMaster as Record<string, unknown> | undefined;
              const machinePartMaster = bomAny.machinePartMaster as Record<string, unknown> | undefined;
              const otherMaterialMaster = bomAny.otherMaterialMaster as Record<string, unknown> | undefined;

              // Get material name from appropriate master
              const materialName =
                laceMaster?.laceName ||
                buttonMaster?.buttonName ||
                threadMaster?.threadName ||
                zipperMaster?.zipperName ||
                elasticMaster?.elasticName ||
                labelMaster?.labelName ||
                packagingMaster?.packagingName ||
                machinePartMaster?.partName ||
                otherMaterialMaster?.materialName ||
                bom.componentName ||
                bom.materialType ||
                'Unknown';

              // Get price from BOM or fallback to master price
              const masterPrice =
                laceMaster?.pricePerMeter ||
                buttonMaster?.pricePerPiece ||
                threadMaster?.pricePerCone ||
                zipperMaster?.pricePerPiece ||
                elasticMaster?.pricePerMeter ||
                labelMaster?.pricePerPiece ||
                packagingMaster?.pricePerPiece ||
                machinePartMaster?.costPerPiece ||
                otherMaterialMaster?.costPerUnit ||
                0;

              const materialType = (bom.materialType as string) || 'UNKNOWN';
              // Default quantity to 1 for accessories/labels (not 0)
              const quantity = bom.quantityPerGarment || 1;
              // Prioritize master price over BOM unitPrice (master is source of truth)
              const rate = (masterPrice as number) || bom.unitPrice || 0;
              const total = quantity * rate;
              const unit = (bom.unit as string) || getUnitForMaterialType(materialType);
              const bomId = bom.id as string;

              // ============================================
              // LACE EXTRACTION - Check materialType FIRST
              // Laces need special handling for 3 sourcing strategies
              // ============================================
              if (materialType === 'LACE' && laceMaster) {
                const laceId = (bomAny.laceId as string) || (laceMaster.id as string);

                // Skip if already in laceDetails (avoid duplicates with manually added laces)
                if (existingLaceIds.has(laceId)) {
                  continue;
                }

                const quantityPerGarment = bom.quantityPerGarment || 0;
                const wastagePercent = laceWastagePercentDefault;
                const effectiveQuantity = quantityPerGarment * (1 + wastagePercent / 100);
                const costPerMeter = Number(laceMaster.pricePerMeter) || 0;
                const totalCost = effectiveQuantity * costPerMeter;

                extractedLaces.push({
                  laceId: laceId,
                  laceName: String(laceMaster.laceName || 'Unknown Lace'),
                  colorName: laceMaster.color ? String(laceMaster.color) : undefined,
                  width: laceMaster.width ? Number(laceMaster.width) : undefined,
                  quantityPerGarment: quantityPerGarment,
                  wastagePercent: wastagePercent,
                  effectiveQuantity: effectiveQuantity,
                  sourcingStrategy: 'READY_LACE', // Default strategy
                  costPerMeter: costPerMeter,
                  totalCost: totalCost,
                });

                continue; // Skip usageCategory routing for LACE items
              }

              // Route to appropriate category based on usageCategory
              if (bom.usageCategory === 'GARMENT_TRIM') {
                // Pick only ONE master FK - specific FK takes priority over generic materialId
                // (backend enforces at most one FK per trim item)
                const specificFk =
                  bomAny.threadId ||
                  bomAny.buttonId ||
                  bomAny.zipperId ||
                  bomAny.elasticId ||
                  bomAny.labelId ||
                  bomAny.packagingId;
                extractedTrims.push({
                  trimName: String(materialName),
                  trimQuantity: quantity,
                  trimRate: rate,
                  trimTotal: total,
                  unit,
                  bomId,
                  materialType,
                  // Preserve master IDs from style_material_bom - only one FK allowed
                  threadId: bomAny.threadId as string | undefined,
                  buttonId: !bomAny.threadId ? (bomAny.buttonId as string | undefined) : undefined,
                  zipperId: !bomAny.threadId && !bomAny.buttonId ? (bomAny.zipperId as string | undefined) : undefined,
                  elasticId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId
                      ? (bomAny.elasticId as string | undefined)
                      : undefined,
                  labelId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId && !bomAny.elasticId
                      ? (bomAny.labelId as string | undefined)
                      : undefined,
                  packagingId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId && !bomAny.elasticId && !bomAny.labelId
                      ? (bomAny.packagingId as string | undefined)
                      : undefined,
                  // Only use materialId as fallback if no specific FK is set
                  materialId: !specificFk ? (bomAny.materialId as string | undefined) : undefined,
                });
              } else if (bom.usageCategory === 'PACKAGING') {
                extractedAccessories.push({
                  accessoryName: String(materialName),
                  accessoryQuantity: quantity,
                  accessoryRate: rate,
                  accessoryTotal: total,
                  labelId: bomAny.labelId as string | undefined,
                  packagingId: bomAny.packagingId as string | undefined,
                  materialId: bomAny.materialId as string | undefined,
                  materialType,
                });
              } else if (bom.usageCategory === 'VALUE_ADDITION') {
                extractedEmbroidery.push({
                  embroideryName: String(materialName),
                  embroideryAverage: quantity,
                  embroideryRate: rate,
                  embroideryTotal: total,
                });
              } else {
                // Uncategorized defaults to trims
                // Pick only ONE master FK - specific FK takes priority over generic materialId
                const specificFk =
                  bomAny.threadId ||
                  bomAny.buttonId ||
                  bomAny.zipperId ||
                  bomAny.elasticId ||
                  bomAny.labelId ||
                  bomAny.packagingId;
                extractedTrims.push({
                  trimName: String(materialName),
                  trimQuantity: quantity,
                  trimRate: rate,
                  trimTotal: total,
                  unit,
                  bomId,
                  materialType,
                  threadId: bomAny.threadId as string | undefined,
                  buttonId: !bomAny.threadId ? (bomAny.buttonId as string | undefined) : undefined,
                  zipperId: !bomAny.threadId && !bomAny.buttonId ? (bomAny.zipperId as string | undefined) : undefined,
                  elasticId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId
                      ? (bomAny.elasticId as string | undefined)
                      : undefined,
                  labelId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId && !bomAny.elasticId
                      ? (bomAny.labelId as string | undefined)
                      : undefined,
                  packagingId:
                    !bomAny.threadId && !bomAny.buttonId && !bomAny.zipperId && !bomAny.elasticId && !bomAny.labelId
                      ? (bomAny.packagingId as string | undefined)
                      : undefined,
                  materialId: !specificFk ? (bomAny.materialId as string | undefined) : undefined,
                });
              }
            }

            // Replace defaults with extracted data (check cancelled flag before state updates)
            if (cancelled) {
              return;
            }

            if (extractedTrims.length > 0) {
              setTrimsDetails(extractedTrims);
              populated.push(`${extractedTrims.length} trims`);
            }
            if (extractedAccessories.length > 0) {
              setAccessoriesDetails(extractedAccessories);
              populated.push(`${extractedAccessories.length} accessories`);
            }
            if (extractedEmbroidery.length > 0) {
              setEmbroideryDetails(extractedEmbroidery);
              populated.push(`${extractedEmbroidery.length} embroidery items`);
            }
            if (extractedLaces.length > 0) {
              setLaceDetails(extractedLaces);
              setStyleHasLace(true);
              populated.push(`${extractedLaces.length} laces`);
            } else {
              // Check if style has any lace in BOM even if not extracted
              const hasLaceInBom = styleDetails.styleMaterialBom?.some(
                (bom: { materialType?: string }) => bom.materialType === 'LACE'
              );
              setStyleHasLace(hasLaceInBom || false);
            }
          }

          // Show specific warnings for missing data
          if (!styleDetails.components || styleDetails.components.length === 0) {
            notify.warning(
              'Style has no components/fabrics defined. Add fabric components to the style first, or enter fabric details manually.',
              { duration: 6000 }
            );
          }
          if (!styleDetails.styleMaterialBom || styleDetails.styleMaterialBom.length === 0) {
            notify.warning(
              'Style has no material BOM (trims/accessories). Add materials to the style BOM first, or enter trim details manually.',
              { duration: 6000 }
            );
          }

          // Show success notification
          if (populated.length > 0) {
            notify.success(`Auto-populated: ${populated.join(', ')}`, { duration: 4000 });

            // Show accurate rate source notifications
            if (ratesFromCosting > 0) {
              notify.success(`Fetched ${ratesFromCosting} fabric rate(s) from approved costing`, {
                duration: 4000,
              });
            }
            if (ratesFromStock > 0) {
              notify.info(`Fetched ${ratesFromStock} fabric rate(s) from stock inventory`, {
                duration: 4000,
              });
            }

            // Warn user if rates are missing
            if (fabricsWithoutRate > 0) {
              notify.warning(
                `${fabricsWithoutRate} fabric(s) need rate entry. Complete fabric costing or enter rates manually.`,
                { duration: 6000 }
              );
            }
          } else {
            notify.info('Style loaded. Please fill in cost details manually.');
          }
        } catch (error: unknown) {
          console.error('Failed to fetch style details:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          notify.error(`Failed to load style details: ${errorMessage}`);
        }
      }
    };
    fetchStyleDetails();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyleId, isEditMode, costingMode, hasUserEdited]); // Re-fetch when costingMode changes, skip if user edited

  // Reset hasUserEdited when style changes (new style = expect fresh data)
  useEffect(() => {
    setHasUserEdited(false);
  }, [selectedStyleId]);

  // Fetch budget suggestions from style data
  const fetchBudgetSuggestions = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }

    setLoadingBudgets(true);
    try {
      const suggestions = await getBudgetSuggestions(selectedStyleId);
      setBudgetSuggestions(suggestions);

      // Apply suggestions to form
      setFabricBudget(suggestions.fabricBudget);
      setTrimsBudget(suggestions.trimsBudget);
      setCmtBudget(suggestions.cmtBudget);
      setEmbroideryBudget(suggestions.embroideryBudget);
      setAccessoriesBudget(suggestions.accessoriesBudget);

      notify.success('Budget suggestions loaded from style data');
    } catch (error) {
      notify.error('Failed to load budget suggestions');
      console.error('Budget suggestions error:', error);
    } finally {
      setLoadingBudgets(false);
    }
  };

  // Calculate total budget
  const calculateTotalBudget = () => {
    return fabricBudget + trimsBudget + cmtBudget + embroideryBudget + accessoriesBudget;
  };

  // Calculate fabric total (excluding NA items)
  const calculateFabricTotal = () => {
    return fabricDetails
      .filter((fabric) => !fabric.isNotApplicable)
      .reduce((sum, fabric) => sum + (fabric.fabricTotal || 0), 0);
  };

  // Calculate trims total (excluding NA items)
  const calculateTrimsTotal = () => {
    return trimsDetails.filter((trim) => !trim.isNotApplicable).reduce((sum, trim) => sum + (trim.trimTotal || 0), 0);
  };

  // Calculate lace total (excluding NA items)
  const calculateLaceTotal = () => {
    return laceDetails.filter((lace) => !lace.isNotApplicable).reduce((sum, lace) => sum + (lace.totalCost || 0), 0);
  };

  // Calculate CMT total
  const calculateCMTTotal = () => {
    return Object.values(cmtCosts).reduce((sum, cost) => sum + (cost || 0), 0);
  };

  // Calculate embroidery total (excluding NA items)
  const calculateEmbroideryTotal = () => {
    return embroideryDetails
      .filter((embr) => !embr.isNotApplicable)
      .reduce((sum, embr) => sum + (embr.embroideryTotal || 0), 0);
  };

  // Calculate accessories total (excluding NA items)
  const calculateAccessoriesTotal = () => {
    return accessoriesDetails
      .filter((acc) => !acc.isNotApplicable)
      .reduce((sum, acc) => sum + (acc.accessoryTotal || 0), 0);
  };

  // Calculate subtotal (before value loss and markup)
  const calculateSubtotal = () => {
    return (
      calculateFabricTotal() +
      calculateTrimsTotal() +
      calculateLaceTotal() +
      calculateCMTTotal() +
      calculateEmbroideryTotal() +
      calculateAccessoriesTotal()
    );
  };

  // Calculate value loss amount
  const calculateValueLossAmount = () => {
    const subtotal = calculateSubtotal();
    return (subtotal * valueLossPercent) / 100;
  };

  // Calculate total after value loss
  const calculateTotalAfterValueLoss = () => {
    return calculateSubtotal() + calculateValueLossAmount();
  };

  // Calculate markup amount
  const calculateMarkupAmount = () => {
    const totalAfterValueLoss = calculateTotalAfterValueLoss();
    return (totalAfterValueLoss * markupPercent) / 100;
  };

  // Calculate total product cost
  const calculateTotalProductCost = () => {
    return calculateTotalAfterValueLoss() + calculateMarkupAmount();
  };

  // Add new fabric row (manually added, so N/A checkbox will be shown)
  const addFabricRow = () => {
    setFabricDetails([
      ...fabricDetails,
      { fabricName: '', fabricWidth: 0, fabricAverage: 0, fabricRate: 0, fabricTotal: 0, isAutoPopulated: false },
    ]);
  };

  // Remove fabric row
  const removeFabricRow = (index: number) => {
    if (fabricDetails.length > 1) {
      setFabricDetails(fabricDetails.filter((_, i) => i !== index));
    }
  };

  // Update fabric row
  const updateFabricRow = (index: number, field: keyof FabricDetail, value: FabricDetail[keyof FabricDetail]) => {
    const updated = [...fabricDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate fabric total
    if (field === 'fabricWidth' || field === 'fabricAverage' || field === 'fabricRate') {
      const fabric = updated[index];
      fabric.fabricTotal = fabric.fabricAverage * fabric.fabricRate;
    }

    setFabricDetails(updated);
    setHasUserEdited(true); // Preserve user edits on error/mode change
  };

  // Update fabric sourcing strategy
  const updateFabricSourcingStrategy = (
    index: number,
    strategy: {
      sourcingStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
      cost: number;
      stockLotId?: string;
      processorId?: string;
      rateCardId?: string;
      procurementId?: string;
      greigeCost?: number;
      processingCost?: number;
      isManualOverride?: boolean;
      overrideReason?: string;
    }
  ) => {
    const updated = [...fabricDetails];
    const costPerMeter = updated[index].fabricAverage > 0 ? strategy.cost / updated[index].fabricAverage : 0;

    updated[index] = {
      ...updated[index],
      sourcingStrategy: strategy.sourcingStrategy,
      fabricRate: costPerMeter,
      fabricTotal: strategy.cost,
      stockLotId: strategy.stockLotId,
      processorId: strategy.processorId,
      rateCardId: strategy.rateCardId,
      procurementId: strategy.procurementId,
      greigeCost: strategy.greigeCost,
      processingCost: strategy.processingCost,
      isManualOverride: strategy.isManualOverride,
      overrideReason: strategy.overrideReason,
    };
    setFabricDetails(updated);
  };

  // Add new trim row
  const addTrimRow = () => {
    setTrimsDetails([
      ...trimsDetails,
      { trimName: '', trimQuantity: 0, trimRate: 0, trimTotal: 0, materialType: 'THREAD' },
    ]);
  };

  // Remove trim row
  const removeTrimRow = (index: number) => {
    setTrimsDetails(trimsDetails.filter((_, i) => i !== index));
  };

  // Update trim row
  const updateTrimRow = (index: number, field: keyof TrimDetail, value: TrimDetail[keyof TrimDetail]) => {
    const updated = [...trimsDetails];
    updated[index] = { ...updated[index], [field]: value };

    // When materialType changes, clear the previous master ID
    if (field === 'materialType') {
      updated[index].threadId = undefined;
      updated[index].buttonId = undefined;
      updated[index].zipperId = undefined;
      updated[index].elasticId = undefined;
      updated[index].labelId = undefined;
      updated[index].packagingId = undefined;
      updated[index].materialId = undefined;
      updated[index].trimName = '';
    }

    // Auto-calculate trim total
    if (field === 'trimQuantity' || field === 'trimRate') {
      const trim = updated[index];
      trim.trimTotal = trim.trimQuantity * trim.trimRate;
    }

    setTrimsDetails(updated);
    setHasUserEdited(true); // Preserve user edits on error/mode change
  };

  // Handle master selection from TrimMasterCombobox (data-driven via registry)
  const handleTrimMasterSelect = (index: number, selection: TrimMasterSelection | null) => {
    const updated = [...trimsDetails];
    // Clear all master ID fields using the registry
    for (const entry of ALL_TRIM_TYPES) {
      (updated[index] as Record<string, unknown>)[entry.idField] = undefined;
    }
    updated[index].materialId = undefined;

    if (selection) {
      updated[index].trimName = selection.masterName;
      // Set the specific FK field from the selection
      const config = TRIM_TYPE_REGISTRY[selection.materialType];
      if (config) {
        (updated[index] as Record<string, unknown>)[config.idField] = selection.masterId;
      }
      // Set unit and rate from master if available
      if (selection.unit) updated[index].unit = selection.unit;
      if (selection.unitPrice && !updated[index].trimRate) {
        updated[index].trimRate = selection.unitPrice;
        updated[index].trimTotal = (updated[index].trimQuantity || 0) * selection.unitPrice;
      }
    } else {
      updated[index].trimName = '';
    }
    setTrimsDetails(updated);
  };

  // Check if a trim has a linked master record (data-driven via registry)
  const hasTrimMasterLink = (trim: TrimDetail): boolean => {
    if (trim.materialId) return true;
    const config = TRIM_TYPE_REGISTRY[trim.materialType || ''];
    if (config) return !!trim[config.idField as keyof TrimDetail];
    return false;
  };

  // Get the master ID value for a trim based on its materialType (data-driven via registry)
  const getTrimMasterId = (trim: TrimDetail): string | undefined => {
    const config = TRIM_TYPE_REGISTRY[trim.materialType || ''];
    if (config) return trim[config.idField as keyof TrimDetail] as string | undefined;
    return undefined;
  };

  // Add new embroidery row
  const addEmbroideryRow = () => {
    setEmbroideryDetails([
      ...embroideryDetails,
      { embroideryName: '', embroideryAverage: 0, embroideryRate: 0, embroideryTotal: 0 },
    ]);
  };

  // Remove embroidery row
  const removeEmbroideryRow = (index: number) => {
    setEmbroideryDetails(embroideryDetails.filter((_, i) => i !== index));
  };

  // Update embroidery row
  const updateEmbroideryRow = (
    index: number,
    field: keyof EmbroideryDetail,
    value: EmbroideryDetail[keyof EmbroideryDetail]
  ) => {
    const updated = [...embroideryDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate embroidery total
    if (field === 'embroideryAverage' || field === 'embroideryRate') {
      const embr = updated[index];
      embr.embroideryTotal = embr.embroideryAverage * embr.embroideryRate;
    }

    setEmbroideryDetails(updated);
    setHasUserEdited(true); // Preserve user edits on error/mode change
  };

  // Add new accessory row
  const addAccessoryRow = () => {
    setAccessoriesDetails([
      ...accessoriesDetails,
      { accessoryName: '', accessoryQuantity: 0, accessoryRate: 0, accessoryTotal: 0, materialType: 'LABEL' },
    ]);
  };

  // Remove accessory row
  const removeAccessoryRow = (index: number) => {
    setAccessoriesDetails(accessoriesDetails.filter((_, i) => i !== index));
  };

  // Update accessory row
  const updateAccessoryRow = (
    index: number,
    field: keyof AccessoryDetail,
    value: AccessoryDetail[keyof AccessoryDetail]
  ) => {
    const updated = [...accessoriesDetails];
    updated[index] = { ...updated[index], [field]: value };

    // When materialType changes, clear master IDs
    if (field === 'materialType') {
      updated[index].labelId = undefined;
      updated[index].packagingId = undefined;
      updated[index].materialId = undefined;
      updated[index].accessoryName = '';
    }

    // Auto-calculate accessory total
    if (field === 'accessoryQuantity' || field === 'accessoryRate') {
      const acc = updated[index];
      acc.accessoryTotal = acc.accessoryQuantity * acc.accessoryRate;
    }

    setAccessoriesDetails(updated);
    setHasUserEdited(true); // Preserve user edits on error/mode change
  };

  // Handle master selection for accessories
  const handleAccessoryMasterSelect = (index: number, selection: TrimMasterSelection | null) => {
    const updated = [...accessoriesDetails];
    updated[index].labelId = undefined;
    updated[index].packagingId = undefined;
    updated[index].materialId = undefined;

    if (selection) {
      updated[index].accessoryName = selection.masterName;
      if (selection.labelId) updated[index].labelId = selection.labelId;
      if (selection.packagingId) updated[index].packagingId = selection.packagingId;
      if (selection.unitPrice && !updated[index].accessoryRate) {
        updated[index].accessoryRate = selection.unitPrice;
        updated[index].accessoryTotal = (updated[index].accessoryQuantity || 0) * selection.unitPrice;
      }
    } else {
      updated[index].accessoryName = '';
    }
    setAccessoriesDetails(updated);
  };

  // Check if an accessory has a linked master record
  const hasAccessoryMasterLink = (acc: AccessoryDetail): boolean => {
    return !!(acc.labelId || acc.packagingId || acc.materialId);
  };

  // Get the master ID for an accessory based on its materialType
  const getAccessoryMasterId = (acc: AccessoryDetail): string | undefined => {
    switch (acc.materialType) {
      case 'LABEL':
        return acc.labelId;
      case 'PACKAGING':
        return acc.packagingId;
      default:
        return undefined;
    }
  };

  // Traditional BOM loading removed - quantities now come from Style Material BOM
  // and prices are entered directly in Cost Sheet or from Fabric Costing

  // Auto-generate cost sheet from approved CAD or selected costing run
  /**
   * Load the fabric lines of a SELECTED costing run into the form.
   *
   * This was previously half of an "Auto-Generate from CAD" button whose other half re-derived
   * fabrics/trims/embroidery/accessories from CAD — a duplicate of what selecting a style already
   * does automatically, by different dedupe rules. That divergence is what silently understated
   * fabric cost on 8 styles, so the CAD-generate half (and its endpoint) was retired on
   * 2026-09-01. Applying a costing run is a genuinely distinct action and is kept, under a name
   * that says what it does.
   */
  const handleLoadFromCostingRun = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }
    if (!selectedRunId) {
      notify.error('Select a costing run first');
      return;
    }

    try {
      setLoading(true);

      const styleDetails = await styleService.getStyleById(selectedStyleId);
      setSelectedStyle(styleDetails);

      {
        // Fetch full run details with fabric data
        const run = await getRunById(selectedRunId);

        if (run.fabrics && run.fabrics.length > 0) {
          // Transform run fabrics to cost sheet fabric details
          const fabricDetailsFromRun: FabricDetail[] = run.fabrics.map((fab) => ({
            fabricName:
              fab.componentName ||
              (fab.greige ? `${fab.greige.greigeCode} - ${fab.greige.greigeName}` : 'Unknown Fabric'),
            fabricWidth: Number(fab.cutableWidth) || 0,
            fabricAverage: Number(fab.cadAverage) || 0,
            fabricRate: Number(fab.totalCostPerMeter) || 0,
            fabricTotal: (Number(fab.cadAverage) || 0) * (Number(fab.totalCostPerMeter) || 0),
            // Carry sourcing strategy from costing run
            sourcingStrategy: fab.processor ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
            processorId: fab.processor?.id,
            // Auto-populated from costing run - N/A checkbox won't show
            isAutoPopulated: true,
          }));

          setFabricDetails(fabricDetailsFromRun);

          // Auto-enable budget tracking for non-COSTING modes
          if (costingMode === 'RAW_MATERIAL_CALCULATION' || costingMode === 'PRODUCTION') {
            setEnableBudgetTracking(true);
            setBudgetSource('auto');
            // Set fabric budget from run's total cost per garment
            if (run.totalFabricCost) {
              setFabricBudget(Number(run.totalFabricCost));
            }
          }

          // Pre-fill basic information from style
          if (styleDetails.numberOfComponents) {
            setNumberOfComponents(styleDetails.numberOfComponents);
          }
          if (styleDetails.brandCategories) {
            setCategory(styleDetails.brandCategories.category || '');
            setSubCategory(styleDetails.brandCategories.subCategory || '');
          }

          notify.success(
            `Loaded ${fabricDetailsFromRun.length} fabric(s) from ${run.runName}. ${
              run.isComplete ? 'All costs complete.' : 'Note: Some costs may be incomplete.'
            }`,
            { duration: 6000 }
          );
          return;
        }

        notify.warning(`${run.runName} has no costed fabrics to load.`, { duration: 6000 });
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string; message?: string } } };
      const errorMsg =
        axiosError.response?.data?.error || axiosError.response?.data?.message || 'Failed to load the costing run';
      notify.error(errorMsg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStyleId) {
      notify.error('Please select a style');
      return;
    }

    // Validate: Check for 0 values on non-NA items
    const invalidFabrics = fabricDetails.filter(
      (f) => !f.isNotApplicable && (f.fabricRate <= 0 || f.fabricAverage <= 0)
    );
    const invalidTrims = trimsDetails.filter((t) => !t.isNotApplicable && (t.trimRate <= 0 || t.trimQuantity <= 0));
    const invalidEmbroidery = embroideryDetails.filter(
      (e) => !e.isNotApplicable && (e.embroideryRate <= 0 || e.embroideryAverage <= 0)
    );
    const invalidAccessories = accessoriesDetails.filter(
      (a) => !a.isNotApplicable && (a.accessoryRate <= 0 || a.accessoryQuantity <= 0)
    );
    const invalidLaces = laceDetails.filter(
      (l) => !l.isNotApplicable && (l.costPerMeter <= 0 || l.quantityPerGarment <= 0)
    );

    const emptyNameFabrics = fabricDetails.filter((f) => !f.isNotApplicable && !f.fabricName?.trim());
    if (emptyNameFabrics.length > 0) {
      notify.error(`${emptyNameFabrics.length} fabric(s) have no name. Re-select the style or enter names manually.`);
      return;
    }
    if (invalidFabrics.length > 0) {
      const names = invalidFabrics.map((f) => f.fabricName || 'Unnamed').join(', ');
      notify.error(
        `${invalidFabrics.length} fabric(s) have 0 values: ${names}. Enter values or mark as "N/A" to save.`
      );
      return;
    }
    if (invalidTrims.length > 0) {
      const names = invalidTrims.map((t) => t.trimName || 'Unnamed').join(', ');
      notify.error(`${invalidTrims.length} trim(s) have 0 values: ${names}. Enter values or mark as "N/A" to save.`);
      return;
    }
    if (invalidEmbroidery.length > 0) {
      const names = invalidEmbroidery.map((e) => e.embroideryName || 'Unnamed').join(', ');
      notify.error(
        `${invalidEmbroidery.length} embroidery item(s) have 0 values: ${names}. Enter values or mark as "N/A" to save.`
      );
      return;
    }
    if (invalidAccessories.length > 0) {
      const names = invalidAccessories.map((a) => a.accessoryName || 'Unnamed').join(', ');
      notify.error(
        `${invalidAccessories.length} accessory(s) have 0 values: ${names}. Enter values or mark as "N/A" to save.`
      );
      return;
    }
    if (invalidLaces.length > 0) {
      const names = invalidLaces.map((l) => l.laceName || 'Unnamed').join(', ');
      notify.error(`${invalidLaces.length} lace(s) have 0 values: ${names}. Enter values or mark as "N/A" to save.`);
      return;
    }

    try {
      setLoading(true);

      const data = {
        styleId: selectedStyleId,
        purpose: costingMode, // Cost sheet purpose/mode (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
        numberOfComponents: numberOfComponents || undefined,
        category: category || undefined,
        subCategory: subCategory || undefined,
        fabricDetails,
        trimsDetails,
        laceDetails,
        cmtCosts,
        embroideryDetails,
        accessoriesDetails,
        valueLossPercent,
        markupPercent,
        notes: notes || undefined,
        // Closed Cost - Final agreed price with customer
        closedCost: closedCost || undefined,
        closedCostNotes: closedCostNotes || undefined,
        // Budget Tracking (for RAW_MATERIAL_CALCULATION/PRODUCTION direct procurement)
        ...(enableBudgetTracking && {
          enableBudgetTracking: true,
          fabricBudget,
          trimsBudget,
          cmtBudget,
          embroideryBudget,
          accessoriesBudget,
          totalBudget: calculateTotalBudget(),
          fabricBufferPercent,
          trimsBufferPercent,
          cmtBufferPercent,
          embroideryBufferPercent,
          accessoriesBufferPercent,
        }),
      };

      const saved = isEditMode && id ? await updateCostSheet(id, data) : await createCostSheet(data);
      notify.success(`Cost sheet ${isEditMode && id ? 'updated' : 'created'} successfully`);

      // The save can succeed while leaving a fabric line paired only by position, or a costed CAD
      // row with no cost line at all. Those rows drive the Order BOM and the greige PO, so they
      // get their own toast rather than disappearing behind the success one.
      for (const warning of saved.warnings ?? []) {
        notify.warning(warning, { duration: 10000 });
      }

      navigate('/cost-sheets');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      notify.error(axiosError.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} cost sheet`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-display font-medium">{isEditMode ? 'Edit Cost Sheet' : 'Create Cost Sheet'}</h1>
        <Button variant="outline" onClick={() => navigate('/cost-sheets')}>
          Back to List
        </Button>
      </div>

      {/* BUG-CS7 fix: Show banner when cost sheet is approved */}
      {isApprovedCostSheet && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">Approved Cost Sheet - Read Only</h3>
            <p className="text-sm text-amber-700 mt-1">
              This cost sheet has been approved and cannot be edited. To make changes, create a new version from the
              detail page.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-amber-400 text-amber-700 hover:bg-amber-100"
              onClick={() => navigate(`/cost-sheets/${id}`)}
            >
              Go to Detail Page
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold">Basic Information</h2>
            {/* BUG-CS7 fix: also check isApprovedCostSheet (safety check) */}
            {selectedStyleId && !isEditMode && !isApprovedCostSheet && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Re-trigger auto-populate by toggling style ID
                    const currentId = selectedStyleId;
                    setSelectedStyleId('');
                    setTimeout(() => setSelectedStyleId(currentId), 50);
                  }}
                  disabled={loading || isApprovedCostSheet}
                  className="flex items-center gap-2"
                  title="Reload fabric and trim data from style"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload from Style
                </Button>
                {/* Only meaningful with a run selected — fabrics, trims and the rest already
                    populate from the style itself the moment one is chosen. */}
                {selectedRunId && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleLoadFromCostingRun}
                    disabled={loading || !selectedStyle || isApprovedCostSheet}
                    className="flex items-center gap-2 bg-gradient-to-r from-accent to-info hover:from-accent hover:to-info disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Replace the fabric rows with the fabrics costed in the selected costing run"
                  >
                    <Sparkles className="h-4 w-4" />
                    Load from Costing Run
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Search Style *</label>
              <StyleCombobox
                value={selectedStyleId}
                onChange={(styleId, style) => {
                  setSelectedStyleId(styleId);
                  if (style) {
                    // Set the full style object
                    setSelectedStyle(style);
                    // Auto-populate customer from style
                    const customer = customers.find((c) => c.name.toLowerCase() === style.customerName?.toLowerCase());
                    if (customer) {
                      setSelectedCustomerId(customer.id);
                    }
                  }
                }}
                disabled={isEditMode || isApprovedCostSheet}
                placeholder="Type style code to search..."
                status={null} // Include both ACTIVE and DRAFT styles for costing
              />
              <p className="text-xs text-muted-foreground mt-1">Search by style code, name, or customer</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Customer</label>
              <Input
                value={selectedStyle?.customerName || (selectedStyleId ? 'Loading...' : 'Select a style first')}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-populated from selected style</p>
            </div>
            {/* Fabric Costing Mode Selector - shown after style is selected */}
            {selectedStyleId && (
              <div>
                <label className="block text-sm font-medium mb-2">Fabric Costing Mode</label>
                <Select
                  value={costingMode}
                  onValueChange={(v) =>
                    handleCostingModeChange(v as 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION')
                  }
                  disabled={isEditMode || isApprovedCostSheet}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select costing mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COSTING">Costing (Buyer Quotation)</SelectItem>
                    <SelectItem value="RAW_MATERIAL_CALCULATION">Raw Material Calculation</SelectItem>
                    <SelectItem value="PRODUCTION">Production</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only approved options from this mode will be used for fabric rates
                </p>
              </div>
            )}
          </div>

          {/* Costing Run Selector - Compact inline format */}
          {selectedStyleId && !isEditMode && costingRuns.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Costing Run:</span>
              {costingRuns.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(selectedRunId === run.id ? null : run.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm transition-all ${
                    selectedRunId === run.id
                      ? 'border-info bg-info/10 text-info font-medium'
                      : 'border-border bg-card hover:border-info/50 text-foreground'
                  }`}
                >
                  <span>{run.runName}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>
                    {run.fabricCount} fabric{run.fabricCount !== 1 ? 's' : ''}
                  </span>
                  {run.totalFabricCost && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium">₹{Number(run.totalFabricCost).toFixed(0)}</span>
                    </>
                  )}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                      run.isComplete ? 'bg-success-muted text-success' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {run.isComplete ? '✓' : '⚠'}
                  </span>
                  {selectedRunId === run.id && (
                    <svg className="h-4 w-4 text-info" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
              {selectedRunId && <span className="text-xs text-info ml-2">→ Click Load from Costing Run to use</span>}
            </div>
          )}

          {/* Loading indicator for runs */}
          {selectedStyleId && loadingRuns && (
            <div className="mt-4 p-4 border border-border bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading costing runs...</span>
              </div>
            </div>
          )}

          {/* Budget Tracking Section - Only for RAW_MATERIAL_CALCULATION or PRODUCTION modes */}
          {selectedStyleId && (costingMode === 'RAW_MATERIAL_CALCULATION' || costingMode === 'PRODUCTION') && (
            <div className="mt-4 p-4 border border-accent/20 bg-accent/10 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <Checkbox
                  id="enableBudgetTracking"
                  checked={enableBudgetTracking}
                  onCheckedChange={(checked) => setEnableBudgetTracking(checked as boolean)}
                />
                <Label htmlFor="enableBudgetTracking" className="font-medium text-accent">
                  Enable Budget Tracking for Procurement
                </Label>
              </div>

              {enableBudgetTracking && (
                <>
                  {/* Budget Source Selector */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2">Budget Source</label>
                      <Select value={budgetSource} onValueChange={(v) => setBudgetSource(v as 'manual' | 'auto')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                          <SelectItem value="auto">Auto-Calculate from Style Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {budgetSource === 'auto' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fetchBudgetSuggestions}
                        disabled={loadingBudgets}
                        className="mt-6"
                      >
                        {loadingBudgets ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Fetch Budgets
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Budget Entry Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Fabric Budget (₹)</label>
                      <Input
                        type="number"
                        value={fabricBudget || ''}
                        onChange={(e) => setFabricBudget(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {budgetSuggestions?.sources.fabricSource && (
                        <p className="text-xs text-muted-foreground mt-1">{budgetSuggestions.sources.fabricSource}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Trims Budget (₹)</label>
                      <Input
                        type="number"
                        value={trimsBudget || ''}
                        onChange={(e) => setTrimsBudget(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {budgetSuggestions?.sources.trimsSource && (
                        <p className="text-xs text-muted-foreground mt-1">{budgetSuggestions.sources.trimsSource}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">CMT Budget (₹)</label>
                      <Input
                        type="number"
                        value={cmtBudget || ''}
                        onChange={(e) => setCmtBudget(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {budgetSuggestions?.sources.cmtSource && (
                        <p className="text-xs text-muted-foreground mt-1">{budgetSuggestions.sources.cmtSource}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Embroidery Budget (₹)</label>
                      <Input
                        type="number"
                        value={embroideryBudget || ''}
                        onChange={(e) => setEmbroideryBudget(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {budgetSuggestions?.sources.embroiderySource && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {budgetSuggestions.sources.embroiderySource}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Accessories Budget (₹)</label>
                      <Input
                        type="number"
                        value={accessoriesBudget || ''}
                        onChange={(e) => setAccessoriesBudget(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {budgetSuggestions?.sources.accessoriesSource && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {budgetSuggestions.sources.accessoriesSource}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Total Budget (₹)</label>
                      <Input
                        type="number"
                        value={calculateTotalBudget()}
                        readOnly
                        className="bg-accent/10 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Buffer Percentages */}
                  <div className="mt-4 pt-4 border-t border-accent/20">
                    <label className="block text-sm font-medium mb-2">Buffer Percentages</label>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground">Fabric</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={fabricBufferPercent}
                            onChange={(e) => setFabricBufferPercent(parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">Trims</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={trimsBufferPercent}
                            onChange={(e) => setTrimsBufferPercent(parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">CMT</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={cmtBufferPercent}
                            onChange={(e) => setCmtBufferPercent(parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">Embroidery</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={embroideryBufferPercent}
                            onChange={(e) => setEmbroideryBufferPercent(parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">Accessories</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={accessoriesBufferPercent}
                            onChange={(e) => setAccessoriesBufferPercent(parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BUG-CS7 fix: disable fields when approved */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Number of Components</label>
              <Input
                type="number"
                placeholder="0"
                value={numberOfComponents || ''}
                onChange={(e) => setNumberOfComponents(parseInt(e.target.value) || 0)}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <Input
                placeholder="e.g., Top Wear"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sub Category</label>
              <Input
                placeholder="e.g., Kurta"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                disabled={isApprovedCostSheet}
              />
            </div>
          </div>

          {/* CAD Status Info Banner - Only show if NO costing runs available AND CAD not approved */}
          {selectedStyle && !isCADApproved(selectedStyle.cadStatus) && costingRuns.length === 0 && (
            <div className="mt-4 p-4 rounded-lg border bg-warning-muted border-yellow-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-warning" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold">CAD Planning Workflow:</span>
                    <CADStatusBadge status={selectedStyle.cadStatus} size="sm" />
                  </div>
                  <p className="text-sm text-yellow-800">{getCADWorkflowMessage(selectedStyle.cadStatus)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate(`/cad-planning/${selectedStyleId}`)}
                  >
                    Go to CAD Planning
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fabric Details */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold">Fabric Details</h2>
            {/* BUG-CS7 fix: disable button when approved */}
            <Button type="button" onClick={addFabricRow} size="sm" disabled={isApprovedCostSheet}>
              <Plus className="w-4 h-4 mr-1" /> Add Fabric
            </Button>
          </div>

          {/* Fabric Table with Sourcing Strategy */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fabric</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">CAD (m)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Width</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sourcing</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Price (₹/m)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase"
                    title="Not Applicable"
                  >
                    N/A
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-gray-200">
                {fabricDetails.map((fabric, index) => (
                  <FabricCostingRow
                    key={index}
                    index={index}
                    fabricId={fabric.fabricId || ''}
                    fabricName={fabric.fabricName}
                    cadMeters={fabric.fabricAverage}
                    width={fabric.fabricWidth}
                    orderQuantity={selectedStyle?.orderQuantity}
                    styleId={selectedStyleId}
                    currentStrategy={fabric.sourcingStrategy}
                    pricePerMeter={fabric.fabricRate}
                    currentCost={fabric.fabricTotal}
                    onStrategyChange={(strategy) => updateFabricSourcingStrategy(index, strategy)}
                    onRemove={fabricDetails.length > 1 ? () => removeFabricRow(index) : undefined}
                    isNotApplicable={fabric.isNotApplicable}
                    onNotApplicableChange={
                      fabric.isAutoPopulated
                        ? undefined
                        : (checked) => updateFabricRow(index, 'isNotApplicable', checked)
                    }
                    disabled={isApprovedCostSheet}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">Fabric Total: {formatCurrency(calculateFabricTotal())}</p>
          </div>
        </div>

        {/* Fabric Cost Comparison Table */}
        {fabricDetails.length > 0 && fabricDetails.some((f) => f.fabricId) && fabricCostResults.length > 0 && (
          <CostComparisonTable fabricResults={fabricCostResults} className="bg-card" />
        )}

        {/* Lace Details - Only show if style has lace in BOM or user added lace items */}
        {(styleHasLace || laceDetails.length > 0) && (
          <div className="bg-card p-6 rounded-lg shadow">
            {/* BUG-CS7 fix: disable when approved */}
            <LaceCostingSection
              laceDetails={laceDetails}
              onLaceDetailsChange={setLaceDetails}
              styleId={selectedStyleId}
              disabled={loading || isApprovedCostSheet}
            />
          </div>
        )}

        {/* Trims Details */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold">Trims Details</h2>
            {/* BUG-CS7 fix: disable button when approved */}
            <Button type="button" onClick={addTrimRow} size="sm" disabled={isApprovedCostSheet}>
              <Plus className="w-4 h-4 mr-1" /> Add Trim
            </Button>
          </div>
          <div className="space-y-4">
            {trimsDetails.map((trim, index) => (
              <div
                key={index}
                className={`grid grid-cols-12 gap-4 items-end border-b pb-4 ${trim.isNotApplicable ? 'bg-muted opacity-60' : ''}`}
              >
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Type</label>
                  {/* BUG-CS7 fix: disable when approved */}
                  <Select
                    value={trim.materialType || ''}
                    onValueChange={(val) => updateTrimRow(index, 'materialType', val)}
                    disabled={trim.isNotApplicable || isApprovedCostSheet}
                  >
                    <SelectTrigger className={trim.isNotApplicable ? 'bg-muted' : ''}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TRIM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium mb-2">
                    Trim Name
                    {hasTrimMasterLink(trim) ? (
                      <Link2 className="inline-block w-3 h-3 ml-1 text-success" />
                    ) : trim.materialType && trim.materialType !== 'OTHER' && trim.trimName ? (
                      <span title="Not linked to a master record. MRP may skip this item.">
                        <Unlink className="inline-block w-3 h-3 ml-1 text-orange-500" />
                      </span>
                    ) : null}
                  </label>
                  {/* BUG-CS7 fix: disable when approved */}
                  {trim.materialType && trim.materialType !== 'OTHER' ? (
                    <TrimMasterCombobox
                      materialType={trim.materialType}
                      value={getTrimMasterId(trim)}
                      onSelect={(selection) => handleTrimMasterSelect(index, selection)}
                      disabled={trim.isNotApplicable || isApprovedCostSheet}
                      customerId={selectedCustomerId}
                      className={trim.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  ) : (
                    <Input
                      placeholder="Trim name"
                      value={trim.trimName}
                      onChange={(e) => updateTrimRow(index, 'trimName', e.target.value)}
                      disabled={trim.isNotApplicable || isApprovedCostSheet}
                      className={trim.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  )}
                </div>
                {/* BUG-CS7 fix: disable when approved */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Qty {trim.unit && <span className="text-xs text-muted-foreground">({trim.unit})</span>}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.trimQuantity || ''}
                    onChange={(e) => updateTrimRow(index, 'trimQuantity', parseFloat(e.target.value) || 0)}
                    disabled={trim.isNotApplicable || isApprovedCostSheet}
                    className={trim.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Rate {trim.unit && <span className="text-xs text-muted-foreground">(per {trim.unit})</span>}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.trimRate || ''}
                    onChange={(e) => updateTrimRow(index, 'trimRate', parseFloat(e.target.value) || 0)}
                    disabled={trim.isNotApplicable || isApprovedCostSheet}
                    className={trim.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-2">Total</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.isNotApplicable ? 'N/A' : trim.trimTotal.toFixed(2)}
                    disabled
                    className={`bg-muted ${trim.isNotApplicable ? 'line-through text-muted-foreground' : ''}`}
                  />
                </div>
                {/* BUG-CS7 fix: disable when approved */}
                <div className="col-span-1 flex items-center justify-center">
                  <label
                    className={`flex items-center gap-1 ${isApprovedCostSheet ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    title="Not Applicable"
                  >
                    <Checkbox
                      checked={trim.isNotApplicable || false}
                      onCheckedChange={(checked) => updateTrimRow(index, 'isNotApplicable', checked)}
                      disabled={isApprovedCostSheet}
                    />
                    <span className="text-xs text-muted-foreground">N/A</span>
                  </label>
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTrimRow(index)}
                    disabled={isApprovedCostSheet}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">Trims Total: {formatCurrency(calculateTrimsTotal())}</p>
          </div>
        </div>

        {/* CMT Costs */}
        {/* BUG-CS7 fix: disable fields when approved */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-display font-semibold mb-4">CMT (Cut, Make, Trim) Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cutting</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.cuttingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, cuttingCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Stitching</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.stitchingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, stitchingCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Finishing</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.finishingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, finishingCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Button Attachment</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.buttonAttachmentCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, buttonAttachmentCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Handwork</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.handworkCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, handworkCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Smocking</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.smockingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, smockingCost: parseFloat(e.target.value) || 0 })}
                disabled={isApprovedCostSheet}
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">CMT Total: {formatCurrency(calculateCMTTotal())}</p>
          </div>
        </div>

        {/* Embroidery Details */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold">Embroidery Details</h2>
            {/* BUG-CS7 fix: disable button when approved */}
            <Button type="button" onClick={addEmbroideryRow} size="sm" disabled={isApprovedCostSheet}>
              <Plus className="w-4 h-4 mr-1" /> Add Embroidery
            </Button>
          </div>
          {embroideryDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No embroidery added. Click "Add Embroidery" to start.
            </p>
          ) : (
            <div className="space-y-4">
              {embroideryDetails.map((embr, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-12 gap-4 items-end border-b pb-4 ${embr.isNotApplicable ? 'bg-muted opacity-60' : ''}`}
                >
                  {/* BUG-CS7 fix: disable fields when approved */}
                  <div className="col-span-3">
                    <label className="block text-sm font-medium mb-2">Embroidery {index + 1} Name</label>
                    <Input
                      placeholder="Embroidery name"
                      value={embr.embroideryName}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryName', e.target.value)}
                      disabled={embr.isNotApplicable || isApprovedCostSheet}
                      className={embr.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Average</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.embroideryAverage || ''}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryAverage', parseFloat(e.target.value) || 0)}
                      disabled={embr.isNotApplicable || isApprovedCostSheet}
                      className={embr.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Rate</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.embroideryRate || ''}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryRate', parseFloat(e.target.value) || 0)}
                      disabled={embr.isNotApplicable || isApprovedCostSheet}
                      className={embr.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Total</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.isNotApplicable ? 'N/A' : embr.embroideryTotal.toFixed(2)}
                      disabled
                      className={`bg-muted ${embr.isNotApplicable ? 'line-through text-muted-foreground' : ''}`}
                    />
                  </div>
                  {/* BUG-CS7 fix: disable when approved */}
                  <div className="col-span-2 flex items-center justify-center">
                    <label
                      className={`flex items-center gap-1 ${isApprovedCostSheet ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      title="Not Applicable"
                    >
                      <Checkbox
                        checked={embr.isNotApplicable || false}
                        onCheckedChange={(checked) => updateEmbroideryRow(index, 'isNotApplicable', checked)}
                        disabled={isApprovedCostSheet}
                      />
                      <span className="text-xs text-muted-foreground">N/A</span>
                    </label>
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeEmbroideryRow(index)}
                      disabled={isApprovedCostSheet}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {embroideryDetails.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-lg font-semibold text-right">
                Embroidery Total: {formatCurrency(calculateEmbroideryTotal())}
              </p>
            </div>
          )}
        </div>

        {/* Accessories Details */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold">Accessories Details</h2>
            {/* BUG-CS7 fix: disable button when approved */}
            <Button type="button" onClick={addAccessoryRow} size="sm" disabled={isApprovedCostSheet}>
              <Plus className="w-4 h-4 mr-1" /> Add Accessory
            </Button>
          </div>
          {accessoriesDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No accessories added. Click "Add Accessory" to start.
            </p>
          ) : (
            <div className="space-y-4">
              {accessoriesDetails.map((acc, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-12 gap-4 items-end border-b pb-4 ${acc.isNotApplicable ? 'bg-muted opacity-60' : ''}`}
                >
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <Select
                      value={acc.materialType || ''}
                      onValueChange={(val) => updateAccessoryRow(index, 'materialType', val)}
                      disabled={acc.isNotApplicable || isApprovedCostSheet}
                    >
                      {/* BUG-CS7 fix: disable when approved */}
                      <SelectTrigger className={acc.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LABEL">Label</SelectItem>
                        <SelectItem value="PACKAGING">Packaging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium mb-2">
                      Name
                      {hasAccessoryMasterLink(acc) ? (
                        <Link2 className="inline-block w-3 h-3 ml-1 text-success" />
                      ) : acc.materialType && acc.accessoryName ? (
                        <span title="Not linked to a master record. MRP may skip this item.">
                          <Unlink className="inline-block w-3 h-3 ml-1 text-orange-500" />
                        </span>
                      ) : null}
                    </label>
                    {/* BUG-CS7 fix: disable when approved */}
                    {acc.materialType === 'LABEL' || acc.materialType === 'PACKAGING' ? (
                      <TrimMasterCombobox
                        materialType={acc.materialType}
                        value={getAccessoryMasterId(acc)}
                        onSelect={(selection) => handleAccessoryMasterSelect(index, selection)}
                        disabled={acc.isNotApplicable || isApprovedCostSheet}
                        customerId={selectedCustomerId}
                        className={acc.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                      />
                    ) : (
                      <Input
                        placeholder="Accessory name"
                        value={acc.accessoryName}
                        onChange={(e) => updateAccessoryRow(index, 'accessoryName', e.target.value)}
                        disabled={acc.isNotApplicable || isApprovedCostSheet}
                        className={acc.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                      />
                    )}
                  </div>
                  {/* BUG-CS7 fix: disable when approved */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.accessoryQuantity || ''}
                      onChange={(e) => updateAccessoryRow(index, 'accessoryQuantity', parseFloat(e.target.value) || 0)}
                      disabled={acc.isNotApplicable || isApprovedCostSheet}
                      className={acc.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Rate</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.accessoryRate || ''}
                      onChange={(e) => updateAccessoryRow(index, 'accessoryRate', parseFloat(e.target.value) || 0)}
                      disabled={acc.isNotApplicable || isApprovedCostSheet}
                      className={acc.isNotApplicable || isApprovedCostSheet ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium mb-2">Total</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.isNotApplicable ? 'N/A' : acc.accessoryTotal.toFixed(2)}
                      disabled
                      className={`bg-muted ${acc.isNotApplicable ? 'line-through text-muted-foreground' : ''}`}
                    />
                  </div>
                  {/* BUG-CS7 fix: disable when approved */}
                  <div className="col-span-1 flex items-center justify-center">
                    <label
                      className={`flex items-center gap-1 ${isApprovedCostSheet ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      title="Not Applicable"
                    >
                      <Checkbox
                        checked={acc.isNotApplicable || false}
                        onCheckedChange={(checked) => updateAccessoryRow(index, 'isNotApplicable', checked)}
                        disabled={isApprovedCostSheet}
                      />
                      <span className="text-xs text-muted-foreground">N/A</span>
                    </label>
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAccessoryRow(index)}
                      disabled={isApprovedCostSheet}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {accessoriesDetails.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-lg font-semibold text-right">
                Accessories Total: {formatCurrency(calculateAccessoriesTotal())}
              </p>
            </div>
          )}
        </div>

        {/* Value Loss & Markup */}
        {/* BUG-CS7 fix: disable fields when approved */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-display font-semibold mb-4">Value Loss & Markup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Value Loss (%)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.00"
                value={valueLossPercent}
                onChange={(e) => setValueLossPercent(parseFloat(e.target.value) || 0)}
                disabled={isApprovedCostSheet}
              />
              <p className="text-sm text-muted-foreground mt-1">Default: 2%</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Markup (%)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="15.00"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
                disabled={isApprovedCostSheet}
              />
              <p className="text-sm text-muted-foreground mt-1">Default: 15%</p>
            </div>
          </div>

          <div className="space-y-3 bg-muted p-4 rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fabric Total:</span>
              <span className="font-semibold">{formatCurrency(calculateFabricTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trims Total:</span>
              <span className="font-semibold">{formatCurrency(calculateTrimsTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lace Total:</span>
              <span className="font-semibold">{formatCurrency(calculateLaceTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CMT Total:</span>
              <span className="font-semibold">{formatCurrency(calculateCMTTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embroidery Total:</span>
              <span className="font-semibold">{formatCurrency(calculateEmbroideryTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accessories Total:</span>
              <span className="font-semibold">{formatCurrency(calculateAccessoriesTotal())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold text-lg">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Value Loss ({valueLossPercent}%):</span>
              <span className="font-semibold text-primary">+ {formatCurrency(calculateValueLossAmount())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-semibold">Total After Value Loss:</span>
              <span className="font-semibold text-lg">{formatCurrency(calculateTotalAfterValueLoss())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Markup ({markupPercent}%):</span>
              <span className="font-semibold text-success">+ {formatCurrency(calculateMarkupAmount())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-400">
              <span className="font-bold text-lg">Total Product Cost:</span>
              <span className="font-bold text-2xl text-success">{formatCurrency(calculateTotalProductCost())}</span>
            </div>
          </div>
        </div>

        {/* Closed Cost - Final Agreed Price with Customer */}
        <div className="bg-card p-6 rounded-lg shadow border-2 border-info/20">
          <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
            <span className="text-info">💰</span>
            Closed Cost (Final Agreed Price)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enter the final price agreed with the customer. This will be used for billing (exclusive of tax).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BUG-CS7 fix: disable when approved */}
            <div>
              <label className="block text-sm font-medium mb-2">Closed Cost per Piece (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={closedCost || ''}
                onChange={(e) => setClosedCost(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Enter final agreed price"
                className="font-mono"
                disabled={isApprovedCostSheet}
              />
              {calculateTotalProductCost() > 0 && closedCost && (
                <div className="text-xs mt-2">
                  {closedCost > calculateTotalProductCost() ? (
                    <span className="text-success">
                      +₹{(closedCost - calculateTotalProductCost()).toFixed(2)} above calculated cost (
                      {(((closedCost - calculateTotalProductCost()) / closedCost) * 100).toFixed(1)}% margin)
                    </span>
                  ) : closedCost < calculateTotalProductCost() ? (
                    <span className="text-warning">
                      ₹{(calculateTotalProductCost() - closedCost).toFixed(2)} below calculated cost (
                      {(((calculateTotalProductCost() - closedCost) / calculateTotalProductCost()) * 100).toFixed(1)}%
                      loss)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Same as calculated cost</span>
                  )}
                </div>
              )}
            </div>
            {/* BUG-CS7 fix: disable when approved */}
            <div>
              <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
              <textarea
                className={`w-full border rounded-md p-2 min-h-[80px] ${isApprovedCostSheet ? 'bg-muted cursor-not-allowed' : ''}`}
                value={closedCostNotes}
                onChange={(e) => setClosedCostNotes(e.target.value)}
                placeholder="Reason for price variance, negotiation details, etc."
                disabled={isApprovedCostSheet}
              />
            </div>
          </div>

          {/* Price Comparison Card */}
          {closedCost && (
            <div className="mt-4 p-4 bg-info-muted rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Calculated Cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculateTotalProductCost())}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Closed Cost</p>
                  <p className="text-lg font-bold text-info">{formatCurrency(closedCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p
                    className={`text-lg font-semibold ${closedCost >= calculateTotalProductCost() ? 'text-success' : 'text-warning'}`}
                  >
                    {closedCost >= calculateTotalProductCost() ? '+' : ''}
                    {/* BUG-ORD9 fix: guard against division by zero */}
                    {calculateTotalProductCost() !== 0
                      ? (((closedCost - calculateTotalProductCost()) / calculateTotalProductCost()) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        {/* BUG-CS7 fix: disable submit when approved */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/cost-sheets')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || isApprovedCostSheet}>
            {loading ? 'Saving...' : isEditMode ? 'Update Cost Sheet' : 'Create Cost Sheet'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CostSheetForm;
