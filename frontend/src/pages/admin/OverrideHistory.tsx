import { useState, useEffect } from 'react';
import { stageValidationService } from '@/services/stageValidation.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ShieldAlert, Download, Search, FileText, Clock, User, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface OverrideHistoryItem {
  id: string;
  blockType: string;
  workOrderId?: string;
  orderItemId?: string;
  sampleId?: string;
  fromStage?: string;
  toStage?: string;
  blockedSampleType?: string;
  prerequisiteSampleType?: string;
  overrideReason: string;
  overriddenById: string;
  overriddenAt: string;
  overriddenBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workOrder?: {
    id: string;
    workOrderNumber: string;
  };
  sample?: {
    id: string;
    sampleNumber: string;
    sampleType: string;
  };
}

export default function OverrideHistory() {
  const [overrides, setOverrides] = useState<OverrideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [blockTypeFilter, setBlockTypeFilter] = useState<string>('all');
  const [selectedOverride, setSelectedOverride] = useState<OverrideHistoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadOverrides();
  }, []);

  const loadOverrides = async () => {
    setLoading(true);
    try {
      const data = await stageValidationService.getOverrideHistory(
        undefined,
        undefined,
        100 // Load last 100 overrides
      );
      setOverrides(data);
    } catch (error: unknown) {
      console.error('Failed to load override history:', error);
      toast.error('Failed to load override history');
    } finally {
      setLoading(false);
    }
  };

  // Filter overrides based on search and filters
  const filteredOverrides = overrides.filter((override) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        override.overrideReason.toLowerCase().includes(searchLower) ||
        override.overriddenBy.firstName.toLowerCase().includes(searchLower) ||
        override.overriddenBy.lastName.toLowerCase().includes(searchLower) ||
        override.overriddenBy.email.toLowerCase().includes(searchLower) ||
        override.workOrder?.workOrderNumber.toLowerCase().includes(searchLower) ||
        override.sample?.sampleNumber.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Block type filter
    if (blockTypeFilter !== 'all' && override.blockType !== blockTypeFilter) {
      return false;
    }

    return true;
  });

  const exportToCSV = () => {
    try {
      // CSV headers
      const headers = ['Date/Time', 'User', 'Email', 'Type', 'Item', 'From Stage', 'To Stage', 'Reason'];

      // CSV rows
      const rows = filteredOverrides.map((override) => [
        new Date(override.overriddenAt).toLocaleString(),
        `${override.overriddenBy.firstName} ${override.overriddenBy.lastName}`,
        override.overriddenBy.email,
        override.blockType,
        override.workOrder?.workOrderNumber || override.sample?.sampleNumber || 'N/A',
        override.fromStage || 'N/A',
        override.toStage || 'N/A',
        override.overrideReason.replace(/"/g, '""'), // Escape quotes
      ]);

      // Build CSV content
      const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `override-history-${new Date().toISOString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const getBlockTypeBadgeColor = (blockType: string) => {
    switch (blockType) {
      case 'STAGE_TRANSITION':
        return 'bg-destructive/10 text-destructive border-destructive/25';
      case 'SAMPLE_CREATION':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const formatBlockType = (blockType: string) => {
    return blockType.replace(/_/g, ' ');
  };

  const handleRowClick = (override: OverrideHistoryItem) => {
    setSelectedOverride(override);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-medium text-foreground flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Override History
          </h1>
          <p className="text-muted-foreground mt-1">Audit trail of all admin overrides for production blocking rules</p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredOverrides.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by reason, user, work order, sample..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Block Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="blockType">Block Type</Label>
            <Select value={blockTypeFilter} onValueChange={setBlockTypeFilter}>
              <SelectTrigger id="blockType">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="STAGE_TRANSITION">Stage Transition</SelectItem>
                <SelectItem value="SAMPLE_CREATION">Sample Creation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredOverrides.length} of {overrides.length} overrides
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-info" />
          <span className="ml-3 text-muted-foreground">Loading override history...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredOverrides.length === 0 && (
        <Card className="p-12 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No overrides found</p>
          <p className="text-muted-foreground text-sm mt-2">
            {search || blockTypeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No admin overrides have been recorded yet'}
          </p>
        </Card>
      )}

      {/* Override History Table */}
      {!loading && filteredOverrides.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOverrides.map((override) => (
                <TableRow
                  key={override.id}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => handleRowClick(override)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{new Date(override.overriddenAt).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(override.overriddenAt).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(override.overriddenAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {override.overriddenBy.firstName} {override.overriddenBy.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{override.overriddenBy.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getBlockTypeBadgeColor(override.blockType)}>
                      {formatBlockType(override.blockType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {override.workOrder && <div className="font-medium">{override.workOrder.workOrderNumber}</div>}
                      {override.sample && <div className="font-medium">{override.sample.sampleNumber}</div>}
                      {!override.workOrder && !override.sample && <span className="text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {override.toStage && (
                        <div>
                          {override.fromStage && <span>{override.fromStage} → </span>}
                          <span className="font-medium">{override.toStage}</span>
                        </div>
                      )}
                      {override.blockedSampleType && (
                        <div>
                          <span className="font-medium">{override.blockedSampleType}</span>
                          {override.prerequisiteSampleType && <span> (needs {override.prerequisiteSampleType})</span>}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-md text-sm text-foreground line-clamp-2">{override.overrideReason}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(override);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Override Details
            </DialogTitle>
          </DialogHeader>

          {selectedOverride && (
            <div className="space-y-4">
              {/* Override Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date & Time</Label>
                  <p className="text-sm font-medium">{new Date(selectedOverride.overriddenAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge className={getBlockTypeBadgeColor(selectedOverride.blockType)}>
                    {formatBlockType(selectedOverride.blockType)}
                  </Badge>
                </div>
              </div>

              {/* User Info */}
              <div>
                <Label className="text-xs text-muted-foreground">Overridden By</Label>
                <p className="text-sm font-medium">
                  {selectedOverride.overriddenBy.firstName} {selectedOverride.overriddenBy.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{selectedOverride.overriddenBy.email}</p>
              </div>

              {/* Item Info */}
              {selectedOverride.workOrder && (
                <div>
                  <Label className="text-xs text-muted-foreground">Work Order</Label>
                  <p className="text-sm font-medium">{selectedOverride.workOrder.workOrderNumber}</p>
                </div>
              )}

              {selectedOverride.sample && (
                <div>
                  <Label className="text-xs text-muted-foreground">Sample</Label>
                  <p className="text-sm font-medium">
                    {selectedOverride.sample.sampleNumber} ({selectedOverride.sample.sampleType})
                  </p>
                </div>
              )}

              {/* Stage Transition Details */}
              {selectedOverride.toStage && (
                <div>
                  <Label className="text-xs text-muted-foreground">Stage Transition</Label>
                  <p className="text-sm font-medium">
                    {selectedOverride.fromStage && <span>{selectedOverride.fromStage} → </span>}
                    <span className="text-info">{selectedOverride.toStage}</span>
                  </p>
                </div>
              )}

              {/* Sample Creation Details */}
              {selectedOverride.blockedSampleType && (
                <div>
                  <Label className="text-xs text-muted-foreground">Sample Creation</Label>
                  <p className="text-sm font-medium">
                    {selectedOverride.blockedSampleType}
                    {selectedOverride.prerequisiteSampleType && (
                      <span className="text-muted-foreground">
                        {' '}
                        (requires {selectedOverride.prerequisiteSampleType})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <Label className="text-xs text-muted-foreground">Override Reason</Label>
                <div className="bg-muted border border-border rounded-lg p-3 mt-1">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedOverride.overrideReason}</p>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-1">Audit Record</p>
                    <p>
                      This override is permanently logged and may be reviewed by management for compliance purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
