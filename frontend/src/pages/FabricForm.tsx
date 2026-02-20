import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Plus, Info } from 'lucide-react';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import type { FabricMasterFormData, GreigeMaster, FabricStyleAllocation, PatternPartForAllocation } from '../types/fabric-greige.types';
import type { Embroidery } from '../types/embroidery.types';
import { logError } from '../lib/logger';
import { notify } from '../lib/notify';
import { API_URL } from '../config/api.config';
import ColorPicker from '../components/ColorPicker';
import { GenericGreigeSelector } from '../components/GenericGreigeSelector';
import AllocatedStylesCard from '../components/fabric/AllocatedStylesCard';
import AllocateFabricToStyleModal from '../components/fabric/AllocateFabricToStyleModal';
import { QuickCreateGreigeModal } from '../components/QuickCreateGreigeModal';

type FabricSource = 'style_linked' | 'ready_purchase' | 'stock';

// Style fabric within a component (from API)
interface StyleFabricInfo {
  id: string;
  fabricName?: string | null;
  genericGreigeName?: string | null;
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [greigeMasters, setGreigeMasters] = useState<GreigeMaster[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  // New state for fabric source and styles
  const [fabricSource, setFabricSource] = useState<FabricSource>('stock');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [selectedStyleCode, setSelectedStyleCode] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  // Component and pattern parts state (for style_linked and ready_purchase)
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
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
  const [allocations, setAllocations] = useState<FabricStyleAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [quickCreateGreigeOpen, setQuickCreateGreigeOpen] = useState(false);
  const [autoCreateGreigeConfirmOpen, setAutoCreateGreigeConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false); // Flag to proceed after greige creation

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
    finishType: 'solid',
    printDesign: '',
    actualWidth: 0,
    cutableWidth: 0,
    finishedConstruction: '',
    actualGSM: undefined,
    valueAddition: '',
    valueAdditionCost: undefined,
    styleReference: '',
    componentType: '',
    description: '',
    notes: '',
    imageUrl: '',
    isGeneric: false,
    isActive: true,
    suppliers: [],
  });

  // Helper function to get auth token
  const getAuthToken = useCallback(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.token || null;
      } catch (e) {
        logError('Error parsing auth storage:', e);
      }
    }
    return null;
  }, []);

  // Load styles for style_linked source
  const loadStyles = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/styles?limit=200&isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStyles(data.data || []);
    } catch (error) {
      logError('Error loading styles:', error);
    }
  }, [getAuthToken]);

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
      const token = getAuthToken();
      let url = `${API_URL}/fabric-management/fabric/next-code?source=${source}`;
      if (source === 'style_linked' && styleCode) {
        url += `&styleCode=${styleCode}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return data.nextCode || '';
    } catch (error) {
      logError('Error fetching next fabric code:', error);
      return '';
    }
  }, [getAuthToken]);

  // Generate fabric name based on selected fields
  const generateFabricName = useCallback(() => {
    const parts: string[] = [];

    // Add style code for style_linked and ready_purchase
    if ((fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && selectedStyleCode) {
      parts.push(selectedStyleCode);
    }

    // Add greige name or generic fabric name
    if (formData.greigeId) {
      const greige = greigeMasters.find(g => g.id === formData.greigeId);
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
    const finishDisplay = getFinishTypeDisplay(formData.finishType);
    if (finishDisplay) {
      parts.push(finishDisplay);
    }

    // Add first pattern part name (if any selected) - for fabric distinction
    if (selectedPatternPartIds.length > 0) {
      const allPatternParts = [...cadPatternParts, ...masterPatternParts];
      const firstSelectedPart = allPatternParts.find(
        (part) => selectedPatternPartIds.includes(part.id)
      );
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
        const design = embroideryDesigns.find(d => d.id === selectedEmbroideryId);
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
  }, [fabricSource, selectedStyleCode, formData.greigeId, formData.genericGreigeName, formData.finishType, formData.colorName, formData.actualWidth, greigeMasters, hasEmbroidery, selectedEmbroideryId, embroideryDesigns, selectedPatternPartIds, cadPatternParts, masterPatternParts]);

  // Helper to get finish type display text
  const getFinishTypeDisplay = (finishType: string): string => {
    switch (finishType) {
      case 'solid':
      case 'reactive':
      case 'pigment':
        return 'Dyed';
      case 'printed':
        return 'Printed';
      case 'yarn_dyed':
        return 'Yarn Dyed';
      default:
        return '';
    }
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
  }, [mode, id, loadAllocations]);

  // Auto-generate fabric code when source or style changes (create mode only)
  useEffect(() => {
    if (mode === 'create') {
      const generateCode = async () => {
        // For style_linked and ready_purchase, include styleCode in fabric code
        if (fabricSource === 'style_linked' || fabricSource === 'ready_purchase') {
          if (selectedStyleCode) {
            const code = await fetchNextFabricCode(fabricSource, selectedStyleCode);
            setFormData(prev => ({ ...prev, fabricCode: code }));
          }
        } else {
          const code = await fetchNextFabricCode(fabricSource);
          setFormData(prev => ({ ...prev, fabricCode: code }));
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
        setFormData(prev => ({ ...prev, fabricName: generatedName }));
      }
    }
  }, [mode, generateFabricName]);

  // Sync selectedStyle when styles load and selectedStyleId is already set (edit mode)
  useEffect(() => {
    if (selectedStyleId && styles.length > 0 && !selectedStyle) {
      const style = styles.find(s => s.id === selectedStyleId);
      if (style) {
        setSelectedStyle(style);
      }
    }
  }, [selectedStyleId, styles, selectedStyle]);

  const loadFabric = async () => {
    try {
      setLoading(true);
      const fabric = await fabricService.getById(id!);

      // Load style allocations to determine fabric source
      const allocationsResponse = await fabricService.getStyleAllocations(id!);
      const hasAllocations = allocationsResponse.allocations && allocationsResponse.allocations.length > 0;

      // Set fabric source based on allocations
      if (hasAllocations) {
        setFabricSource('style_linked');

        // If there are allocations, pre-populate the first one for display
        const firstAllocation = allocationsResponse.allocations[0];
        if (firstAllocation.component?.style) {
          setSelectedStyleId(firstAllocation.component.style.id);
          setSelectedStyleCode(firstAllocation.component.style.styleCode);
          setSelectedComponentId(firstAllocation.componentId);

          // Extract pattern part IDs from the allocation
          if (firstAllocation.patternParts && firstAllocation.patternParts.length > 0) {
            const patternPartIds = firstAllocation.patternParts.map((pp: { patternPartId: string }) => pp.patternPartId);
            setSelectedPatternPartIds(patternPartIds);
          }

          // Load pattern parts for the allocated component
          try {
            setLoadingPatternParts(true);
            const { cadPatternParts: cadParts, masterPatternParts: masterParts } =
              await fabricService.getCADPatternPartsForComponent(firstAllocation.component.style.id, firstAllocation.componentId);
            setCadPatternParts(cadParts);
            setMasterPatternParts(masterParts);
          } catch (error) {
            logError('Error loading pattern parts for allocation:', error);
          } finally {
            setLoadingPatternParts(false);
          }
        }
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
        finishType: fabric.finishType || 'solid',
        printDesign: fabric.printDesign || '',
        actualWidth: fabric.actualWidth,
        cutableWidth: fabric.cutableWidth || (fabric.actualWidth - 2),
        finishedConstruction: fabric.finishedConstruction || '',
        actualGSM: fabric.actualGSM,
        valueAddition: fabric.valueAddition || '',
        valueAdditionCost: fabric.valueAdditionCost,
        styleReference: fabric.styleReference || '',
        componentType: fabric.componentType || '',
        description: fabric.description || '',
        notes: fabric.notes || '',
        imageUrl: fabric.imageUrl || '',
        isGeneric: fabric.isGeneric || false,
        isActive: fabric.isActive,
        suppliers: fabric.suppliers?.map((s: { supplier: { id: string }; isPreferred: boolean; isActive: boolean; notes?: string }) => ({
          supplierId: s.supplier.id,
          isPreferred: s.isPreferred,
          isActive: s.isActive,
          notes: s.notes || '',
        })) || [],
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
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/suppliers?limit=100&category=FABRIC_SUPPLIER`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSuppliers(data.data || []);
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
    setGreigeMasters(prev => [newGreige, ...prev]);
    // Auto-select the new greige and populate fields
    setFormData(prev => ({
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
    setSelectedComponentId('');
    setCadPatternParts([]);
    setMasterPatternParts([]);
    setSelectedPatternPartIds([]);
    // Reset embroidery state
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);
    // Set isGeneric based on source
    setFormData(prev => ({
      ...prev,
      isGeneric: newSource === 'stock',
    }));
  };

  // Handle style selection
  const handleStyleChange = (styleId: string) => {
    const style = styles.find(s => s.id === styleId);
    setSelectedStyleId(styleId);
    setSelectedStyle(style || null);
    setSelectedStyleCode(style?.styleCode || '');
    // Set styleReference in formData so it's saved to the fabric
    setFormData(prev => ({
      ...prev,
      styleReference: style?.styleCode || '',
    }));
    // Reset component and pattern parts when style changes
    setSelectedComponentId('');
    setCadPatternParts([]);
    setMasterPatternParts([]);
    setSelectedPatternPartIds([]);
    // Reset embroidery state
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);
  };

  // Handle component selection - loads CAD pattern parts first, then master pattern parts
  // Also auto-populates genericGreigeName from the component's style_fabrics
  // And checks if component uses embroidery
  const handleComponentChange = async (componentId: string) => {
    setSelectedComponentId(componentId);
    setSelectedPatternPartIds([]);
    setCadPatternParts([]);
    setMasterPatternParts([]);
    // Reset embroidery state for new component
    setComponentUsesEmbroidery(false);
    setHasEmbroidery(false);
    setSelectedEmbroideryId(null);

    if (!componentId || !selectedStyleId) return;

    // Auto-populate genericGreigeName from the selected component's style_fabrics
    // The serializer maps 'styleFabrics' to 'fabrics', so check both
    const component = selectedStyle?.components?.find(c => c.id === componentId);
    const componentFabrics = component?.fabrics || component?.styleFabrics;
    if (componentFabrics && componentFabrics.length > 0) {
      const firstFabric = componentFabrics[0];
      const fabricGenericName = firstFabric.genericGreigeName || firstFabric.fabricName;
      if (fabricGenericName && !formData.genericGreigeName) {
        // Only auto-populate if genericGreigeName is not already set
        setFormData(prev => ({
          ...prev,
          genericGreigeName: fabricGenericName,
        }));
      }

      // Check if any fabric in this component uses embroidery
      const usesEmbroidery = componentFabrics.some(f => f.hasEmbroidery);
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
        await fabricService.getCADPatternPartsForComponent(selectedStyleId, componentId);
      setCadPatternParts(cadParts);
      setMasterPatternParts(masterParts);
    } catch (error) {
      logError('Error loading pattern parts:', error);
      // Fallback to old behavior - load from component master only
      const componentMasterId = component?.componentMaster?.id;
      if (componentMasterId) {
        try {
          const parts = await fabricService.getPatternPartsForComponent(componentMasterId);
          setMasterPatternParts(parts);
        } catch (fallbackError) {
          logError('Error loading fallback pattern parts:', fallbackError);
        }
      }
    } finally {
      setLoadingPatternParts(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData(prev => {
        const updated = { ...prev, [name]: numValue };

        // Auto-calculate cutableWidth when actualWidth changes (skip for embroidery fabrics)
        if (name === 'actualWidth' && numValue && !hasEmbroidery) {
          updated.cutableWidth = numValue - 2;
        }

        return updated;
      });
    } else if (name === 'greigeId') {
      // When greige is selected, auto-populate fields from greige
      setFormData(prev => {
        const updated = { ...prev, greigeId: value };
        if (value) {
          const greige = greigeMasters.find(g => g.id === value);
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
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSupplier = () => {
    setFormData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, { supplierId: '', isPreferred: false, isActive: true, notes: '' }],
    }));
  };

  const handleRemoveSupplier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index),
    }));
  };

  const handleSupplierChange = (index: number, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
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
        defaultCutableWidth: formData.cutableWidth || (formData.actualWidth > 4 ? formData.actualWidth - 4 : formData.actualWidth),
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
      };

      // Add new greige to the list
      setGreigeMasters(prev => [newGreige, ...prev]);

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
    try {
      if (mode === 'edit' && id) {
        await fabricService.update(id, dataToSave);
        notify.success('Fabric master updated successfully');
      } else {
        const result = await fabricService.create(dataToSave);

        // If style_linked or ready_purchase, allocate to the selected style/component
        if ((fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && selectedComponentId && result?.id) {
          try {
            await fabricService.allocateToStyle(result.id, {
              componentId: selectedComponentId,
              patternPartIds: selectedPatternPartIds.length > 0 ? selectedPatternPartIds : undefined,
              hasEmbroidery: hasEmbroidery,
              embroideryId: hasEmbroidery && selectedEmbroideryId ? selectedEmbroideryId : undefined,
            });
            notify.success('Fabric master created and allocated to style successfully');
          } catch (allocError) {
            logError('Error allocating fabric to style:', allocError);
            notify.warning('Fabric created but failed to allocate to style');
          }
        } else {
          notify.success('Fabric master created successfully');
        }
      }
      navigate('/fabric');
    } catch (error: unknown) {
      logError('Error saving fabric:', error);
      notify.error((error as any).response?.data?.error || 'Failed to save fabric master');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation based on fabric source
    const missingFields: string[] = [];

    // Style and Component are required for style_linked and ready_purchase
    if (fabricSource === 'style_linked' || fabricSource === 'ready_purchase') {
      if (!selectedStyleId) missingFields.push('Style');
      if (!selectedComponentId) missingFields.push('Component');
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
    await saveFabric(formData);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={mode === 'edit' ? 'Edit Fabric Master' : 'New Fabric Master'} />

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        {/* Row 1: Source, Style, Component - all in one row when applicable */}
        <div className="grid grid-cols-12 gap-4">
          {/* Fabric Source - smaller width */}
          <div className="col-span-12 sm:col-span-4 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source <span className="text-red-500">*</span>
            </label>
            <select
              value={fabricSource}
              onChange={(e) => handleFabricSourceChange(e.target.value as FabricSource)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={mode === 'edit'}
            >
              <option value="style_linked">Style-Linked</option>
              <option value="ready_purchase">Ready Purchase</option>
              <option value="stock">Stock/Generic</option>
            </select>
          </div>

          {/* Style dropdown - wider */}
          {(fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && (
            <div className="col-span-12 sm:col-span-4 lg:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStyleId}
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select style...</option>
                {styles.map(style => (
                  <option key={style.id} value={style.id}>
                    {style.styleCode} - {style.styleName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Component dropdown */}
          {(fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && selectedStyleId && (
            <div className="col-span-12 sm:col-span-4 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedComponentId}
                onChange={(e) => handleComponentChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select component...</option>
                {selectedStyle?.components?.map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.componentMaster?.name || comp.componentName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Embroidery Section - Shows when component uses embroidery */}
        {(fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && selectedComponentId && componentUsesEmbroidery && (
          <div className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">
                This component has embroidered fabric requirements
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="hasEmbroidery" className="text-sm text-purple-800">
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
                  <SelectTrigger className="w-24 h-8 border-purple-300 focus:ring-purple-500">
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
                  <label className="block text-xs font-medium text-purple-700 mb-1">
                    Embroidery Design
                  </label>
                  <select
                    value={selectedEmbroideryId || ''}
                    onChange={(e) => setSelectedEmbroideryId(e.target.value || null)}
                    disabled={loadingEmbroidery}
                    className="w-full max-w-md px-3 py-2 text-sm border border-purple-300 rounded-md bg-white focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select embroidery design (optional)...</option>
                    {embroideryDesigns.map(design => (
                      <option key={design.id} value={design.id}>
                        {design.embroideryCode} - {design.designName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-purple-600 mt-1">
                    Design can be selected later if not yet finalized
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pattern Parts - Searchable Multi-Select Dropdown */}
        {(fabricSource === 'style_linked' || fabricSource === 'ready_purchase') && selectedComponentId && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-3">
            <label className="block text-xs font-medium text-gray-600 mb-2">Pattern Parts</label>
            {loadingPatternParts ? (
              <span className="text-xs text-gray-500">Loading pattern parts...</span>
            ) : (cadPatternParts.length > 0 || masterPatternParts.length > 0) ? (
              <PatternPartMultiSelect
                cadPatternParts={cadPatternParts}
                masterPatternParts={masterPatternParts}
                selectedIds={selectedPatternPartIds}
                onChange={setSelectedPatternPartIds}
                placeholder="Search and select pattern parts..."
              />
            ) : (
              <span className="text-xs text-gray-500 italic">No pattern parts defined for this component</span>
            )}
          </div>
        )}

        {/* Row 2: Fabric Identity */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Fabric Identity</h4>
          <div className="grid grid-cols-12 gap-4">
            {/* Code - narrow */}
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
                {mode === 'create' && <span className="text-xs text-blue-500 ml-1">(auto)</span>}
              </label>
              <Input
                type="text"
                name="fabricCode"
                value={formData.fabricCode}
                onChange={handleChange}
                placeholder="FAB-XXX-001"
                required
                readOnly={mode === 'create'}
                className={`text-sm ${mode === 'create' ? 'bg-gray-100' : ''}`}
              />
            </div>

            {/* Name - wide */}
            <div className="col-span-12 sm:col-span-9">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabric Name <span className="text-red-500">*</span>
                {mode === 'create' && <span className="text-xs text-green-600 ml-1">(auto-generated)</span>}
              </label>
              <Input
                type="text"
                name="fabricName"
                value={formData.fabricName}
                onChange={handleChange}
                placeholder='e.g., STY-001 - Cambric - Dyed - Navy Blue - 56"'
                required
                readOnly={mode === 'create'}
                className={`text-sm ${mode === 'create' ? 'bg-gray-100' : ''}`}
              />
            </div>

            {/* Generic Greige Name */}
            <div className="col-span-12 sm:col-span-4">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                Generic Greige Name {!formData.greigeId && <span className="text-red-500">*</span>}
                <Info
                  className="h-3.5 w-3.5 text-gray-400 cursor-help"
                  title="Simple category like 'Cambric', 'Poplin' - auto-filled when Greige Name is selected"
                />
              </label>
              <GenericGreigeSelector
                value={formData.genericGreigeName}
                onChange={(value) => setFormData(prev => ({ ...prev, genericGreigeName: value }))}
                label=""
                placeholder="Search or type greige name..."
                required={!formData.greigeId}
              />
            </div>

            {/* Greige Name (dropdown selector) */}
            <div className="col-span-12 sm:col-span-8">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                Greige Name
                <Info
                  className="h-3.5 w-3.5 text-gray-400 cursor-help"
                  title="Select from Greige Master - enables CAD planning and processor rate lookups"
                />
                {formData.genericGreigeName && <span className="text-xs text-gray-500 ml-1">(filtered)</span>}
              </label>
              <div className="flex gap-2">
                <select
                  name="greigeId"
                  value={formData.greigeId}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select greige...</option>
                  {greigeMasters
                    .filter(greige => {
                      if (!formData.genericGreigeName) return true;
                      const searchTerm = formData.genericGreigeName.toLowerCase();
                      return (
                        greige.genericGreigeName?.toLowerCase().includes(searchTerm) ||
                        greige.greigeName?.toLowerCase().includes(searchTerm)
                      );
                    })
                    .map(greige => (
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
        </div>

        {/* Row 3: Finish, Color, Active */}
        <div className="grid grid-cols-12 gap-4 items-end">
          {/* Finish Type */}
          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Finish Type <span className="text-red-500">*</span>
            </label>
            <select
              name="finishType"
              value={formData.finishType}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="solid">Solid/Dyed</option>
              <option value="printed">Printed</option>
              <option value="yarn_dyed">Yarn Dyed</option>
              <option value="reactive">Reactive</option>
              <option value="pigment">Pigment</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Print Design - only when printed */}
          {formData.finishType === 'printed' && (
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Print Design</label>
              <Input
                type="text"
                name="printDesign"
                value={formData.printDesign}
                onChange={handleChange}
                placeholder="Pattern reference"
                className="text-sm"
              />
            </div>
          )}

          {/* Color - single row, no family filter to keep compact */}
          <div className={`col-span-12 ${formData.finishType === 'printed' ? 'sm:col-span-4' : 'sm:col-span-6'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <ColorPicker
              value={selectedColorId}
              onChange={(colorId, color) => {
                setSelectedColorId(colorId);
                if (color) {
                  setFormData(prev => ({
                    ...prev,
                    colorName: color.colorName,
                    colorCode: color.hexCode || '',
                  }));
                } else {
                  setFormData(prev => ({
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

          {/* Active checkbox - aligned with other fields */}
          <div className={`col-span-6 ${formData.finishType === 'printed' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Row 4: Specifications - 2 rows on mobile, 1 row on desktop */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Specifications</h4>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-4">
            {/* Width - narrow */}
            <div className="col-span-3 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width" <span className="text-red-500">*</span>
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

            {/* Cutable - narrow */}
            <div className="col-span-3 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cutable" {hasEmbroidery ? (
                  <span className="text-xs text-purple-600">(manual)</span>
                ) : (
                  <span className="text-xs text-green-600">(auto)</span>
                )}
              </label>
              <Input
                type="number"
                name="cutableWidth"
                value={formData.cutableWidth || ''}
                onChange={handleChange}
                placeholder={hasEmbroidery ? "Enter width" : "W-2"}
                step="0.1"
                className={`text-sm ${hasEmbroidery ? 'border-purple-300 focus:border-purple-500' : ''}`}
              />
            </div>

            {/* GSM - narrow */}
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">GSM</label>
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

            {/* Yarn Count - narrow */}
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Yarn Count</label>
              <Input
                type="text"
                name="yarnCount"
                value={formData.yarnCount}
                onChange={handleChange}
                placeholder="40x40"
                className="text-sm"
              />
            </div>

            {/* Construction - narrow */}
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Construction</label>
              <Input
                type="text"
                name="finishedConstruction"
                value={formData.finishedConstruction}
                onChange={handleChange}
                placeholder="96x92"
                className="text-sm"
              />
            </div>

            {/* Composition - wider */}
            <div className="col-span-6 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Composition</label>
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
        </div>

        {/* Suppliers */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-800">Suppliers</h4>
            <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
              + Add Supplier
            </Button>
          </div>

          {formData.suppliers.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed border-gray-300">
              <p className="text-sm text-gray-500">No suppliers added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.suppliers.map((supplier, index) => (
                <div key={index} className="flex flex-wrap items-center gap-3 p-3 border rounded-md bg-gray-50">
                  <select
                    value={supplier.supplierId}
                    onChange={(e) => handleSupplierChange(index, 'supplierId', e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supplier.isPreferred}
                      onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    Preferred
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supplier.isActive}
                      onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
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
        </div>

        {/* Allocated Styles - Only show in edit mode */}
        {mode === 'edit' && id && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-800">Allocated Styles</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllocationModalOpen(true)}
              >
                + Allocate to Style
              </Button>
            </div>
            <AllocatedStylesCard
              allocations={allocations}
              onRemove={handleRemoveAllocation}
              editable={true}
              isLoading={loadingAllocations}
            />
          </div>
        )}

        {/* Notes & Image */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 sm:col-span-9">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional notes about this fabric..."
              />
            </div>
            <div className="col-span-12 sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <Input
                type="text"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/fabric')}
            disabled={saving}
          >
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
              No greige is linked to this fabric. Would you like to automatically create a matching greige for CAD planning?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">Greige will be created with:</p>
              <ul className="mt-2 text-blue-700 space-y-1">
                <li>Name: <span className="font-medium">{formData.genericGreigeName} {formData.actualWidth}"</span></li>
                <li>Width: <span className="font-medium">{formData.actualWidth}"</span></li>
                <li>Cutable Width: <span className="font-medium">{formData.cutableWidth || (formData.actualWidth > 4 ? formData.actualWidth - 4 : formData.actualWidth)}"</span></li>
                {formData.composition && <li>Composition: <span className="font-medium">{formData.composition}</span></li>}
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
                await saveFabric(formData);
              }}
              disabled={saving}
            >
              Save Without Greige
            </Button>
            <Button
              type="button"
              onClick={handleAutoCreateGreigeAndSave}
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Greige & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
