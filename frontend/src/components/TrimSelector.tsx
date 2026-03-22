/**
 * TrimSelector Component
 *
 * A multi-select component for selecting trims organized into categories:
 * - Fasteners & Closures: Button, Zipper, Hook & Eye, Snap Button, Buckle, Velcro
 * - Threads & Tapes: Thread, Elastic, Drawstring, Ribbon
 * - Decorative: Lace, Sequin, Bead, Motif
 * - Functional: Label, Interlining, Padding
 *
 * With tabbed interface and inline "Add New" capability.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Search, Plus, X, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import MaterialQuickAddDialog from './MaterialQuickAddDialog';
import type { CreatedMaterial } from '../types/material-quick-add.types';

// Services - Existing 6 trim types
import { getAllButtons } from '../services/button.service';
import { getAllThreads } from '../services/thread.service';
import { getAllZippers } from '../services/zipper.service';
import { getAllElastics } from '../services/elastic.service';
import { getAllLace } from '../services/lace.service';
// Note: Labels are managed under Packaging, not in TrimSelector
// Service - New 16 generic trim types
import { genericTrimService } from '../services/genericTrim.service';
import { TRIM_TYPE_CONFIGS } from '../types/genericTrim.types';
import type { GenericTrimItem } from '../types/genericTrim.types';

// Types - Existing 5 trim types (Labels moved to Packaging)
import type { Button as ButtonType } from '../types/button.types';
import type { Thread } from '../types/thread.types';
import type { Zipper } from '../types/zipper.types';
import type { Elastic } from '../types/elastic.types';
import type { Lace } from '../types/lace.types';

// Trim type definition - All 21 types (excluding Label which is packaging)
// Note: Labels (care labels, size labels, brand labels) are managed separately under Packaging
export type TrimType =
  // Fasteners & Closures (8 including Belt and Other Fastener)
  | 'BUTTON'
  | 'ZIPPER'
  | 'HOOK_EYE'
  | 'SNAP_BUTTON'
  | 'BUCKLE'
  | 'BELT'
  | 'VELCRO'
  | 'OTHER_FASTENER'
  // Threads & Tapes (5 including Other Tape)
  | 'THREAD'
  | 'ELASTIC'
  | 'DRAWSTRING'
  | 'RIBBON'
  | 'OTHER_TAPE'
  // Decorative (5 including Other Decorative)
  | 'LACE'
  | 'SEQUIN'
  | 'BEAD'
  | 'MOTIF'
  | 'OTHER_DECORATIVE'
  // Functional (3 including Other Functional) - Label moved to Packaging
  | 'INTERLINING'
  | 'PADDING'
  | 'OTHER_FUNCTIONAL';

// Category type
export type TrimCategory = 'FASTENERS_CLOSURES' | 'THREADS_TAPES' | 'DECORATIVE' | 'FUNCTIONAL';

export interface StyleTrim {
  trimType: TrimType;
  masterId: string;
  masterCode: string;
  masterName: string;
  color?: string | null;
}

// Generic trim item for internal use
interface TrimItem {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  description?: string | null;
}

interface TrimSelectorProps {
  selectedTrims: StyleTrim[];
  onChange: (trims: StyleTrim[]) => void;
  disabled?: boolean;
}

// Category configurations with trim types
interface CategoryConfig {
  category: TrimCategory;
  label: string;
  color: string;
  trims: { type: TrimType; label: string; icon: string; isGeneric?: boolean; genericKey?: string }[];
}

const TRIM_CATEGORIES: CategoryConfig[] = [
  {
    category: 'FASTENERS_CLOSURES',
    label: 'Fasteners & Closures',
    color: 'bg-blue-50 border-blue-200',
    trims: [
      { type: 'BUTTON', label: 'Button', icon: '🔘' },
      { type: 'ZIPPER', label: 'Zipper', icon: '🔗' },
      { type: 'HOOK_EYE', label: 'Hook & Eye', icon: '🪝', isGeneric: true, genericKey: 'hook_eye' },
      { type: 'SNAP_BUTTON', label: 'Snap Button', icon: '⚫', isGeneric: true, genericKey: 'snap_button' },
      { type: 'BUCKLE', label: 'Buckle', icon: '🪢', isGeneric: true, genericKey: 'buckle' },
      { type: 'BELT', label: 'Belt', icon: '👔', isGeneric: true, genericKey: 'belt' },
      { type: 'VELCRO', label: 'Velcro', icon: '📎', isGeneric: true, genericKey: 'velcro' },
      { type: 'OTHER_FASTENER', label: 'Other Fastener', icon: '🔩', isGeneric: true, genericKey: 'other_fastener' },
    ],
  },
  {
    category: 'THREADS_TAPES',
    label: 'Threads & Tapes',
    color: 'bg-green-50 border-green-200',
    trims: [
      { type: 'THREAD', label: 'Thread', icon: '🧵' },
      { type: 'ELASTIC', label: 'Elastic', icon: '〰️' },
      { type: 'DRAWSTRING', label: 'Drawstring', icon: '➰', isGeneric: true, genericKey: 'drawstring' },
      { type: 'RIBBON', label: 'Ribbon', icon: '🎗️', isGeneric: true, genericKey: 'ribbon' },
      { type: 'OTHER_TAPE', label: 'Other Tape', icon: '📏', isGeneric: true, genericKey: 'other_tape' },
    ],
  },
  {
    category: 'DECORATIVE',
    label: 'Decorative',
    color: 'bg-pink-50 border-pink-200',
    trims: [
      { type: 'LACE', label: 'Lace', icon: '🎀' },
      { type: 'SEQUIN', label: 'Sequin', icon: '💎', isGeneric: true, genericKey: 'sequin' },
      { type: 'BEAD', label: 'Bead', icon: '📿', isGeneric: true, genericKey: 'bead' },
      { type: 'MOTIF', label: 'Motif', icon: '🌸', isGeneric: true, genericKey: 'motif' },
      {
        type: 'OTHER_DECORATIVE',
        label: 'Other Decorative',
        icon: '✨',
        isGeneric: true,
        genericKey: 'other_decorative',
      },
    ],
  },
  {
    category: 'FUNCTIONAL',
    label: 'Functional',
    color: 'bg-gray-50 border-gray-200',
    trims: [
      // Note: Labels are managed separately under Packaging (care labels, size labels, brand labels)
      { type: 'INTERLINING', label: 'Interlining', icon: '📄', isGeneric: true, genericKey: 'interlining' },
      { type: 'PADDING', label: 'Padding', icon: '🛡️', isGeneric: true, genericKey: 'padding' },
      {
        type: 'OTHER_FUNCTIONAL',
        label: 'Other Functional',
        icon: '🔧',
        isGeneric: true,
        genericKey: 'other_functional',
      },
    ],
  },
];

// Flat list for backwards compatibility
const TRIM_TABS: { type: TrimType; label: string; icon: string }[] = TRIM_CATEGORIES.flatMap((cat) => cat.trims);

// Map API keys (snake_case) to state keys (camelCase)
const SNAKE_TO_CAMEL: Record<string, string> = {
  hook_eye: 'hookEye',
  snap_button: 'snapButton',
  buckle: 'buckle',
  belt: 'belt',
  velcro: 'velcro',
  drawstring: 'drawstring',
  ribbon: 'ribbon',
  sequin: 'sequin',
  bead: 'bead',
  motif: 'motif',
  interlining: 'interlining',
  padding: 'padding',
  other_fastener: 'otherFastener',
  other_tape: 'otherTape',
  other_decorative: 'otherDecorative',
  other_functional: 'otherFunctional',
};

export function TrimSelector({ selectedTrims, onChange, disabled = false }: TrimSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<TrimCategory>('FASTENERS_CLOSURES');
  const [activeTab, setActiveTab] = useState<TrimType>('BUTTON');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isGlobalSearchMode, setIsGlobalSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_expandedCategories, setExpandedCategories] = useState<Record<TrimCategory, boolean>>({
    FASTENERS_CLOSURES: true,
    THREADS_TAPES: false,
    DECORATIVE: false,
    FUNCTIONAL: false,
  });

  // Browse modal state - only load and show all items when user wants to add more
  const [browseModalOpen, setBrowseModalOpen] = useState(false);

  // Data for original 5 trim types (Labels moved to Packaging)
  const [buttons, setButtons] = useState<TrimItem[]>([]);
  const [threads, setThreads] = useState<TrimItem[]>([]);
  const [zippers, setZippers] = useState<TrimItem[]>([]);
  const [elastics, setElastics] = useState<TrimItem[]>([]);
  const [laces, setLaces] = useState<TrimItem[]>([]);

  // Data for new 16 generic trim types (including Belt and 4 "Others" types)
  // Using camelCase keys to match frontend conventions
  const [genericTrims, setGenericTrims] = useState<Record<string, TrimItem[]>>({
    hookEye: [],
    snapButton: [],
    buckle: [],
    belt: [],
    velcro: [],
    drawstring: [],
    ribbon: [],
    sequin: [],
    bead: [],
    motif: [],
    interlining: [],
    padding: [],
    // "Others" types
    otherFastener: [],
    otherTape: [],
    otherDecorative: [],
    otherFunctional: [],
  });

  // Quick add modal - common fields
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Load data for each trim type - only when browse modal is opened
  useEffect(() => {
    if (browseModalOpen) {
      loadAllTrims();
    }
  }, [browseModalOpen]);

  const loadAllTrims = async () => {
    setLoading(true);
    try {
      await Promise.all([
        // Original 5 trim types (Labels moved to Packaging)
        loadButtons(),
        loadThreads(),
        loadZippers(),
        loadElastics(),
        loadLaces(),
        // New 16 generic trim types
        loadGenericTrims(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Load all generic trim types
  const loadGenericTrims = async () => {
    const genericTypes = [
      'hook_eye',
      'snap_button',
      'buckle',
      'belt',
      'velcro',
      'drawstring',
      'ribbon',
      'sequin',
      'bead',
      'motif',
      'interlining',
      'padding',
      // "Others" types
      'other_fastener',
      'other_tape',
      'other_decorative',
      'other_functional',
    ];

    await Promise.all(
      genericTypes.map(async (trimType) => {
        try {
          const config = TRIM_TYPE_CONFIGS[trimType];
          if (!config) return;

          const response = await genericTrimService.getAll(trimType, { limit: 100 });
          const items: TrimItem[] = response.data.map((item: GenericTrimItem) => ({
            id: item.id,
            code: (item as any)[config.codeField],
            name: (item as any)[config.nameField],
            color: (item as any).color || null,
            description: item.description,
          }));

          // Convert snake_case API key to camelCase state key
          const stateKey = SNAKE_TO_CAMEL[trimType] || trimType;
          setGenericTrims((prev) => ({
            ...prev,
            [stateKey]: items,
          }));
        } catch (error) {
          console.error(`Failed to load ${trimType}:`, error);
        }
      })
    );
  };

  const loadButtons = async () => {
    try {
      const response = await getAllButtons({ limit: 100 });
      setButtons(
        response.data.map((b: ButtonType) => ({
          id: b.id,
          code: b.buttonCode,
          name: b.buttonName,
          color: b.color,
          description: b.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load buttons:', error);
    }
  };

  const loadThreads = async () => {
    try {
      const response = await getAllThreads({ limit: 100 });
      setThreads(
        response.data.map((t: Thread) => ({
          id: t.id,
          code: t.threadCode,
          name: t.threadName,
          color: t.color,
          description: t.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadZippers = async () => {
    try {
      const response = await getAllZippers({ limit: 100 });
      setZippers(
        response.data.map((z: Zipper) => ({
          id: z.id,
          code: z.zipperCode,
          name: z.zipperName,
          color: z.color,
          description: z.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load zippers:', error);
    }
  };

  const loadElastics = async () => {
    try {
      const response = await getAllElastics({ limit: 100 });
      setElastics(
        response.data.map((e: Elastic) => ({
          id: e.id,
          code: e.elasticCode,
          name: e.elasticName,
          color: e.color,
          description: e.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load elastics:', error);
    }
  };

  const loadLaces = async () => {
    try {
      const response = await getAllLace({ limit: 100 });
      setLaces(
        response.data.map((l: Lace) => ({
          id: l.id,
          code: l.laceCode,
          name: l.laceName,
          color: l.color,
          description: l.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load laces:', error);
    }
  };

  // Note: Labels (care labels, size labels, brand labels) are managed separately under Packaging
  // See AccessorySelector for label selection functionality

  // Get items for current tab
  const getCurrentItems = (): TrimItem[] => {
    switch (activeTab) {
      // Original 5 trim types (Labels moved to Packaging)
      case 'BUTTON':
        return buttons;
      case 'THREAD':
        return threads;
      case 'ZIPPER':
        return zippers;
      case 'ELASTIC':
        return elastics;
      case 'LACE':
        return laces;
      // New 16 generic trim types (camelCase keys)
      case 'HOOK_EYE':
        return genericTrims.hookEye || [];
      case 'SNAP_BUTTON':
        return genericTrims.snapButton || [];
      case 'BUCKLE':
        return genericTrims.buckle || [];
      case 'BELT':
        return genericTrims.belt || [];
      case 'VELCRO':
        return genericTrims.velcro || [];
      case 'DRAWSTRING':
        return genericTrims.drawstring || [];
      case 'RIBBON':
        return genericTrims.ribbon || [];
      case 'SEQUIN':
        return genericTrims.sequin || [];
      case 'BEAD':
        return genericTrims.bead || [];
      case 'MOTIF':
        return genericTrims.motif || [];
      case 'INTERLINING':
        return genericTrims.interlining || [];
      case 'PADDING':
        return genericTrims.padding || [];
      // "Others" types
      case 'OTHER_FASTENER':
        return genericTrims.otherFastener || [];
      case 'OTHER_TAPE':
        return genericTrims.otherTape || [];
      case 'OTHER_DECORATIVE':
        return genericTrims.otherDecorative || [];
      case 'OTHER_FUNCTIONAL':
        return genericTrims.otherFunctional || [];
      default:
        return [];
    }
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const items = getCurrentItems();
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, buttons, threads, zippers, elastics, laces, genericTrims]);

  // Global search - search across ALL trim types
  interface GlobalSearchResult extends TrimItem {
    trimType: TrimType;
    trimLabel: string;
    trimIcon: string;
    categoryLabel: string;
  }

  const globalSearchResults = useMemo((): GlobalSearchResult[] => {
    if (!globalSearchQuery || globalSearchQuery.length < 2) return [];

    const query = globalSearchQuery.toLowerCase();
    const results: GlobalSearchResult[] = [];

    // Helper to add results from an array
    const addResults = (
      items: TrimItem[],
      trimType: TrimType,
      trimLabel: string,
      trimIcon: string,
      categoryLabel: string
    ) => {
      items.forEach((item) => {
        if (
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          item.color?.toLowerCase().includes(query)
        ) {
          results.push({
            ...item,
            trimType,
            trimLabel,
            trimIcon,
            categoryLabel,
          });
        }
      });
    };

    // Search original 5 trim types (Labels moved to Packaging)
    addResults(buttons, 'BUTTON', 'Button', '🔘', 'Fasteners & Closures');
    addResults(zippers, 'ZIPPER', 'Zipper', '🔗', 'Fasteners & Closures');
    addResults(threads, 'THREAD', 'Thread', '🧵', 'Threads & Tapes');
    addResults(elastics, 'ELASTIC', 'Elastic', '〰️', 'Threads & Tapes');
    addResults(laces, 'LACE', 'Lace', '🎀', 'Decorative');

    // Search generic trim types (includes interlining, padding, other_functional under Functional)
    TRIM_CATEGORIES.forEach((cat) => {
      cat.trims.forEach((trim) => {
        if (trim.isGeneric && trim.genericKey) {
          const stateKey = SNAKE_TO_CAMEL[trim.genericKey] || trim.genericKey;
          const items = genericTrims[stateKey] || [];
          addResults(items, trim.type, trim.label, trim.icon, cat.label);
        }
      });
    });

    return results;
  }, [globalSearchQuery, buttons, threads, zippers, elastics, laces, genericTrims]);

  // Toggle global search item selection
  const toggleGlobalSearchItem = (result: GlobalSearchResult) => {
    if (disabled) return;

    const existingIndex = selectedTrims.findIndex((t) => t.trimType === result.trimType && t.masterId === result.id);

    if (existingIndex >= 0) {
      // Remove
      const newTrims = [...selectedTrims];
      newTrims.splice(existingIndex, 1);
      onChange(newTrims);
    } else {
      // Add
      const newTrim: StyleTrim = {
        trimType: result.trimType,
        masterId: result.id,
        masterCode: result.code,
        masterName: result.name,
        color: result.color,
      };
      onChange([...selectedTrims, newTrim]);
    }
  };

  // Check if global search result is selected
  const isGlobalResultSelected = (result: GlobalSearchResult): boolean => {
    return selectedTrims.some((t) => t.trimType === result.trimType && t.masterId === result.id);
  };

  // Exit global search mode
  const exitGlobalSearch = () => {
    setIsGlobalSearchMode(false);
    setGlobalSearchQuery('');
  };

  // Check if item is selected
  const isSelected = (trimType: TrimType, masterId: string): boolean => {
    return selectedTrims.some((t) => t.trimType === trimType && t.masterId === masterId);
  };

  // Toggle item selection
  const toggleItem = (item: TrimItem) => {
    if (disabled) return;

    const trimType = activeTab;
    const existingIndex = selectedTrims.findIndex((t) => t.trimType === trimType && t.masterId === item.id);

    if (existingIndex >= 0) {
      // Remove
      const newTrims = [...selectedTrims];
      newTrims.splice(existingIndex, 1);
      onChange(newTrims);
    } else {
      // Add
      const newTrim: StyleTrim = {
        trimType,
        masterId: item.id,
        masterCode: item.code,
        masterName: item.name,
        color: item.color,
      };
      onChange([...selectedTrims, newTrim]);
    }
  };

  // Remove a selected trim
  const removeTrim = (trim: StyleTrim) => {
    if (disabled) return;
    onChange(selectedTrims.filter((t) => !(t.trimType === trim.trimType && t.masterId === trim.masterId)));
  };

  // Get count of selected items for a tab
  const getSelectedCount = (trimType: TrimType): number => {
    return selectedTrims.filter((t) => t.trimType === trimType).length;
  };

  // Handle material created from quick add dialog
  const handleMaterialCreated = (newMaterial: CreatedMaterial) => {
    // Update local state so item appears in browse list
    const trimItem = {
      id: newMaterial.id,
      code: newMaterial.code,
      name: newMaterial.name,
      color: newMaterial.color || null,
      description: null,
    };

    // Update the appropriate state based on active tab
    switch (activeTab) {
      case 'BUTTON':
        setButtons((prev) => [...prev, trimItem]);
        break;
      case 'THREAD':
        setThreads((prev) => [...prev, trimItem]);
        break;
      case 'ZIPPER':
        setZippers((prev) => [...prev, trimItem]);
        break;
      case 'ELASTIC':
        setElastics((prev) => [...prev, trimItem]);
        break;
      case 'LACE':
        setLaces((prev) => [...prev, trimItem]);
        break;
      // Generic trims - use camelCase state keys
      case 'HOOK_EYE':
        setGenericTrims((prev) => ({ ...prev, hookEye: [...(prev.hookEye || []), trimItem] }));
        break;
      case 'SNAP_BUTTON':
        setGenericTrims((prev) => ({ ...prev, snapButton: [...(prev.snapButton || []), trimItem] }));
        break;
      case 'BUCKLE':
        setGenericTrims((prev) => ({ ...prev, buckle: [...(prev.buckle || []), trimItem] }));
        break;
      case 'BELT':
        setGenericTrims((prev) => ({ ...prev, belt: [...(prev.belt || []), trimItem] }));
        break;
      case 'VELCRO':
        setGenericTrims((prev) => ({ ...prev, velcro: [...(prev.velcro || []), trimItem] }));
        break;
      case 'DRAWSTRING':
        setGenericTrims((prev) => ({ ...prev, drawstring: [...(prev.drawstring || []), trimItem] }));
        break;
      case 'RIBBON':
        setGenericTrims((prev) => ({ ...prev, ribbon: [...(prev.ribbon || []), trimItem] }));
        break;
      case 'SEQUIN':
        setGenericTrims((prev) => ({ ...prev, sequin: [...(prev.sequin || []), trimItem] }));
        break;
      case 'BEAD':
        setGenericTrims((prev) => ({ ...prev, bead: [...(prev.bead || []), trimItem] }));
        break;
      case 'MOTIF':
        setGenericTrims((prev) => ({ ...prev, motif: [...(prev.motif || []), trimItem] }));
        break;
      case 'INTERLINING':
        setGenericTrims((prev) => ({ ...prev, interlining: [...(prev.interlining || []), trimItem] }));
        break;
      case 'PADDING':
        setGenericTrims((prev) => ({ ...prev, padding: [...(prev.padding || []), trimItem] }));
        break;
      case 'OTHER_FASTENER':
        setGenericTrims((prev) => ({ ...prev, otherFastener: [...(prev.otherFastener || []), trimItem] }));
        break;
      case 'OTHER_TAPE':
        setGenericTrims((prev) => ({ ...prev, otherTape: [...(prev.otherTape || []), trimItem] }));
        break;
      case 'OTHER_DECORATIVE':
        setGenericTrims((prev) => ({ ...prev, otherDecorative: [...(prev.otherDecorative || []), trimItem] }));
        break;
      case 'OTHER_FUNCTIONAL':
        setGenericTrims((prev) => ({ ...prev, otherFunctional: [...(prev.otherFunctional || []), trimItem] }));
        break;
    }

    // Auto-select the newly created item
    const newTrim: StyleTrim = {
      trimType: activeTab,
      masterId: newMaterial.id,
      masterCode: newMaterial.code,
      masterName: newMaterial.name,
      color: newMaterial.color || null,
    };
    onChange([...selectedTrims, newTrim]);
  };

  // Open quick add modal - reset all fields

  // Get icon for trim type
  const getTrimIcon = (trimType: TrimType): string => {
    return TRIM_TABS.find((t) => t.type === trimType)?.icon || '📦';
  };

  // Get selected count for a category
  const getCategorySelectedCount = (category: TrimCategory): number => {
    const categoryConfig = TRIM_CATEGORIES.find((c) => c.category === category);
    if (!categoryConfig) return 0;
    return categoryConfig.trims.reduce((sum, t) => sum + getSelectedCount(t.type), 0);
  };

  // Handle category selection
  const handleCategorySelect = (category: TrimCategory) => {
    setActiveCategory(category);
    // Expand this category, collapse others
    setExpandedCategories(
      (prev) =>
        ({
          ...Object.fromEntries(Object.keys(prev).map((k) => [k, false])),
          [category]: true,
        }) as Record<TrimCategory, boolean>
    );
    // Set the first trim in this category as active
    const categoryConfig = TRIM_CATEGORIES.find((c) => c.category === category);
    if (categoryConfig && categoryConfig.trims.length > 0) {
      setActiveTab(categoryConfig.trims[0].type);
    }
    setSearchQuery('');
  };

  // Get current tab info
  const currentTabInfo = TRIM_TABS.find((t) => t.type === activeTab);

  return (
    <div className="space-y-4">
      {/* Show selected trims grouped by category */}
      {TRIM_CATEGORIES.map((cat) => {
        const categoryTrims = selectedTrims.filter((t) => cat.trims.some((trimDef) => trimDef.type === t.trimType));
        if (categoryTrims.length === 0) return null;

        return (
          <div key={cat.category} className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{cat.label}</h4>
              <Badge variant="secondary" className="text-xs">
                {categoryTrims.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryTrims.map((trim, index) => (
                <Badge
                  key={`${trim.trimType}-${trim.masterId}-${index}`}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1.5 px-2.5"
                >
                  <span>{getTrimIcon(trim.trimType)}</span>
                  <span className="font-mono text-xs">{trim.masterCode}</span>
                  <span className="text-xs">{trim.masterName}</span>
                  {trim.color && (
                    <div className="flex items-center gap-1">
                      <Circle className="h-2.5 w-2.5" style={{ fill: trim.color, stroke: trim.color }} />
                    </div>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeTrim(trim)}
                      className="ml-1 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {selectedTrims.length === 0 && (
        <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
          <p className="text-sm">No trims selected for this style.</p>
          <p className="text-xs mt-1">Click "Browse & Add" to add buttons, zippers, threads, and other trims.</p>
        </div>
      )}

      {/* Browse & Add button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setBrowseModalOpen(true)}
        disabled={disabled}
        className="w-full"
      >
        <Search className="h-4 w-4 mr-2" />
        Browse & Add Trims
      </Button>

      {/* Browse Modal - Shows all available trims */}
      <Dialog open={browseModalOpen} onOpenChange={setBrowseModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Browse & Add Trims</DialogTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create New
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {/* Global Search Bar */}
            <div className="relative mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search all trims (name, code, color)..."
                    value={globalSearchQuery}
                    onChange={(e) => {
                      setGlobalSearchQuery(e.target.value);
                      setIsGlobalSearchMode(e.target.value.length > 0);
                    }}
                    className="pl-9"
                  />
                </div>
                {isGlobalSearchMode && (
                  <Button type="button" variant="ghost" size="sm" onClick={exitGlobalSearch}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {globalSearchQuery.length > 0 && globalSearchQuery.length < 2 && (
                <p className="text-xs text-gray-500 mt-1">Type at least 2 characters to search...</p>
              )}
            </div>

            {/* Global Search Results */}
            {isGlobalSearchMode && globalSearchQuery.length >= 2 && (
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <div className="p-3 bg-gray-50 border-b flex items-center justify-between sticky top-0">
                  <span className="text-sm font-medium text-gray-700">
                    Search Results ({globalSearchResults.length})
                  </span>
                  <button
                    type="button"
                    onClick={exitGlobalSearch}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Back to Categories
                  </button>
                </div>
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No trims found matching "{globalSearchQuery}"</div>
                ) : (
                  <div className="divide-y">
                    {globalSearchResults.map((result, index) => (
                      <label
                        key={`${result.trimType}-${result.id}-${index}`}
                        className={cn(
                          'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                          isGlobalResultSelected(result) && 'bg-blue-50 hover:bg-blue-100'
                        )}
                      >
                        <Checkbox
                          checked={isGlobalResultSelected(result)}
                          onCheckedChange={() => toggleGlobalSearchItem(result)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{result.trimIcon}</span>
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {result.code}
                            </Badge>
                            <span className="font-medium text-sm truncate">{result.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {result.trimLabel}
                            </Badge>
                            <span className="text-xs text-gray-400">{result.categoryLabel}</span>
                            {result.color && (
                              <div className="flex items-center gap-1">
                                <Circle className="h-3 w-3" style={{ fill: result.color, stroke: result.color }} />
                                <span className="text-xs text-gray-500">{result.color}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Category Tabs - Hide when in global search mode */}
            {!isGlobalSearchMode && (
              <Tabs
                value={activeCategory}
                onValueChange={(v) => handleCategorySelect(v as TrimCategory)}
                className="h-full flex flex-col"
              >
                <TabsList className="grid grid-cols-4 w-full">
                  {TRIM_CATEGORIES.map((cat) => (
                    <TabsTrigger key={cat.category} value={cat.category} className="text-xs sm:text-sm">
                      <span className="hidden sm:inline">{cat.label}</span>
                      <span className="sm:hidden">{cat.label.split(' ')[0]}</span>
                      {getCategorySelectedCount(cat.category) > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                          {getCategorySelectedCount(cat.category)}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {TRIM_CATEGORIES.map((cat) => (
                  <TabsContent
                    key={cat.category}
                    value={cat.category}
                    className="flex-1 flex flex-col mt-4 overflow-hidden"
                  >
                    {/* Trim Type Sub-tabs within category */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {cat.trims.map((trim) => (
                          <button
                            key={trim.type}
                            type="button"
                            onClick={() => {
                              setActiveTab(trim.type);
                              setSearchQuery('');
                            }}
                            className={cn(
                              'inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors',
                              activeTab === trim.type
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-white hover:bg-gray-50 border-gray-200'
                            )}
                          >
                            <span className="mr-1.5">{trim.icon}</span>
                            <span>{trim.label}</span>
                            {getSelectedCount(trim.type) > 0 && (
                              <Badge
                                variant={activeTab === trim.type ? 'outline' : 'secondary'}
                                className="ml-1.5 h-5 min-w-[20px] p-0 flex items-center justify-center text-xs"
                              >
                                {getSelectedCount(trim.type)}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={`Search ${currentTabInfo?.label.toLowerCase() || 'items'}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* Items list with checkboxes */}
                    <div className="border rounded-lg flex-1 overflow-y-auto max-h-[300px]">
                      {loading ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                      ) : filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {searchQuery
                            ? 'No matching items found'
                            : `No ${currentTabInfo?.label.toLowerCase() || 'items'} available`}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredItems.map((item) => (
                            <label
                              key={item.id}
                              className={cn(
                                'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                                isSelected(activeTab, item.id) && 'bg-blue-50 hover:bg-blue-100'
                              )}
                            >
                              <Checkbox
                                checked={isSelected(activeTab, item.id)}
                                onCheckedChange={() => toggleItem(item)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                                    {item.code}
                                  </Badge>
                                  <span className="font-medium text-sm truncate">{item.name}</span>
                                </div>
                                {item.color && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Circle className="h-3 w-3" style={{ fill: item.color, stroke: item.color }} />
                                    <span className="text-xs text-gray-500">{item.color}</span>
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected count */}
                    <div className="mt-2 text-sm text-gray-600">
                      {getSelectedCount(activeTab)} {currentTabInfo?.label.toLowerCase() || 'items'} selected
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button type="button" onClick={() => setBrowseModalOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Material Quick Add Dialog */}
      <MaterialQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        materialDomain="TRIM"
        onMaterialCreated={handleMaterialCreated}
        initialType={activeTab}
      />
    </div>
  );
}

export default TrimSelector;
