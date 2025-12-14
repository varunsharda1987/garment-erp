import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { ProductionStage } from '@/types/style.types';
import type { StatusFilter } from '@/types/productionStatus.types';

interface FilterState {
  status?: StatusFilter;
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  brand?: string;
  customer?: string;
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
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6 space-y-4">
      {/* Search and Primary Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <Label htmlFor="search" className="text-sm font-medium mb-2 block">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search by style code, buyer, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
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
            onValueChange={(value) =>
              setFilters({ ...filters, status: value as StatusFilter })
            }
          >
            <SelectTrigger id="status">
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
            <SelectTrigger id="stage">
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
                cadStatus:
                  value === 'all'
                    ? undefined
                    : (value as 'PENDING' | 'IN_PROGRESS' | 'APPROVED'),
              })
            }
          >
            <SelectTrigger id="cadStatus">
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
            <SelectTrigger id="sortBy">
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

      {/* Sort Order Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Sort Order:</Label>
        <button
          type="button"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
        </button>
      </div>
    </div>
  );
}
