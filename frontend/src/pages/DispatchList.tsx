import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  CalendarClock,
  RefreshCw,
  Package,
  FileText,
  ClipboardList,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import { FilterBar } from '@/components/filters';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { OrderCombobox } from '@/components/OrderCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deliveryNoteService, asnService, dispatchSummaryService } from '@/services/dispatch.service';
import type { DeliveryNote, DeliveryStatus, ASNApplication, ASNStatus, DispatchSummary } from '@/types/dispatch.types';
import { DeliveryStatusLabels, DeliveryStatusColors, ASNStatusLabels, ASNStatusColors } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { AssignTransportDialog } from '@/components/dispatch/AssignTransportDialog';
import { ASNActionDialog, type ASNAction } from '@/components/dispatch/ASNActionDialog';

import { formatDate } from '@/lib/date';

export default function DispatchList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('delivery-notes');

  // Delivery Notes state
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [dnPage, setDnPage] = useState(1);
  const [dnPageSize, setDnPageSize] = useState(20);
  const [dnTotalPages, setDnTotalPages] = useState(1);
  const [dnTotal, setDnTotal] = useState(0);
  const [dnSearch, setDnSearch] = useState('');
  const [dnStatusFilter, setDnStatusFilter] = useState<string>('');
  // '' = all customers / all orders
  const [dnCustomerFilter, setDnCustomerFilter] = useState('');
  const [dnOrderFilter, setDnOrderFilter] = useState('');

  // ASN state
  const [asnApplications, setAsnApplications] = useState<ASNApplication[]>([]);
  const [asnPage, setAsnPage] = useState(1);
  const [asnPageSize, setAsnPageSize] = useState(20);
  const [asnTotalPages, setAsnTotalPages] = useState(1);
  const [asnTotal, setAsnTotal] = useState(0);
  const [asnSearch, setAsnSearch] = useState('');
  const [asnStatusFilter, setAsnStatusFilter] = useState<string>('');
  const [asnOrderFilter, setAsnOrderFilter] = useState('');

  // Shared state
  const [summary, setSummary] = useState<DispatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Inline action dialogs (wired to existing endpoints — findings B10-05, B10-06)
  const [transportDn, setTransportDn] = useState<DeliveryNote | null>(null);
  const [asnAction, setAsnAction] = useState<{ asn: ASNApplication; action: ASNAction } | null>(null);

  const fetchDeliveryNotes = useCallback(async () => {
    try {
      const response = await deliveryNoteService.getAll({
        page: dnPage,
        limit: dnPageSize,
        search: dnSearch || undefined,
        status: (dnStatusFilter as DeliveryStatus) || undefined,
        customerId: dnCustomerFilter || undefined,
        orderId: dnOrderFilter || undefined,
      });
      setDeliveryNotes(response.data);
      setDnTotalPages(response.pagination.totalPages);
      setDnTotal(response.pagination.total);
    } catch (error) {
      console.error('Error fetching delivery notes:', error);
      handleApiError(error, 'Failed to load delivery notes');
    }
  }, [dnPage, dnPageSize, dnSearch, dnStatusFilter, dnCustomerFilter, dnOrderFilter]);

  const fetchASNApplications = useCallback(async () => {
    try {
      const response = await asnService.getAll({
        page: asnPage,
        limit: asnPageSize,
        search: asnSearch || undefined,
        status: (asnStatusFilter as ASNStatus) || undefined,
        orderId: asnOrderFilter || undefined,
      });
      setAsnApplications(response.data);
      setAsnTotalPages(response.pagination.totalPages);
      setAsnTotal(response.pagination.total);
    } catch (error) {
      console.error('Error fetching ASN applications:', error);
      handleApiError(error, 'Failed to load ASN applications');
    }
  }, [asnPage, asnPageSize, asnSearch, asnStatusFilter, asnOrderFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const summaryData = await dispatchSummaryService.getSummary();
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDeliveryNotes(), fetchASNApplications(), fetchSummary()]);
    setLoading(false);
  }, [fetchDeliveryNotes, fetchASNApplications, fetchSummary]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDeliveryNotes();
  }, [fetchDeliveryNotes]);

  useEffect(() => {
    fetchASNApplications();
  }, [fetchASNApplications]);

  // Each tab has its own filters; clearing one tab's keeps the other tab and the page sizes as they are
  const dnFilterCount = [dnSearch, dnStatusFilter, dnCustomerFilter, dnOrderFilter].filter(Boolean).length;
  const clearDnFilters = () => {
    setDnSearch('');
    setDnStatusFilter('');
    setDnCustomerFilter('');
    setDnOrderFilter('');
    setDnPage(1);
  };

  const asnFilterCount = [asnSearch, asnStatusFilter, asnOrderFilter].filter(Boolean).length;
  const clearAsnFilters = () => {
    setAsnSearch('');
    setAsnStatusFilter('');
    setAsnOrderFilter('');
    setAsnPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // ASN workflow actions
  const handleApplyASN = async (id: string) => {
    try {
      await asnService.apply(id);
      handleApiSuccess('Success', 'ASN applied successfully');
      fetchASNApplications();
      fetchSummary();
    } catch (error) {
      handleApiError(error, 'Failed to apply ASN');
    }
  };

  // Delivery Note workflow actions
  const handleDispatch = async (id: string) => {
    try {
      await deliveryNoteService.dispatch(id);
      handleApiSuccess('Success', 'Delivery note dispatched successfully');
      fetchDeliveryNotes();
      fetchSummary();
    } catch (error) {
      handleApiError(error, 'Failed to dispatch');
    }
  };

  const getDeliveryStatusBadge = (status: DeliveryStatus) => (
    <Badge className={DeliveryStatusColors[status]}>{DeliveryStatusLabels[status]}</Badge>
  );

  const getASNStatusBadge = (status: ASNStatus) => (
    <Badge className={ASNStatusColors[status]}>{ASNStatusLabels[status]}</Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium">Dispatch</h1>
            <p className="text-muted-foreground">Manage delivery notes, ASN applications, and shipments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link to="/manufacturing/dispatch/asn/new">
              <Plus className="h-4 w-4 mr-2" />
              New ASN
            </Link>
          </Button>
          <Button asChild>
            <Link to="/manufacturing/dispatch/delivery/new">
              <Plus className="h-4 w-4 mr-2" />
              New Delivery Note
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Transit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{summary.inTransit}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{summary.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ASN Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary.asnSummary?.pending || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="delivery-notes">
            <FileText className="h-4 w-4 mr-2" />
            Delivery Notes
          </TabsTrigger>
          <TabsTrigger value="asn">
            <ClipboardList className="h-4 w-4 mr-2" />
            ASN Applications
          </TabsTrigger>
        </TabsList>

        {/* Delivery Notes Tab */}
        <TabsContent value="delivery-notes" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <FilterBar
                onClear={clearDnFilters}
                hasActiveFilters={dnFilterCount > 0}
                clearText={`Clear ${dnFilterCount} ${dnFilterCount === 1 ? 'filter' : 'filters'}`}
              >
                <SearchInput
                  className="min-w-[220px] max-w-md flex-1"
                  placeholder="Search DN number, order, customer, style, buyer PO, customer GRN…"
                  value={dnSearch}
                  onChange={(value) => {
                    setDnSearch(value);
                    setDnPage(1);
                  }}
                  // The API refuses a longer search (deliveryNoteQuerySchema: max 100)
                  maxLength={100}
                  aria-label="Search delivery notes"
                />
                <Select
                  value={dnStatusFilter || 'all'}
                  onValueChange={(v) => {
                    setDnStatusFilter(v === 'all' ? '' : v);
                    setDnPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(DeliveryStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CustomerCombobox
                  value={dnCustomerFilter}
                  onValueChange={(v) => {
                    setDnCustomerFilter(v || '');
                    setDnPage(1);
                  }}
                  allowAll
                  allLabel="All customers"
                  placeholder="All customers"
                  className="w-[220px]"
                />
                <OrderCombobox
                  value={dnOrderFilter}
                  onValueChange={(v) => {
                    setDnOrderFilter(v || '');
                    setDnPage(1);
                  }}
                  allowAll
                  allLabel="All orders"
                  placeholder="All orders"
                  className="w-[220px]"
                />
              </FilterBar>
            </CardContent>
          </Card>

          {/* Delivery Notes Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : deliveryNotes.length === 0 ? (
                dnFilterCount > 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <p>No delivery notes match these filters.</p>
                    <Button variant="outline" size="sm" onClick={clearDnFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No delivery notes found</div>
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DN #</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dispatch Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cartons</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer GRN</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryNotes.map((dn) => (
                      <TableRow key={dn.id}>
                        <TableCell className="font-medium">{dn.deliveryNumber}</TableCell>
                        <TableCell>{dn.order?.orderNumber || '-'}</TableCell>
                        <TableCell>{dn.customer?.billingName || dn.customer?.name || '-'}</TableCell>
                        <TableCell>{dn.deliveryDate ? formatDate(new Date(dn.deliveryDate)) : '-'}</TableCell>
                        <TableCell className="text-right">
                          {dn.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                        </TableCell>
                        <TableCell className="text-right">{dn.ext?.cartons?.length || 0}</TableCell>
                        <TableCell>{getDeliveryStatusBadge(dn.status)}</TableCell>
                        <TableCell>
                          {dn.ext?.pod?.customerGrnNumber ? (
                            <div className="text-sm">
                              <div className="font-medium">{dn.ext.pod.customerGrnNumber}</div>
                              {dn.ext.pod.customerGrnDate && (
                                <div className="text-muted-foreground text-xs">
                                  {formatDate(new Date(dn.ext.pod.customerGrnDate))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild title="View">
                              <Link to={`/manufacturing/dispatch/delivery/${dn.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {dn.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setTransportDn(dn)}
                                title="Assign Transport"
                              >
                                <Truck className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {dn.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDispatch(dn.id)}
                                title="Dispatch"
                              >
                                <Send className="h-4 w-4 text-info" />
                              </Button>
                            )}
                            {dn.status === 'PENDING' && (
                              <Button variant="ghost" size="icon" title="Cancel" asChild>
                                <Link to={`/manufacturing/dispatch/delivery/${dn.id}?cancel=1`}>
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Link>
                              </Button>
                            )}
                            {dn.status === 'IN_TRANSIT' && (
                              <Button variant="ghost" size="icon" title="Record POD" asChild>
                                <Link to={`/manufacturing/dispatch/delivery/${dn.id}/pod`}>
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Link>
                              </Button>
                            )}
                            {dn.status === 'DELIVERED' && (
                              <Button variant="ghost" size="icon" title="Invoice" asChild>
                                <Link to={`/manufacturing/dispatch/delivery/${dn.id}?invoice=1`}>
                                  <FileText className="h-4 w-4 text-primary" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={dnPage}
                totalPages={dnTotalPages}
                pageSize={dnPageSize}
                totalItems={dnTotal}
                onPageChange={setDnPage}
                onPageSizeChange={(size) => {
                  setDnPageSize(size);
                  setDnPage(1);
                }}
                pageSizeOptions={[20, 50, 100]}
                itemLabel="delivery notes"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASN Tab */}
        <TabsContent value="asn" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <FilterBar
                onClear={clearAsnFilters}
                hasActiveFilters={asnFilterCount > 0}
                clearText={`Clear ${asnFilterCount} ${asnFilterCount === 1 ? 'filter' : 'filters'}`}
              >
                <SearchInput
                  className="min-w-[220px] max-w-md flex-1"
                  placeholder="Search ASN number, buyer ref, order, customer, style, buyer style…"
                  value={asnSearch}
                  onChange={(value) => {
                    setAsnSearch(value);
                    setAsnPage(1);
                  }}
                  // The API refuses a longer search (asnQuerySchema: max 100)
                  maxLength={100}
                  aria-label="Search ASN applications"
                />
                {/* Options come from the label map, which holds the API's own values (RESCHEDULE, not RESCHEDULED) */}
                <Select
                  value={asnStatusFilter || 'all'}
                  onValueChange={(v) => {
                    setAsnStatusFilter(v === 'all' ? '' : v);
                    setAsnPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(ASNStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <OrderCombobox
                  value={asnOrderFilter}
                  onValueChange={(v) => {
                    setAsnOrderFilter(v || '');
                    setAsnPage(1);
                  }}
                  allowAll
                  allLabel="All orders"
                  placeholder="All orders"
                  className="w-[220px]"
                />
              </FilterBar>
            </CardContent>
          </Card>

          {/* ASN Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : asnApplications.length === 0 ? (
                asnFilterCount > 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <p>No ASN applications match these filters.</p>
                    <Button variant="outline" size="sm" onClick={clearAsnFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No ASN applications found</div>
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ASN #</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Requested Ship Date</TableHead>
                      <TableHead className="text-right">Planned Qty</TableHead>
                      <TableHead className="text-right">Cartons</TableHead>
                      <TableHead>Appointment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asnApplications.map((asn) => (
                      <TableRow
                        key={asn.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/manufacturing/dispatch/asn/${asn.id}`)}
                      >
                        <TableCell className="font-medium">{asn.asnNumber}</TableCell>
                        <TableCell>{asn.order?.orderNumber || '-'}</TableCell>
                        <TableCell>{formatDate(new Date(asn.requestedShipDate))}</TableCell>
                        <TableCell className="text-right">{asn.plannedDispatchQty}</TableCell>
                        <TableCell className="text-right">{asn.cartonsPlanned}</TableCell>
                        <TableCell>
                          {asn.appointmentDate ? (
                            <div>
                              <div>{formatDate(new Date(asn.appointmentDate))}</div>
                              {asn.appointmentTime && (
                                <div className="text-sm text-muted-foreground">{asn.appointmentTime}</div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{getASNStatusBadge(asn.status)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {asn.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApplyASN(asn.id)}
                                title="Apply ASN"
                              >
                                <Send className="h-4 w-4 text-info" />
                              </Button>
                            )}
                            {asn.status === 'APPLIED' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setAsnAction({ asn, action: 'approve' })}
                                  title="Approve ASN"
                                >
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setAsnAction({ asn, action: 'reschedule' })}
                                  title="Reschedule ASN"
                                >
                                  <CalendarClock className="h-4 w-4 text-warning" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setAsnAction({ asn, action: 'reject' })}
                                  title="Reject ASN"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {asn.status === 'APPROVED' && (
                              <Button variant="ghost" size="icon" title="Create Delivery Note" asChild>
                                <Link to={`/manufacturing/dispatch/delivery/new?asnId=${asn.id}`}>
                                  <Package className="h-4 w-4 text-success" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={asnPage}
                totalPages={asnTotalPages}
                pageSize={asnPageSize}
                totalItems={asnTotal}
                onPageChange={setAsnPage}
                onPageSizeChange={(size) => {
                  setAsnPageSize(size);
                  setAsnPage(1);
                }}
                pageSizeOptions={[20, 50, 100]}
                itemLabel="ASN applications"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Transport dialog (PENDING delivery notes) — finding B10-06 */}
      <AssignTransportDialog
        deliveryNote={transportDn}
        onOpenChange={(open) => !open && setTransportDn(null)}
        onSuccess={() => {
          fetchDeliveryNotes();
          fetchSummary();
        }}
      />

      {/* ASN approve / reject / reschedule dialog (APPLIED applications) — finding B10-05 */}
      <ASNActionDialog
        asn={asnAction?.asn ?? null}
        action={asnAction?.action ?? null}
        onOpenChange={(open) => !open && setAsnAction(null)}
        onSuccess={() => {
          fetchASNApplications();
          fetchSummary();
        }}
      />
    </div>
  );
}
