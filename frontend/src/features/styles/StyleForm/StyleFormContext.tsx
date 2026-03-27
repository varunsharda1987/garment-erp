/**
 * StyleForm Context
 * Centralized state management for the StyleForm component
 */

import { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ComponentMaster } from '../../../types/componentMaster.types';
import type { Customer, BrandCategory } from '../../../types/customer.types';
import type { MaterialBOMEntry } from '../../../components/MaterialBOMPicker';
import { createDefaultFabric, createDefaultSKUVariants, createDefaultProcesses } from './types';
import type { FabricEntry, SKUVariant, ProcessEntry, SelectedComponent, ProcessType } from './types';

// ============================================
// Accessory Preset Interface
// ============================================

export interface AccessoryPreset {
  id: string;
  presetName: string;
  isDefault?: boolean;
}

// ============================================
// State Interface
// ============================================

export interface StyleFormState {
  // Meta
  loading: boolean;
  activeTab: string;
  showAdditionalDetails: boolean;
  isEditMode: boolean;
  styleId: string | null;

  // Basic Info
  styleCode: string;
  styleName: string;
  selectedCustomerId: string;
  customerName: string;
  brandName: string;
  category: string;
  brandCategoryId: string;
  season: string;
  seasonId: string | null;
  description: string;

  // Additional Details
  numberOfComponents: number;
  costPrice: number | '';
  sellingPrice: number | '';
  expectedOrderQty: number | '';
  remarks: string;
  hsnCode: string;
  productTaxRule: string;
  bulletPoints: string;
  accountingSKU: string;
  accountingUnit: string;
  imageUrl: string;
  uploadingImage: boolean;

  // Lookups
  customers: Customer[];
  availableBrands: string[];
  availableCategories: BrandCategory[];
  customerAccessoryPresets: AccessoryPreset[];
  componentMasters: ComponentMaster[];
  componentCategories: string[];
  selectedComponents: SelectedComponent[];

  // Tab 2: SKU Variants
  skuVariants: SKUVariant[];

  // Tab 3: Fabrics & Trims
  fabrics: FabricEntry[];
  materialBOM: MaterialBOMEntry[];

  // Tab 4: Processes
  processes: ProcessEntry[];

  // Tab 5: Accessories
  selectedAccessoryPresetId: string;
  accessories: MaterialBOMEntry[];
  isPickerOpen: boolean;
}

// ============================================
// Action Types
// ============================================

type StyleFormAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'TOGGLE_ADDITIONAL_DETAILS' }
  | { type: 'SET_EDIT_MODE'; payload: { isEditMode: boolean; styleId: string | null } }
  | { type: 'SET_BASIC_INFO'; payload: Partial<StyleFormState> }
  | { type: 'SET_CUSTOMERS'; payload: Customer[] }
  | { type: 'SET_SELECTED_CUSTOMER'; payload: string }
  | { type: 'SET_AVAILABLE_BRANDS'; payload: string[] }
  | { type: 'SET_AVAILABLE_CATEGORIES'; payload: BrandCategory[] }
  | { type: 'SET_ACCESSORY_PRESETS'; payload: AccessoryPreset[] }
  | { type: 'SET_COMPONENT_MASTERS'; payload: { masters: ComponentMaster[]; categories: string[] } }
  | { type: 'SET_SELECTED_COMPONENTS'; payload: SelectedComponent[] }
  | { type: 'UPDATE_SELECTED_COMPONENT'; payload: { index: number; component: SelectedComponent } }
  | { type: 'SET_SKU_VARIANTS'; payload: SKUVariant[] }
  | { type: 'UPDATE_SKU_VARIANT'; payload: { index: number; variant: SKUVariant } }
  | { type: 'SET_FABRICS'; payload: FabricEntry[] }
  | { type: 'ADD_FABRIC' }
  | { type: 'REMOVE_FABRIC'; payload: string }
  | { type: 'UPDATE_FABRIC'; payload: { id: string; field: keyof FabricEntry; value: FabricEntry[keyof FabricEntry] } }
  | { type: 'SET_MATERIAL_BOM'; payload: MaterialBOMEntry[] }
  | { type: 'ADD_MATERIAL'; payload: MaterialBOMEntry }
  | { type: 'REMOVE_MATERIAL'; payload: number }
  | { type: 'SET_PROCESSES'; payload: ProcessEntry[] }
  | { type: 'TOGGLE_PROCESS'; payload: ProcessType }
  | { type: 'UPDATE_PROCESS'; payload: { processType: ProcessType; field: string; value: string | number } }
  | { type: 'SET_ACCESSORIES'; payload: MaterialBOMEntry[] }
  | { type: 'ADD_ACCESSORY'; payload: MaterialBOMEntry }
  | { type: 'REMOVE_ACCESSORY'; payload: number }
  | { type: 'SET_ACCESSORY_PRESET_ID'; payload: string }
  | { type: 'SET_PICKER_OPEN'; payload: boolean }
  | { type: 'SET_IMAGE_URL'; payload: string }
  | { type: 'SET_UPLOADING_IMAGE'; payload: boolean }
  | { type: 'LOAD_STYLE_DATA'; payload: Partial<StyleFormState> }
  | { type: 'RESET_FORM' };

