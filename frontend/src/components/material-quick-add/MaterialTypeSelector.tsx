/**
 * MaterialTypeSelector Component (Step 1)
 * Displays all material types grouped by category with search functionality
 */

import React, { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';
import type { MaterialTypeConfig, CategoryConfig, MaterialDomain } from '../../types/material-quick-add.types';
import { getMaterialConfigs, getAllCategories } from '../../config/material-quick-add.config';

interface MaterialTypeSelectorProps {
  domain: MaterialDomain;
  selectedType: string | null;
  onSelectType: (type: string) => void;
}

export const MaterialTypeSelector: React.FC<MaterialTypeSelectorProps> = ({ domain, selectedType, onSelectType }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allConfigs = getMaterialConfigs(domain);
  const categories = getAllCategories(domain);

  // Filter configs based on search query
  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return allConfigs;

    const query = searchQuery.toLowerCase();
    return allConfigs.filter(
      (config) => config.label.toLowerCase().includes(query) || config.categoryLabel.toLowerCase().includes(query)
    );
  }, [searchQuery, allConfigs]);

  // Group filtered configs by category
  const configsByCategory = useMemo(() => {
    const grouped: Record<string, MaterialTypeConfig[]> = {};

    filteredConfigs.forEach((config) => {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push(config);
    });

    return grouped;
  }, [filteredConfigs]);

  // Filter categories that have configs
  const visibleCategories = categories.filter((cat) => configsByCategory[cat.category]?.length > 0);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search material types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Sections */}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {visibleCategories.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No material types found matching "{searchQuery}"</div>
        ) : (
          visibleCategories.map((category) => (
            <CategorySection
              key={category.category}
              category={category}
              configs={configsByCategory[category.category]}
              selectedType={selectedType}
              onSelectType={onSelectType}
            />
          ))
        )}
      </div>
    </div>
  );
};

/**
 * CategorySection Component
 * Displays a category with its material type cards
 */
interface CategorySectionProps {
  category: CategoryConfig;
  configs: MaterialTypeConfig[];
  selectedType: string | null;
  onSelectType: (type: string) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({ category, configs, selectedType, onSelectType }) => {
  return (
    <div className="space-y-3">
      {/* Category Header */}
      <h3 className="text-sm font-semibold text-foreground">
        {category.label} ({configs.length})
      </h3>

      {/* Material Type Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {configs.map((config) => (
          <MaterialTypeCard
            key={config.type}
            config={config}
            isSelected={selectedType === config.type}
            onSelect={() => onSelectType(config.type)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * MaterialTypeCard Component
 * Individual material type selection card
 */
interface MaterialTypeCardProps {
  config: MaterialTypeConfig;
  isSelected: boolean;
  onSelect: () => void;
}

const MaterialTypeCard: React.FC<MaterialTypeCardProps> = ({ config, isSelected, onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative p-4 rounded-lg border-2 transition-all
        flex flex-col items-center gap-2
        hover:shadow-md
        ${
          isSelected
            ? 'border-primary bg-primary/10 ring-2 ring-primary'
            : 'border-border bg-card hover:bg-muted hover:border-border'
        }
      `}
    >
      {/* Icon */}
      <div className="text-3xl">{config.icon}</div>

      {/* Label */}
      <div className="text-sm font-medium text-foreground text-center">{config.label}</div>
    </button>
  );
};
