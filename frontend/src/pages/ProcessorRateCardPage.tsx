/**
 * Processor Rate Card Management Page V2
 * Matrix-based UI for DYEING and PRINTING processor rates
 * - One table per processor with greige rows and slab columns
 * - Direct link to Greige Master for row data
 * - Custom quantity slabs per processor
 * - Copy functionality between processors
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { processorRateCardV2Service } from '../services/processorRateCardV2.service';
import type {
  ProcessingTypeV2,
  PrintingTypeV2,
  ProcessorInfo,
  SlabInput,
  GreigeRow,
  GreigeForRateCard,
  RateEntry,
  ShrinkageEntry,
  MaterialTypeV2,
  GreigeLaceForRateCard,
  LaceRow,
  LaceRateEntry,
} from '../types/processorRateCardV2.types';
import { PRINTING_TYPES, PRINTING_TYPE_LABELS } from '../types/processorRateCardV2.types';
import { notify } from '../lib/notify';
import { ArrowLeft, Plus, Save, Copy, X, Trash2, Search, Check, Clipboard, ClipboardPaste } from 'lucide-react';
import { ProcessorRateCardSummary } from '../components/processor-rate-card/ProcessorRateCardSummary';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ProcessorRateCardPage() {
  const navigate = useNavigate();

  // Material type state (Fabric or Lace)
  const [materialType, setMaterialType] = useState<MaterialTypeV2>('FABRIC');

  // Selection state
  const [processingType, setProcessingType] = useState<ProcessingTypeV2>('DYEING');
  const [printingType, setPrintingType] = useState<PrintingTypeV2>('PIGMENT');
  const [selectedProcessorId, setSelectedProcessorId] = useState<string>('');
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [isDefaultRatesMode, setIsDefaultRatesMode] = useState(false);
  const [systemDefaultProcessorId, setSystemDefaultProcessorId] = useState<string | null>(null);

  // Matrix data (Fabric)
  const [slabs, setSlabs] = useState<SlabInput[]>([]);
  const [greiges, setGreiges] = useState<GreigeRow[]>([]);
  const [deletedGreigeIds, setDeletedGreigeIds] = useState<string[]>([]);

  // Available greiges for adding
  const [availableGreiges, setAvailableGreiges] = useState<GreigeForRateCard[]>([]);

  // Lace-specific state
  const [laces, setLaces] = useState<LaceRow[]>([]);
  const [deletedLaceIds, setDeletedLaceIds] = useState<string[]>([]);
  const [availableLaces, setAvailableLaces] = useState<GreigeLaceForRateCard[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingSlabId, setEditingSlabId] = useState<string | null>(null);
  const [tempSlabValues, setTempSlabValues] = useState({ min: 0, max: 0 });

  // Modal state
  const [isAddGreigeModalOpen, setIsAddGreigeModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [greigeSearchTerm, setGreigeSearchTerm] = useState('');
  const [selectedGreigeIds, setSelectedGreigeIds] = useState<Set<string>>(new Set());
  const [copyTargetProcessorId, setCopyTargetProcessorId] = useState('');
  const [copyRatesFlag, setCopyRatesFlag] = useState(false);

  // Row copy/paste state
  const [copiedRowData, setCopiedRowData] = useState<{
    shrinkagePercent: number | null;
    rates: Record<string, number | null>;
    sourceGreigeName: string;
  } | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [greigeToDelete, setGreigeToDelete] = useState<GreigeRow | null>(null);

  // Slab delete confirmation state
  const [slabDeleteConfirmOpen, setSlabDeleteConfirmOpen] = useState(false);
  const [slabToDelete, setSlabToDelete] = useState<{ index: number; slab: SlabInput } | null>(null);

  // Track original state for change detection
  const originalStateRef = useRef<{ slabs: SlabInput[]; greiges: GreigeRow[] } | null>(null);

  // Load processors and available materials on mount and when material type changes
  useEffect(() => {
    loadProcessors();
    if (materialType === 'FABRIC') {
      loadAvailableGreiges();
    } else {
      loadAvailableLaces();
    }
  }, [materialType]);

  // Load matrix when processor, processing type, printing type, or material type changes
  useEffect(() => {
    if (selectedProcessorId) {
      if (materialType === 'FABRIC') {
        loadMatrix();
      } else {
        loadLaceMatrix();
      }
    } else {
      setSlabs([]);
      setGreiges([]);
      setDeletedGreigeIds([]);
      setLaces([]);
      setDeletedLaceIds([]);
      setHasUnsavedChanges(false);
    }
  }, [selectedProcessorId, processingType, printingType, materialType]);

  // Detect unsaved changes
  useEffect(() => {
    if (!originalStateRef.current) {
      setHasUnsavedChanges(false);
      return;
    }

    const hasSlabChanges = JSON.stringify(slabs) !== JSON.stringify(originalStateRef.current.slabs);

    if (materialType === 'FABRIC') {
      const hasGreigeChanges = JSON.stringify(greiges) !== JSON.stringify(originalStateRef.current.greiges);
      const hasDeletedGreiges = deletedGreigeIds.length > 0;
      setHasUnsavedChanges(hasSlabChanges || hasGreigeChanges || hasDeletedGreiges);
    } else {
      const hasLaceChanges = JSON.stringify(laces) !== JSON.stringify((originalStateRef.current as any).laces || []);
      const hasDeletedLaces = deletedLaceIds.length > 0;
      setHasUnsavedChanges(hasSlabChanges || hasLaceChanges || hasDeletedLaces);
    }
  }, [slabs, greiges, deletedGreigeIds, laces, deletedLaceIds, materialType]);

  const loadProcessors = async () => {
    try {
      const data = await processorRateCardV2Service.getProcessors();
      // Find and separate SYSTEM_DEFAULT processor
      const systemDefault = data.find((p: ProcessorInfo) => p.code === 'SYSTEM_DEFAULT');
      if (systemDefault) {
        setSystemDefaultProcessorId(systemDefault.id);
        // Filter out SYSTEM_DEFAULT from regular processor list
        setProcessors(data.filter((p: ProcessorInfo) => p.code !== 'SYSTEM_DEFAULT'));
      } else {
        setProcessors(data);
      }
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to load processors');
    }
  };

  const loadAvailableGreiges = async () => {
    try {
      const data = await processorRateCardV2Service.getGreigeFabrics();
      setAvailableGreiges(data);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to load greiges');
    }
  };

  const loadAvailableLaces = async () => {
    try {
      const data = await processorRateCardV2Service.getGreigeLaces();
      setAvailableLaces(data);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to load greige laces');
    }
  };

  const loadMatrix = async () => {
    if (!selectedProcessorId) return;

    setLoading(true);
    try {
      const matrix = await processorRateCardV2Service.getProcessorMatrix(
        selectedProcessorId,
        processingType,
        processingType === 'PRINTING' ? printingType : undefined
      );

      const loadedSlabs: SlabInput[] = matrix.slabs.map((s) => ({
        id: s.id,
        slabOrder: s.slabOrder,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        slabLabel: s.slabLabel,
      }));

      // Ensure slabs are sorted by minQuantity (in case backend didn't sort)
      const sortedSlabs = sortAndReorderSlabs(loadedSlabs);
      setSlabs(sortedSlabs);
      setGreiges(matrix.greiges);
      setDeletedGreigeIds([]);

      // Store original state for change detection
      originalStateRef.current = {
        slabs: JSON.parse(JSON.stringify(sortedSlabs)),
        greiges: JSON.parse(JSON.stringify(matrix.greiges)),
      };
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to load rate matrix');
    } finally {
      setLoading(false);
    }
  };

  const loadLaceMatrix = async () => {
    if (!selectedProcessorId) return;

    setLoading(true);
    try {
      const matrix = await processorRateCardV2Service.getLaceProcessorMatrix(selectedProcessorId);

      const loadedSlabs: SlabInput[] = matrix.slabs.map((s) => ({
        id: s.id,
        slabOrder: s.slabOrder,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        slabLabel: s.slabLabel,
      }));

      const sortedSlabs = sortAndReorderSlabs(loadedSlabs);
      setSlabs(sortedSlabs);
      setLaces(matrix.laces);
      setDeletedLaceIds([]);

      // Store original state for change detection
      originalStateRef.current = {
        slabs: JSON.parse(JSON.stringify(sortedSlabs)),
        greiges: [], // Not used for lace mode
        laces: JSON.parse(JSON.stringify(matrix.laces)),
      } as any;
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to load lace rate matrix');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProcessorId || !hasUnsavedChanges) return;

    // Validate slabs
    if (slabs.length === 0) {
      notify.error('Please add at least one quantity slab');
      return;
    }

    for (const slab of slabs) {
      if (slab.minQuantity >= slab.maxQuantity) {
        notify.error(`Invalid slab range: ${slab.minQuantity} to ${slab.maxQuantity}`);
        return;
      }
    }

    setSaving(true);
    try {
      if (materialType === 'FABRIC') {
        // Build rate entries from greiges
        const rates: RateEntry[] = [];
        const shrinkages: ShrinkageEntry[] = [];
        for (const greige of greiges) {
          // Collect shrinkage values
          shrinkages.push({
            greigeId: greige.id,
            shrinkagePercent: greige.shrinkagePercent ?? null,
          });

          for (const slab of slabs) {
            const slabId = slab.id || `temp-${slab.slabOrder}`;
            const rate = greige.rates[slabId];
            if (rate !== null && rate !== undefined) {
              rates.push({
                greigeId: greige.id,
                slabId: slabId,
                ratePerMeter: rate,
              });
            }
          }
        }

        await processorRateCardV2Service.saveMatrix(selectedProcessorId, {
          processingType,
          printingType: processingType === 'PRINTING' ? printingType : undefined,
          slabs,
          rates,
          shrinkages,
          deletedGreigeIds,
        });

        notify.success('Rate matrix saved successfully');
        await loadMatrix();
      } else {
        // Build rate entries from laces
        const laceRates: LaceRateEntry[] = [];
        for (const lace of laces) {
          for (const slab of slabs) {
            const slabId = slab.id || `temp-${slab.slabOrder}`;
            const rate = lace.rates[slabId];
            if (rate !== null && rate !== undefined) {
              laceRates.push({
                laceId: lace.laceId,
                slabId: slabId,
                ratePerMeter: rate,
              });
            }
          }
        }

        await processorRateCardV2Service.saveLaceMatrix(selectedProcessorId, {
          slabs,
          rates: laceRates,
          deletedLaceIds,
        });

        notify.success('Lace rate matrix saved successfully');
        await loadLaceMatrix();
      }
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to save rate matrix');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalStateRef.current) {
      setSlabs(JSON.parse(JSON.stringify(originalStateRef.current.slabs)));
      if (materialType === 'FABRIC') {
        setGreiges(JSON.parse(JSON.stringify(originalStateRef.current.greiges)));
        setDeletedGreigeIds([]);
      } else {
        setLaces(JSON.parse(JSON.stringify((originalStateRef.current as any).laces || [])));
        setDeletedLaceIds([]);
      }
    }
  };

  // Helper function to sort slabs by minQuantity and recalculate slabOrder
  const sortAndReorderSlabs = (slabsToSort: SlabInput[]): SlabInput[] => {
    const sorted = [...slabsToSort].sort((a, b) => a.minQuantity - b.minQuantity);
    return sorted.map((slab, index) => ({
      ...slab,
      slabOrder: index + 1,
    }));
  };

  const addSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newMinQuantity = lastSlab ? lastSlab.maxQuantity : 0;
    const newMaxQuantity = newMinQuantity + 500;
    const newOrder = slabs.length + 1;

    const newSlab: SlabInput = {
      slabOrder: newOrder,
      minQuantity: newMinQuantity,
      maxQuantity: newMaxQuantity,
      slabLabel: `${newMinQuantity}-${newMaxQuantity}m`,
      isNew: true,
    };

    // Sort slabs by minQuantity and recalculate slabOrder
    const sortedSlabs = sortAndReorderSlabs([...slabs, newSlab]);
    setSlabs(sortedSlabs);
  };

  const removeSlab = (index: number) => {
    const newSlabs = slabs.filter((_, i) => i !== index);
    // Sort and re-order remaining slabs
    const sortedSlabs = sortAndReorderSlabs(newSlabs);
    setSlabs(sortedSlabs);
  };

  const handleSlabDeleteClick = (index: number, slab: SlabInput) => {
    setSlabToDelete({ index, slab });
    setSlabDeleteConfirmOpen(true);
  };

  const confirmSlabDelete = () => {
    if (slabToDelete) {
      removeSlab(slabToDelete.index);
      setSlabToDelete(null);
    }
  };

  const updateSlabRange = (index: number, min: number, max: number) => {
    const newSlabs = [...slabs];
    newSlabs[index] = {
      ...newSlabs[index],
      minQuantity: min,
      maxQuantity: max,
      slabLabel: `${min}-${max}m`,
    };
    // Sort slabs by minQuantity and recalculate slabOrder
    const sortedSlabs = sortAndReorderSlabs(newSlabs);
    setSlabs(sortedSlabs);
  };

  const updateRate = (greigeId: string, slabId: string, value: string) => {
    const newGreiges = greiges.map((g) => {
      if (g.id === greigeId) {
        return {
          ...g,
          rates: {
            ...g.rates,
            [slabId]: value === '' ? null : parseFloat(value),
          },
        };
      }
      return g;
    });
    setGreiges(newGreiges);
  };

  const updateShrinkage = (greigeId: string, value: string) => {
    const newGreiges = greiges.map((g) => {
      if (g.id === greigeId) {
        return {
          ...g,
          shrinkagePercent: value === '' ? null : parseFloat(value),
        };
      }
      return g;
    });
    setGreiges(newGreiges);
  };

  const removeGreige = (greigeId: string) => {
    setGreiges(greiges.filter((g) => g.id !== greigeId));
    setDeletedGreigeIds([...deletedGreigeIds, greigeId]);
  };

  // Lace-specific functions
  const updateLaceRate = (laceId: string, slabId: string, value: string) => {
    const newLaces = laces.map((l) => {
      if (l.laceId === laceId) {
        return {
          ...l,
          rates: {
            ...l.rates,
            [slabId]: value === '' ? null : parseFloat(value),
          },
        };
      }
      return l;
    });
    setLaces(newLaces);
  };

  const removeLaceRow = (laceId: string) => {
    setLaces(laces.filter((l) => l.laceId !== laceId));
    setDeletedLaceIds([...deletedLaceIds, laceId]);
  };

  const handleLaceDeleteClick = (lace: LaceRow) => {
    // Reuse greige delete confirmation for lace
    setGreigeToDelete({ id: lace.laceId, greigeName: lace.laceName } as any);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteClick = (greige: GreigeRow) => {
    setGreigeToDelete(greige);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (greigeToDelete) {
      if (materialType === 'FABRIC') {
        removeGreige(greigeToDelete.id);
      } else {
        removeLaceRow(greigeToDelete.id);
      }
      setGreigeToDelete(null);
    }
  };

  const addSelectedGreiges = () => {
    const newGreiges: GreigeRow[] = [];
    const existingIds = new Set(greiges.map((g) => g.id));

    for (const greigeId of selectedGreigeIds) {
      if (existingIds.has(greigeId)) continue;

      const greige = availableGreiges.find((g) => g.id === greigeId);
      if (greige) {
        // Create empty rates for all slabs
        const rates: Record<string, number | null> = {};
        slabs.forEach((slab) => {
          rates[slab.id || `temp-${slab.slabOrder}`] = null;
        });

        newGreiges.push({
          id: greige.id,
          greigeCode: greige.greigeCode,
          greigeName: greige.greigeName,
          genericGreigeName: greige.genericGreigeName,
          rates,
          shrinkagePercent: null, // Will display averageShrinkagePercent as placeholder
          averageShrinkagePercent: greige.averageShrinkagePercent ?? null,
          isNew: true,
        });
      }
    }

    setGreiges([...greiges, ...newGreiges]);
    setSelectedGreigeIds(new Set());
    setIsAddGreigeModalOpen(false);
    setGreigeSearchTerm('');
  };

  const handleCopy = async () => {
    if (!selectedProcessorId || !copyTargetProcessorId) return;

    setSaving(true);
    try {
      await processorRateCardV2Service.copyRates({
        sourceProcessorId: selectedProcessorId,
        targetProcessorId: copyTargetProcessorId,
        processingType,
        printingType: processingType === 'PRINTING' ? printingType : undefined,
        copySlabs: true,
        copyRates: copyRatesFlag,
      });

      notify.success('Rate structure copied successfully');
      setIsCopyModalOpen(false);
      setCopyTargetProcessorId('');
      setCopyRatesFlag(false);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to copy rates');
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailableGreiges = availableGreiges.filter((g) => {
    if (!greigeSearchTerm) return true;
    const term = greigeSearchTerm.toLowerCase();
    return (
      g.greigeName.toLowerCase().includes(term) ||
      g.genericGreigeName.toLowerCase().includes(term) ||
      g.greigeCode.toLowerCase().includes(term)
    );
  });

  // Lace functions
  const addSelectedLaces = () => {
    const newLaces: LaceRow[] = [];
    const existingIds = new Set(laces.map((l) => l.laceId));

    for (const laceId of selectedGreigeIds) {
      if (existingIds.has(laceId)) continue;

      const lace = availableLaces.find((l) => l.id === laceId);
      if (lace) {
        // Create empty rates for all slabs
        const rates: Record<string, number | null> = {};
        slabs.forEach((slab) => {
          rates[slab.id || `temp-${slab.slabOrder}`] = null;
        });

        newLaces.push({
          laceId: lace.id,
          laceCode: lace.code,
          laceName: lace.name,
          width: lace.width,
          composition: lace.composition,
          expectedShrinkagePercent: lace.expectedShrinkagePercent,
          costPerMeterGreige: lace.costPerMeterGreige,
          rates,
          isNew: true,
        });
      }
    }

    setLaces([...laces, ...newLaces]);
    setSelectedGreigeIds(new Set());
    setIsAddGreigeModalOpen(false);
    setGreigeSearchTerm('');
  };

  const filteredAvailableLaces = availableLaces.filter((l) => {
    if (!greigeSearchTerm) return true;
    const term = greigeSearchTerm.toLowerCase();
    return (
      l.name.toLowerCase().includes(term) ||
      l.code.toLowerCase().includes(term) ||
      (l.composition && l.composition.toLowerCase().includes(term))
    );
  });

  const getSlabId = (slab: SlabInput) => slab.id || `temp-${slab.slabOrder}`;

  // Copy row data (shrinkage + all rates)
  const copyRowData = (greige: GreigeRow) => {
    setCopiedRowData({
      shrinkagePercent: greige.shrinkagePercent ?? null,
      rates: { ...greige.rates },
      sourceGreigeName: greige.greigeName,
    });
    notify.success(`Copied row data from "${greige.greigeName}"`);
  };

  // Paste row data to a greige
  const pasteRowData = (targetGreigeId: string) => {
    if (!copiedRowData) return;

    const newGreiges = greiges.map((g) => {
      if (g.id === targetGreigeId) {
        // Map rates from copied data to current slabs
        const newRates: Record<string, number | null> = {};
        slabs.forEach((slab) => {
          const slabId = getSlabId(slab);
          // Use the rate from copied data if it exists for this slab
          newRates[slabId] = copiedRowData.rates[slabId] ?? null;
        });

        return {
          ...g,
          shrinkagePercent: copiedRowData.shrinkagePercent,
          rates: newRates,
        };
      }
      return g;
    });
    setGreiges(newGreiges);
    notify.success(`Pasted row data to "${greiges.find((g) => g.id === targetGreigeId)?.greigeName}"`);
  };

  // Clear copied row data
  const clearCopiedRowData = () => {
    setCopiedRowData(null);
  };

  // Toggle Default Rates mode
  const toggleDefaultRatesMode = () => {
    if (hasUnsavedChanges) {
      notify.warning('Please save or discard changes before switching modes');
      return;
    }

    const newMode = !isDefaultRatesMode;
    setIsDefaultRatesMode(newMode);

    if (newMode && systemDefaultProcessorId) {
      // Switch to SYSTEM_DEFAULT processor
      setSelectedProcessorId(systemDefaultProcessorId);
    } else {
      // Clear processor selection when exiting default mode
      setSelectedProcessorId('');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Processor Rate Cards</h1>
        </div>

        {/* Default Rates Toggle */}
        <div className="flex items-center gap-4">
          {systemDefaultProcessorId && (
            <Button
              variant={isDefaultRatesMode ? 'default' : 'outline'}
              onClick={toggleDefaultRatesMode}
              className={isDefaultRatesMode ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {isDefaultRatesMode ? '✓ Default Rates Mode' : 'Default Rates'}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && <span className="text-sm text-orange-500 mr-2">Unsaved changes</span>}
          <Button variant="outline" onClick={handleDiscard} disabled={!hasUnsavedChanges || saving}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Material Type Toggle */}
      <div className="flex gap-2 mb-4 pb-4 border-b">
        <span className="text-sm font-medium text-gray-700 self-center mr-2">Material Type:</span>
        <Button
          variant={materialType === 'FABRIC' ? 'default' : 'outline'}
          onClick={() => {
            if (hasUnsavedChanges) {
              notify.warning('Please save or discard changes before switching material type');
              return;
            }
            setMaterialType('FABRIC');
            setProcessingType('DYEING');
          }}
          className={materialType === 'FABRIC' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Fabric
        </Button>
        <Button
          variant={materialType === 'LACE' ? 'default' : 'outline'}
          onClick={() => {
            if (hasUnsavedChanges) {
              notify.warning('Please save or discard changes before switching material type');
              return;
            }
            setMaterialType('LACE');
            setProcessingType('DYEING'); // Lace only supports DYEING
          }}
          className={materialType === 'LACE' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          Lace
        </Button>
      </div>

      {/* Processing Type Tabs (only for Fabric) */}
      {materialType === 'FABRIC' && (
        <>
          <div className="flex gap-2 mb-4">
            <Button
              variant={processingType === 'DYEING' ? 'default' : 'outline'}
              onClick={() => setProcessingType('DYEING')}
              disabled={hasUnsavedChanges}
            >
              Dyeing
            </Button>
            <Button
              variant={processingType === 'PRINTING' ? 'default' : 'outline'}
              onClick={() => setProcessingType('PRINTING')}
              disabled={hasUnsavedChanges}
            >
              Printing
            </Button>
            {hasUnsavedChanges && (
              <span className="text-sm text-gray-500 ml-2 self-center">Save changes before switching</span>
            )}
          </div>

          {/* Printing Type Sub-Tabs (only visible when PRINTING is selected) */}
          {processingType === 'PRINTING' && (
            <div className="flex gap-2 mb-4 ml-4 border-l-2 border-gray-200 pl-4">
              {PRINTING_TYPES.map((type) => (
                <Button
                  key={type}
                  variant={printingType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintingType(type)}
                  disabled={hasUnsavedChanges}
                  className={printingType === type ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  {PRINTING_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lace Mode Info Banner */}
      {materialType === 'LACE' && (
        <div className="flex items-center gap-4 mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
          <span className="text-purple-800 font-medium">Lace Dyeing Rates</span>
          <span className="text-purple-600 text-sm">Configure dyeing rates for greige lace processing</span>
        </div>
      )}

      {/* Processor Selection or Default Rates Banner */}
      <div className="flex items-center gap-4 mb-6">
        {isDefaultRatesMode ? (
          // Show banner when in Default Rates mode
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <span className="text-amber-800 font-medium">Editing Default Processing Rates</span>
            <span className="text-amber-600 text-sm">
              These rates are used when no specific processor is selected in Fabric Costing
            </span>
          </div>
        ) : (
          // Normal processor dropdown
          <div className="w-64">
            <Select value={selectedProcessorId} onValueChange={setSelectedProcessorId} disabled={hasUnsavedChanges}>
              <SelectTrigger>
                <SelectValue placeholder="Select Processor" />
              </SelectTrigger>
              <SelectContent>
                {processors.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedProcessorId && (
          <>
            <Button variant="outline" onClick={() => setIsAddGreigeModalOpen(true)} disabled={slabs.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              {materialType === 'FABRIC' ? 'Add Greige Row' : 'Add Lace Row'}
            </Button>
            {/* Hide Copy button in Default Rates mode and Lace mode */}
            {!isDefaultRatesMode && materialType === 'FABRIC' && (
              <Button variant="outline" onClick={() => setIsCopyModalOpen(true)} disabled={slabs.length === 0}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Another Processor
              </Button>
            )}
          </>
        )}
      </div>

      {/* Loading State */}
      {loading && <div className="text-center py-8 text-gray-500">Loading rate matrix...</div>}

      {/* Summary Dashboard (when no processor selected) */}
      {!selectedProcessorId && !loading && (
        <ProcessorRateCardSummary
          onSelectProcessor={(processorId, type) => {
            setProcessingType(type);
            setSelectedProcessorId(processorId);
          }}
        />
      )}

      {/* Matrix Table */}
      {selectedProcessorId && !loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {materialType === 'FABRIC' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                        Generic Greige Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                        Greige Name
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Shrinkage %
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Lace Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                        Lace Name
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Width
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Shrinkage %
                      </th>
                    </>
                  )}
                  {slabs.map((slab, index) => (
                    <th
                      key={getSlabId(slab)}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32 relative group"
                    >
                      {editingSlabId === getSlabId(slab) ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={tempSlabValues.min}
                            onChange={(e) =>
                              setTempSlabValues({ ...tempSlabValues, min: parseFloat(e.target.value) || 0 })
                            }
                            className="w-16 h-6 text-xs"
                          />
                          <span>-</span>
                          <Input
                            type="number"
                            value={tempSlabValues.max}
                            onChange={(e) =>
                              setTempSlabValues({ ...tempSlabValues, max: parseFloat(e.target.value) || 0 })
                            }
                            className="w-16 h-6 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              updateSlabRange(index, tempSlabValues.min, tempSlabValues.max);
                              setEditingSlabId(null);
                            }}
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingSlabId(null)}
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
                          onClick={() => {
                            setEditingSlabId(getSlabId(slab));
                            setTempSlabValues({ min: slab.minQuantity, max: slab.maxQuantity });
                          }}
                        >
                          {slab.slabLabel || `${slab.minQuantity}-${slab.maxQuantity}m`}
                          <button
                            className="ml-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSlabDeleteClick(index, slab);
                            }}
                          >
                            <X className="h-3 w-3 inline" />
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    <Button variant="ghost" size="sm" onClick={addSlab} className="text-blue-600 hover:text-blue-800">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Slab
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    <div className="flex flex-col items-center gap-1">
                      <span>Actions</span>
                      {copiedRowData && (
                        <div className="flex items-center gap-1">
                          <span
                            className="text-xs text-green-600 font-normal normal-case truncate max-w-24"
                            title={`Copied: ${copiedRowData.sourceGreigeName}`}
                          >
                            📋 Copied
                          </span>
                          <button
                            onClick={clearCopiedRowData}
                            className="text-gray-400 hover:text-red-500"
                            title="Clear clipboard"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materialType === 'FABRIC' ? (
                  /* Fabric Mode */
                  greiges.length === 0 ? (
                    <tr>
                      <td colSpan={slabs.length + 4} className="px-4 py-8 text-center text-gray-500">
                        {slabs.length === 0
                          ? 'Add quantity slabs first, then add greige rows'
                          : 'No greige fabrics added. Click "Add Greige Row" to add fabrics.'}
                      </td>
                    </tr>
                  ) : (
                    greiges.map((greige) => (
                      <tr key={greige.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {greige.genericGreigeName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{greige.greigeName}</td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            step="0.1"
                            value={greige.shrinkagePercent ?? ''}
                            onChange={(e) => updateShrinkage(greige.id, e.target.value)}
                            placeholder={greige.averageShrinkagePercent ? `${greige.averageShrinkagePercent}%` : '---'}
                            className="w-20 text-center mx-auto"
                            title={
                              greige.averageShrinkagePercent
                                ? `Default: ${greige.averageShrinkagePercent}% (from greige master)`
                                : undefined
                            }
                          />
                        </td>
                        {slabs.map((slab) => {
                          const slabId = getSlabId(slab);
                          const rate = greige.rates[slabId];
                          return (
                            <td key={slabId} className="px-4 py-3 text-center">
                              <Input
                                type="number"
                                step="0.01"
                                value={rate ?? ''}
                                onChange={(e) => updateRate(greige.id, slabId, e.target.value)}
                                placeholder="---"
                                className="w-24 text-center mx-auto"
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(greige)}
                              className="text-red-500 hover:text-red-700"
                              title="Remove greige row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyRowData(greige)}
                              className="text-blue-500 hover:text-blue-700"
                              title="Copy row (shrinkage + all rates)"
                            >
                              <Clipboard className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => pasteRowData(greige.id)}
                              disabled={!copiedRowData}
                              className={copiedRowData ? 'text-green-500 hover:text-green-700' : 'text-gray-300'}
                              title={
                                copiedRowData ? `Paste from "${copiedRowData.sourceGreigeName}"` : 'Copy a row first'
                              }
                            >
                              <ClipboardPaste className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                ) : /* Lace Mode */
                laces.length === 0 ? (
                  <tr>
                    <td colSpan={slabs.length + 5} className="px-4 py-8 text-center text-gray-500">
                      {slabs.length === 0
                        ? 'Add quantity slabs first, then add lace rows'
                        : 'No greige laces added. Click "Add Lace Row" to add laces.'}
                    </td>
                  </tr>
                ) : (
                  laces.map((lace) => (
                    <tr key={lace.laceId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{lace.laceCode || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{lace.laceName}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {lace.width ? `${lace.width}"` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {lace.expectedShrinkagePercent ? `${lace.expectedShrinkagePercent}%` : '-'}
                      </td>
                      {slabs.map((slab) => {
                        const slabId = getSlabId(slab);
                        const rate = lace.rates[slabId];
                        return (
                          <td key={slabId} className="px-4 py-3 text-center">
                            <Input
                              type="number"
                              step="0.01"
                              value={rate ?? ''}
                              onChange={(e) => updateLaceRate(lace.laceId, slabId, e.target.value)}
                              placeholder="---"
                              className="w-24 text-center mx-auto"
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLaceDeleteClick(lace)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove lace row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Greige/Lace Modal */}
      {isAddGreigeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {materialType === 'FABRIC' ? 'Add Greige Fabrics' : 'Add Greige Laces'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddGreigeModalOpen(false);
                  setSelectedGreigeIds(new Set());
                  setGreigeSearchTerm('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={materialType === 'FABRIC' ? 'Search greige fabrics...' : 'Search greige laces...'}
                  value={greigeSearchTerm}
                  onChange={(e) => setGreigeSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {materialType === 'FABRIC'
                  ? /* Fabric Mode - Show greige fabrics */
                    filteredAvailableGreiges.map((greige) => {
                      const isExisting = greiges.some((g) => g.id === greige.id);
                      const isSelected = selectedGreigeIds.has(greige.id);

                      return (
                        <label
                          key={greige.id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                            isExisting
                              ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isExisting}
                            onChange={() => {
                              const newSelected = new Set(selectedGreigeIds);
                              if (isSelected) {
                                newSelected.delete(greige.id);
                              } else {
                                newSelected.add(greige.id);
                              }
                              setSelectedGreigeIds(newSelected);
                            }}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{greige.greigeName}</div>
                            <div className="text-sm text-gray-500">
                              {greige.genericGreigeName} | {greige.composition} | {greige.greigeWidth}"
                            </div>
                          </div>
                          {isExisting && <span className="text-xs text-gray-500">Already added</span>}
                        </label>
                      );
                    })
                  : /* Lace Mode - Show greige laces */
                    filteredAvailableLaces.map((lace) => {
                      const isExisting = laces.some((l) => l.laceId === lace.id);
                      const isSelected = selectedGreigeIds.has(lace.id);

                      return (
                        <label
                          key={lace.id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                            isExisting
                              ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-purple-500 bg-purple-50'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isExisting}
                            onChange={() => {
                              const newSelected = new Set(selectedGreigeIds);
                              if (isSelected) {
                                newSelected.delete(lace.id);
                              } else {
                                newSelected.add(lace.id);
                              }
                              setSelectedGreigeIds(newSelected);
                            }}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{lace.name}</div>
                            <div className="text-sm text-gray-500">
                              {lace.code} | {lace.composition || 'N/A'} | {lace.width ? `${lace.width}"` : 'N/A'}
                              {lace.expectedShrinkagePercent && ` | Shrinkage: ${lace.expectedShrinkagePercent}%`}
                            </div>
                          </div>
                          {isExisting && <span className="text-xs text-gray-500">Already added</span>}
                        </label>
                      );
                    })}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddGreigeModalOpen(false);
                  setSelectedGreigeIds(new Set());
                  setGreigeSearchTerm('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={materialType === 'FABRIC' ? addSelectedGreiges : addSelectedLaces}
                disabled={selectedGreigeIds.size === 0}
              >
                Add {selectedGreigeIds.size} {materialType === 'FABRIC' ? 'Greige(s)' : 'Lace(s)'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Copy Rate Structure</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setCopyTargetProcessorId('');
                  setCopyRatesFlag(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Processor</label>
                <div className="p-2 bg-gray-100 rounded text-sm">
                  {processors.find((p) => p.id === selectedProcessorId)?.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Processor *</label>
                <Select value={copyTargetProcessorId} onValueChange={setCopyTargetProcessorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target processor" />
                  </SelectTrigger>
                  <SelectContent>
                    {processors
                      .filter((p) => p.id !== selectedProcessorId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={true} disabled className="rounded" />
                  <span className="text-sm">Copy quantity slabs (required)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={copyRatesFlag}
                    onChange={(e) => setCopyRatesFlag(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Copy rates (optional)</span>
                </label>
              </div>

              <div className="text-sm text-gray-500">
                Note: This will replace any existing rate structure for the target processor.
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setCopyTargetProcessorId('');
                  setCopyRatesFlag(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCopy} disabled={!copyTargetProcessorId || saving}>
                {saving ? 'Copying...' : 'Copy Structure'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Row Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={materialType === 'FABRIC' ? 'Remove Greige Row?' : 'Remove Lace Row?'}
        description={`Are you sure you want to remove "${greigeToDelete?.greigeName}" from this rate card? This change will take effect when you save.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Delete Slab Confirmation Dialog */}
      <ConfirmDialog
        open={slabDeleteConfirmOpen}
        onOpenChange={setSlabDeleteConfirmOpen}
        title="Delete Quantity Slab?"
        description={
          slabToDelete
            ? `Are you sure you want to delete the slab "${slabToDelete.slab.slabLabel || `${slabToDelete.slab.minQuantity}-${slabToDelete.slab.maxQuantity}m`}"?\n\n⚠️ WARNING: This will delete ALL ${materialType === 'FABRIC' ? greiges.length : laces.length} ${materialType === 'FABRIC' ? 'fabric' : 'lace'} rate${(materialType === 'FABRIC' ? greiges.length : laces.length) !== 1 ? 's' : ''} associated with this slab. This change will take effect when you save.`
            : ''
        }
        confirmText="Delete Slab"
        cancelText="Cancel"
        onConfirm={confirmSlabDelete}
        variant="destructive"
      />
    </div>
  );
}
