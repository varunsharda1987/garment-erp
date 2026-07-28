import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Package,
  UserCircle,
  Shirt,
  ClipboardList,
  ListChecks,
  Calculator,
  Warehouse,
  BarChart3,
  ClipboardCheck,
  Wallet,
  ChevronDown,
  ChevronRight,
  Factory,
  Sparkles,
  Ruler,
  FileSpreadsheet,
  Scissors,
  Box,
  Layers,
  ShoppingCart,
  PackageOpen,
  CalendarClock,
  FileBarChart,
  Shuffle,
  PackageX,
  ShieldAlert,
  Truck,
  Palette,
  Cog,
  Beaker,
  Droplets,
  CheckSquare,
  Send,
  TestTube,
  PackagePlus,
  Scale,
  Wrench,
  Activity,
  FlaskConical,
  FolderTree,
  Tag,
  BookOpen,
  Settings,
  PackageSearch,
  Lock,
  Puzzle,
  Calendar,
  Users,
  Receipt,
  BookImage,
  FileText,
  UserCheck,
  Search,
  Star,
  X,
  Hash,
  MessageCircle,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIPreferences } from '@/stores/ui-preferences.store';
import {
  TOP_LEVEL_ITEMS,
  NAV_GROUPS,
  getAllFlatNavItems,
  type NavItem,
  type NavItemOrDivider,
  type SubHeader,
} from '@/config/navigation';

interface SidebarProps {
  isOpen: boolean;
}

// Map icon name strings to React components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Package,
  UserCircle,
  Shirt,
  ClipboardList,
  ListChecks,
  Calculator,
  Warehouse,
  BarChart3,
  ClipboardCheck,
  Wallet,
  Factory,
  Sparkles,
  Ruler,
  FileSpreadsheet,
  Scissors,
  Box,
  Layers,
  ShoppingCart,
  PackageOpen,
  CalendarClock,
  FileBarChart,
  Shuffle,
  PackageX,
  ShieldAlert,
  Truck,
  Palette,
  Cog,
  Beaker,
  Droplets,
  CheckSquare,
  Send,
  TestTube,
  PackagePlus,
  Scale,
  Wrench,
  Activity,
  FlaskConical,
  FolderTree,
  Tag,
  BookOpen,
  Settings,
  PackageSearch,
  Lock,
  Puzzle,
  Calendar,
  Users,
  Receipt,
  BookImage,
  FileText,
  UserCheck,
  Hash,
  MessageCircle,
};

function getIcon(name: string, size: 'sm' | 'md' = 'sm'): ReactNode {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return <Icon className={cls} />;
}

function isNavItem(item: NavItemOrDivider): item is NavItem {
  return typeof item !== 'string' && !('type' in item);
}

