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

export default function MasterDataDashboard() {
  const navigate = useNavigate();
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
    if (!searchQuery.trim() || !summary) return;

    // Find matching master across all categories
    for (const categoryData of Object.values(summary)) {
      const matchingMaster = categoryData.masters.find((m: MasterType) =>
        m.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchingMaster) {
        navigate(matchingMaster.route);
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
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

      {!displaySummary && searchQuery.trim() && (
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