// ============================================
// Initial State
// ============================================

const initialState: StyleFormState = {
  loading: false,
  activeTab: 'basic',
  showAdditionalDetails: false,
  isEditMode: false,
  styleId: null,

  styleCode: '',
  styleName: '',
  selectedCustomerId: '',
  customerName: '',
  brandName: '',
  category: '',
  brandCategoryId: '',
  season: '',
  seasonId: null,
  description: '',

  numberOfComponents: 1,
  costPrice: '',
  sellingPrice: '',
  expectedOrderQty: '',
  remarks: '',
  hsnCode: '',
  productTaxRule: '',
  bulletPoints: '',
  accountingSKU: '',
  accountingUnit: 'PCS',
  imageUrl: '',
  uploadingImage: false,

  customers: [],
  availableBrands: [],
  availableCategories: [],
  customerAccessoryPresets: [],
  componentMasters: [],
  componentCategories: [],
  selectedComponents: [],

  skuVariants: createDefaultSKUVariants(),
  fabrics: [createDefaultFabric(1)],
  materialBOM: [],
  processes: createDefaultProcesses(),
  selectedAccessoryPresetId: '',
  accessories: [],
  isPickerOpen: false,
};

// ============================================
// Reducer
// ============================================

function styleFormReducer(state: StyleFormState, action: StyleFormAction): StyleFormState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'TOGGLE_ADDITIONAL_DETAILS':
      return { ...state, showAdditionalDetails: !state.showAdditionalDetails };

    case 'SET_EDIT_MODE':
      return { ...state, isEditMode: action.payload.isEditMode, styleId: action.payload.styleId };

    case 'SET_BASIC_INFO':
      return { ...state, ...action.payload };

    case 'SET_CUSTOMERS':
      return { ...state, customers: action.payload };

    case 'SET_SELECTED_CUSTOMER':
      return { ...state, selectedCustomerId: action.payload };

    case 'SET_AVAILABLE_BRANDS':
      return { ...state, availableBrands: action.payload };

    case 'SET_AVAILABLE_CATEGORIES':
      return { ...state, availableCategories: action.payload };

    case 'SET_ACCESSORY_PRESETS':
      return { ...state, customerAccessoryPresets: action.payload };

    case 'SET_COMPONENT_MASTERS':
      return {
        ...state,
        componentMasters: action.payload.masters,
        componentCategories: action.payload.categories,
      };

    case 'SET_SELECTED_COMPONENTS':
      return { ...state, selectedComponents: action.payload };

    case 'UPDATE_SELECTED_COMPONENT': {
      const newComponents = [...state.selectedComponents];
      while (newComponents.length <= action.payload.index) {
        newComponents.push({ category: '', componentId: '' });
      }
      newComponents[action.payload.index] = action.payload.component;
      return { ...state, selectedComponents: newComponents };
    }

    case 'SET_SKU_VARIANTS':
      return { ...state, skuVariants: action.payload };

    case 'UPDATE_SKU_VARIANT': {
      const variants = [...state.skuVariants];
      variants[action.payload.index] = action.payload.variant;
      return { ...state, skuVariants: variants };
    }

    case 'SET_FABRICS':
      return { ...state, fabrics: action.payload };

    case 'ADD_FABRIC':
      return {
        ...state,
        fabrics: [...state.fabrics, createDefaultFabric(state.fabrics.length + 1)],
      };

    case 'REMOVE_FABRIC':
      if (state.fabrics.length <= 1) return state;
      return {
        ...state,
        fabrics: state.fabrics.filter((f) => f.id !== action.payload),
      };

    case 'UPDATE_FABRIC':
      return {
        ...state,
        fabrics: state.fabrics.map((f) =>
          f.id === action.payload.id ? { ...f, [action.payload.field]: action.payload.value } : f
        ),
      };

    case 'SET_MATERIAL_BOM':
      return { ...state, materialBOM: action.payload };

    case 'ADD_MATERIAL':
      return { ...state, materialBOM: [...state.materialBOM, action.payload] };

    case 'REMOVE_MATERIAL':
      return {
        ...state,
        materialBOM: state.materialBOM.filter((_, i) => i !== action.payload),
      };

    case 'SET_PROCESSES':
      return { ...state, processes: action.payload };

    case 'TOGGLE_PROCESS':
      return {
        ...state,
        processes: state.processes.map((p) =>
          p.processType === action.payload ? { ...p, isRequired: !p.isRequired } : p
        ),
      };

    case 'UPDATE_PROCESS':
      return {
        ...state,
        processes: state.processes.map((p) =>
          p.processType === action.payload.processType ? { ...p, [action.payload.field]: action.payload.value } : p
        ),
      };

    case 'SET_ACCESSORIES':
      return { ...state, accessories: action.payload };

    case 'ADD_ACCESSORY':
      return { ...state, accessories: [...state.accessories, action.payload] };

    case 'REMOVE_ACCESSORY':
      return {
        ...state,
        accessories: state.accessories.filter((_, i) => i !== action.payload),
      };

    case 'SET_ACCESSORY_PRESET_ID':
      return { ...state, selectedAccessoryPresetId: action.payload };

    case 'SET_PICKER_OPEN':
      return { ...state, isPickerOpen: action.payload };

    case 'SET_IMAGE_URL':
      return { ...state, imageUrl: action.payload };

    case 'SET_UPLOADING_IMAGE':
      return { ...state, uploadingImage: action.payload };

    case 'LOAD_STYLE_DATA':
      return { ...state, ...action.payload };

    case 'RESET_FORM':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface StyleFormContextValue {
  state: StyleFormState;
  dispatch: React.Dispatch<StyleFormAction>;
  // Convenience action creators
  setLoading: (loading: boolean) => void;
  setActiveTab: (tab: string) => void;
  toggleAdditionalDetails: () => void;
  setBasicInfo: (info: Partial<StyleFormState>) => void;
  addFabric: () => void;
  removeFabric: (id: string) => void;
  updateFabric: (id: string, field: keyof FabricEntry, value: FabricEntry[keyof FabricEntry]) => void;
  addMaterial: (entry: MaterialBOMEntry) => void;
  removeMaterial: (index: number) => void;
  toggleProcess: (processType: ProcessType) => void;
  updateProcess: (processType: ProcessType, field: string, value: string | number) => void;
  addAccessory: (entry: MaterialBOMEntry) => void;
  removeAccessory: (index: number) => void;
  setPickerOpen: (open: boolean) => void;
}

