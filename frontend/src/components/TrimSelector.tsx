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

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Search, Plus, X, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { notify } from '../lib/notify';

// Services - Existing 6 trim types
import { getAllButtons, createButton } from '../services/button.service';
import { getAllThreads, createThread } from '../services/thread.service';
import { getAllZippers, createZipper } from '../services/zipper.service';
import { getAllElastics, createElastic } from '../services/elastic.service';
import { getAllLace, createLace } from '../services/lace.service';
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
  | 'BUTTON' | 'ZIPPER' | 'HOOK_EYE' | 'SNAP_BUTTON' | 'BUCKLE' | 'BELT' | 'VELCRO' | 'OTHER_FASTENER'
  // Threads & Tapes (5 including Other Tape)
  | 'THREAD' | 'ELASTIC' | 'DRAWSTRING' | 'RIBBON' | 'OTHER_TAPE'
  // Decorative (5 including Other Decorative)
  | 'LACE' | 'SEQUIN' | 'BEAD' | 'MOTIF' | 'OTHER_DECORATIVE'
  // Functional (3 including Other Functional) - Label moved to Packaging
  | 'INTERLINING' | 'PADDING' | 'OTHER_FUNCTIONAL';

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
    ]
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
    ]
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
      { type: 'OTHER_DECORATIVE', label: 'Other Decorative', icon: '✨', isGeneric: true, genericKey: 'other_decorative' },
    ]
  },
  {
    category: 'FUNCTIONAL',
    label: 'Functional',
    color: 'bg-gray-50 border-gray-200',
    trims: [
      // Note: Labels are managed separately under Packaging (care labels, size labels, brand labels)
      { type: 'INTERLINING', label: 'Interlining', icon: '📄', isGeneric: true, genericKey: 'interlining' },
      { type: 'PADDING', label: 'Padding', icon: '🛡️', isGeneric: true, genericKey: 'padding' },
      { type: 'OTHER_FUNCTIONAL', label: 'Other Functional', icon: '🔧', isGeneric: true, genericKey: 'other_functional' },
    ]
  }
];

// Flat list for backwards compatibility
const TRIM_TABS: { type: TrimType; label: string; icon: string }[] = TRIM_CATEGORIES.flatMap(cat => cat.trims);

