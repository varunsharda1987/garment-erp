/**
 * Job Work Order List Page
 * Unified view for all job work orders across process types
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Factory,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  FileText,
  TrendingDown,
  Plus,
} from 'lucide-react';
import { JobWorkOrderCreateDialog } from '@/components/JobWorkOrderCreateDialog';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import type { JobWorkOrder, JobWorkOrderQueryParams } from '@/types/jobWorkOrder.types';

const PROCESS_TYPES = [
  { value: 'DYEING', label: 'Dyeing' },
  { value: 'PRINTING', label: 'Printing' },
  { value: 'EMBROIDERY', label: 'Embroidery' },
  { value: 'STITCHING', label: 'Stitching' },
  { value: 'SMOCKING', label: 'Smocking' },
  { value: 'WASHING', label: 'Washing' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'HANDWORK', label: 'Handwork' },
  { value: 'KAAJ_BUTTON', label: 'Kaaj-Button' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  LAB_DIP_PENDING: { label: 'Lab Dip Pending', variant: 'outline' },
  LAB_DIP_SUBMITTED: { label: 'Lab Dip Submitted', variant: 'outline' },
  LAB_DIP_APPROVED: { label: 'Lab Dip Approved', variant: 'secondary' },
  READY_TO_SEND: { label: 'Ready to Send', variant: 'secondary' },
  SENT_TO_MILL: { label: 'Sent to Mill', variant: 'default' },
  AT_MILL: { label: 'At Processor', variant: 'default' },
  RECEIVED: { label: 'Received', variant: 'secondary' },
  QUALITY_CHECKED: { label: 'QC Done', variant: 'secondary' },
  STOCK_UPDATED: { label: 'Stock Updated', variant: 'default' },
  // New statuses
  DRAFT: { label: 'Draft', variant: 'outline' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'outline' },
  APPROVED: { label: 'Approved', variant: 'secondary' },
  ISSUED: { label: 'Issued', variant: 'default' },
  IN_TRANSIT: { label: 'In Transit', variant: 'default' },
  AT_PROCESSOR: { label: 'At Processor', variant: 'default' },
  PARTIALLY_RECEIVED: { label: 'Partial Receipt', variant: 'secondary' },
  CLOSED: { label: 'Closed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getDaysOutstanding(sentDate?: string): number | null {
  if (!sentDate) return null;
  const sent = new Date(sentDate);
  const today = new Date();
  const diffTime = today.getTime() - sent.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getSection143Status(sentDate?: string, receivedDate?: string) {
  if (receivedDate) return null;
  const days = getDaysOutstanding(sentDate);
  if (days === null) return null;

  if (days > 365) {
    return { icon: XCircle, color: 'text-red-500', label: 'BREACHED' };
  } else if (days > 300) {
    return { icon: AlertTriangle, color: 'text-red-500', label: 'CRITICAL' };
  } else if (days > 270) {
    return { icon: Clock, color: 'text-yellow-500', label: 'WARNING' };
  }
  return { icon: CheckCircle2, color: 'text-green-500', label: 'OK' };
}

export default function JobWorkOrderList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [processType, setProcessType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const limit = 20;

  const queryParams: JobWorkOrderQueryParams = {
    page,
    limit,
    search: search || undefined,
    processType: processType !== 'all' ? processType : undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['job-work-orders', queryParams],
    queryFn: () => jobWorkOrderService.getAll(queryParams),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['job-work-orders-dashboard'],
    queryFn: () => jobWorkOrderService.getDashboard(),
  });

  const handleRowClick = (jwo: JobWorkOrder) => {
    navigate(`/job-work-orders/${jwo.id}`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="h-6 w-6" />
            Job Work Orders
          </h1>
          <p className="text-muted-foreground">Manage external processing across all process types</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Job Work Order
        </Button>
      </div>

      <JobWorkOrderCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
          queryClient.invalidateQueries({ queryKey: ['job-work-orders-dashboard'] });
        }}
      />

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding at Processors</CardDescription>
              <CardTitle className="text-2xl">{dashboard.outstanding}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Section 143 Warnings</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {dashboard.section143Warnings}
                {dashboard.section143Warnings > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Over Tolerance (Debit Due)</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {dashboard.overTolerance}
                {dashboard.overTolerance > 0 && <TrendingDown className="h-5 w-5 text-red-500" />}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Process Type</CardDescription>
              <CardContent className="p-0 pt-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(dashboard.byProcessType)
                    .slice(0, 3)
                    .map(([type, count]) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}: {count}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by JWO number, processor, style..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={processType}
              onValueChange={(value) => {
                setProcessType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Process Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PROCESS_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>JWO Number</TableHead>
                  <TableHead>Process</TableHead>
                  <TableHead>Processor</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead className="text-right">Qty Sent</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Section 143</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-destructive">
                      Failed to load job work orders
                    </TableCell>
                  </TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No job work orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((jwo) => {
                    const section143 = getSection143Status(jwo.sentDate, jwo.receivedDate);
                    const daysOut = getDaysOutstanding(jwo.sentDate);

                    return (
                      <TableRow
                        key={jwo.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(jwo)}
                      >
                        <TableCell className="font-medium">{jwo.jobWorkNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{jwo.processType}</Badge>
                        </TableCell>
                        <TableCell>{jwo.processor?.name || '-'}</TableCell>
                        <TableCell>
                          {jwo.style?.styleCode || '-'}
                          {jwo.style?.buyerStyleRef && (
                            <span className="text-xs text-muted-foreground ml-1">({jwo.style.buyerStyleRef})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {jwo.qtySentMeters.toFixed(2)} {jwo.uom}
                        </TableCell>
                        <TableCell className="text-right">
                          {jwo.qtyReceivedMeters ? `${jwo.qtyReceivedMeters.toFixed(2)} ${jwo.uom}` : '-'}
                        </TableCell>
                        <TableCell>{jwo.sentDate ? format(new Date(jwo.sentDate), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell>{getStatusBadge(jwo.jwoStatus || jwo.status)}</TableCell>
                        <TableCell>
                          {section143 ? (
                            <div className="flex items-center gap-1">
                              <section143.icon className={`h-4 w-4 ${section143.color}`} />
                              <span className="text-xs">{daysOut}d</span>
                            </div>
                          ) : jwo.receivedDate ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/job-work-orders/${jwo.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="mr-2 h-4 w-4" />
                                Print JWO
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.pagination.total)} of{' '}
                {data.pagination.total}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