const StyleFormContext = createContext<StyleFormContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface StyleFormProviderProps {
  children: ReactNode;
  initialEditMode?: boolean;
  initialStyleId?: string | null;
}

export function StyleFormProvider({
  children,
  initialEditMode = false,
  initialStyleId = null,
}: StyleFormProviderProps) {
  const [state, dispatch] = useReducer(styleFormReducer, {
    ...initialState,
    isEditMode: initialEditMode,
    styleId: initialStyleId,
  });

  // Action creators
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const toggleAdditionalDetails = useCallback(() => {
    dispatch({ type: 'TOGGLE_ADDITIONAL_DETAILS' });
  }, []);

  const setBasicInfo = useCallback((info: Partial<StyleFormState>) => {
    dispatch({ type: 'SET_BASIC_INFO', payload: info });
  }, []);

  const addFabric = useCallback(() => {
    dispatch({ type: 'ADD_FABRIC' });
  }, []);

  const removeFabric = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FABRIC', payload: id });
  }, []);

  const updateFabric = useCallback((id: string, field: keyof FabricEntry, value: FabricEntry[keyof FabricEntry]) => {
    dispatch({ type: 'UPDATE_FABRIC', payload: { id, field, value } });
  }, []);

  const addMaterial = useCallback((entry: MaterialBOMEntry) => {
    dispatch({ type: 'ADD_MATERIAL', payload: entry });
  }, []);

  const removeMaterial = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_MATERIAL', payload: index });
  }, []);

  const toggleProcess = useCallback((processType: ProcessType) => {
    dispatch({ type: 'TOGGLE_PROCESS', payload: processType });
  }, []);

  const updateProcess = useCallback((processType: ProcessType, field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_PROCESS', payload: { processType, field, value } });
  }, []);

  const addAccessory = useCallback((entry: MaterialBOMEntry) => {
    dispatch({ type: 'ADD_ACCESSORY', payload: entry });
  }, []);

  const removeAccessory = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_ACCESSORY', payload: index });
  }, []);

  const setPickerOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_PICKER_OPEN', payload: open });
  }, []);

  const value: StyleFormContextValue = {
    state,
    dispatch,
    setLoading,
    setActiveTab,
    toggleAdditionalDetails,
    setBasicInfo,
    addFabric,
    removeFabric,
    updateFabric,
    addMaterial,
    removeMaterial,
    toggleProcess,
    updateProcess,
    addAccessory,
    removeAccessory,
    setPickerOpen,
  };

  return <StyleFormContext.Provider value={value}>{children}</StyleFormContext.Provider>;
}

// ============================================
// Hook
// ============================================

// eslint-disable-next-line react-refresh/only-export-components
export function useStyleForm() {
  const context = useContext(StyleFormContext);
  if (!context) {
    throw new Error('useStyleForm must be used within a StyleFormProvider');
  }
  return context;
}
