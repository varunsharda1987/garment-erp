import { useState, useMemo } from 'react';
import ProcessGuideHeader from '@/components/process-guide/ProcessGuideHeader';
import QuickStartChecklist from '@/components/process-guide/QuickStartChecklist';
import ProcessStageCard from '@/components/process-guide/ProcessStageCard';
import { processStages, processCategoryInfo } from '@/config/processStages';
import type { ProcessCategory } from '@/types/processGuide.types';

export default function ProcessGuidePage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProcessCategory | 'all'>('all');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  // Filter stages based on search and category
  const filteredStages = useMemo(() => {
    let filtered = processStages;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((stage) => stage.category === categoryFilter);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (stage) =>
          stage.title.toLowerCase().includes(searchLower) ||
          stage.description.toLowerCase().includes(searchLower) ||
          stage.purpose.toLowerCase().includes(searchLower) ||
          stage.databaseModels.some((model) => model.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [search, categoryFilter]);

  // Group stages by category
  const groupedStages = useMemo(() => {
    const groups = new Map<ProcessCategory, typeof processStages>();

    filteredStages.forEach((stage) => {
      if (!groups.has(stage.category)) {
        groups.set(stage.category, []);
      }
      groups.get(stage.category)!.push(stage);
    });

    return groups;
  }, [filteredStages]);

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
      } else {
        newSet.add(stageId);
      }
      return newSet;
    });
  };

  const handleToggleExpand = () => {
    if (allExpanded) {
      // Collapse all
      setExpandedStages(new Set());
      setAllExpanded(false);
    } else {
      // Expand all
      const allStageIds = new Set(filteredStages.map((s) => s.id));
      setExpandedStages(allStageIds);
      setAllExpanded(true);
    }
  };

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <ProcessGuideHeader
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          allExpanded={allExpanded}
          onToggleExpand={handleToggleExpand}
        />

        {/* Quick Start Checklist */}
        <div className="mt-8">
          <QuickStartChecklist />
        </div>

        {/* Process Stages by Category */}
        <div className="mt-12 space-y-16">
          {processCategoryInfo.map((categoryInfo) => {
            const stages = groupedStages.get(categoryInfo.id);
            if (!stages || stages.length === 0) return null;

            return (
              <div key={categoryInfo.id} className="space-y-6">
                {/* Category Header - Enhanced with Full Gradient */}
                <div className="relative mb-8">
                  <div className="rounded-xl shadow-xl overflow-hidden">
                    {/* Full Gradient Background */}
                    <div className={`bg-gradient-to-r ${categoryInfo.gradientFrom} ${categoryInfo.gradientTo} p-8`}>
                      <div className="flex items-center gap-6">
                        {/* Larger badge with white border and backdrop effect */}
                        <div className="w-20 h-20 rounded-2xl bg-card bg-opacity-20 backdrop-blur-sm border-4 border-white flex items-center justify-center text-white font-extrabold text-3xl shadow-lg">
                          {stages.length}
                        </div>
                        <div className="flex-1">
                          {/* Larger, bolder title with uppercase */}
                          <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase">
                            {categoryInfo.title}
                          </h2>
                          {/* Larger description with better contrast */}
                          <p className="text-lg text-white text-opacity-90 mt-2 font-medium">
                            {categoryInfo.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Decorative bottom border */}
                    <div className="h-2 bg-gradient-to-r from-transparent via-white to-transparent opacity-20" />
                  </div>
                </div>

                {/* Stages in Category */}
                <div className="space-y-4">
                  {stages.map((stage) => (
                    <ProcessStageCard
                      key={stage.id}
                      stage={stage}
                      isExpanded={expandedStages.has(stage.id)}
                      onToggle={() => toggleStage(stage.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredStages.length === 0 && (
          <div className="mt-12 text-center py-12">
            <p className="text-muted-foreground text-lg">No stages found matching your search criteria.</p>
            <p className="text-muted-foreground text-sm mt-2">Try adjusting your search or filter settings.</p>
          </div>
        )}

        {/* Footer */}
        <div className="my-12 border-t border-border" />
        <div className="text-center pb-8">
          <p className="text-sm text-muted-foreground">
            Complete Process Guide - {processStages.length} Stages from Style Creation to Dispatch
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            For detailed documentation, refer to{' '}
            <code className="bg-muted px-2 py-1 rounded text-muted-foreground">docs/PRODUCT_FLOW_GUIDE.md</code>
          </p>
        </div>
      </div>
    </div>
  );
}
