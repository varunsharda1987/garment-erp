import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  CheckCircle,
  RefreshCw,
  Package,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  deliveryNoteService,
  asnService,
  dispatchSummaryService,
} from '@/services/dispatch.service';
import type {
  DeliveryNote,
  DeliveryStatus,
  ASNApplication,
  ASNStatus,
  DispatchSummary,
} from '@/types/dispatch.types';
import {
  DeliveryStatusLabels,
  DeliveryStatusColors,
  ASNStatusLabels,
  ASNStatusColors,
} from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format } from 'date-fns';

export default function DispatchList() {
  const [activeTab, setActiveTab] = useState('delivery-notes');

  // Delivery Notes state
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [dnPage, setDnPage] = useState(1);
  const [dnTotalPages, setDnTotalPages] = useState(1);
  const [dnSearch, setDnSearch] = useState('');
  const [dnStatusFilter, setDnStatusFilter] = useState<string>('');

  // ASN state
  const [asnApplications, setAsnApplications] = useState<ASNApplication[]>([]);
  const [asnPage, setAsnPage] = useState(1);
  const [asnTotalPages, setAsnTotalPages] = useState(1);
  const [asnSearch, setAsnSearch] = useState('');
  const [asnStatusFilter, setAsnStatusFilter] = useState<string>('');

  // Shared state
  const [summary, setSummary] = useState<DispatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDeliveryNotes = async () => {
    try {
      const response = await deliveryNoteService.getAll({
        page: dnPage,
        limit: 20,
        search: dnSearch || undefined,
        status: dnStatusFilter as DeliveryStatus || undefined,
      });
      setDeliveryNotes(response.data);
      setDnTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching delivery notes:', error);
      handleApiError(error, 'Failed to load delivery notes');
    }
  };

  const fetchASNApplications = async () => {
    try {
      const response = await asnService.getAll({
        page: asnPage,
        limit: 20,
        search: asnSearch || undefined,
        status: asnStatusFilter as ASNStatus || undefined,
      });
      setAsnApplications(response.data);
      setAsnTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching ASN applications:', error);
      handleApiError(error, 'Failed to load ASN applications');
    }
  };

  const fetchSummary = async () => {
    try {
      const summaryData = await dispatchSummaryService.getSummary();
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchDeliveryNotes(), fetchASNApplications(), fetchSummary()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDeliveryNotes();
  }, [dnPage, dnStatusFilter]);

  useEffect(() => {
    fetchASNApplications();
  }, [asnPage, asnStatusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleDnSearch = () => {
    setDnPage(1);
    fetchDeliveryNotes();
  };

  const handleAsnSearch = () => {
    setAsnPage(1);
    fetchASNApplications();
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
    <Badge className={DeliveryStatusColors[status]}>
      {DeliveryStatusLabels[status]}
    </Badge>
  );

  const getASNStatusBadge = (status: ASNStatus) => (
    <Badge className={ASNStatusColors[status]}>
      {ASNStatusLabels[status]}
    </Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold">Dispatch</h1>
            <p className="text-muted-foreground">
              Manage delivery notes, ASN applications, and shipments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild variant="outline">
            <Link to="/manufacturing/dispatch/asn/new">
              <ClipboardList className="h-4 w-4 mr-2" />
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Transit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.inTransit}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ASN Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.asnSummary?.pending || 0}
              </div>
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
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by delivery note #, order #, or customer..."
                    value={dnSearch}
                    onChange={(e) => setDnSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDnSearch()}
                    className="pl-9"
                  />
                </div>
                <Select value={dnStatusFilter || 'all'} onValueChange={(v) => setDnStatusFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleDnSearch}>Search</Button>
              </div>
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
                <div className="text-center py-8 text-muted-foreground">
                  No delivery notes found
                </div>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryNotes.map((dn) => (
                      <TableRow key={dn.id}>
                        <TableCell className="font-medium">{dn.deliveryNoteNumber}</TableCell>
                        <TableCell>{dn.order?.orderNumber || '-'}</TableCell>
                        <TableCell>{dn.order?.customer?.name || '-'}</TableCell>
                        <TableCell>
                          {dn.dispatchDate
                            ? format(new Date(dn.dispatchDate), 'dd MMM yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {dn.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {dn.cartons?.length || 0}
                        </TableCell>
                        <TableCell>{getDeliveryStatusBadge(dn.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/manufacturing/dispatch/delivery/${dn.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {dn.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDispatch(dn.id)}
                                title="Dispatch"
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {dn.status === 'IN_TRANSIT' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Record POD"
                                asChild
                              >
                                <Link to={`/manufacturing/dispatch/delivery/${dn.id}/pod`}>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
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
              {dnTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {dnPage} of {dnTotalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDnPage(dnPage - 1)}
                      disabled={dnPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDnPage(dnPage + 1)}
                      disabled={dnPage === dnTotalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASN Tab */}
        <TabsContent value="asn" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ASN #, order #..."
                    value={asnSearch}
                    onChange={(e) => setAsnSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAsnSearch()}
                    className="pl-9"
                  />
                </div>
                <Select value={asnStatusFilter || 'all'} onValueChange={(v) => setAsnStatusFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPLIED">Applied</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAsnSearch}>Search</Button>
              </div>
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
                <div className="text-center py-8 text-muted-foreground">
                  No ASN applications found
                </div>
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
                      <TableRow key={asn.id}>
                        <TableCell className="font-medium">{asn.asnNumber}</TableCell>
                        <TableCell>{asn.order?.orderNumber || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(asn.requestedShipDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          {asn.plannedDispatchQty}
                        </TableCell>
                        <TableCell className="text-right">
                          {asn.cartonsPlanned}
                        </TableCell>
                        <TableCell>
                          {asn.appointmentDate ? (
                            <div>
                              <div>{format(new Date(asn.appointmentDate), 'dd MMM yyyy')}</div>
                              {asn.appointmentTime && (
                                <div className="text-sm text-muted-foreground">
                                  {asn.appointmentTime}
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{getASNStatusBadge(asn.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/manufacturing/dispatch/asn/${asn.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {asn.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApplyASN(asn.id)}
                                title="Apply ASN"
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {asn.status === 'APPROVED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Create Delivery Note"
                                asChild
                              >
                                <Link to={`/manufacturing/dispatch/delivery/new?asnId=${asn.id}`}>
                                  <Package className="h-4 w-4 text-green-600" />
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
              {asnTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {asnPage} of {asnTotalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAsnPage(asnPage - 1)}
                      disabled={asnPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAsnPage(asnPage + 1)}
                      disabled={asnPage === asnTotalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
