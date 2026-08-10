import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Layers, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/config/permissions.config';
import {
  masterDataService,
  type MasterDataSummary,
  type MasterCategory,
  type MasterType,
} from '@/services/masterData.service';

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  fabricsRawMaterials: 'bg-info-muted border-info/20',
  otherMaterials: 'bg-cyan-50 border-cyan-200',
  fastenersClosures: 'bg-accent/10 border-accent/20',
  threadsTapes: 'bg-success-muted border-success/20',
  decorative: 'bg-pink-50 border-pink-200',
  packagingLabels: 'bg-primary/10 border-orange-200',
  functional: 'bg-muted border-border',
};

// Static sections not covered by the server summary. These are this hub's only
// click-path for several pages demoted from the sidebar, so they must render
// even when the summary API fails (see the error branch below). Each entry's
// permission mirrors its route guard so no role sees a card it cannot open.
interface StaticMaster {
  label: string;
  route: string;
  permission?: PermissionKey;
}

const STATIC_SECTIONS: { key: string; category: string; colorClass: string; masters: StaticMaster[] }[] = [
  {
    key: 'peopleEntities',
    category: 'People & Entities',
    colorClass: 'bg-warning-muted border-warning/20',
    masters: [
      { label: 'Customers', route: '/customers', permission: 'customers' },
      { label: 'Suppliers', route: '/suppliers', permission: 'suppliers' },
      { label: 'Agents', route: '/agents', permission: 'customers' },
      { label: 'Agencies', route: '/agencies', permission: 'customers' },
    ],
  },
  {
    key: 'workshopOther',
    category: 'Workshop & Other Materials',
    colorClass: 'bg-muted border-border',
    masters: [
      { label: 'Machine Parts', route: '/materials/machine-part', permission: 'trimMasters' },
      { label: 'Other Materials', route: '/materials/other', permission: 'trimMasters' },
    ],
  },
  {
    key: 'configuration',
    category: 'Configuration',
    colorClass: 'bg-secondary border-border',
    masters: [
      { label: 'Colors', route: '/colors', permission: 'colorMaster' },
      { label: 'Seasons', route: '/seasons', permission: 'seasonMaster' },
      { label: 'Size Categories', route: '/masters/size-categories', permission: 'sizeCategoryMaster' },
      { label: 'Component Groups', route: '/component-groups', permission: 'componentMasters' },
      { label: 'Component Masters', route: '/component-masters', permission: 'componentMasters' },
      { label: 'Pattern Parts', route: '/pattern-parts', permission: 'componentMasters' },
      { label: 'Product Categories', route: '/product-categories', permission: 'productCategories' },
      { label: 'Processor Rate Cards', route: '/processor-rate-cards', permission: 'suppliers' },
      { label: 'Warehouses', route: '/inventory/warehouses', permission: 'warehouses' },
      { label: 'Export Templates', route: '/settings/export-templates', permission: 'masterData' },
    ],
  },
];

