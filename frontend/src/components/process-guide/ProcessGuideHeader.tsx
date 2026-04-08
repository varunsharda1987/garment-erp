import { Search, Maximize2, Minimize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProcessCategory } from '@/types/processGuide.types';

interface ProcessGuideHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: ProcessCategory | 'all';
  onCategoryFilterChange: (value: ProcessCategory | 'all') => void;
  allExpanded: boolean;
  onToggleExpand: () => void;
}

export default function ProcessGuideHeader({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  allExpanded,
  onToggleExpand,
}: ProcessGuideHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div>
        <h1 className="text-3xl font-display font-medium text-foreground">
          Process Guide - Style Creation to Dispatch
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your complete workflow reference for the garment ERP system
        </p>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stages..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={categoryFilter}
          onValueChange={(value) => onCategoryFilterChange(value as ProcessCategory | 'all')}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="pre-production">Pre-Production</SelectItem>
            <SelectItem value="order-management">Order Management</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="fulfillment">Fulfillment</SelectItem>
          </SelectContent>
        </Select>

        {/* Expand/Collapse All */}
        <Button variant="outline" onClick={onToggleExpand} className="w-full sm:w-auto">
          {allExpanded ? (
            <>
              <Minimize2 className="mr-2 h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <Maximize2 className="mr-2 h-4 w-4" />
              Expand All
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