function isSubHeader(item: NavItemOrDivider): item is SubHeader {
  return typeof item !== 'string' && 'type' in item && item.type === 'sub-header';
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const { can } = usePermissions();
  const {
    expandedGroups,
    toggleGroup,
    collapsedSubSections,
    toggleSubSection,
    pinnedItems,
    togglePin,
    setCommandPaletteOpen,
  } = useUIPreferences();
  const [searchTerm, setSearchTerm] = useState('');

  const allFlatItems = useMemo(() => getAllFlatNavItems(), []);

  // Filter top-level items by permission
  const filteredTopLevelItems = useMemo(() => {
    return TOP_LEVEL_ITEMS.filter((item) => !item.permission || can(item.permission));
  }, [can]);

  // Filter groups and their items by permission
  const filteredNavGroups = useMemo(() => {
    return NAV_GROUPS.filter((group) => !group.permission || can(group.permission))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item === 'divider') return true;
          if (isSubHeader(item)) return true;
          if (isNavItem(item)) return !item.permission || can(item.permission);
          return true;
        }),
      }))
      .filter((group) => group.items.some((item) => isNavItem(item)))
      .map((group) => ({
        ...group,
        items: cleanDividers(group.items),
      }));
  }, [can]);

  // Search filtering
  const isSearching = searchTerm.trim().length > 0;
  const searchLower = searchTerm.toLowerCase();

  const searchFilteredTopLevel = useMemo(() => {
    if (!isSearching) return filteredTopLevelItems;
    return filteredTopLevelItems.filter((item) => item.title.toLowerCase().includes(searchLower));
  }, [filteredTopLevelItems, searchLower, isSearching]);

  const searchFilteredGroups = useMemo(() => {
    if (!isSearching) return filteredNavGroups;
    return filteredNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item === 'divider') return false; // hide dividers during search
          if (isSubHeader(item)) return false; // hide sub-headers during search
          if (isNavItem(item)) return item.title.toLowerCase().includes(searchLower);
          return false;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredNavGroups, searchLower, isSearching]);

  // Pinned items resolved
  const resolvedPinnedItems = useMemo(() => {
    return pinnedItems
      .map((path) => allFlatItems.find((item) => item.path === path))
      .filter(Boolean) as typeof allFlatItems;
  }, [pinnedItems, allFlatItems]);

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r shadow-sm overflow-y-auto">
      <nav className="p-4">
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter menu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring bg-muted"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
            style={{ display: searchTerm ? 'none' : 'block' }}
            title="Search all pages (Ctrl+K)"
          >
            <kbd className="text-[10px] bg-muted text-muted-foreground px-1 py-0.5 rounded font-mono">/</kbd>
          </button>
        </div>

        {/* Pinned Favorites */}
        {resolvedPinnedItems.length > 0 && !isSearching && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-warning uppercase tracking-wider">
              <Star className="h-3 w-3 fill-amber-400 text-warning" />
              <span>Favorites</span>
            </div>
            <div className="space-y-0.5">
              {resolvedPinnedItems.map((item) => (
                <div key={item.path} className="group relative">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-accent/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      }`
                    }
                  >
                    {getIcon(item.iconName)}
                    <span className="truncate">{item.title}</span>
                  </NavLink>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(item.path);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-warning hover:text-warning transition-opacity"
                    title="Unpin"
                  >
                    <Star className="h-3 w-3 fill-current" />
                  </button>
                </div>
              ))}
            </div>
            <div className="my-2 border-t border-border mx-3" />
          </div>
        )}

        {/* Top Level Navigation Items */}
        {searchFilteredTopLevel.map((item, index) => (
          <div key={item.path} className="group relative">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md ${
                  index === searchFilteredTopLevel.length - 1 ? 'mb-4' : 'mb-1'
                } transition-colors ${
                  isActive ? 'bg-sidebar-accent/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                }`
              }
            >
              {getIcon(item.iconName, 'md')}
              <span>{item.title}</span>
              {item.badge && (
                <span className="ml-auto text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
            </NavLink>
            {!pinnedItems.includes(item.path) && (
              <button
                onClick={() => togglePin(item.path)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-warning transition-opacity"
                title="Pin to favorites"
              >
                <Star className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Navigation Groups */}
        {searchFilteredGroups.map((group) => (
          <div key={group.title} className="mb-2">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                {getIcon(group.iconName, 'md')}
                <span>{group.title}</span>
              </div>
              {isSearching || expandedGroups.includes(group.title) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Group Items */}
            {(isSearching || expandedGroups.includes(group.title)) && (
              <div className="mt-1 ml-2 space-y-0.5">{renderGroupItems(group.items, group.title)}</div>
            )}
          </div>
        ))}

        {/* AI Assistant Link - Bottom */}
        {can('aiAssistant') && !isSearching && (
          <div className="mt-4 pt-4 border-t border-border">
            <NavLink
              to="/ai-assistant"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                    : 'text-foreground hover:bg-accent/10 hover:border hover:border-accent/10'
                }`
              }
            >
              <Sparkles className="h-5 w-5" />
              <span>AI Assistant</span>
              <span className="ml-auto text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">NEW</span>
            </NavLink>
          </div>
        )}

        {/* Search - show AI Assistant if it matches */}
        {isSearching && can('aiAssistant') && 'ai assistant'.includes(searchLower) && (
          <NavLink
            to="/ai-assistant"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md mt-2 text-sm transition-colors ${
                isActive ? 'bg-sidebar-accent/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
              }`
            }
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Assistant</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );

  /**
   * Renders items within a group, handling NavItems, dividers, and sub-headers
   * with collapsible sections.
   */
  function renderGroupItems(items: NavItemOrDivider[], groupTitle: string) {
    const result: ReactNode[] = [];
    let currentSubHeader: SubHeader | null = null;
    let subSectionItems: NavItem[] = [];
    let itemIndex = 0;

    function flushSubSection() {
      if (currentSubHeader && subSectionItems.length > 0) {
        const key = `${groupTitle}::${currentSubHeader.title}`;
        const isCollapsed = collapsedSubSections.includes(key);
        const isCollapsible = currentSubHeader.collapsible;

        result.push(
          <div key={`sub-${currentSubHeader.title}`}>
            {isCollapsible ? (
              <button
                onClick={() => toggleSubSection(key)}
                className="flex items-center justify-between w-full px-3 py-1 mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-muted-foreground transition-colors"
              >
                <span>{currentSubHeader.title}</span>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] normal-case font-normal">
                    {isCollapsed ? `${subSectionItems.length} items` : ''}
                  </span>
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
              </button>
            ) : (
              <div className="px-3 py-1 mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {currentSubHeader.title}
              </div>
            )}
            {(!isCollapsible || !isCollapsed) && (
              <div className="space-y-0.5">{subSectionItems.map((navItem) => renderNavItem(navItem))}</div>
            )}
          </div>
        );
      } else if (subSectionItems.length > 0) {
        // No sub-header, just render items directly
        subSectionItems.forEach((navItem) => {
          result.push(renderNavItem(navItem));
        });
      }
      currentSubHeader = null;
      subSectionItems = [];
    }

    for (const item of items) {
      if (item === 'divider') {
        flushSubSection();
        result.push(<div key={`divider-${itemIndex}`} className="my-1.5 border-t border-border mx-3" />);
      } else if (isSubHeader(item)) {
        flushSubSection();
        currentSubHeader = item;
      } else if (isNavItem(item)) {
        subSectionItems.push(item);
      }
      itemIndex++;
    }
    flushSubSection();

    return result;
  }

  function renderNavItem(item: NavItem) {
    return (
      <div key={item.path} className="group/item relative">
        <NavLink
          to={item.path}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${
              isActive ? 'bg-sidebar-accent/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
            }`
          }
        >
          {getIcon(item.iconName)}
          <span className="truncate">{item.title}</span>
        </NavLink>
        {!pinnedItems.includes(item.path) && (
          <button
            onClick={() => togglePin(item.path)}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-warning transition-opacity"
            title="Pin to favorites"
          >
            <Star className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
}

/**
 * Remove orphan dividers (dividers at start, end, or consecutive)
 * Also removes dividers adjacent to sub-headers
 */
function cleanDividers(items: NavItemOrDivider[]): NavItemOrDivider[] {
  return items.filter((item, index, arr) => {
    if (item !== 'divider') return true;
    if (index === 0 || index === arr.length - 1) return false;
    if (arr[index - 1] === 'divider') return false;
    return true;
  });
}