export default function MasterDataDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MasterDataSummary | null>(null);
  const [totals, setTotals] = useState({ totalItems: 0, activeItems: 0, categories: 0 });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'fabricsRawMaterials',
    'otherMaterials',
    'fastenersClosures',
    'threadsTapes',
    'decorative',
    'packagingLabels',
    'functional',
    'peopleEntities',
    'workshopOther',
    'configuration',
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await masterDataService.getSummary();
      setSummary(response.data.summary);
      setTotals(response.data.totals);
    } catch (err: unknown) {
      console.error('Failed to load master data summary:', err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load master data. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();

    // Find matching master across all server categories
    if (summary) {
      for (const categoryData of Object.values(summary)) {
        const matchingMaster = categoryData.masters.find((m: MasterType) => m.label.toLowerCase().includes(query));
        if (matchingMaster) {
          navigate(matchingMaster.route);
          return;
        }
      }
    }

    // Fall back to the static sections (permission-filtered)
    for (const section of STATIC_SECTIONS) {
      const match = section.masters.find(
        (m) => (!m.permission || can(m.permission)) && m.label.toLowerCase().includes(query)
      );
      if (match) {
        navigate(match.route);
        return;
      }
    }
  };

  const filteredSummary = (): MasterDataSummary | null => {
    if (!summary || !searchQuery.trim()) return summary;

    const filtered: Record<string, MasterCategory> = {};

    for (const [key, categoryData] of Object.entries(summary)) {
      const matchingMasters = categoryData.masters.filter((m: MasterType) =>
        m.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (matchingMasters.length > 0) {
        filtered[key] = {
          ...categoryData,
          masters: matchingMasters,
        };
      }
    }

    return Object.keys(filtered).length > 0 ? (filtered as unknown as MasterDataSummary) : null;
  };

  const filteredStaticSections = () => {
    const query = searchQuery.trim().toLowerCase();
    return STATIC_SECTIONS.map((section) => ({
      ...section,
      masters: section.masters.filter(
        (m) => (!m.permission || can(m.permission)) && (!query || m.label.toLowerCase().includes(query))
      ),
    })).filter((section) => section.masters.length > 0);
  };

  const renderStaticSections = () => (
    <div className="space-y-4">
      {filteredStaticSections().map((section) => {
        const isExpanded = expandedCategories.includes(section.key);
        return (
          <Collapsible key={section.key} open={isExpanded} onOpenChange={() => toggleCategory(section.key)}>
            <Card className={`border-2 ${section.colorClass}`}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-card/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Layers className="h-5 w-5" />
                      <div className="text-left">
                        <CardTitle className="text-lg">{section.category}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{section.masters.length} masters</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {section.masters.map((master) => (
                      <button
                        key={master.route}
                        onClick={() => navigate(master.route)}
                        className="group relative flex items-center justify-between p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <div className="font-medium text-left group-hover:text-primary transition-colors">
                          {master.label}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    // Static sections must stay reachable even when the summary API is down —
    // they are the only click-path for pages demoted from the sidebar.
    return (
      <div className="space-y-6">
        <PageHeader title="Master Data">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
          </div>
        </PageHeader>
        <Alert variant="destructive">
          <AlertTitle>Failed to load master data</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" className="w-fit" onClick={loadSummary}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
        {renderStaticSections()}
      </div>
    );
  }

  const displaySummary = filteredSummary();

  return (
    <div className="space-y-6">
      <PageHeader title="Master Data">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
        </div>
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Masters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">{totals.activeItems} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.categories}</div>
            <p className="text-xs text-muted-foreground mt-1">Organized groups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totals.totalItems > 0 ? Math.round((totals.activeItems / totals.totalItems) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active masters</p>
          </CardContent>
        </Card>
      </div>

      {/* Global Search */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all master types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Categories */}
      {displaySummary && (
        <div className="space-y-4">
          {Object.entries(displaySummary).map(([key, categoryData]) => {
            const isExpanded = expandedCategories.includes(key);
            const colorClass = CATEGORY_COLORS[key] || 'bg-muted border-border';

            return (
              <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleCategory(key)}>
                <Card className={`border-2 ${colorClass}`}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-card/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Layers className="h-5 w-5" />
                          <div className="text-left">
                            <CardTitle className="text-lg">{categoryData.category}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {categoryData.totalCount} total • {categoryData.activeCount} active
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-base px-3 py-1">
                            {categoryData.totalCount}
                          </Badge>
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryData.masters.map((master: MasterType) => (
                          <button
                            key={master.type}
                            onClick={() => navigate(master.route)}
                            className="group relative flex items-center justify-between p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            <div className="flex-1 text-left">
                              <div className="font-medium group-hover:text-primary transition-colors">
                                {master.label}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {master.count} total • {master.active} active
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-base">
                                {master.count}
                              </Badge>
                              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Static sections: people, workshop materials, configuration */}
      {renderStaticSections()}

      {!displaySummary && searchQuery.trim() && filteredStaticSections().length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No masters found</h3>
            <p className="text-muted-foreground">Try adjusting your search query</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
