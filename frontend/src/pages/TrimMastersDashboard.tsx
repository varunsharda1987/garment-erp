import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleDot,
  ToggleRight,
  Scissors,
  Cable,
  Wind,
  Plus,
  Layers,
  Lock,
  Sparkles,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { trimService, type TrimSummary, type TrimType } from '@/services/trim.service';
import { genericTrimService } from '@/services/genericTrim.service';
import type { TrimCountsResponse } from '@/types/genericTrim.types';
import { notify } from '@/lib/notify';

// Original 5 trim types (existing) - Labels moved to Packaging
const ORIGINAL_TRIM_TYPES = [
  {
    type: 'BUTTON' as TrimType,
    label: 'Buttons',
    icon: CircleDot,
    path: '/materials/button',
    formPath: '/materials/button/new',
    color: 'bg-info-muted text-info',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'ZIPPER' as TrimType,
    label: 'Zippers',
    icon: ToggleRight,
    path: '/materials/zipper',
    formPath: '/materials/zipper/new',
    color: 'bg-accent/10 text-accent',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'LACE' as TrimType,
    label: 'Laces',
    icon: Scissors,
    path: '/materials/lace',
    formPath: '/materials/lace/new',
    color: 'bg-pink-100 text-pink-800',
    category: 'DECORATIVE',
  },
  {
    type: 'THREAD' as TrimType,
    label: 'Threads',
    icon: Cable,
    path: '/materials/thread',
    formPath: '/materials/thread/new',
    color: 'bg-success-muted text-success',
    category: 'THREADS_TAPES',
  },
  {
    type: 'ELASTIC' as TrimType,
    label: 'Elastic',
    icon: Wind,
    path: '/materials/elastic',
    formPath: '/materials/elastic/new',
    color: 'bg-orange-100 text-orange-800',
    category: 'THREADS_TAPES',
  },
  // Note: Labels (care labels, size labels, brand labels) are now managed under Packaging
];

// New trim types (generic) - includes "Others" for each category
const NEW_TRIM_TYPES = [
  {
    type: 'hook_eye',
    label: 'Hook & Eye',
    icon: Lock,
    path: '/materials/hook_eye',
    formPath: '/materials/hook_eye/new',
    color: 'bg-slate-100 text-slate-800',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'snap_button',
    label: 'Snap Button',
    icon: CircleDot,
    path: '/materials/snap_button',
    formPath: '/materials/snap_button/new',
    color: 'bg-primary/10 text-primary',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'buckle',
    label: 'Buckle',
    icon: Lock,
    path: '/materials/buckle',
    formPath: '/materials/buckle/new',
    color: 'bg-warning/10 text-warning',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'belt',
    label: 'Belt',
    icon: Cable,
    path: '/materials/belt',
    formPath: '/materials/belt/new',
    color: 'bg-stone-100 text-stone-800',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'velcro',
    label: 'Velcro',
    icon: Layers,
    path: '/materials/velcro',
    formPath: '/materials/velcro/new',
    color: 'bg-lime-100 text-lime-800',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'other_fastener',
    label: 'Other Fastener',
    icon: MoreHorizontal,
    path: '/materials/other_fastener',
    formPath: '/materials/other_fastener/new',
    color: 'bg-neutral-100 text-neutral-800',
    category: 'FASTENERS_CLOSURES',
  },
  {
    type: 'drawstring',
    label: 'Drawstring',
    icon: Cable,
    path: '/materials/drawstring',
    formPath: '/materials/drawstring/new',
    color: 'bg-emerald-100 text-emerald-800',
    category: 'THREADS_TAPES',
  },
  {
    type: 'ribbon',
    label: 'Ribbon',
    icon: Wind,
    path: '/materials/ribbon',
    formPath: '/materials/ribbon/new',
    color: 'bg-rose-100 text-rose-800',
    category: 'THREADS_TAPES',
  },
  {
    type: 'other_tape',
    label: 'Other Tape/Thread',
    icon: MoreHorizontal,
    path: '/materials/other_tape',
    formPath: '/materials/other_tape/new',
    color: 'bg-neutral-100 text-neutral-800',
    category: 'THREADS_TAPES',
  },
  {
    type: 'sequin',
    label: 'Sequin',
    icon: Sparkles,
    path: '/materials/sequin',
    formPath: '/materials/sequin/new',
    color: 'bg-fuchsia-100 text-fuchsia-800',
    category: 'DECORATIVE',
  },
  {
    type: 'bead',
    label: 'Bead',
    icon: CircleDot,
    path: '/materials/bead',
    formPath: '/materials/bead/new',
    color: 'bg-violet-100 text-violet-800',
    category: 'DECORATIVE',
  },
  {
    type: 'motif',
    label: 'Motif',
    icon: Sparkles,
    path: '/materials/motif',
    formPath: '/materials/motif/new',
    color: 'bg-accent/10 text-accent',
    category: 'DECORATIVE',
  },
  {
    type: 'other_decorative',
    label: 'Other Decorative',
    icon: MoreHorizontal,
    path: '/materials/other_decorative',
    formPath: '/materials/other_decorative/new',
    color: 'bg-neutral-100 text-neutral-800',
    category: 'DECORATIVE',
  },
  {
    type: 'interlining',
    label: 'Interlining',
    icon: Layers,
    path: '/materials/interlining',
    formPath: '/materials/interlining/new',
    color: 'bg-muted text-foreground',
    category: 'FUNCTIONAL',
  },
  {
    type: 'padding',
    label: 'Padding',
    icon: Settings,
    path: '/materials/padding',
    formPath: '/materials/padding/new',
    color: 'bg-teal-100 text-teal-800',
    category: 'FUNCTIONAL',
  },
  {
    type: 'other_functional',
    label: 'Other Functional',
    icon: MoreHorizontal,
    path: '/materials/other_functional',
    formPath: '/materials/other_functional/new',
    color: 'bg-neutral-100 text-neutral-800',
    category: 'FUNCTIONAL',
  },
];

