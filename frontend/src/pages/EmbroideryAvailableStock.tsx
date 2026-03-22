/**
 * Embroidery Available Stock Page
 * View and manage embroidered fabric inventory and send-out records
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { embroideryService } from '../services/embroidery.service';
import {
  Search,
  Package2,
  Plus,
  AlertTriangle,
  ArrowLeft,
  Download,
  Sparkles,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import type { EmbroiderySendOut, EmbroideredFabricStock } from '../types/embroidery.types';
import { logError } from '../lib/logger';
import { API_URL } from '../config/api.config';
import { formatCurrency } from '../lib/currency';

export default function EmbroideryAvailableStock() {
  const navigate = useNavigate();

  // Data
  const [sendOuts, setSendOuts] = useState<EmbroiderySendOut[]>([]);
  const [embroideredStock, setEmbroideredStock] = useState<EmbroideredFabricStock[]>([]);
  const [filteredSendOuts, setFilteredSendOuts] = useState<EmbroiderySendOut[]>([]);
  const [filteredStock, setFilteredStock] = useState<EmbroideredFabricStock[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('send-outs');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, showOverdueOnly, sendOuts, embroideredStock, activeTab]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Get token from localStorage
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token;
        } catch (e) {
          logError('Error parsing auth storage:', e);
        }
      }

      // Load send-outs
      const sendOutData = await embroideryService.getSendOuts();
      setSendOuts(sendOutData);

      // Load embroidered stock
      const stockResponse = await fetch(`${API_URL}/stock?status=AVAILABLE&stockType=EMBROIDERED`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        // Filter to only embroidered stock (has embroideryId)
        const embStock = (stockData.data || stockData || []).filter(
          (s: EmbroideredFabricStock & { embroideryId?: string }) => s.embroideryId
        );
        setEmbroideredStock(embStock);
      }
    } catch (err) {
      logError('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    // Filter send-outs
    let filteredSO = [...sendOuts];
    if (searchTerm) {
      filteredSO = filteredSO.filter(
        (so) =>
          so.sourceFabricStock?.fabricMaster?.fabricCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.sourceFabricStock?.fabricMaster?.fabricName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.embroidery?.designName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      filteredSO = filteredSO.filter((so) => so.status === statusFilter);
    }
    if (showOverdueOnly) {
      filteredSO = filteredSO.filter(
        (so) => so.expectedReturnDate && new Date(so.expectedReturnDate) < new Date() && so.status === 'SENT'
      );
    }
    setFilteredSendOuts(filteredSO);

    // Filter embroidered stock
    let filteredES = [...embroideredStock];
    if (searchTerm) {
      filteredES = filteredES.filter(
        (stock) =>
          stock.fabricMaster?.fabricCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.fabricMaster?.fabricName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.embroidery?.designName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredStock(filteredES);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, ReactNode> = {
      SENT: (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
          <Send className="h-3 w-3" />
          Sent
        </span>
      ),
      IN_PROGRESS: (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          In Progress
        </span>
      ),
      RECEIVED: (
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Received
        </span>
      ),
      PARTIALLY_RECEIVED: (
        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">Partial</span>
      ),
      CANCELLED: (
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      ),
    };
    return badges[status] || status;
  };

  const getQualityBadge = (grade: string) => {
    const badges: Record<string, ReactNode> = {
      A: <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Grade A</span>,
      B: <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Grade B</span>,
      DEFECT: <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Defect</span>,
    };
    return badges[grade] || grade;
  };

  const isOverdue = (expectedDate?: string | null, status?: string) => {
    if (!expectedDate || status !== 'SENT') return false;
    return new Date(expectedDate) < new Date();
  };

  const getPendingCount = () => sendOuts.filter((so) => so.status === 'SENT').length;
  const getOverdueCount = () =>
    sendOuts.filter(
      (so) => so.expectedReturnDate && new Date(so.expectedReturnDate) < new Date() && so.status === 'SENT'
    ).length;
  const getTotalPendingMeters = () =>
    sendOuts.filter((so) => so.status === 'SENT').reduce((sum, so) => sum + so.quantitySent, 0);
  const getTotalEmbroideredMeters = () => filteredStock.reduce((sum, stock) => sum + stock.quantityAvailable, 0);
  const getTotalEmbroideredValue = () =>
    filteredStock.reduce((sum, stock) => sum + stock.quantityAvailable * stock.weightedAvgCost, 0);

  const handleExportSendOuts = () => {
    const headers = [
      'Fabric Code',
      'Fabric Name',
      'Embroidery Design',
      'Supplier',
      'Qty Sent',
      'Qty Received',
      'Status',
      'Send Date',
      'Expected Return',
      'Actual Return',
      'Rate',
    ];
    const rows = filteredSendOuts.map((so) => [
      so.sourceFabricStock?.fabricMaster?.fabricCode || '',
      so.sourceFabricStock?.fabricMaster?.fabricName || '',
      so.embroidery?.designName || '',
      so.supplier?.name || '',
      so.quantitySent,
      so.quantityReceived || '',
      so.status,
      new Date(so.sendDate).toLocaleDateString(),
      so.expectedReturnDate ? new Date(so.expectedReturnDate).toLocaleDateString() : '',
      so.actualReturnDate ? new Date(so.actualReturnDate).toLocaleDateString() : '',
      so.agreedRate,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embroidery-send-outs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleExportStock = () => {
    const headers = [
      'Fabric Code',
      'Fabric Name',
      'Embroidery Design',
      'Quantity',
      'Width',
      'Cost/m',
      'Total Value',
      'Quality',
      'Location',
    ];
    const rows = filteredStock.map((stock) => [
      stock.fabricMaster?.fabricCode || '',
      stock.fabricMaster?.fabricName || '',
      stock.embroidery?.designName || '',
      stock.quantityAvailable,
      stock.width,
      stock.weightedAvgCost.toFixed(2),
      (stock.quantityAvailable * stock.weightedAvgCost).toFixed(2),
      stock.qualityGrade,
      stock.warehouseLocation || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embroidered-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">
          Home
        </Link>
        {' > '}
        <Link to="/fabric" className="hover:text-blue-600">
          Fabric
        </Link>
        {' > '}
        <span className="font-medium text-gray-900">Embroidery Stock</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/fabric')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fabric Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                Embroidery Stock Management
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Manage fabric sent for embroidery and embroidered fabric inventory
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/embroidery-stock/receive')}>
                <Package2 className="h-4 w-4 mr-2" />
                Receive
              </Button>
              <Button
                onClick={() => navigate('/embroidery-stock/send-out')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Send Out
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Pending Send-Outs</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{getPendingCount()}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-gray-600">Pending Meters</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">{getTotalPendingMeters().toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`${getOverdueCount() > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${getOverdueCount() > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-sm text-gray-600">Overdue</span>
                </div>
                <div className={`text-2xl font-bold ${getOverdueCount() > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {getOverdueCount()}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Package2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">Embroidered Stock</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{getTotalEmbroideredMeters().toFixed(2)} m</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-gray-600">Stock Value</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(getTotalEmbroideredValue())}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="send-outs" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send-Outs ({sendOuts.length})
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-2">
                <Package2 className="h-4 w-4" />
                Embroidered Stock ({embroideredStock.length})
              </TabsTrigger>
            </TabsList>

            {/* Send-Outs Tab */}
            <TabsContent value="send-outs">
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search fabric, design, supplier..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RECEIVED">Received</SelectItem>
                      <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showOverdueOnly"
                      checked={showOverdueOnly}
                      onChange={(e) => setShowOverdueOnly(e.target.checked)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showOverdueOnly" className="ml-2 text-sm text-gray-700">
                      Show overdue only
                    </label>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleExportSendOuts}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Send-Outs Table */}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading send-outs...</p>
                </div>
              ) : filteredSendOuts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Send className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No send-out records found</p>
                  <Button className="mt-4" onClick={() => navigate('/embroidery-stock/send-out')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Send First Batch
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Fabric</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Embroidery</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Supplier</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Qty Sent</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Qty Received</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Send Date</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Expected</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSendOuts.map((so) => (
                        <tr
                          key={so.id}
                          className={`hover:bg-gray-50 ${isOverdue(so.expectedReturnDate, so.status) ? 'bg-red-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {so.sourceFabricStock?.fabricMaster?.fabricCode}
                            </div>
                            <div className="text-xs text-gray-500">
                              {so.sourceFabricStock?.fabricMaster?.fabricName}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              <span className="font-medium">{so.embroidery?.designName}</span>
                            </div>
                            <div className="text-xs text-gray-500">{so.embroidery?.embroideryCode}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{so.supplier?.name || '-'}</td>
                          <td className="px-4 py-3 text-right font-medium">{so.quantitySent} m</td>
                          <td className="px-4 py-3 text-right">
                            {so.quantityReceived ? (
                              <span className="text-green-600">{so.quantityReceived} m</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">{getStatusBadge(so.status)}</td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {new Date(so.sendDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {so.expectedReturnDate ? (
                              <span
                                className={`flex items-center justify-center gap-1 ${isOverdue(so.expectedReturnDate, so.status) ? 'text-red-600 font-medium' : 'text-gray-700'}`}
                              >
                                {isOverdue(so.expectedReturnDate, so.status) && <AlertTriangle className="h-3 w-3" />}
                                {new Date(so.expectedReturnDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {so.status === 'SENT' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/embroidery-stock/receive/${so.id}`)}
                              >
                                Receive
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Embroidered Stock Tab */}
            <TabsContent value="stock">
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search fabric, design..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div></div>

                  <Button variant="outline" size="sm" onClick={handleExportStock}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Embroidered Stock Table */}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading stock...</p>
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No embroidered fabric stock found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Embroidered stock is created when you receive fabric back from embroidery
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Fabric</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Embroidery Design</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Quantity</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Width</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Quality</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Cost/m</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Total Value</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Location</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">For Style</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStock.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{stock.fabricMaster?.fabricCode}</div>
                            <div className="text-xs text-gray-500">{stock.fabricMaster?.fabricName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              <span className="font-medium text-purple-700">{stock.embroidery?.designName}</span>
                            </div>
                            <div className="text-xs text-gray-500">{stock.embroidery?.embroideryCode}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">
                            {stock.quantityAvailable.toFixed(2)} m
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{stock.width}"</td>
                          <td className="px-4 py-3 text-center">{getQualityBadge(stock.qualityGrade)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatCurrency(stock.weightedAvgCost)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(stock.quantityAvailable * stock.weightedAvgCost)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{stock.warehouseLocation || '-'}</td>
                          <td className="px-4 py-3">
                            {stock.forStyle ? (
                              <Link
                                to={`/styles/${stock.forStyle.id}`}
                                className="text-blue-600 hover:underline text-xs"
                              >
                                {stock.forStyle.styleCode}
                              </Link>
                            ) : (
                              <span className="text-gray-400 text-xs">Generic</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