export function TrimSelector({ selectedTrims, onChange, disabled = false }: TrimSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<TrimCategory>('FASTENERS_CLOSURES');
  const [activeTab, setActiveTab] = useState<TrimType>('BUTTON');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isGlobalSearchMode, setIsGlobalSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<TrimCategory, boolean>>({
    FASTENERS_CLOSURES: true,
    THREADS_TAPES: false,
    DECORATIVE: false,
    FUNCTIONAL: false,
  });

  // Data for original 5 trim types (Labels moved to Packaging)
  const [buttons, setButtons] = useState<TrimItem[]>([]);
  const [threads, setThreads] = useState<TrimItem[]>([]);
  const [zippers, setZippers] = useState<TrimItem[]>([]);
  const [elastics, setElastics] = useState<TrimItem[]>([]);
  const [laces, setLaces] = useState<TrimItem[]>([]);

  // Data for new 16 generic trim types (including Belt and 4 "Others" types)
  const [genericTrims, setGenericTrims] = useState<Record<string, TrimItem[]>>({
    hook_eye: [],
    snap_button: [],
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
    other_fastener: [],
    other_tape: [],
    other_decorative: [],
    other_functional: [],
  });

  // Quick add modal - common fields
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<TrimType>('BUTTON');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddColor, setQuickAddColor] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Quick add modal - type-specific fields
  // Button fields
  const [quickAddSize, setQuickAddSize] = useState('');
  const [quickAddHoles, setQuickAddHoles] = useState<number | ''>('');
  const [quickAddMaterial, setQuickAddMaterial] = useState('');
  const [quickAddShape, setQuickAddShape] = useState('');
  // Thread fields
  const [quickAddBrand, setQuickAddBrand] = useState('');
  const [quickAddPackagingType, setQuickAddPackagingType] = useState<'CONE' | 'TUBE' | ''>('');
  const [quickAddMetersPerUnit, setQuickAddMetersPerUnit] = useState<number | ''>('');
  // Zipper fields
  const [quickAddLength, setQuickAddLength] = useState<number | ''>('');
  const [quickAddTeethType, setQuickAddTeethType] = useState('');
  const [quickAddSliderType, setQuickAddSliderType] = useState('');
  // Elastic fields
  const [quickAddWidth, setQuickAddWidth] = useState<number | ''>('');
  const [quickAddComposition, setQuickAddComposition] = useState('');
  const [quickAddElasticType, setQuickAddElasticType] = useState('');
  // Lace fields
  const [quickAddLaceType, setQuickAddLaceType] = useState('');
  const [quickAddDesign, setQuickAddDesign] = useState('');

  // Load data for each trim type
  useEffect(() => {
    loadAllTrims();
  }, []);

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
      'hook_eye', 'snap_button', 'buckle', 'belt', 'velcro',
      'drawstring', 'ribbon',
      'sequin', 'bead', 'motif',
      'interlining', 'padding',
      // "Others" types
      'other_fastener', 'other_tape', 'other_decorative', 'other_functional'
    ];

    await Promise.all(genericTypes.map(async (trimType) => {
      try {
        const config = TRIM_TYPE_CONFIGS[trimType];
        if (!config) return;

        const response = await genericTrimService.getAll(trimType, { limit: 500 });
        const items: TrimItem[] = response.data.map((item: GenericTrimItem) => ({
          id: item.id,
          code: (item as any)[config.codeField],
          name: (item as any)[config.nameField],
          color: (item as any).color || null,
          description: item.description,
        }));

        setGenericTrims(prev => ({
          ...prev,
          [trimType]: items
        }));
      } catch (error) {
        console.error(`Failed to load ${trimType}:`, error);
      }
    }));
  };

  const loadButtons = async () => {
    try {
      const response = await getAllButtons({ limit: 500 });
      setButtons(response.data.map((b: ButtonType) => ({
        id: b.id,
        code: b.buttonCode,
        name: b.buttonName,
        color: b.color,
        description: b.description,
      })));
    } catch (error) {
      console.error('Failed to load buttons:', error);
    }
  };

  const loadThreads = async () => {
    try {
      const response = await getAllThreads({ limit: 500 });
      setThreads(response.data.map((t: Thread) => ({
        id: t.id,
        code: t.threadCode,
        name: t.threadName,
        color: t.color,
        description: t.description,
      })));
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadZippers = async () => {
    try {
      const response = await getAllZippers({ limit: 500 });
      setZippers(response.data.map((z: Zipper) => ({
        id: z.id,
        code: z.zipperCode,
        name: z.zipperName,
        color: z.color,
        description: z.description,
      })));
    } catch (error) {
      console.error('Failed to load zippers:', error);
    }
  };

  const loadElastics = async () => {
    try {
      const response = await getAllElastics({ limit: 500 });
      setElastics(response.data.map((e: Elastic) => ({
        id: e.id,
        code: e.elasticCode,
        name: e.elasticName,
        color: e.color,
        description: e.description,
      })));
    } catch (error) {
      console.error('Failed to load elastics:', error);
    }
  };

  const loadLaces = async () => {
    try {
      const response = await getAllLace({ limit: 500 });
      setLaces(response.data.map((l: Lace) => ({
        id: l.id,
        code: l.laceCode,
        name: l.laceName,
        color: l.color,
        description: l.description,
      })));
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
      case 'BUTTON': return buttons;
      case 'THREAD': return threads;
      case 'ZIPPER': return zippers;
      case 'ELASTIC': return elastics;
      case 'LACE': return laces;
      // New 16 generic trim types
      case 'HOOK_EYE': return genericTrims.hookEye;
      case 'SNAP_BUTTON': return genericTrims.snapButton;
      case 'BUCKLE': return genericTrims.buckle;
      case 'BELT': return genericTrims.belt;
      case 'VELCRO': return genericTrims.velcro;
      case 'DRAWSTRING': return genericTrims.drawstring;
      case 'RIBBON': return genericTrims.ribbon;
      case 'SEQUIN': return genericTrims.sequin;
      case 'BEAD': return genericTrims.bead;
      case 'MOTIF': return genericTrims.motif;
      case 'INTERLINING': return genericTrims.interlining;
      case 'PADDING': return genericTrims.padding;
      // "Others" types
      case 'OTHER_FASTENER': return genericTrims.otherFastener;
      case 'OTHER_TAPE': return genericTrims.otherTape;
      case 'OTHER_DECORATIVE': return genericTrims.otherDecorative;
      case 'OTHER_FUNCTIONAL': return genericTrims.otherFunctional;
      default: return [];
    }
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const items = getCurrentItems();
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item =>
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
    const addResults = (items: TrimItem[], trimType: TrimType, trimLabel: string, trimIcon: string, categoryLabel: string) => {
      items.forEach(item => {
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
    TRIM_CATEGORIES.forEach(cat => {
      cat.trims.forEach(trim => {
        if (trim.isGeneric && trim.genericKey) {
          const items = genericTrims[trim.genericKey] || [];
          addResults(items, trim.type, trim.label, trim.icon, cat.label);
        }
      });
    });

    return results;
  }, [globalSearchQuery, buttons, threads, zippers, elastics, laces, genericTrims]);

  // Toggle global search item selection
  const toggleGlobalSearchItem = (result: GlobalSearchResult) => {
    if (disabled) return;

    const existingIndex = selectedTrims.findIndex(
      t => t.trimType === result.trimType && t.masterId === result.id
    );

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
    return selectedTrims.some(t => t.trimType === result.trimType && t.masterId === result.id);
  };

  // Exit global search mode
  const exitGlobalSearch = () => {
    setIsGlobalSearchMode(false);
    setGlobalSearchQuery('');
  };

  // Check if item is selected
  const isSelected = (trimType: TrimType, masterId: string): boolean => {
    return selectedTrims.some(t => t.trimType === trimType && t.masterId === masterId);
  };

  // Toggle item selection
  const toggleItem = (item: TrimItem) => {
    if (disabled) return;

    const trimType = activeTab;
    const existingIndex = selectedTrims.findIndex(
      t => t.trimType === trimType && t.masterId === item.id
    );

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
    onChange(selectedTrims.filter(t => !(t.trimType === trim.trimType && t.masterId === trim.masterId)));
  };

  // Get count of selected items for a tab
  const getSelectedCount = (trimType: TrimType): number => {
    return selectedTrims.filter(t => t.trimType === trimType).length;
  };

  // Open quick add modal - reset all fields
  const openQuickAdd = () => {
    setQuickAddType(activeTab);
    // Common fields
    setQuickAddName('');
    setQuickAddColor('');
    // Button fields
    setQuickAddSize('');
    setQuickAddHoles('');
    setQuickAddMaterial('');
    setQuickAddShape('');
    // Thread fields
    setQuickAddBrand('');
    setQuickAddPackagingType('');
    setQuickAddMetersPerUnit('');
    // Zipper fields
    setQuickAddLength('');
    setQuickAddTeethType('');
    setQuickAddSliderType('');
    // Elastic fields
    setQuickAddWidth('');
    setQuickAddComposition('');
    setQuickAddElasticType('');
    // Lace fields
    setQuickAddLaceType('');
    setQuickAddDesign('');
    // Open modal
    setQuickAddOpen(true);
  };

  // Handle quick add save
  const handleQuickAddSave = async () => {
    if (!quickAddName.trim()) {
      notify.error('Name is required');
      return;
    }

    setQuickAddSaving(true);
    try {
      let newItem: TrimItem | null = null;

      switch (quickAddType) {
        case 'BUTTON': {
          const result = await createButton({
            buttonName: quickAddName,
            color: quickAddColor || undefined,
            size: quickAddSize || undefined,
            holes: quickAddHoles ? Number(quickAddHoles) : undefined,
            material: quickAddMaterial || undefined,
            shape: quickAddShape || undefined,
          });
          newItem = {
            id: result.id,
            code: result.buttonCode,
            name: result.buttonName,
            color: result.color,
          };
          setButtons(prev => [...prev, newItem!]);
          break;
        }
        case 'THREAD': {
          const result = await createThread({
            threadName: quickAddName,
            color: quickAddColor || undefined,
            brand: quickAddBrand || undefined,
            packagingType: quickAddPackagingType || undefined,
            metersPerUnit: quickAddMetersPerUnit ? Number(quickAddMetersPerUnit) : undefined,
          });
          newItem = {
            id: result.id,
            code: result.threadCode,
            name: result.threadName,
            color: result.color,
          };
          setThreads(prev => [...prev, newItem!]);
          break;
        }
        case 'ZIPPER': {
          const result = await createZipper({
            zipperName: quickAddName,
            color: quickAddColor || undefined,
            length: quickAddLength ? Number(quickAddLength) : undefined,
            teethType: quickAddTeethType || undefined,
            brand: quickAddBrand || undefined,
            sliderType: quickAddSliderType || undefined,
          });
          newItem = {
            id: result.id,
            code: result.zipperCode,
            name: result.zipperName,
            color: result.color,
          };
          setZippers(prev => [...prev, newItem!]);
          break;
        }
        case 'ELASTIC': {
          const result = await createElastic({
            elasticName: quickAddName,
            color: quickAddColor || undefined,
            width: quickAddWidth ? Number(quickAddWidth) : undefined,
            composition: quickAddComposition || undefined,
            elasticType: quickAddElasticType || undefined,
          });
          newItem = {
            id: result.id,
            code: result.elasticCode,
            name: result.elasticName,
            color: result.color,
          };
          setElastics(prev => [...prev, newItem!]);
          break;
        }
        case 'LACE': {
          const result = await createLace({
            laceName: quickAddName,
            color: quickAddColor || undefined,
            laceType: quickAddLaceType || undefined,
            width: quickAddWidth ? Number(quickAddWidth) : undefined,
            composition: quickAddComposition || undefined,
            design: quickAddDesign || undefined,
          });
          newItem = {
            id: result.id,
            code: result.laceCode,
            name: result.laceName,
            color: result.color,
          };
          setLaces(prev => [...prev, newItem!]);
          break;
        }
        // Note: Labels are managed under Packaging, not in TrimSelector
        // Handle new generic trim types
        default: {
          // Find the generic key for this trim type
          const trimConfig = TRIM_CATEGORIES.flatMap(c => c.trims)
            .find(t => t.type === quickAddType);

          if (trimConfig?.isGeneric && trimConfig.genericKey) {
            const config = TRIM_TYPE_CONFIGS[trimConfig.genericKey];
            if (config) {
              const createData: Record<string, any> = {
                [config.nameField]: quickAddName,
                color: quickAddColor || null,
              };

              const response = await genericTrimService.create(trimConfig.genericKey, createData);
              const createdItem = response.data || response;

              newItem = {
                id: createdItem.id,
                code: (createdItem as any)[config.codeField],
                name: (createdItem as any)[config.nameField],
                color: (createdItem as any).color,
              };

              // Update the generic trims state
              setGenericTrims(prev => ({
                ...prev,
                [trimConfig.genericKey!]: [...prev[trimConfig.genericKey!], newItem!]
              }));
            }
          }
          break;
        }
      }

      if (newItem) {
        // Auto-select the newly created item
        const newTrim: StyleTrim = {
          trimType: quickAddType,
          masterId: newItem.id,
          masterCode: newItem.code,
          masterName: newItem.name,
          color: newItem.color,
        };
        onChange([...selectedTrims, newTrim]);
        notify.success(`${quickAddName} created and added`);
      }

      setQuickAddOpen(false);
    } catch (error) {
      console.error('Failed to create trim:', error);
      notify.error('Failed to create item');
    } finally {
      setQuickAddSaving(false);
    }
  };

  // Get icon for trim type
  const getTrimIcon = (trimType: TrimType): string => {
    return TRIM_TABS.find(t => t.type === trimType)?.icon || '📦';
  };

  // Get selected count for a category
  const getCategorySelectedCount = (category: TrimCategory): number => {
    const categoryConfig = TRIM_CATEGORIES.find(c => c.category === category);
    if (!categoryConfig) return 0;
    return categoryConfig.trims.reduce((sum, t) => sum + getSelectedCount(t.type), 0);
  };

  // Handle category selection
  const handleCategorySelect = (category: TrimCategory) => {
    setActiveCategory(category);
    // Expand this category, collapse others
    setExpandedCategories(prev => ({
      ...Object.fromEntries(Object.keys(prev).map(k => [k, false])),
      [category]: true,
    } as Record<TrimCategory, boolean>));
    // Set the first trim in this category as active
    const categoryConfig = TRIM_CATEGORIES.find(c => c.category === category);
    if (categoryConfig && categoryConfig.trims.length > 0) {
      setActiveTab(categoryConfig.trims[0].type);
    }
    setSearchQuery('');
  };

  // Get current tab info
  const currentTabInfo = TRIM_TABS.find(t => t.type === activeTab);

  return (
    <div className="space-y-4">
      {/* Global Search Bar - Always visible at top */}
      <div className="relative">
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
              onFocus={() => {
                if (globalSearchQuery.length > 0) {
                  setIsGlobalSearchMode(true);
                }
              }}
              className="pl-9"
              disabled={disabled}
            />
          </div>
          {isGlobalSearchMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={exitGlobalSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {globalSearchQuery.length > 0 && globalSearchQuery.length < 2 && (
          <p className="text-xs text-gray-500 mt-1">Type at least 2 characters to search...</p>
        )}
      </div>

      {/* Global Search Results - Show when in global search mode */}
      {isGlobalSearchMode && globalSearchQuery.length >= 2 && (
        <div className="border rounded-lg">
          <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
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
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : globalSearchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No trims found matching "{globalSearchQuery}"
              </div>
            ) : (
              <div className="divide-y">
                {globalSearchResults.map((result, index) => (
                  <label
                    key={`${result.trimType}-${result.id}-${index}`}
                    className={cn(
                      'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                      isGlobalResultSelected(result) && 'bg-blue-50 hover:bg-blue-50',
                      disabled && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Checkbox
                      checked={isGlobalResultSelected(result)}
                      onCheckedChange={() => toggleGlobalSearchItem(result)}
                      disabled={disabled}
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
                            <Circle
                              className="h-3 w-3"
                              style={{ fill: result.color, stroke: result.color }}
                            />
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
        </div>
      )}

      {/* Category Tabs - Hide when in global search mode */}
      {!isGlobalSearchMode && (
      <Tabs value={activeCategory} onValueChange={(v) => handleCategorySelect(v as TrimCategory)}>
        <TabsList className="grid grid-cols-4 w-full">
          {TRIM_CATEGORIES.map(cat => (
            <TabsTrigger key={cat.category} value={cat.category} className="text-xs sm:text-sm">
              <span className="hidden sm:inline">{cat.label}</span>
              <span className="sm:hidden">{cat.label.split(' ')[0]}</span>
              {getCategorySelectedCount(cat.category) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {getCategorySelectedCount(cat.category)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRIM_CATEGORIES.map(cat => (
          <TabsContent key={cat.category} value={cat.category} className="mt-4">
            {/* Trim Type Sub-tabs within category */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {cat.trims.map(trim => (
                  <button
                    key={trim.type}
                    type="button"
                    onClick={() => { setActiveTab(trim.type); setSearchQuery(''); }}
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
                      <Badge variant={activeTab === trim.type ? "outline" : "secondary"} className="ml-1.5 h-5 min-w-[20px] p-0 flex items-center justify-center text-xs">
                        {getSelectedCount(trim.type)}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Add New */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={`Search ${currentTabInfo?.label.toLowerCase() || 'items'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openQuickAdd}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New
              </Button>
            </div>

            {/* Items list with checkboxes */}
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No matching items found' : `No ${currentTabInfo?.label.toLowerCase() || 'items'} available`}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredItems.map(item => (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                        isSelected(activeTab, item.id) && 'bg-blue-50 hover:bg-blue-50',
                        disabled && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <Checkbox
                        checked={isSelected(activeTab, item.id)}
                        onCheckedChange={() => toggleItem(item)}
                        disabled={disabled}
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
                            <Circle
                              className="h-3 w-3"
                              style={{ fill: item.color, stroke: item.color }}
                            />
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

      {/* Selected Trims Summary */}
      {selectedTrims.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Selected Trims ({selectedTrims.length})</h4>
          <div className="flex flex-wrap gap-2">
            {selectedTrims.map((trim, index) => (
              <Badge
                key={`${trim.trimType}-${trim.masterId}-${index}`}
                variant="secondary"
                className="flex items-center gap-1 py-1 px-2"
              >
                <span>{getTrimIcon(trim.trimType)}</span>
                <span className="font-mono text-xs">{trim.masterCode}</span>
                <span className="text-xs">{trim.masterName}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeTrim(trim)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Add Modal - Type-specific forms */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add New {TRIM_TABS.find(t => t.type === quickAddType)?.label.slice(0, -1) || 'Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Common: Name field */}
            <div>
              <Label htmlFor="quickAddName">Name *</Label>
              <Input
                id="quickAddName"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={`Enter ${quickAddType.toLowerCase()} name`}
                autoFocus
              />
            </div>

            {/* Common: Color field */}
            <div>
              <Label htmlFor="quickAddColor">Color</Label>
              <Input
                id="quickAddColor"
                value={quickAddColor}
                onChange={(e) => setQuickAddColor(e.target.value)}
                placeholder="e.g., White, Black, Red"
              />
            </div>

            {/* BUTTON-specific fields */}
            {quickAddType === 'BUTTON' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddSize">Size</Label>
                    <Input
                      id="quickAddSize"
                      value={quickAddSize}
                      onChange={(e) => setQuickAddSize(e.target.value)}
                      placeholder="e.g., 15mm, 18L"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddHoles">Holes</Label>
                    <Input
                      id="quickAddHoles"
                      type="number"
                      value={quickAddHoles}
                      onChange={(e) => setQuickAddHoles(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 2, 4"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddMaterial">Material</Label>
                    <Input
                      id="quickAddMaterial"
            value={quickAddMaterial}
                      onChange={(e) => setQuickAddMaterial(e.target.value)}
                      placeholder="e.g., Plastic, Metal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddShape">Shape</Label>
                    <Input
                      id="quickAddShape"
                      value={quickAddShape}
                      onChange={(e) => setQuickAddShape(e.target.value)}
                      placeholder="e.g., Round, Square"
                    />
                  </div>
                </div>
              </>
            )}

            {/* THREAD-specific fields */}
            {quickAddType === 'THREAD' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddBrand">Brand</Label>
                    <Input
                      id="quickAddBrand"
                      value={quickAddBrand}
			onChange={(e) => setQuickAddBrand(e.target.value)}
                      placeholder="e.g., Coats, Aster"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddPackagingType">Packaging Type</Label>
                    <select
                      id="quickAddPackagingType"
                      value={quickAddPackagingType}
                      onChange={(e) => setQuickAddPackagingType(e.target.value as 'CONE' | 'TUBE' | '')}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="CONE">Cone</option>
                      <option value="TUBE">Tube</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="quickAddMetersPerUnit">Meters Per Unit</Label>
                  <Input
                    id="quickAddMetersPerUnit"
                    type="number"
                    value={quickAddMetersPerUnit}
                    onChange={(e) => setQuickAddMetersPerUnit(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g., 5000, 1000"
                  />
                </div>
              </>
            )}

            {/* ZIPPER-specific fields */}
            {quickAddType === 'ZIPPER' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLength">Length (inches)</Label>
                    <Input
                      id="quickAddLength"
                      type="number"
                      step="0.1"
                      value={quickAddLength}
                      onChange={(e) => setQuickAddLength(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 7.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddBrand">Brand</Label>
                    <Input
                      id="quickAddBrand"
                      value={quickAddBrand}
                      onChange={(e) => setQuickAddBrand(e.target.value)}
                      placeholder="e.g., YKK, SBS"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddTeethType">Teeth Type</Label>
                    <Input
                      id="quickAddTeethType"
                      value={quickAddTeethType}
                      onChange={(e) => setQuickAddTeethType(e.target.value)}
                      placeholder="e.g., Metal, Nylon"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddSliderType">Slider Type</Label>
                    <Input
                      id="quickAddSliderType"
                      value={quickAddSliderType}
                      onChange={(e) => setQuickAddSliderType(e.target.value)}
                      placeholder="e.g., Auto-lock"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ELASTIC-specific fields */}
            {quickAddType === 'ELASTIC' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddWidth">Width (mm)</Label>
                    <Input
                      id="quickAddWidth"
                      type="number"
                      step="0.1"
                      value={quickAddWidth}
                      onChange={(e) => setQuickAddWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 25.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddElasticType">Elastic Type</Label>
                    <Input
                      id="quickAddElasticType"
                      value={quickAddElasticType}
                      onChange={(e) => setQuickAddElasticType(e.target.value)}
                      placeholder="e.g., Woven, Knitted"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="quickAddComposition">Composition</Label>
                  <Input
                    id="quickAddComposition"
                    value={quickAddComposition}
                    onChange={(e) => setQuickAddComposition(e.target.value)}
                    placeholder="e.g., 80% Polyester 20% Spandex"
                  />
                </div>
              </>
            )}

            {/* LACE-specific fields */}
            {quickAddType === 'LACE' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLaceType">Lace Type</Label>
                    <Input
                      id="quickAddLaceType"
                      value={quickAddLaceType}
                      onChange={(e) => setQuickAddLaceType(e.target.value)}
                      placeholder="e.g., Guipure, Chantilly"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddWidth">Width (inches)</Label>
                    <Input
                      id="quickAddWidth"
                      type="number"
                      step="0.1"
                      value={quickAddWidth}
                      onChange={(e) => setQuickAddWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 2.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddComposition">Composition</Label>
                    <Input
                      id="quickAddComposition"
                      value={quickAddComposition}
                      onChange={(e) => setQuickAddComposition(e.target.value)}
                      placeholder="e.g., 100% Polyester"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddDesign">Design</Label>
                    <Input
                      id="quickAddDesign"
                      value={quickAddDesign}
                      onChange={(e) => setQuickAddDesign(e.target.value)}
                      placeholder="e.g., Floral, Geometric"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Generic trim types - show info message */}
            {/* Note: Labels are managed under Packaging, not in TrimSelector */}
            {!['BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LACE'].includes(quickAddType) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
                Quick add creates a basic item with name and color. For more detailed entries,
                go to Materials &gt; {currentTabInfo?.label || 'Trim'} Master.
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddOpen(false)}
                disabled={quickAddSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleQuickAddSave}
                disabled={quickAddSaving || !quickAddName.trim()}
              >
                {quickAddSaving ? 'Creating...' : 'Create & Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TrimSelector;
