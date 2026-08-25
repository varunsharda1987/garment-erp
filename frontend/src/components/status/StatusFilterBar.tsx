import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ProductionStage } from '@/types/style.types';
import type { StatusFilter } from '@/types/productionStatus.types';
import { cn } from '@/lib/utils';

interface FilterState {
  status?: StatusFilter;
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  brand?: string;
  customer?: string;
  orderDateRange?: DateRange;
  deliveryDateRange?: DateRange;
}

interface StatusFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (value: 'asc' | 'desc') => void;
}

export default function StatusFilterBar({
  search,
  setSearch,
  filters,
  setFilters,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: StatusFilterBarProps) {
  const [expanded, setExpanded] = useState(true);

  const activeFilterCount = [
    filters.status && filters.status !== 'all',
    filters.stage,
    filters.cadStatus,
    filters.orderDateRange,
    filters.deliveryDateRange,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setSearch('');
    setFilters({
      status: 'all',
      stage: undefined,
      cadStatus: undefined,
      brand: undefined,
      customer: undefined,
      orderDateRange: undefined,
      deliveryDateRange: undefined,
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border mb-6 overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">Filters & Search</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleClearFilters();
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expandable Content */}
      <div
        className={cn(
          'transition-all duration-200 ease-in-out overflow-hidden',
          expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="p-4 pt-0 space-y-4">
          {/* Row 1: Search and Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <Label htmlFor="search" className="text-sm font-medium mb-2 block">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by style code, buyer, brand..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Label htmlFor="status" className="text-sm font-medium mb-2 block">
                Status
              </Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters({ ...filters, status: value as StatusFilter })}
              >
                <SelectTrigger id="status" className="h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="attention">Needs Attention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stage Filter */}
            <div>
              <Label htmlFor="stage" className="text-sm font-medium mb-2 block">
                Production Stage
              </Label>
              <Select
                value={filters.stage || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    stage: value === 'all' ? undefined : (value as ProductionStage),
                  })
                }
              >
                <SelectTrigger id="stage" className="h-9">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="ORDER_RECEIVED">Order Received</SelectItem>
                  <SelectItem value="PENDING_COSTING">Pending Costing</SelectItem>
                  <SelectItem value="PENDING_GREIGE_ORDER">Pending Greige Order</SelectItem>
                  <SelectItem value="TRIMS_NOT_ORDERED">Trims Not Ordered</SelectItem>
                  <SelectItem value="IN_PRINTING">In Printing</SelectItem>
                  <SelectItem value="IN_DYING">In Dying</SelectItem>
                  <SelectItem value="IN_EMBROIDERY">In Embroidery</SelectItem>
                  <SelectItem value="IN_HANDWORK">In Handwork</SelectItem>
                  <SelectItem value="IN_CUTTING">In Cutting</SelectItem>
                  <SelectItem value="IN_STITCHING">In Stitching</SelectItem>
                  <SelectItem value="IN_FINISHING">In Finishing</SelectItem>
                  <SelectItem value="READY_TO_SHIP">Ready to Ship</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CAD Status Filter */}
            <div>
              <Label htmlFor="cadStatus" className="text-sm font-medium mb-2 block">
                CAD Status
              </Label>
              <Select
                value={filters.cadStatus || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    cadStatus: value === 'all' ? undefined : (value as 'PENDING' | 'IN_PROGRESS' | 'APPROVED'),
                  })
                }
              >
                <SelectTrigger id="cadStatus" className="h-9">
                  <SelectValue placeholder="All CAD Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CAD Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div>
              <Label htmlFor="sortBy" className="text-sm font-medium mb-2 block">
                Sort By
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sortBy" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orderDate">Order Date</SelectItem>
                  <SelectItem value="deliveryDate">Delivery Date</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="orderValue">Order Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Date Range Filters and Sort Order */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Order Date Range */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Order Date</Label>
              <DateRangePicker
                value={filters.orderDateRange}
                onChange={(range) => setFilters({ ...filters, orderDateRange: range })}
                placeholder="Select order date range"
              />
            </div>

            {/* Delivery Date Range */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Delivery Date</Label>
              <DateRangePicker
                value={filters.deliveryDateRange}
                onChange={(range) => setFilters({ ...filters, deliveryDateRange: range })}
                placeholder="Select delivery date range"
              />
            </div>

            {/* Quick Date Presets */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Quick Filter</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    const today = new Date();
                    const nextWeek = new Date(today);
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    setFilters({ ...filters, deliveryDateRange: { from: today, to: nextWeek } });
                  }}
                >
                  Due this week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    const today = new Date();
                    setFilters({ ...filters, deliveryDateRange: { from: undefined, to: today } });
                  }}
                >
                  Overdue
                </Button>
              </div>
            </div>

            {/* Sort Order Toggle */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Sort Order</Label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">↓ Descending (Newest first)</SelectItem>
                  <SelectItem value="asc">↑ Ascending (Oldest first)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
