import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Sparkles, Plus, Info } from 'lucide-react';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { fabricService, greigeService } from '../services/fabricGreigeService';
import { PatternPartMultiSelect } from '../components/fabric/PatternPartMultiSelect';
import { embroideryService } from '../services/embroidery.service';
import type {
  FabricMasterFormData,
  GreigeMaster,
  FabricStyleAllocation,
  PatternPartForAllocation,
} from '../types/fabric-greige.types';
import type { Embroidery } from '../types/embroidery.types';
import { logError } from '../lib/logger';
import { notify } from '../lib/notify';
import api from '@/lib/api';
import { FABRIC_FINISH_TYPES, getFinishTypeLabel } from '../constants/fabric-finish-types';
import ColorPicker from '../components/ColorPicker';
import { GenericGreigeSelector } from '../components/GenericGreigeSelector';
import AllocatedStylesCard from '../components/fabric/AllocatedStylesCard';
import AllocateFabricToStyleModal from '../components/fabric/AllocateFabricToStyleModal';
import { QuickCreateGreigeModal } from '../components/QuickCreateGreigeModal';
import { StyleCombobox } from '../components/StyleCombobox';

type FabricSource = 'style_linked' | 'stock';

// Style fabric within a component (from API)
interface StyleFabricInfo {
  id: string;
  fabricName?: string | null;
  genericGreigeName?: string | null;
  fabricFinishType?: string | null;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
}

// Style component with componentMaster from API
// Note: styleFabrics is mapped to 'fabrics' by the serializer
interface StyleComponentWithMaster {
  id: string;
  componentName: string;
  componentMaster?: {
    id: string;
    code: string;
    name: string;
  };
  fabrics?: StyleFabricInfo[];
  styleFabrics?: StyleFabricInfo[]; // Also check for unmapped version
}

interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  components?: StyleComponentWithMaster[];
}

interface FabricFormProps {
  mode?: 'create' | 'edit';
}