// All trim types combined
const ALL_TRIM_TYPES = [...ORIGINAL_TRIM_TYPES, ...NEW_TRIM_TYPES];

// Category configuration
const CATEGORY_CONFIG = {
  FASTENERS_CLOSURES: { label: 'Fasteners & Closures', color: 'bg-info-muted border-info/20' },
  THREADS_TAPES: { label: 'Threads & Tapes', color: 'bg-success-muted border-success/20' },
  DECORATIVE: { label: 'Decorative', color: 'bg-pink-50 border-pink-200' },
  FUNCTIONAL: { label: 'Functional', color: 'bg-muted border-border' },
};

// Map trim type to summary key (API returns plural keys like 'buttons', 'zippers', etc.)
// Note: Labels moved to Packaging
const TRIM_TYPE_TO_SUMMARY_KEY: Record<string, keyof TrimSummary> = {
  BUTTON: 'buttons',
  ZIPPER: 'zippers',
  LACE: 'laces',
  THREAD: 'threads',
  ELASTIC: 'elastic',
};

export default function TrimMastersDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Summary data
  const [summary, setSummary] = useState<TrimSummary | null>(null);
  const [totalTrims, setTotalTrims] = useState(0);
  const [newTrimCounts, setNewTrimCounts] = useState<TrimCountsResponse>({});
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'FASTENERS_CLOSURES',
    'THREADS_TAPES',
    'DECORATIVE',
    'FUNCTIONAL',
  ]);

  // Global search
  const [searchQuery, setSearchQuery] = useState('');

  // Load summary on mount
  useEffect(() => {
    loadSummary();
    loadNewTrimCounts();
  }, []);

  const loadNewTrimCounts = async () => {
    try {
      const counts = await genericTrimService.getCounts();
      setNewTrimCounts(counts);
    } catch (err) {
      console.error('Failed to load new trim counts:', err);
      // BUG-DASH13-15 fix: notify user on error
      notify.error('Failed to load trim counts');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const loadSummary = async () => {
    try {
      const response = await trimService.getSummary();
      setSummary(response.data);
      setTotalTrims(response.total);
    } catch (err: unknown) {
      console.error('Failed to load trim summary:', err);
      // BUG-DASH13-15 fix: notify user on error
      notify.error('Failed to load trim summary');
    } finally {
      setLoading(false);
    }
  };

  // Handle search - navigate to first matching category or show results
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Find matching trim types by label
    const matchingType = ALL_TRIM_TYPES.find((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()));

    if (matchingType) {
      // Navigate to matching trim type list with search query
      navigate(`${matchingType.path}?search=${encodeURIComponent(searchQuery)}`);
    } else {
      // Navigate to buttons (most common) with search query
      navigate(`/materials/button?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Get count for a trim type
  const getTrimCount = (trimType: string): number => {
    const isOriginalTrim = ORIGINAL_TRIM_TYPES.some((t) => t.type === trimType);
    if (isOriginalTrim) {
      const summaryKey = TRIM_TYPE_TO_SUMMARY_KEY[trimType];
      return summary?.[summaryKey]?.count || 0;
    } else {
      return newTrimCounts[trimType] || 0;
    }
  };

  // Get most used trim types (top 4 by count)
  const getMostUsedTrims = () => {
    const trimCounts = ALL_TRIM_TYPES.map((trim) => ({
      ...trim,
      count: getTrimCount(trim.type),
    }));

    return trimCounts
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  const mostUsedTrims = getMostUsedTrims();
  const totalItems = totalTrims + Object.values(newTrimCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <PageHeader title="Trim Masters">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Trim
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
            <DropdownMenuLabel>Fasteners & Closures</DropdownMenuLabel>
            {ALL_TRIM_TYPES.filter((t) => t.category === 'FASTENERS_CLOSURES').map((trim) => (
              <DropdownMenuItem key={trim.type} onClick={() => navigate(trim.formPath)}>
                <trim.icon className="mr-2 h-4 w-4" />
                New {trim.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Threads & Tapes</DropdownMenuLabel>
            {ALL_TRIM_TYPES.filter((t) => t.category === 'THREADS_TAPES').map((trim) => (
              <DropdownMenuItem key={trim.type} onClick={() => navigate(trim.formPath)}>
                <trim.icon className="mr-2 h-4 w-4" />
                New {trim.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Decorative</DropdownMenuLabel>
            {ALL_TRIM_TYPES.filter((t) => t.category === 'DECORATIVE').map((trim) => (
              <DropdownMenuItem key={trim.type} onClick={() => navigate(trim.formPath)}>
                <trim.icon className="mr-2 h-4 w-4" />
                New {trim.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Functional</DropdownMenuLabel>
            {ALL_TRIM_TYPES.filter((t) => t.category === 'FUNCTIONAL').map((trim) => (
              <DropdownMenuItem key={trim.type} onClick={() => navigate(trim.formPath)}>
                <trim.icon className="mr-2 h-4 w-4" />
                New {trim.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Summary Card with Search */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Summary info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Layers className="h-10 w-10 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Trim Items</p>
                  <p className="text-3xl font-bold">{totalItems}</p>
                </div>
              </div>
              <div className="hidden sm:block h-12 w-px bg-border mx-2" />
              <div className="hidden sm:block text-right">
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-lg font-semibold text-primary">{ALL_TRIM_TYPES.length} types</p>
              </div>
            </div>

            {/* Right: Search */}
            <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trims by name, code, color..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </div>

          {/* Quick Links */}
          {mostUsedTrims.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Quick access:</span>
                {mostUsedTrims.map((trim) => {
                  const Icon = trim.icon;
                  return (
                    <Button
                      key={trim.type}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(trim.path)}
                      className="gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {trim.label}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {trim.count}
                      </Badge>
                    </Button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/fabric')}
                  className="gap-1 text-muted-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Fabric Masters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouped Summary Cards by Category */}
      <div className="space-y-4">
        {Object.entries(CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
          const categoryTrims = ALL_TRIM_TYPES.filter((t) => t.category === categoryKey);
          const isExpanded = expandedCategories.includes(categoryKey);

          // Calculate total count for this category
          const categoryTotal = categoryTrims.reduce((total, trim) => {
            return total + getTrimCount(trim.type);
          }, 0);

          return (
            <Collapsible key={categoryKey} open={isExpanded} onOpenChange={() => toggleCategory(categoryKey)}>
              <Card className={`border ${categoryConfig.color}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        {categoryConfig.label}
                        <Badge variant="outline" className="ml-2">
                          {categoryTrims.length} types
                        </Badge>
                        {categoryTotal > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {categoryTotal} items
                          </Badge>
                        )}
                      </CardTitle>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {categoryTrims.map((trim) => {
                        const Icon = trim.icon;
                        const count = getTrimCount(trim.type);

                        return (
                          <Card
                            key={trim.type}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => navigate(trim.path)}
                          >
                            <CardContent className="pt-3 pb-3 px-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <Badge className={`text-[10px] px-1.5 py-0 ${trim.color}`}>{count}</Badge>
                              </div>
                              <p className="text-sm font-medium truncate">{trim.label}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
