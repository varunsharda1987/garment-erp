import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIPreferencesState {
  // Sidebar expanded groups
  expandedGroups: string[];
  // Collapsed sub-sections within groups (e.g. "Materials & Masters::Configuration")
  collapsedSubSections: string[];
  // Pinned/favorite navigation paths
  pinnedItems: string[];
  // Command palette open state (not persisted)
  commandPaletteOpen: boolean;

  // Actions
  toggleGroup: (groupTitle: string) => void;
  setExpandedGroups: (groups: string[]) => void;
  toggleSubSection: (key: string) => void;
  isSubSectionCollapsed: (key: string) => boolean;
  togglePin: (path: string) => void;
  isPinned: (path: string) => boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const MAX_PINNED_ITEMS = 7;

export const useUIPreferences = create<UIPreferencesState>()(
  persist(
    (set, get) => ({
      expandedGroups: ['Orders & Planning'],
      collapsedSubSections: ['Materials & Masters::Configuration'],
      pinnedItems: [],
      commandPaletteOpen: false,

      toggleGroup: (groupTitle: string) => {
        set((state) => ({
          expandedGroups: state.expandedGroups.includes(groupTitle)
            ? state.expandedGroups.filter((t) => t !== groupTitle)
            : [...state.expandedGroups, groupTitle],
        }));
      },

      setExpandedGroups: (groups: string[]) => {
        set({ expandedGroups: groups });
      },

      toggleSubSection: (key: string) => {
        set((state) => ({
          collapsedSubSections: state.collapsedSubSections.includes(key)
            ? state.collapsedSubSections.filter((k) => k !== key)
            : [...state.collapsedSubSections, key],
        }));
      },

      isSubSectionCollapsed: (key: string) => {
        return get().collapsedSubSections.includes(key);
      },

      togglePin: (path: string) => {
        set((state) => {
          if (state.pinnedItems.includes(path)) {
            return { pinnedItems: state.pinnedItems.filter((p) => p !== path) };
          }
          if (state.pinnedItems.length >= MAX_PINNED_ITEMS) {
            return state; // don't exceed max
          }
          return { pinnedItems: [...state.pinnedItems, path] };
        });
      },

      isPinned: (path: string) => {
        return get().pinnedItems.includes(path);
      },

      setCommandPaletteOpen: (open: boolean) => {
        set({ commandPaletteOpen: open });
      },
    }),
    {
      name: 'ui-preferences',
      partialize: (state) => ({
        expandedGroups: state.expandedGroups,
        collapsedSubSections: state.collapsedSubSections,
        pinnedItems: state.pinnedItems,
        // Don't persist commandPaletteOpen
      }),
    }
  )
);