export default function FabricForm({ mode = 'create' }: FabricFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  // URL params for auto-population (e.g., from Stock Entry page or Style Form)
  const preselectedStyleId = searchParams.get('styleId');
  const preselectedSource = searchParams.get('source') as FabricSource | null;
  const preselectedComponentId = searchParams.get('componentId');
  const preselectedFinishType = searchParams.get('finishType');
  // New params from Style Form "Create New Fabric" link
  const preselectedStyleCode = searchParams.get('styleCode');
  const preselectedComponentName = searchParams.get('componentName');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [greigeMasters, setGreigeMasters] = useState<GreigeMaster[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  // New state for fabric source and styles
  // Initialize from URL params if coming from Style Form
  const [fabricSource, setFabricSource] = useState<FabricSource>(preselectedSource || 'stock');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(preselectedStyleId || '');
  const [selectedStyleCode, setSelectedStyleCode] = useState<string>(preselectedStyleCode || '');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  // Component and pattern parts state (for style_linked)
  // Multi-component selection (array of component IDs)
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  // Two separate arrays for CAD-defined and master pattern parts
  const [cadPatternParts, setCadPatternParts] = useState<PatternPartForAllocation[]>([]);
  const [masterPatternParts, setMasterPatternParts] = useState<PatternPartForAllocation[]>([]);
  const [selectedPatternPartIds, setSelectedPatternPartIds] = useState<string[]>([]);
  const [loadingPatternParts, setLoadingPatternParts] = useState(false);

  // Embroidery state for style-linked fabrics
  const [componentUsesEmbroidery, setComponentUsesEmbroidery] = useState(false);
  const [hasEmbroidery, setHasEmbroidery] = useState(false);
  const [selectedEmbroideryId, setSelectedEmbroideryId] = useState<string | null>(null);
  const [embroideryDesigns, setEmbroideryDesigns] = useState<Embroidery[]>([]);
  const [loadingEmbroidery, setLoadingEmbroidery] = useState(false);

  // State for style allocations (edit mode only)
  const [allocationId, setAllocationId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<FabricStyleAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [quickCreateGreigeOpen, setQuickCreateGreigeOpen] = useState(false);
  const [autoCreateGreigeConfirmOpen, setAutoCreateGreigeConfirmOpen] = useState(false);

  // Initialize formData with pre-filled values from URL params (Style Form link)
  // fabricName is left empty - auto-generated from greige, finish, color, width
  const [formData, setFormData] = useState<FabricMasterFormData>({
    fabricCode: '',
    fabricName: '',
    greigeId: '',
    greigeName: '',
    genericGreigeName: '',
    yarnCount: '',
    composition: '',
    colorName: '',
    colorCode: '',
    finishType: preselectedFinishType || 'DYED',
    printDesign: '',
    actualWidth: 0,
    cutableWidth: 0,
    finishedConstruction: '',
    actualGSM: undefined,
    valueAddition: '',
    valueAdditionCost: undefined,
    styleReference: preselectedStyleCode || '',
    description: '',
    notes: '',
    imageUrl: '',
    isGeneric: false,
    isActive: true,
    suppliers: [],
  });

  // Load styles for style_linked source
  const loadStyles = useCallback(async () => {
    try {
      const response = await api.get<{ data: Style[] }>('/styles?limit=200&isActive=true');
      setStyles(response.data.data || []);
    } catch (error) {
      logError('Error loading styles:', error);
    }
  }, []);

  // Load embroidery designs
  const loadEmbroideryDesigns = useCallback(async () => {
    try {
      setLoadingEmbroidery(true);
      const response = await embroideryService.getAllEmbroidery({ limit: 100, isActive: true });
      setEmbroideryDesigns(response.data || []);
    } catch (error) {
      logError('Error loading embroidery designs:', error);
      setEmbroideryDesigns([]);
    } finally {
      setLoadingEmbroidery(false);
    }
  }, []);

  // Fetch next fabric code from backend
  const fetchNextFabricCode = useCallback(async (source: FabricSource, styleCode?: string) => {
    try {
      let url = `/fabric-management/fabric/next-code?source=${source}`;
      if (source === 'style_linked' && styleCode) {
        url += `&styleCode=${styleCode}`;
      }
      const response = await api.get<{ nextCode: string }>(url);
      return response.data.nextCode || '';
    } catch (error) {
      logError('Error fetching next fabric code:', error);
      return '';
    }
  }, []);

  // Generate fabric name based on selected fields
  const generateFabricName = useCallback(() => {
    const parts: string[] = [];

    // Add style code for style_linked
    if (fabricSource === 'style_linked' && selectedStyleCode) {
      parts.push(selectedStyleCode);
    }

    // Add greige name or generic fabric name
    if (formData.greigeId) {
      const greige = greigeMasters.find((g) => g.id === formData.greigeId);
      if (greige) {
        // Extract fabric type from greige name (e.g., "Cambric 40×40" → "Cambric")
        const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        const fabricType = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
        parts.push(fabricType);
      }
    } else if (formData.genericGreigeName) {
      parts.push(formData.genericGreigeName);
    }

    // Add finish type display
    const finishDisplay = getFinishTypeDisplay(formData.finishType || '');
    if (finishDisplay) {
      parts.push(finishDisplay);
    }

    // Add first pattern part name (if any selected) - for fabric distinction
    if (selectedPatternPartIds.length > 0) {
      const allPatternParts = [...cadPatternParts, ...masterPatternParts];
      const firstSelectedPart = allPatternParts.find((part) => selectedPatternPartIds.includes(part.id));
      if (firstSelectedPart) {
        parts.push(firstSelectedPart.name);
      }
    }

    // Add color
    if (formData.colorName) {
      parts.push(formData.colorName);
    }

    // Add width
    if (formData.actualWidth) {
      parts.push(`${formData.actualWidth}"`);
    }

    // Add embroidery indicator if fabric has embroidery
    if (hasEmbroidery) {
      if (selectedEmbroideryId) {
        // Find the embroidery design to get its code
        const design = embroideryDesigns.find((d) => d.id === selectedEmbroideryId);
        if (design) {
          parts.push(design.embroideryCode);
        } else {
          parts.push('Embroidery');
        }
      } else {
        parts.push('Embroidery');
      }
    }

    return parts.join(' - ');
  }, [
    fabricSource,
    selectedStyleCode,
    formData.greigeId,
    formData.genericGreigeName,
    formData.finishType,
    formData.colorName,
    formData.actualWidth,
    greigeMasters,
    hasEmbroidery,
    selectedEmbroideryId,
    embroideryDesigns,
    selectedPatternPartIds,
    cadPatternParts,
    masterPatternParts,
  ]);

  // Helper to get finish type display text
  const getFinishTypeDisplay = (finishType: string): string => {
    return getFinishTypeLabel(finishType);
  };

  // Load style allocations for this fabric (edit mode only)
  // Note: Defined before useEffect to avoid hoisting issues
  const loadAllocations = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingAllocations(true);
      const response = await fabricService.getStyleAllocations(id);
      setAllocations(response.allocations || []);
    } catch (error) {
      logError('Error loading style allocations:', error);
      setAllocations([]);
    } finally {
      setLoadingAllocations(false);
    }
  }, [id]);

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadFabric();
      loadAllocations();
    }
    loadGreigeMasters();
    loadSuppliers();
    loadStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, loadAllocations]);

  // Auto-generate fabric code when source or style changes (create mode only)
  useEffect(() => {
    if (mode === 'create') {
      const generateCode = async () => {
        // For style_linked, include styleCode in fabric code
        if (fabricSource === 'style_linked') {
          if (selectedStyleCode) {
            const code = await fetchNextFabricCode(fabricSource, selectedStyleCode);
            setFormData((prev) => ({ ...prev, fabricCode: code }));
          }
        } else {
          const code = await fetchNextFabricCode(fabricSource);
          setFormData((prev) => ({ ...prev, fabricCode: code }));
        }
      };
      generateCode();
    }
  }, [mode, fabricSource, selectedStyleCode, fetchNextFabricCode]);

  // Auto-generate fabric name when relevant fields change (create mode only)
  useEffect(() => {
    if (mode === 'create') {
      const generatedName = generateFabricName();
      if (generatedName) {
        setFormData((prev) => ({ ...prev, fabricName: generatedName }));
      }
    }
  }, [mode, generateFabricName]);

  // Sync selectedStyle when styles load and selectedStyleId is already set (edit mode)
  useEffect(() => {
    if (selectedStyleId && styles.length > 0 && !selectedStyle) {
      const style = styles.find((s) => s.id === selectedStyleId);
      if (style) {
        setSelectedStyle(style);
      }
    }
  }, [selectedStyleId, styles, selectedStyle]);

  // Auto-populate from URL params (e.g., from Stock Entry "Create fabric in Fabric Master" link)
  useEffect(() => {
    if (mode === 'edit') return;

    // Set source if provided and not already set
    if (preselectedSource && fabricSource !== preselectedSource) {
      setFabricSource(preselectedSource);
    }

    // Set finish type if provided
    if (preselectedFinishType && !formData.finishType) {
      setFormData((prev) => ({ ...prev, finishType: preselectedFinishType }));
    }
  }, [mode, preselectedSource, fabricSource, preselectedFinishType, formData.finishType]);

  // Note: styleCode and finishType are initialized directly in state from URL params

  // Auto-select style from URL params (after source is set to style_linked)
  useEffect(() => {
    if (mode === 'edit') return;
    if (fabricSource !== 'style_linked') return;
    if (!preselectedStyleId || selectedStyleId) return;

    handleStyleChangeFromCombobox(preselectedStyleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fabricSource, preselectedStyleId, selectedStyleId]);

  // Auto-select component from URL params by ID (after style components load)
  useEffect(() => {
    if (mode === 'edit') return;
    if (!preselectedComponentId) return;
    if (selectedComponentIds.length > 0) return;
    if (!selectedStyle?.components?.length) return;

    const componentExists = selectedStyle.components.some((c) => c.id === preselectedComponentId);
    if (componentExists) {
      setSelectedComponentIds([preselectedComponentId]);
      // Pass styleId explicitly to avoid stale closure issues
      loadComponentDetails(preselectedComponentId, preselectedStyleId || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, preselectedComponentId, selectedComponentIds, selectedStyle?.components]);

  // Auto-select component from URL params by NAME (from Style Form link)
  useEffect(() => {
    if (mode === 'edit') return;
    if (!preselectedComponentName) return;
    if (selectedComponentIds.length > 0) return;
    if (!selectedStyle?.components?.length) return;

    // Find component by name (componentMaster.name or componentName)
    const matchingComponent = selectedStyle.components.find(
      (c) => c.componentMaster?.name === preselectedComponentName || c.componentName === preselectedComponentName
    );
    if (matchingComponent) {
      setSelectedComponentIds([matchingComponent.id]);
      loadComponentDetails(matchingComponent.id, preselectedStyleId || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, preselectedComponentName, selectedComponentIds, selectedStyle?.components]);

  const loadFabric = async () => {
    try {
      setLoading(true);
      const fabric = await fabricService.getById(id!);

      // Load style allocations to determine fabric source
      const allocationsResponse = await fabricService.getStyleAllocations(id!);
      const hasAllocations = allocationsResponse.allocations && allocationsResponse.allocations.length > 0;

      // Set fabric source from persisted value, fallback to inference
      if (fabric.source === 'STOCK') {
        setFabricSource('stock');
      } else if (fabric.source === 'STYLE_LINKED' || hasAllocations) {
        setFabricSource('style_linked');

        // Only access allocations[0] if allocations actually exist
        if (hasAllocations) {
          const firstAllocation = allocationsResponse.allocations[0];
          setAllocationId(firstAllocation.id);
          if (firstAllocation.component?.style) {
            setSelectedStyleId(firstAllocation.component.style.id);
            setSelectedStyleCode(firstAllocation.component.style.styleCode);
            setSelectedComponentIds([firstAllocation.componentId]);

            // Extract pattern part IDs from the allocation
            if (firstAllocation.patternParts && firstAllocation.patternParts.length > 0) {
              const patternPartIds = firstAllocation.patternParts.map(
                (pp: { patternPartId: string }) => pp.patternPartId
              );
              setSelectedPatternPartIds(patternPartIds);
            }

            // Load pattern parts for the allocated component
            try {
              setLoadingPatternParts(true);
              const { cadPatternParts: cadParts, masterPatternParts: masterParts } =
                await fabricService.getCADPatternPartsForComponent(
                  firstAllocation.component.style.id,
                  firstAllocation.componentId
                );
              setCadPatternParts(cadParts);
              setMasterPatternParts(masterParts);
            } catch (error) {
              logError('Error loading pattern parts for allocation:', error);
            } finally {
              setLoadingPatternParts(false);
            }
          }
        }
        // If source is STYLE_LINKED but no allocations, fabric source is set
        // User can manually add allocations later
      } else {
        setFabricSource('stock');
      }

      setFormData({
        fabricCode: fabric.fabricCode,
        fabricName: fabric.fabricName,
        greigeId: fabric.greigeId,
        greigeName: fabric.greigeName || '',
        genericGreigeName: fabric.genericGreigeName || '',
        yarnCount: fabric.yarnCount || '',
        composition: fabric.composition || '',
        colorName: fabric.colorName || '',
        colorCode: fabric.colorCode || '',
        finishType: fabric.finishType || 'DYED',
        printDesign: fabric.printDesign || '',
        actualWidth: fabric.actualWidth,
        cutableWidth: fabric.cutableWidth || fabric.actualWidth - 2,
        finishedConstruction: fabric.finishedConstruction || '',
        actualGSM: fabric.actualGSM,
        valueAddition: fabric.valueAddition || '',
        valueAdditionCost: fabric.valueAdditionCost,
        styleReference: fabric.styleReference || '',
        description: fabric.description || '',
        notes: fabric.notes || '',
        imageUrl: fabric.imageUrl || '',
        isGeneric: fabric.isGeneric || false,
        isActive: fabric.isActive,
        suppliers:
          fabric.supplier?.map(
            (s: { supplier: { id: string }; isPreferred: boolean; isActive: boolean; notes?: string }) => ({
              supplierId: s.supplier.id,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
            })
          ) || [],
      });
    } catch (error) {
      logError('Error loading fabric:', error);
      notify.error('Failed to load fabric master');
    } finally {
      setLoading(false);
    }
  };

  const loadGreigeMasters = async () => {
    try {
      const response = await greigeService.getAll({ limit: 100, isActive: 'true' });
      setGreigeMasters(response.data);
    } catch (error) {
      logError('Error loading greige masters:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await api.get<{ data: { id: string; code: string; name: string }[] }>(
        '/suppliers?limit=100&category=FABRIC_SUPPLIER'
      );
      setSuppliers(response.data.data || []);
    } catch (error) {
      logError('Error loading suppliers:', error);
    }
  };

  // Handle removing a style allocation
  const handleRemoveAllocation = async (allocationId: string) => {
    if (!id) return;
    try {
      await fabricService.removeStyleAllocation(id, allocationId);
      notify.success('Style allocation removed');
      loadAllocations();
    } catch (error) {
      logError('Error removing allocation:', error);
      notify.error('Failed to remove style allocation');
    }
  };

  // Handle allocation completion from modal
  const handleAllocationComplete = () => {
    notify.success('Fabric allocated to style successfully');
    loadAllocations();
  };

  // Handle quick-create greige completion
  const handleGreigeCreated = (newGreige: GreigeMaster) => {
    // Add the new greige to the list
    setGreigeMasters((prev) => [newGreige, ...prev]);
    // Auto-select the new greige and populate fields
    setFormData((prev) => ({
      ...prev,
      greigeId: newGreige.id,
      greigeName: newGreige.greigeName,
      genericGreigeName: newGreige.genericGreigeName || prev.genericGreigeName,
      cutableWidth: newGreige.defaultCutableWidth ? Number(newGreige.defaultCutableWidth) : prev.cutableWidth,
    }));
  };

  // Handle fabric source change
  const handleFabricSourceChange = (newSource: FabricSource) => {
    setFabricSource(newSource);
    // Reset style selection when changing to stock
    if (newSource === 'stock') {
      setSelectedStyleId('');
      setSelectedStyleCode('');
      setSelectedStyle(null);
    }
    // Always reset component and pattern parts when changing source
    setSelectedComponentIds([]);
    setCadPatternParts([]);
    setMasterPatternParts([]);
    setSelectedPatternPartIds([]);
    // Reset embroidery state
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);
    // Set isGeneric based on source
    setFormData((prev) => ({
      ...prev,
      isGeneric: newSource === 'stock',
    }));
  };

  // Handle style selection from searchable combobox
  const handleStyleChangeFromCombobox = async (styleId: string) => {
    if (!styleId) {
      setSelectedStyleId('');
      setSelectedStyle(null);
      setSelectedStyleCode('');
      return;
    }
    // Reset state immediately
    setSelectedStyleId(styleId);
    setSelectedComponentIds([]);
    setCadPatternParts([]);
    setMasterPatternParts([]);
    setSelectedPatternPartIds([]);
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);

    // Fetch full style detail (with components) for component dropdown
    try {
      const response = await api.get<{ data: Style } | Style>(`/styles/${styleId}`);
      const fullStyle = (response.data as { data: Style }).data || (response.data as Style);
      setSelectedStyle(fullStyle);
      setSelectedStyleCode(fullStyle.styleCode || '');
      setFormData((prev) => ({
        ...prev,
        styleReference: fullStyle.styleCode || '',
      }));
    } catch (error) {
      logError('Error loading style detail:', error);
    }
  };

  // Handle component toggle - multi-select support
  // Also auto-populates genericGreigeName from the component's style_fabrics (uses first selected)
  // And checks if component uses embroidery
  const handleComponentToggle = (componentId: string, checked: boolean) => {
    setSelectedComponentIds((prev) => {
      if (checked) {
        return [...prev, componentId];
      } else {
        return prev.filter((id) => id !== componentId);
      }
    });

    // When adding first component or changing selection, update pattern parts
    if (checked) {
      loadComponentDetails(componentId);
    } else if (selectedComponentIds.length === 1 && selectedComponentIds[0] === componentId) {
      // Last component unchecked - reset pattern parts
      setSelectedPatternPartIds([]);
      setCadPatternParts([]);
      setMasterPatternParts([]);
      setComponentUsesEmbroidery(false);
      setHasEmbroidery(false);
      setSelectedEmbroideryId(null);
    }
  };

  // Load details for a component (pattern parts, embroidery, etc.)
  // styleIdOverride allows passing styleId explicitly to avoid stale closure issues
  const loadComponentDetails = async (componentId: string, styleIdOverride?: string) => {
    setSelectedPatternPartIds([]);
    setCadPatternParts([]);
    setMasterPatternParts([]);
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);

    // Use passed styleId OR fall back to selectedStyleId from closure
    const effectiveStyleId = styleIdOverride || selectedStyleId;

    // If no component or style context, still load ALL pattern parts as fallback
    if (!componentId || !effectiveStyleId) {
      try {
        setLoadingPatternParts(true);
        const allParts = await fabricService.getAllPatternParts();
        setMasterPatternParts(allParts);
      } catch (err) {
        logError('Error loading fallback pattern parts:', err);
      } finally {
        setLoadingPatternParts(false);
      }
      return;
    }

    // Auto-populate genericGreigeName from the selected component's fabrics
    const component = selectedStyle?.components?.find((c) => c.id === componentId);
    const componentFabrics = component?.fabrics;
    if (componentFabrics && componentFabrics.length > 0) {
      const firstFabric = componentFabrics[0];
      const fabricGenericName = firstFabric.genericGreigeName || firstFabric.fabricName;
      const styleFinishType = firstFabric.fabricFinishType;
      if (fabricGenericName || styleFinishType) {
        setFormData((prev) => ({
          ...prev,
          ...(fabricGenericName && !prev.genericGreigeName ? { genericGreigeName: fabricGenericName } : {}),
          ...(styleFinishType ? { finishType: styleFinishType } : {}),
        }));
      }

      // Check if any fabric in this component uses embroidery
      const usesEmbroidery = componentFabrics.some((f) => f.hasEmbroidery);
      if (usesEmbroidery) {
        setComponentUsesEmbroidery(true);
        // Load embroidery designs if not already loaded
        if (embroideryDesigns.length === 0) {
          loadEmbroideryDesigns();
        }
      }
    }

    try {
      setLoadingPatternParts(true);
      // Use new API that returns both CAD and master pattern parts
      const { cadPatternParts: cadParts, masterPatternParts: masterParts } =
        await fabricService.getCADPatternPartsForComponent(effectiveStyleId, componentId);
      setCadPatternParts(cadParts);
      setMasterPatternParts(masterParts);

      // If no CAD or component master parts found, load all available pattern parts as fallback
      if (cadParts.length === 0 && masterParts.length === 0) {
        const allParts = await fabricService.getAllPatternParts();
        setMasterPatternParts(allParts);
      }
    } catch (error) {
      logError('Error loading pattern parts:', error);
      // Fallback: load all available pattern parts so user can always select
      try {
        const allParts = await fabricService.getAllPatternParts();
        setMasterPatternParts(allParts);
      } catch (fallbackError) {
        logError('Error loading fallback pattern parts:', fallbackError);
      }
    } finally {
      setLoadingPatternParts(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData((prev) => {
        const updated = { ...prev, [name]: numValue };

        // Auto-calculate cutableWidth when actualWidth changes (skip for embroidery fabrics)
        if (name === 'actualWidth' && numValue && !hasEmbroidery) {
          updated.cutableWidth = numValue - 2;
        }

        return updated;
      });
    } else if (name === 'greigeId') {
      // When greige is selected, auto-populate fields from greige
      setFormData((prev) => {
        const updated = { ...prev, greigeId: value };
        if (value) {
          const greige = greigeMasters.find((g) => g.id === value);
          if (greige?.greigeName) {
            updated.greigeName = greige.greigeName;
          }
          if (greige?.genericGreigeName) {
            updated.genericGreigeName = greige.genericGreigeName;
          }
          // Inherit cutableWidth from greige's defaultCutableWidth if available
          if (greige?.defaultCutableWidth) {
            updated.cutableWidth = Number(greige.defaultCutableWidth);
          }
        }
        return updated;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSupplier = () => {
    setFormData((prev) => ({
      ...prev,
      suppliers: [...prev.suppliers, { supplierId: '', isPreferred: false, isActive: true, notes: '' }],
    }));
  };

  const handleRemoveSupplier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index),
    }));
  };

  const handleSupplierChange = (index: number, field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  // Check if we can auto-create a greige (has enough data)
  const canAutoCreateGreige = () => {
    return !formData.greigeId && formData.genericGreigeName && formData.actualWidth > 0;
  };

  // Auto-create greige and then save fabric
  const handleAutoCreateGreigeAndSave = async () => {
    try {
      setSaving(true);
      setAutoCreateGreigeConfirmOpen(false);

      // Create the greige first
      const greigeName = `${formData.genericGreigeName} ${formData.actualWidth}"`;
      const newGreige = await greigeService.create({
        greigeCode: '', // Backend will auto-generate
        greigeName,
        genericGreigeName: formData.genericGreigeName,
        greigeWidth: formData.actualWidth,
        defaultCutableWidth:
          formData.cutableWidth || (formData.actualWidth > 4 ? formData.actualWidth - 4 : formData.actualWidth),
        composition: formData.composition || '100% Cotton',
        averageShrinkagePercent: 8,
        isActive: true,
        suppliers: [],
      });

      notify.success(`Greige "${newGreige.greigeName}" created automatically`);

      // Update formData with new greige and save fabric
      const updatedFormData = {
        ...formData,
        greigeId: newGreige.id,
        greigeName: newGreige.greigeName,
        source: fabricSource === 'style_linked' ? 'STYLE_LINKED' : 'STOCK',
      };

      // Add new greige to the list
      setGreigeMasters((prev) => [newGreige, ...prev]);

      // Now save the fabric with the greige linked
      await saveFabric(updatedFormData);
    } catch (error) {
      logError('Error auto-creating greige:', error);
      notify.error('Failed to auto-create greige');
      setSaving(false);
    }
  };

  // Core save fabric function (called directly or after greige creation)
  const saveFabric = async (dataToSave: FabricMasterFormData) => {
    // Sanitize empty strings to null for optional fields (Zod requires null/undefined, not "")
    const sanitizedData = {
      ...dataToSave,
      greigeId: dataToSave.greigeId || null,
      greigeName: dataToSave.greigeName || null,
      genericGreigeName: dataToSave.genericGreigeName || null,
      yarnCount: dataToSave.yarnCount || null,
      composition: dataToSave.composition || null,
      colorName: dataToSave.colorName || null,
      colorCode: dataToSave.colorCode || null,
      finishType: dataToSave.finishType || null,
      printDesign: dataToSave.printDesign || null,
      finishedConstruction: dataToSave.finishedConstruction || null,
      valueAddition: dataToSave.valueAddition || null,
      styleReference: dataToSave.styleReference || null,
      description: dataToSave.description || null,
      notes: dataToSave.notes || null,
      imageUrl: dataToSave.imageUrl || null,
    };

    try {
      if (mode === 'edit' && id) {
        await fabricService.update(id, sanitizedData);

        // Update pattern parts if this is a style-linked fabric with an existing allocation
        if (fabricSource === 'style_linked' && allocationId) {
          try {
            await fabricService.updateAllocationPatternParts(id, allocationId, selectedPatternPartIds);
          } catch (ppError) {
            logError('Error updating pattern parts:', ppError);
            notify.warning('Fabric updated but failed to save pattern parts');
          }
        }

        notify.success('Fabric master updated successfully');
      } else {
        const result = await fabricService.create(sanitizedData);

        // If style_linked, allocate to the selected style/component(s)
        if (fabricSource === 'style_linked' && selectedComponentIds.length > 0 && result?.id) {
          try {
            await fabricService.allocateToStyle(result.id, {
              componentIds: selectedComponentIds,
              patternPartIds: selectedPatternPartIds.length > 0 ? selectedPatternPartIds : undefined,
              hasEmbroidery: hasEmbroidery,
              embroideryId: hasEmbroidery && selectedEmbroideryId ? selectedEmbroideryId : undefined,
            });
            notify.success('Fabric master created and allocated to style successfully');
          } catch (allocError: unknown) {
            logError('Error allocating fabric to style:', allocError);
            const axiosAllocErr = allocError as { response?: { data?: { error?: string; message?: string } } };
            const allocErrMsg =
              axiosAllocErr.response?.data?.error || axiosAllocErr.response?.data?.message || 'Unknown error';
            notify.warning(`Fabric created but failed to allocate to style: ${allocErrMsg}`);
          }
        } else {
          notify.success('Fabric master created successfully');
        }
      }
      navigate('/fabric');
    } catch (error: unknown) {
      logError('Error saving fabric:', error);
      const axiosErr = error as { response?: { data?: { error?: string } } };
      notify.error(axiosErr.response?.data?.error || 'Failed to save fabric master');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation based on fabric source
    const missingFields: string[] = [];

    // Style and Component are required for style_linked
    if (fabricSource === 'style_linked') {
      if (!selectedStyleId) missingFields.push('Style');
      if (selectedComponentIds.length === 0) missingFields.push('Component');
    }

    // All sources: require either greige OR generic fabric name
    if (!formData.greigeId && !formData.genericGreigeName) {
      missingFields.push('Generic Greige Name (or select a Greige Name)');
    }

    // Common validation
    if (!formData.fabricCode) missingFields.push('Fabric Code');
    if (!formData.fabricName) missingFields.push('Fabric Name');
    if (!formData.finishType) missingFields.push('Finish Type');
    if (!formData.actualWidth) missingFields.push('Actual Width');

    if (missingFields.length > 0) {
      notify.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    if (formData.actualWidth <= 0) {
      notify.error('Actual width must be greater than 0');
      return;
    }

    // Check if we should offer to auto-create greige
    // Only in create mode and if no greige is selected but we have the data to create one
    if (mode === 'create' && canAutoCreateGreige()) {
      setAutoCreateGreigeConfirmOpen(true);
      return;
    }

    // Proceed with normal save
    setSaving(true);
    const dataWithSource = {
      ...formData,
      source: fabricSource === 'style_linked' ? 'STYLE_LINKED' : 'STOCK',
    };
    await saveFabric(dataWithSource);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={mode === 'edit' ? 'Edit Fabric Master' : 'New Fabric Master'} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Source & Linking */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Source & Linking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Fabric Source - smaller width */}
              <div className="col-span-12 sm:col-span-4 lg:col-span-3">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Source <span className="text-destructive">*</span>
                </label>
                <select
                  value={fabricSource}
                  onChange={(e) => handleFabricSourceChange(e.target.value as FabricSource)}
                  className="w-full h-10 px-3 py-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-info"
                  disabled={mode === 'edit'}
                >
                  <option value="style_linked">Style-Linked</option>
                  <option value="stock">Stock/Generic</option>
                </select>
              </div>

              {/* Style searchable dropdown */}
              {fabricSource === 'style_linked' && (
                <div className="col-span-12 sm:col-span-4 lg:col-span-5">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Style <span className="text-destructive">*</span>
                  </label>
                  <StyleCombobox
                    value={selectedStyleId}
                    onChange={(styleId) => handleStyleChangeFromCombobox(styleId)}
                    placeholder="Search by style code..."
                    disabled={mode === 'edit'}
                  />
                </div>
              )}

              {/* Component multi-select */}
              {fabricSource === 'style_linked' && selectedStyleId && (
                <div className="col-span-12 sm:col-span-6 lg:col-span-6">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Components <span className="text-destructive">*</span>
                    {selectedComponentIds.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({selectedComponentIds.length} selected)
                      </span>
                    )}
                  </label>
                  <div className="border border-border rounded-md p-2 max-h-32 overflow-y-auto bg-background">
                    {selectedStyle?.components?.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No components available</span>
                    ) : (
                      selectedStyle?.components?.map((comp) => (
                        <label
                          key={comp.id}
                          className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedComponentIds.includes(comp.id)}
                            onChange={(e) => handleComponentToggle(comp.id, e.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm">{comp.componentMaster?.name || comp.componentName}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Embroidery Section - Shows when component uses embroidery */}
            {fabricSource === 'style_linked' && selectedComponentIds.length > 0 && componentUsesEmbroidery && (
              <div className="border-l-4 border-l-accent pl-4 py-3 bg-accent/10 rounded-r">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-accent">
                    This component has embroidered fabric requirements
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="hasEmbroidery" className="text-sm text-accent">
                      This fabric will be embroidered
                    </Label>
                    <Select
                      value={hasEmbroidery ? 'yes' : 'no'}
                      onValueChange={(val) => {
                        setHasEmbroidery(val === 'yes');
                        if (val === 'no') {
                          setSelectedEmbroideryId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="w-24 h-8 border-accent/25 focus:ring-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasEmbroidery && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-accent mb-1">Embroidery Design</label>
                      <select
                        value={selectedEmbroideryId || ''}
                        onChange={(e) => setSelectedEmbroideryId(e.target.value || null)}
                        disabled={loadingEmbroidery}
                        className="w-full max-w-md h-10 px-3 py-2 text-sm border border-accent/25 rounded-md bg-card focus:ring-purple-500 focus:border-accent"
                      >
                        <option value="">Select embroidery design (optional)...</option>
                        {embroideryDesigns.map((design) => (
                          <option key={design.id} value={design.id}>
                            {design.embroideryCode} - {design.designName}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-accent mt-1">Design can be selected later if not yet finalized</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Finish Type, Pattern Parts, Color */}
            <div className="grid grid-cols-12 gap-4 items-start">
              {/* Finish Type */}
              <div className="col-span-6 sm:col-span-3">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Finish Type <span className="text-destructive">*</span>
                </label>
                <select
                  name="finishType"
                  value={formData.finishType}
                  onChange={handleChange}
                  className="w-full h-10 px-3 py-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-info"
                  required
                >
                  {FABRIC_FINISH_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pattern Parts */}
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-sm font-medium text-foreground mb-1">Pattern Parts</label>
                {fabricSource === 'style_linked' && selectedComponentIds.length > 0 ? (
                  loadingPatternParts ? (
                    <span className="text-xs text-muted-foreground">Loading pattern parts...</span>
                  ) : cadPatternParts.length > 0 || masterPatternParts.length > 0 ? (
                    <PatternPartMultiSelect
                      cadPatternParts={cadPatternParts}
                      masterPatternParts={masterPatternParts}
                      selectedIds={selectedPatternPartIds}
                      onChange={setSelectedPatternPartIds}
                      placeholder="Search and select pattern parts..."
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No pattern parts defined</span>
                  )
                ) : (
                  <Input type="text" disabled placeholder="Select a style & component first" className="text-sm" />
                )}
              </div>

              {/* Color */}
              <div className="col-span-12 sm:col-span-4">
                <label className="block text-sm font-medium text-foreground mb-1">Color</label>
                <ColorPicker
                  value={selectedColorId}
                  onChange={(colorId, color) => {
                    setSelectedColorId(colorId);
                    if (color) {
                      setFormData((prev) => ({
                        ...prev,
                        colorName: color.colorName,
                        colorCode: color.hexCode || '',
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        colorName: '',
                        colorCode: '',
                      }));
                    }
                  }}
                  showFamilyFilter={false}
                  placeholder="Select color..."
                />
              </div>
            </div>

            {/* Print Design - only when printed */}
            {formData.finishType === 'PRINTED' && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-sm font-medium text-foreground mb-1">Print Design</label>
                  <Input
                    type="text"
                    name="printDesign"
                    value={formData.printDesign}
                    onChange={handleChange}
                    placeholder="Pattern reference"
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Fabric Details — 2×2 grid */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Fabric Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-4">
              {/* Row 1 */}
              <div className="col-span-12 sm:col-span-6">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Code <span className="text-destructive">*</span>
                  <span className="text-xs text-info ml-1">(auto)</span>
                </label>
                <Input
                  type="text"
                  name="fabricCode"
                  value={formData.fabricCode}
                  onChange={handleChange}
                  placeholder="FAB-XXX-001"
                  required
                  readOnly
                  className="text-sm bg-muted cursor-not-allowed"
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Fabric Name <span className="text-destructive">*</span>
                  <span className="text-xs text-success ml-1">(auto-generated)</span>
                </label>
                <Input
                  type="text"
                  name="fabricName"
                  value={formData.fabricName}
                  onChange={handleChange}
                  placeholder='e.g., STY-001 - Cambric - Dyed - Navy Blue - 56"'
                  required
                  readOnly
                  className="text-sm bg-muted cursor-not-allowed"
                />
              </div>

              {/* Row 2 */}
              <div className="col-span-12 sm:col-span-6">
                <label className="flex items-center gap-1 text-sm font-medium text-foreground mb-1">
                  Generic Greige Name {!formData.greigeId && <span className="text-destructive">*</span>}
                  <span title="Simple category like 'Cambric', 'Poplin' - auto-filled when Greige Name is selected">
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </span>
                </label>
                <GenericGreigeSelector
                  value={formData.genericGreigeName}
                  onChange={(value) => setFormData((prev) => ({ ...prev, genericGreigeName: value }))}
                  label=""
                  placeholder="Search or type greige name..."
                  required={!formData.greigeId}
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="flex items-center gap-1 text-sm font-medium text-foreground mb-1">
                  Greige Name
                  <span title="Select from Greige Master - enables CAD planning and processor rate lookups">
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </span>
                  {formData.genericGreigeName && <span className="text-xs text-muted-foreground ml-1">(filtered)</span>}
                </label>
                <div className="flex gap-2">
                  <select
                    name="greigeId"
                    value={formData.greigeId}
                    onChange={handleChange}
                    className="flex-1 h-10 px-3 py-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-info"
                  >
                    <option value="">Select greige...</option>
                    {greigeMasters
                      .filter((greige) => {
                        if (!formData.genericGreigeName) return true;
                        const searchTerm = formData.genericGreigeName.toLowerCase();
                        return (
                          greige.genericGreigeName?.toLowerCase().includes(searchTerm) ||
                          greige.greigeName?.toLowerCase().includes(searchTerm)
                        );
                      })
                      .map((greige) => (
                        <option key={greige.id} value={greige.id}>
                          {greige.greigeName}
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickCreateGreigeOpen(true)}
                    className="flex items-center gap-1 whitespace-nowrap"
                    title="Quick create a new greige"
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Specifications */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Width" <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  name="actualWidth"
                  value={formData.actualWidth || ''}
                  onChange={handleChange}
                  placeholder="56"
                  step="0.1"
                  required
                  className="text-sm"
                />
              </div>

              {/* Cutable */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Cutable"{' '}
                  {hasEmbroidery ? (
                    <span className="text-xs text-accent">(manual)</span>
                  ) : (
                    <span className="text-xs text-success">(auto)</span>
                  )}
                </label>
                <Input
                  type="number"
                  name="cutableWidth"
                  value={formData.cutableWidth || ''}
                  onChange={handleChange}
                  placeholder={hasEmbroidery ? 'Enter width' : 'W-2'}
                  step="0.1"
                  className={`text-sm ${hasEmbroidery ? 'border-accent/25 focus:border-accent' : ''}`}
                />
              </div>

              {/* GSM */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">GSM</label>
                <Input
                  type="number"
                  name="actualGSM"
                  value={formData.actualGSM || ''}
                  onChange={handleChange}
                  placeholder="140"
                  step="0.1"
                  className="text-sm"
                />
              </div>

              {/* Yarn Count */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Yarn Count</label>
                <Input
                  type="text"
                  name="yarnCount"
                  value={formData.yarnCount}
                  onChange={handleChange}
                  placeholder="40x40"
                  className="text-sm"
                />
              </div>

              {/* Construction */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Construction</label>
                <Input
                  type="text"
                  name="finishedConstruction"
                  value={formData.finishedConstruction}
                  onChange={handleChange}
                  placeholder="96x92"
                  className="text-sm"
                />
              </div>

              {/* Composition */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Composition</label>
                <Input
                  type="text"
                  name="composition"
                  value={formData.composition}
                  onChange={handleChange}
                  placeholder="100% Cotton"
                  className="text-sm"
                />
              </div>
            </div>
            <input type="hidden" name="isGeneric" checked={formData.isGeneric} onChange={handleChange} />
          </CardContent>
        </Card>

        {/* Card 4: Suppliers */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Suppliers</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
                + Add Supplier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {formData.suppliers.length === 0 ? (
              <div className="text-center py-6 bg-muted rounded-md border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No suppliers added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.suppliers.map((supplier, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 p-3 border rounded-md bg-muted">
                    <select
                      value={supplier.supplierId}
                      onChange={(e) => handleSupplierChange(index, 'supplierId', e.target.value)}
                      className="flex-1 min-w-[200px] h-10 px-3 py-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplier.isPreferred}
                        onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                        className="h-4 w-4 rounded border-border text-info"
                      />
                      Preferred
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplier.isActive}
                        onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                        className="h-4 w-4 rounded border-border text-info"
                      />
                      Active
                    </label>
                    <Input
                      type="text"
                      value={supplier.notes}
                      onChange={(e) => handleSupplierChange(index, 'notes', e.target.value)}
                      placeholder="Notes..."
                      className="w-40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSupplier(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded p-1"
                      title="Remove supplier"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Allocated Styles - Only show in edit mode */}
        {mode === 'edit' && id && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Allocated Styles</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllocationModalOpen(true)}>
                  + Allocate to Style
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <AllocatedStylesCard
                allocations={allocations}
                onRemove={handleRemoveAllocation}
                editable={true}
                isLoading={loadingAllocations}
              />
            </CardContent>
          </Card>
        )}

        {/* Card 6: Additional Info */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Additional Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-12 sm:col-span-6">
                <label className="block text-sm font-medium text-foreground mb-1">Image URL</label>
                <Input
                  type="text"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <label className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-card cursor-pointer hover:bg-muted w-full">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border text-info focus:ring-blue-500"
                  />
                  <span className="text-sm text-foreground">Active</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes / Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-info"
                placeholder="Optional notes about this fabric..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/fabric')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : mode === 'edit' ? 'Update Fabric' : 'Create Fabric'}
          </Button>
        </div>
      </form>

      {/* Allocate to Style Modal - Only in edit mode */}
      {mode === 'edit' && id && (
        <AllocateFabricToStyleModal
          isOpen={allocationModalOpen}
          onClose={() => setAllocationModalOpen(false)}
          fabricId={id}
          fabricCode={formData.fabricCode}
          fabricName={formData.fabricName}
          onAllocationComplete={handleAllocationComplete}
        />
      )}

      {/* Quick Create Greige Modal */}
      <QuickCreateGreigeModal
        isOpen={quickCreateGreigeOpen}
        onClose={() => setQuickCreateGreigeOpen(false)}
        onGreigeCreated={handleGreigeCreated}
        initialGenericGreigeName={formData.genericGreigeName}
      />

      {/* Auto-Create Greige Confirmation Dialog */}
      <Dialog open={autoCreateGreigeConfirmOpen} onOpenChange={setAutoCreateGreigeConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Greige Automatically?</DialogTitle>
            <DialogDescription>
              No greige is linked to this fabric. Would you like to automatically create a matching greige for CAD
              planning?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-info-muted border border-info/20 rounded-lg p-3 text-sm">
              <p className="font-medium text-info">Greige will be created with:</p>
              <ul className="mt-2 text-info space-y-1">
                <li>
                  Name:{' '}
                  <span className="font-medium">
                    {formData.genericGreigeName} {formData.actualWidth}"
                  </span>
                </li>
                <li>
                  Width: <span className="font-medium">{formData.actualWidth}"</span>
                </li>
                <li>
                  Cutable Width:{' '}
                  <span className="font-medium">
                    {formData.cutableWidth ||
                      (formData.actualWidth > 4 ? formData.actualWidth - 4 : formData.actualWidth)}
                    "
                  </span>
                </li>
                {formData.composition && (
                  <li>
                    Composition: <span className="font-medium">{formData.composition}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setAutoCreateGreigeConfirmOpen(false);
                setSaving(true);
                await saveFabric({
                  ...formData,
                  source: fabricSource === 'style_linked' ? 'STYLE_LINKED' : 'STOCK',
                });
              }}
              disabled={saving}
            >
              Save Without Greige
            </Button>
            <Button type="button" onClick={handleAutoCreateGreigeAndSave} disabled={saving}>
              {saving ? 'Creating...' : 'Create Greige & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
